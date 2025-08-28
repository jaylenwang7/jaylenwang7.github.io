import pandas as pd
import json
import gspread
import os
import requests
import time
import hashlib
from collections import Counter, defaultdict
import re
from oauth2client.service_account import ServiceAccountCredentials
import argparse
from datetime import datetime
import pytz

def setup_google_sheets():
    """Setup Google Sheets API connection"""
    scope = ['https://spreadsheets.google.com/feeds',
             'https://www.googleapis.com/auth/drive']
    
    # Load credentials from GitHub secret
    creds_json = json.loads(os.environ['GOOGLE_SHEETS_CREDENTIALS'])
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_json, scope)
    client = gspread.authorize(creds)
    
    spreadsheet_id = os.environ['SPREADSHEET_ID']
    return client.open_by_key(spreadsheet_id).sheet1

def load_cache():
    """Load the cache of processed rows"""
    cache_file = 'data/processing_cache.json'
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                return json.load(f)
        except:
            print("Warning: Could not load cache file, starting fresh")
            return {'row_hashes': {}, 'cleaned_values': {}}
    return {'row_hashes': {}, 'cleaned_values': {}}

def save_cache(cache):
    """Save the cache of processed rows"""
    os.makedirs('data', exist_ok=True)
    with open('data/processing_cache.json', 'w') as f:
        json.dump(cache, f, indent=2)

def get_row_hash(row_data):
    """Generate a hash for a row to detect changes"""
    # Create a string representation of the row data for relevant columns
    relevant_data = {
        'fruit': str(row_data.get('fruit', '')),
        'trader_joes': str(row_data.get('trader_joes', '')),
        'plane_drink': str(row_data.get('plane_drink', '')),
        'potato': str(row_data.get('potato', '')),
        'pasta_shape': str(row_data.get('pasta_shape', ''))
    }
    row_str = json.dumps(relevant_data, sort_keys=True)
    return hashlib.md5(row_str.encode()).hexdigest()

class LLMBatcher:
    """Batch LLM requests to respect rate limits and process multiple items at once"""
    
    def __init__(self, requests_per_minute=25, batch_size=8):  # Reduced batch size
        self.requests_per_minute = requests_per_minute
        self.batch_size = batch_size
        self.request_times = []
        self.cache = {}
        
    def _wait_for_rate_limit(self):
        """Wait if we're hitting rate limits"""
        now = time.time()
        # Remove requests older than 1 minute
        self.request_times = [t for t in self.request_times if now - t < 60]
        
        if len(self.request_times) >= self.requests_per_minute:
            # Need to wait until the oldest request is over a minute old
            wait_time = 61 - (now - self.request_times[0])
            if wait_time > 0:
                print(f"Rate limit reached, waiting {wait_time:.1f} seconds...")
                time.sleep(wait_time)
                self._wait_for_rate_limit()  # Recursive call to check again
    
    def clean_batch_with_llm(self, texts, question_type, force_api=False):
        """Process a batch of texts with a single API call"""
        if not texts:
            return []
        
        # Check cache for all items first (unless forcing API calls)
        cached_results = {}
        uncached_texts = []
        uncached_indices = []
        
        for i, text in enumerate(texts):
            cache_key = f"{question_type}:{text}"
            if not force_api and cache_key in self.cache:
                cached_results[i] = self.cache[cache_key]
                print(f"  CACHE HIT: {question_type} '{text[:50]}...' -> '{self.cache[cache_key]}'")
            else:
                uncached_texts.append(text)
                uncached_indices.append(i)
                if force_api:
                    print(f"  CACHE SKIP (forced): {question_type} '{text[:50]}...'")
                else:
                    print(f"  CACHE MISS: {question_type} '{text[:50]}...'")
        
        print(f"  Batch summary: {len(cached_results)} cached, {len(uncached_texts)} need processing")
        
        # If all items are cached, return cached results
        if not uncached_texts:
            return [cached_results[i] for i in range(len(texts))]
        
        api_key = os.environ.get('GROQ_API_KEY')
        if not api_key:
            print("No GROQ_API_KEY found, using fallback cleaning")
            fallback_results = [fallback_clean(text, question_type) for text in uncached_texts]
            # Cache fallback results
            for i, text in enumerate(uncached_texts):
                cache_key = f"{question_type}:{text}"
                self.cache[cache_key] = fallback_results[i]
                print(f"    FALLBACK CACHED: '{text[:50]}...' -> '{fallback_results[i]}'")
            
            # Merge cached and fallback results
            final_results = [None] * len(texts)
            for i, result in cached_results.items():
                final_results[i] = result
            for i, idx in enumerate(uncached_indices):
                final_results[idx] = fallback_results[i]
            return final_results
        
        prompts = {
            'fruit': f"""You are cleaning survey data for data visualization. Convert these fruit responses to clean, singular fruit names suitable for charts.

RULES:
- Return exactly {len(uncached_texts)} items in the same order
- One fruit name per response (no combinations like "apple and banana")
- Singular form only ("Apple" not "Apples")  
- Remove all parentheses, explanations, and extra text
- Standard fruit names only (e.g., "Litchi" → "Lychee")
- PROPER CAPITALIZATION: Title Case (e.g., "apple" → "Apple", "d'anjou pear" → "Pear")

Input: {json.dumps(uncached_texts)}

Return clean JSON array for graphing: """,

            'trader_joes': f"""You are cleaning survey data for charts. Clean these Trader Joe's product responses.

RULES:
- Return exactly {len(uncached_texts)} items in the same order
- "idk", "don't know", "don't shop there" → "SKIP" 
- Remove parentheses and descriptions (e.g., "(the one without skin)" → remove)
- Simple product names only for chart labels
- No URLs - extract product name from links
- PROPER CAPITALIZATION: Title Case Each Word (e.g., "chocolate pb cups" → "Chocolate Peanut Butter Cups")

Input: {json.dumps(uncached_texts)}

Return clean JSON array for graphing: """,

            'plane_drink': f"""You are cleaning survey data for charts. Convert these airplane drink responses to simple drink names.

RULES:
- Return exactly {len(uncached_texts)} items in the same order
- If multiple drinks mentioned (e.g., "tomato juice or ginger ale"), pick the FIRST one only
- Remove all explanations and parentheses (e.g., "(only on American Airlines)" → remove)
- Simple drink names for chart labels (e.g., "Diet Dr Pepper" not "Diet Dr. Pepper (Only Available...)")
- "Nothing - I don't trust it" → "Nothing"
- PROPER CAPITALIZATION: Title Case (e.g., "diet coke" → "Diet Coke", "orange juice" → "Orange Juice")

Input: {json.dumps(uncached_texts)}

Return clean JSON array for graphing: """,

            'potato': f"""You are cleaning survey data for charts. Categorize these fried potato responses into simple categories.

RULES:
- Return exactly {len(uncached_texts)} items in the same order
- Use standard categories: French Fries, Curly Fries, Waffle Fries, Tater Tots, Hash Browns, Potato Chips
- For unique items, create simple category names (e.g., "Latkes")
- Remove descriptions and explanations
- "all the above" → "Mixed"
- PROPER CAPITALIZATION: Title Case (e.g., "hash browns" → "Hash Browns", "french fries" → "French Fries")

Input: {json.dumps(uncached_texts)}

Return clean JSON array for graphing: """,

            'pasta': f"""You are cleaning survey data for charts. Convert these pasta responses to standard pasta shape names.

RULES:
- Return exactly {len(uncached_texts)} items in the same order
- Standard pasta names only (Penne, Shells, Fusilli, Rigatoni, etc.)
- Remove descriptions (e.g., "(spirally ones)" → remove)
- Simple names for chart labels
- PROPER CAPITALIZATION: Title Case (e.g., "penne" → "Penne", "macaroni" → "Macaroni")

Input: {json.dumps(uncached_texts)}

Return clean JSON array for graphing: """
        }
        
        if question_type not in prompts:
            fallback_results = [fallback_clean(text, question_type) for text in uncached_texts]
            # Cache results
            for i, text in enumerate(uncached_texts):
                cache_key = f"{question_type}:{text}"
                self.cache[cache_key] = fallback_results[i]
            
            # Merge results
            final_results = [None] * len(texts)
            for i, result in cached_results.items():
                final_results[i] = result
            for i, idx in enumerate(uncached_indices):
                final_results[idx] = fallback_results[i]
            return final_results
        
        try:
            # Wait for rate limit before making request
            self._wait_for_rate_limit()
            
            models_to_try = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"]
            
            for model in models_to_try:
                try:
                    # Record the request time
                    self.request_times.append(time.time())
                    
                    response = requests.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model,
                            "messages": [{"role": "user", "content": prompts[question_type]}],
                            "temperature": 0.0,
                            "max_tokens": 500  # Increased for batch responses
                        },
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        response_text = response.json()['choices'][0]['message']['content'].strip()
                        
                        print(f"    RAW LLM RESPONSE ({model}):")
                        print(f"    " + "="*80)
                        print(f"    {response_text}")
                        print(f"    " + "="*80)
                        
                        # Parse JSON response with multiple attempts
                        try:
                            # Clean response text - remove any prefixes/suffixes
                            original_response = response_text
                            if '```json' in response_text:
                                response_text = response_text.split('```json')[1].split('```')[0].strip()
                            elif '```' in response_text:
                                response_text = response_text.split('```')[1].split('```')[0].strip()
                            
                            # Try multiple JSON extraction methods
                            json_attempts = []
                            
                            # Method 1: Find JSON array brackets
                            start_idx = response_text.find('[')
                            end_idx = response_text.rfind(']') + 1
                            if start_idx != -1 and end_idx != 0:
                                json_attempts.append(response_text[start_idx:end_idx])
                            
                            # Method 2: Try the whole response if no brackets found
                            if not json_attempts:
                                json_attempts.append(response_text.strip())
                            
                            # Method 3: Look for arrays in the original response
                            if '[' in original_response and ']' in original_response:
                                start_orig = original_response.find('[')
                                end_orig = original_response.rfind(']') + 1
                                json_attempts.append(original_response[start_orig:end_orig])
                            
                            cleaned_batch = None
                            for attempt_idx, json_str in enumerate(json_attempts):
                                try:
                                    cleaned_batch = json.loads(json_str)
                                    print(f"    JSON parsed successfully on attempt {attempt_idx + 1}")
                                    break
                                except json.JSONDecodeError as e:
                                    print(f"    JSON attempt {attempt_idx + 1} failed: {e}")
                                    continue
                            
                            if cleaned_batch is None:
                                print(f"    All JSON parsing attempts failed")
                                print(f"    Original response: {original_response[:200]}...")
                                continue
                                
                            if len(cleaned_batch) == len(uncached_texts):
                                print(f"    ✅ API SUCCESS: Processed {len(uncached_texts)} {question_type} items")
                                print(f"    INPUT->OUTPUT MAPPING:")
                                for i in range(min(5, len(uncached_texts))):  # Show first 5 mappings
                                    print(f"      '{uncached_texts[i][:40]}...' -> '{cleaned_batch[i]}'")
                                if len(uncached_texts) > 5:
                                    print(f"      ... and {len(uncached_texts) - 5} more")
                                
                                # Cache individual results
                                for i, text in enumerate(uncached_texts):
                                    cache_key = f"{question_type}:{text}"
                                    self.cache[cache_key] = cleaned_batch[i]
                                
                                # Merge cached and new results
                                final_results = [None] * len(texts)
                                for i, result in cached_results.items():
                                    final_results[i] = result
                                for i, idx in enumerate(uncached_indices):
                                    final_results[idx] = cleaned_batch[i]
                                
                                return final_results
                            else:
                                print(f"    ❌ LENGTH MISMATCH: expected {len(uncached_texts)}, got {len(cleaned_batch)}")
                                print(f"    INPUT ({len(uncached_texts)} items): {[t[:20]+'...' for t in uncached_texts]}")
                                print(f"    OUTPUT ({len(cleaned_batch)} items): {cleaned_batch}")
                                print(f"    PROBLEM: LLM returned different number of items than input")
                                continue
                                
                        except json.JSONDecodeError as e:
                            print(f"JSON parsing failed: {e}")
                            print(f"Response text: {response_text[:200]}...")
                            continue
                            
                    elif response.status_code == 429:
                        print(f"Rate limited on {model}, waiting and trying next model...")
                        time.sleep(2)
                        continue
                    else:
                        print(f"API error {response.status_code} on {model}: {response.text}")
                        continue
                        
                except Exception as e:
                    print(f"Model {model} failed: {e}")
                    continue
            
            # If all API attempts failed, use fallback
            print(f"All LLM attempts failed for batch of {len(uncached_texts)} items, using fallback")
            fallback_results = [fallback_clean(text, question_type) for text in uncached_texts]
            
            # Cache fallback results
            for i, text in enumerate(uncached_texts):
                cache_key = f"{question_type}:{text}"
                self.cache[cache_key] = fallback_results[i]
            
            # Merge results
            final_results = [None] * len(texts)
            for i, result in cached_results.items():
                final_results[i] = result
            for i, idx in enumerate(uncached_indices):
                final_results[idx] = fallback_results[i]
            return final_results
                
        except Exception as e:
            print(f"Batch LLM cleaning failed: {e}")
            fallback_results = [fallback_clean(text, question_type) for text in uncached_texts]
            
            # Cache fallback results
            for i, text in enumerate(uncached_texts):
                cache_key = f"{question_type}:{text}"
                self.cache[cache_key] = fallback_results[i]
            
            # Merge results
            final_results = [None] * len(texts)
            for i, result in cached_results.items():
                final_results[i] = result
            for i, idx in enumerate(uncached_indices):
                final_results[idx] = fallback_results[i]
            return final_results

    def process_all_items(self, df, force_api=False):
        """Process all survey items by question type in batches"""
        results = {
            'fruits': [],
            'trader_joes': [],
            'plane_drinks': [],
            'potatoes': [],
            'pasta_shapes': []
        }
        
        # Collect all items by type
        items_by_type = {
            'fruit': [],
            'trader_joes': [],
            'plane_drink': [],
            'potato': [],
            'pasta': []
        }
        
        # Build lists of items to process
        for index, row in df.iterrows():
            if pd.notna(row['fruit']) and row['fruit'] != '':
                items_by_type['fruit'].append(str(row['fruit']))
            if pd.notna(row['trader_joes']) and row['trader_joes'] != '':
                items_by_type['trader_joes'].append(str(row['trader_joes']))
            if pd.notna(row['plane_drink']) and row['plane_drink'] != '':
                items_by_type['plane_drink'].append(str(row['plane_drink']))
            if pd.notna(row['potato']) and row['potato'] != '':
                items_by_type['potato'].append(str(row['potato']))
            if pd.notna(row['pasta_shape']) and row['pasta_shape'] != '':
                items_by_type['pasta'].append(str(row['pasta_shape']))
        
        # Process each type in batches
        for question_type, items in items_by_type.items():
            if not items:
                continue
                
            print(f"\n=== Processing {len(items)} {question_type} items ===")
            
            # Process in batches
            all_results = []
            for i in range(0, len(items), self.batch_size):
                batch = items[i:i + self.batch_size]
                print(f"  Batch {i//self.batch_size + 1}: Processing items {i+1}-{min(i+self.batch_size, len(items))}")
                batch_results = self.clean_batch_with_llm(batch, question_type, force_api)
                all_results.extend(batch_results)
            
            # Store results
            if question_type == 'fruit':
                results['fruits'] = all_results
            elif question_type == 'trader_joes':
                results['trader_joes'] = [r for r in all_results if r != "SKIP"]
            elif question_type == 'plane_drink':
                results['plane_drinks'] = all_results
            elif question_type == 'potato':
                results['potatoes'] = all_results
            elif question_type == 'pasta':
                results['pasta_shapes'] = all_results
        
        return results

def fallback_clean(text, question_type):
    """Fallback cleaning when LLM is unavailable"""
    text = str(text).strip()
    
    if question_type == 'fruit':
        # Basic fruit cleaning
        text = re.sub(r'\([^)]*\)', '', text)  # Remove parentheses
        text = re.sub(r'^the ', '', text, flags=re.IGNORECASE)  # Remove "the"
        text = text.split(',')[0].strip()  # Take first word if comma-separated
        
        # Convert to singular form
        singular_mappings = {
            'apples': 'Apple',
            'strawberries': 'Strawberry', 
            'cherries': 'Cherry',
            'grapes': 'Grape',
            'peaches': 'Peach',
            'mangoes': 'Mango',
            'litchi': 'Lychee',
            'lychees': 'Lychee',
            'd\'anjou pear': 'Pear', 
            'golden kiwi': 'Kiwi',
            'black cherry': 'Cherry',
            'humble apple': 'Apple'
        }
        
        text_lower = text.lower().strip()
        for key, value in singular_mappings.items():
            if key == text_lower or key in text_lower:
                return value
        
        # General plural to singular conversion
        if text_lower.endswith('ies'):
            return text[:-3] + 'y'
        elif text_lower.endswith('s') and len(text) > 3:
            return text[:-1].title()
            
        return text.title()
        
    elif question_type == 'trader_joes':
        if any(phrase in text.lower() for phrase in ['idk', 'don\'t shop', 'don\'t know']):
            return "SKIP"
        
        # Clean up common abbreviations and improve formatting
        text = re.sub(r'\([^)]*\)', '', text)  # Remove parentheses content
        text = re.sub(r'^the ', '', text, flags=re.IGNORECASE)  # Remove "the" prefix
        
        # Common Trader Joe's abbreviation expansions
        expansions = {
            ' pb ': ' Peanut Butter ',
            'pb ': 'Peanut Butter ',
            ' tj': ' Trader Joe\'s',
            'choc': 'Chocolate'
        }
        
        text_lower = text.lower()
        for abbrev, expansion in expansions.items():
            if abbrev in text_lower:
                text = re.sub(re.escape(abbrev), expansion, text, flags=re.IGNORECASE)
        
        return text.strip().title()
        
    elif question_type == 'plane_drink':
        text_lower = text.lower().strip()
        
        # Keep specific drink names, don't over-categorize
        if any(word in text_lower for word in ['water', 'worter']) and 'sparkling' not in text_lower:
            return 'Water'
        elif 'sparkling water' in text_lower or 'sparking water' in text_lower:
            return 'Sparkling Water'
        elif 'diet dr pepper' in text_lower or 'diet dr. pepper' in text_lower:
            return 'Diet Dr Pepper'
        elif 'diet coke' in text_lower:
            return 'Diet Coke'
        elif 'ginger ale' in text_lower:
            return 'Ginger Ale' 
        elif 'sprite' in text_lower:
            return 'Sprite'
        elif 'orange juice' in text_lower:
            return 'Orange Juice'
        elif 'apple juice' in text_lower:
            return 'Apple Juice'
        elif 'cranberry juice' in text_lower:
            return 'Cranberry Juice'
        elif 'mango juice' in text_lower:
            return 'Mango Juice'
        elif 'tomato juice' in text_lower:
            return 'Tomato Juice'
        elif 'coffee' in text_lower:
            return 'Coffee'
        elif 'iced tea' in text_lower:
            return 'Iced Tea'
        elif 'tea' in text_lower:
            return 'Tea'
        elif any(phrase in text_lower for phrase in ['nothing', 'don\'t trust']):
            return 'Nothing'
        elif 'juice' in text_lower:
            return 'Juice'
        elif any(word in text_lower for word in ['coke', 'pepsi', 'soda']):
            return 'Soda'
        return text.title()
        
    elif question_type == 'potato':
        text_lower = text.lower()
        if 'curly' in text_lower:
            return 'Curly Fries'
        elif 'waffle' in text_lower:
            return 'Waffle Fries'
        elif any(word in text_lower for word in ['tater tot', 'tot']):
            return 'Tater Tots'
        elif 'hash brown' in text_lower:
            return 'Hash Browns'
        elif 'latke' in text_lower:
            return 'Latkes'  # Let latkes be their own category
        elif any(word in text_lower for word in ['chip', 'crisp']):
            return 'Potato Chips'
        elif any(word in text_lower for word in ['fries', 'fry', 'french']) and 'curly' not in text_lower and 'waffle' not in text_lower:
            return 'French Fries'
        elif 'all the above' in text_lower or 'all of the above' in text_lower:
            return 'Other'
        elif len(text.strip()) > 50:  # Long descriptions probably don't fit standard categories
            return 'Other'
        else:
            # For short, specific items that don't match common categories, keep them as-is
            return text.title()
        
    elif question_type == 'pasta':
        text_lower = text.lower()
        # Common pasta shape mappings
        pasta_mappings = {
            'shell': 'Shells',
            'fusilli': 'Fusilli', 
            'spiral': 'Fusilli',
            'penne': 'Penne',
            'rigatoni': 'Rigatoni', 
            'macaroni': 'Macaroni',
            'spaghetti': 'Spaghetti',
            'linguine': 'Linguine',
            'farfalle': 'Farfalle',
            'bow tie': 'Farfalle',
            'bowtie': 'Farfalle',
            'angel hair': 'Angel Hair',
            'fettuccine': 'Fettuccine',
            'lasagna': 'Lasagna',
            'ravioli': 'Ravioli',
            'tortellini': 'Tortellini'
        }
        
        for key, value in pasta_mappings.items():
            if key in text_lower:
                return value
        
        # If no match found, return cleaned version of original
        return text.title()
    
    return text.strip()

def extract_number(text):
    """Extract numeric value from egg responses"""
    if pd.isna(text) or text == '':
        return None
    
    text_str = str(text).lower().strip()
    
    # Handle explicit zero cases
    if any(phrase in text_str for phrase in ['don\'t eat eggs', 'i don\'t eat eggs', 'zero', 'none']):
        return 0
    
    if text_str == '0':
        return 0
    
    # Handle range responses (take the average)
    if '-' in text_str and any(char.isdigit() for char in text_str):
        numbers = re.findall(r'\d+', text_str)
        if len(numbers) >= 2:
            return int((int(numbers[0]) + int(numbers[1])) / 2)
    
    # Extract first number found
    numbers = re.findall(r'\d+', text_str)
    if numbers:
        # Take the first number, but handle special cases
        first_num = int(numbers[0])
        # If someone wrote something like "Maybe 10", trust the number
        return first_num
    
    return None

def process_survey_data(force_reprocess=False):
    """Main function to process survey data with caching"""
    print(f"Starting processing (force_reprocess={force_reprocess})")
    
    # Load cache
    cache = load_cache()
    
    # Initialize LLM batcher with smaller batch size for better reliability
    llm_batcher = LLMBatcher(batch_size=8)
    
    # Load any cached LLM results into the batcher's cache (unless force reprocessing)
    if 'llm_cache' in cache and not force_reprocess:
        llm_batcher.cache = cache['llm_cache']
        print(f"Loaded {len(llm_batcher.cache)} cached LLM results")
    elif force_reprocess:
        print("Force reprocessing enabled - clearing LLM cache")
    
    # Load data from Google Sheets
    sheet = setup_google_sheets()
    data = sheet.get_all_records()
    df = pd.DataFrame(data)
    
    # Debug: Print actual columns and their count
    print(f"Actual columns ({len(df.columns)}): {list(df.columns)}")
    
    # Expected column names
    expected_columns = ['timestamp', 'fruit', 'grapes', 'eggs', 'sandwich', 
                       'trader_joes', 'plane_drink', 'potato', 'taco_shell', 
                       'toast_level', 'pasta_shape', 'feedback']
    
    print(f"Expected columns ({len(expected_columns)}): {expected_columns}")
    
    # Handle column count mismatch more gracefully
    if len(df.columns) != len(expected_columns):
        print(f"Warning: Column count mismatch. Expected {len(expected_columns)}, got {len(df.columns)}")
        print("Using original column names from sheet")
        # Map columns by position instead of reassigning all names
        if len(df.columns) >= len(expected_columns):
            # If we have extra columns, just use the first ones we need
            column_mapping = {}
            for i, expected_col in enumerate(expected_columns):
                if i < len(df.columns):
                    column_mapping[df.columns[i]] = expected_col
            df = df.rename(columns=column_mapping)
        else:
            # If we have fewer columns than expected, this is a bigger problem
            raise ValueError(f"Sheet has fewer columns ({len(df.columns)}) than expected ({len(expected_columns)})")
    else:
        # Clean column names as originally intended
        df.columns = expected_columns
    
    # Ensure we have the columns we need for processing
    required_columns = ['fruit', 'grapes', 'eggs', 'sandwich', 'trader_joes', 
                       'plane_drink', 'potato', 'taco_shell', 'pasta_shape']
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    # Determine if we need to reprocess
    if force_reprocess:
        print("Force reprocessing all items - clearing row hashes")
        cache['row_hashes'] = {}  # Clear row hashes to force reprocessing
        rows_changed = True
    else:
        # Check if we need to reprocess by comparing data hashes
        rows_changed = False
        new_rows = 0
        changed_rows = 0
        unchanged_rows = 0
        
        print("\n=== Checking row-level cache ===")
        for index, row in df.iterrows():
            row_hash = get_row_hash(row)
            row_id = f"row_{index}"
            
            if row_id not in cache['row_hashes']:
                print(f"ROW {index}: NEW (not in cache)")
                rows_changed = True
                new_rows += 1
            elif cache['row_hashes'][row_id] != row_hash:
                print(f"ROW {index}: CHANGED (hash mismatch)")
                print(f"  Old hash: {cache['row_hashes'][row_id][:12]}...")
                print(f"  New hash: {row_hash[:12]}...")
                rows_changed = True
                changed_rows += 1
            else:
                print(f"ROW {index}: UNCHANGED (hash match)")
                unchanged_rows += 1
        
        print(f"Row summary: {new_rows} new, {changed_rows} changed, {unchanged_rows} unchanged")
        
        if not rows_changed:
            print("No row changes detected - could use cached results")
            # Note: We'll still process to demonstrate the text-level caching
    
    print("Processing all items with batched API calls...")
    
    # Process all items using the new batching system
    llm_results = llm_batcher.process_all_items(df, force_api=force_reprocess)
    
    # Debug: Check what we got back
    print("\n=== RESULTS SUMMARY ===")
    for key, values in llm_results.items():
        print(f"{key}: {len(values)} items")
        if values:
            print(f"  Sample items: {values[:3]}")
            print(f"  Item types: {[type(v).__name__ for v in values[:3]]}")
    
    # Ensure all results are strings (not dicts or other types)
    for key in llm_results:
        cleaned_items = []
        for item in llm_results[key]:
            if isinstance(item, str):
                cleaned_items.append(item)
            elif isinstance(item, dict):
                print(f"WARNING: Found dict in {key} results: {item}")
                # Try to extract string value from dict
                if 'value' in item:
                    cleaned_items.append(str(item['value']))
                else:
                    cleaned_items.append(str(item))
            else:
                print(f"WARNING: Found {type(item)} in {key} results: {item}")
                cleaned_items.append(str(item))
        llm_results[key] = cleaned_items
    
    stats = {}
    stats['fruits'] = dict(Counter(llm_results['fruits']))
    stats['trader_joes'] = dict(Counter(llm_results['trader_joes']))
    stats['plane_drinks'] = dict(Counter(llm_results['plane_drinks']))
    stats['potatoes'] = dict(Counter(llm_results['potatoes']))
    stats['pasta_shapes'] = dict(Counter(llm_results['pasta_shapes']))
    
    # Process grapes (manual mapping - these are radio buttons)
    grape_mapping = {
        'green': 'Green',
        'red': 'Red', 
        'they\'re the same in my mind': 'No Preference',
        'same': 'No Preference'
    }
    grapes = []
    for grape in df['grapes']:
        if pd.notna(grape) and grape != '':
            mapped = grape_mapping.get(str(grape).lower().strip(), str(grape))
            grapes.append(mapped)
    stats['grapes'] = dict(Counter(grapes))
    
    # Process eggs (extract numbers from text)
    eggs = [extract_number(egg) for egg in df['eggs']]
    eggs = [e for e in eggs if e is not None]
    stats['eggs'] = {
        'data': eggs,
        'average': round(sum(eggs) / len(eggs), 1) if eggs else 0,
        'max': max(eggs) if eggs else 0,
        'min': min(eggs) if eggs else 0,
        'total_responses': len(eggs)
    }
    
    # Process sandwiches (these are radio buttons, no cleaning needed)
    sandwiches = [str(sandwich) for sandwich in df['sandwich'] 
                  if pd.notna(sandwich) and sandwich != '']
    stats['sandwiches'] = dict(Counter(sandwiches))
    
    # Process taco shells (these are radio buttons, manual mapping)
    taco_mapping = {
        'hard': 'Hard',
        'soft corn': 'Soft Corn',
        'soft flour': 'Soft Flour'
    }
    taco_shells = []
    for shell in df['taco_shell']:
        if pd.notna(shell) and shell != '':
            mapped = taco_mapping.get(str(shell).lower().strip(), str(shell))
            taco_shells.append(mapped)
    stats['taco_shells'] = dict(Counter(taco_shells))
    
    # Process toast level if it exists (optional processing)
    if 'toast_level' in df.columns:
        toast_levels = []
        for toast in df['toast_level']:
            if pd.notna(toast) and toast != '':
                toast_levels.append(str(toast))
        if toast_levels:
            stats['toast_levels'] = dict(Counter(toast_levels))
    
    # Update row hashes in cache
    for index, row in df.iterrows():
        row_hash = get_row_hash(row)
        row_id = f"row_{index}"
        cache['row_hashes'][row_id] = row_hash
    
    # Add general stats
    et_tz = pytz.timezone('US/Eastern')
    current_time_et = datetime.now(et_tz)
    
    stats['general'] = {
        'total_responses': len(df),
        'last_updated': current_time_et.strftime('%Y-%m-%d %H:%M:%S %Z'),
        'processing_info': f"Force reprocessed: {force_reprocess}, Cached items: {len(llm_batcher.cache)}"
    }
    
    # Save updated cache with LLM results
    cache['llm_cache'] = llm_batcher.cache
    save_cache(cache)
    
    # Save to JSON file
    os.makedirs('data', exist_ok=True)
    with open('data/survey-stats.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"Processed {len(df)} responses successfully!")
    print(f"Results: {len(llm_results['fruits'])} fruits, {len(llm_results['trader_joes'])} Trader Joe's items, {len(llm_results['plane_drinks'])} drinks, {len(llm_results['potatoes'])} potatoes, {len(llm_results['pasta_shapes'])} pasta shapes")
    print(f"Cache contains {len(llm_batcher.cache)} LLM results")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process survey data with caching')
    parser.add_argument('--force', action='store_true', 
                       help='Force reprocessing of all rows (ignore cache)')
    
    args = parser.parse_args()
    
    # Also check for environment variable (useful for GitHub Actions)
    force_reprocess = args.force or os.environ.get('FORCE_REPROCESS', '').lower() == 'true'
    
    process_survey_data(force_reprocess=force_reprocess)