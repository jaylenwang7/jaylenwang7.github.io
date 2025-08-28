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
    """Batch LLM requests to respect rate limits"""
    
    def __init__(self, requests_per_minute=25):  # Slightly under the 30 limit for safety
        self.requests_per_minute = requests_per_minute
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
    
    def clean_with_llm_batched(self, text, question_type, force_api=False):
        """Use Groq API with rate limiting and caching"""
        # Create cache key
        cache_key = f"{question_type}:{text}"
        
        # Check cache first (unless forcing API)
        if not force_api and cache_key in self.cache:
            return self.cache[cache_key]
        
        api_key = os.environ.get('GROQ_API_KEY')
        if not api_key:
            print("No GROQ_API_KEY found, using fallback cleaning")
            result = fallback_clean(text, question_type)
            self.cache[cache_key] = result
            return result
        
        prompts = {
            'fruit': f"""Clean this fruit name: "{text}"

Return ONLY the singular form of the fruit name in Title Case. Remove explanations, parentheses, and extra words. Always use singular form.

Examples:
- "The humble Apple" → Apple
- "blackberry (because it is tasty and healthy" → Blackberry  
- "d'anjou pear" → Pear
- "litchi" → Lychee
- "golden kiwi" → Kiwi
- "strawberries" → Strawberry
- "apples" → Apple
- "cherries" → Cherry

Answer with just the singular fruit name:""",

            'trader_joes': f"""Clean this Trader Joe's response: "{text}"

If it's "idk", "don't know", or "don't shop there" → return "SKIP"
Otherwise, return the product name cleanly formatted with proper capitalization and clear naming.
If a link is provided, extract the likely product name from the URL.

Examples:
- "idk" → SKIP
- "don't shop there" → SKIP
- "Ube Mochi Ice Cream" → Ube Mochi Ice Cream
- "chocolate pb cups" → Chocolate Peanut Butter Cups
- "burrata filling (the one without the skin in a flat looking container)" → Burrata Filling
- "scandinavian swimmers" → Scandinavian Swimmers
- "the lava cakes" → Lava Cakes

Clean product name:""",

            'plane_drink': f"""Clean this drink name: "{text}"

Keep specific drink names but clean them up. Only use broad categories for unclear responses.

Examples:
- "bottled water" → Water
- "worter" → Water  
- "diet dr. pepper (only available on american airlines; coke zero elsewhere)" → Diet Dr Pepper
- "diet coke" → Diet Coke
- "orange juice" → Orange Juice
- "ginger ale" → Ginger Ale
- "sprite" → Sprite
- "nothing - i don't trust it" → Nothing
- "sparking water" → Sparkling Water

Clean drink name:""",

            'potato': f"""Categorize this fried potato: "{text}"

Use one of these common categories if it fits well: French Fries, Curly Fries, Waffle Fries, Tater Tots, Hash Browns, Potato Chips

If it doesn't fit well into any of these, create an appropriate new category name (e.g., "Latkes" for latkes, "Rösti" for rösti, etc.)

Examples:
- "standard french fry" → French Fries
- "crinkle cut fries" → French Fries
- "latkes" → Latkes
- "parboil the potatoes first..." → Other
- "tater tot" → Tater Tots
- "rösti" → Rösti

Category:""",

            'pasta': f"""Standardize this pasta shape: "{text}"

Use one of these common shapes if it fits: Penne, Shells, Fusilli, Rigatoni, Macaroni, Spaghetti

If it's a different pasta shape, use the proper name for that shape (e.g., "Farfalle" for bow ties, "Linguine" for linguine, etc.)

Examples:
- "fusilli (spirally ones)" → Fusilli
- "shells" → Shells
- "bow ties" → Farfalle
- "linguine" → Linguine

Shape:"""
        }
        
        if question_type not in prompts:
            result = fallback_clean(text, question_type)
            self.cache[cache_key] = result
            return result
        
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
                            "max_tokens": 25
                        },
                        timeout=15
                    )
                    
                    if response.status_code == 200:
                        cleaned = response.json()['choices'][0]['message']['content'].strip()
                        
                        # Remove common prefixes the model might add
                        for prefix in ["Answer:", "Answer with just the singular fruit name:", "Clean drink name:", "Category:", "Shape:"]:
                            if cleaned.startswith(prefix):
                                cleaned = cleaned[len(prefix):].strip()
                        
                        # Remove quotes if present
                        cleaned = cleaned.strip('"\'')
                        
                        # Validate the response isn't empty
                        if cleaned and len(cleaned) > 0:
                            print(f"LLM ({model}) cleaned '{text}' → '{cleaned}'")
                            self.cache[cache_key] = cleaned
                            return cleaned
                            
                    elif response.status_code == 429:
                        print(f"Rate limited on {model}, waiting and trying next model...")
                        time.sleep(2)  # Brief wait before trying next model
                        continue
                    else:
                        print(f"API error {response.status_code} on {model}: {response.text}")
                        continue
                        
                except Exception as e:
                    print(f"Model {model} failed for '{text}': {e}")
                    continue
            
            # If all models failed, use fallback
            print(f"All LLM attempts failed for '{text}', using fallback")
            result = fallback_clean(text, question_type)
            self.cache[cache_key] = result
            return result
                
        except Exception as e:
            print(f"LLM cleaning failed for '{text}': {e}")
            result = fallback_clean(text, question_type)
            self.cache[cache_key] = result
            return result

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
    
    # Initialize LLM batcher
    llm_batcher = LLMBatcher()
    
    # Load any cached LLM results into the batcher's cache
    if 'llm_cache' in cache:
        llm_batcher.cache = cache['llm_cache']
        print(f"Loaded {len(llm_batcher.cache)} cached LLM results")
    
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
    
    # Determine which rows need processing
    rows_to_process = []
    new_rows = 0
    cached_rows = 0
    
    for index, row in df.iterrows():
        row_hash = get_row_hash(row)
        row_id = f"row_{index}"
        
        if force_reprocess or row_id not in cache['row_hashes'] or cache['row_hashes'][row_id] != row_hash:
            rows_to_process.append((index, row, row_hash, row_id))
            if row_id not in cache['row_hashes']:
                new_rows += 1
        else:
            cached_rows += 1
    
    print(f"Processing status: {new_rows} new rows, {len(rows_to_process) - new_rows} changed rows, {cached_rows} cached rows")
    print(f"Will process {len(rows_to_process)} total rows")
    
    if len(rows_to_process) > 50:
        estimated_time = len(rows_to_process) * 5 / 25  # 5 API calls per row, 25 per minute
        print(f"Estimated processing time: {estimated_time:.1f} minutes (due to rate limits)")
    
    stats = {}
    
    # Process rows that need updates
    for i, (index, row, row_hash, row_id) in enumerate(rows_to_process):
        if i % 10 == 0:
            print(f"Processing row {i+1}/{len(rows_to_process)}")
        
        # Update the cache with the new hash
        cache['row_hashes'][row_id] = row_hash
    
    # Collect all data for final stats (from both processed and cached rows)
    fruits = []
    trader_joes = []
    plane_drinks = []
    potatoes = []
    pasta_shapes = []
    
    for index, row in df.iterrows():
        row_id = f"row_{index}"
        
        # Process fruits (LLM cleaned)
        if pd.notna(row['fruit']) and row['fruit'] != '':
            cleaned = llm_batcher.clean_with_llm_batched(str(row['fruit']), 'fruit')
            fruits.append(cleaned)
        
        # Process Trader Joe's items (LLM cleaned, filter out non-responses)
        if pd.notna(row['trader_joes']) and row['trader_joes'] != '':
            cleaned = llm_batcher.clean_with_llm_batched(str(row['trader_joes']), 'trader_joes')
            if cleaned != "SKIP":  # Don't include "idk" or "don't shop there" responses
                trader_joes.append(cleaned)
        
        # Process plane drinks (LLM cleaned)
        if pd.notna(row['plane_drink']) and row['plane_drink'] != '':
            cleaned = llm_batcher.clean_with_llm_batched(str(row['plane_drink']), 'plane_drink')
            plane_drinks.append(cleaned)
        
        # Process potatoes (LLM cleaned)
        if pd.notna(row['potato']) and row['potato'] != '':
            cleaned = llm_batcher.clean_with_llm_batched(str(row['potato']), 'potato')
            potatoes.append(cleaned)
        
        # Process pasta shapes (LLM cleaned)
        if pd.notna(row['pasta_shape']) and row['pasta_shape'] != '':
            cleaned = llm_batcher.clean_with_llm_batched(str(row['pasta_shape']), 'pasta')
            pasta_shapes.append(cleaned)
    
    stats['fruits'] = dict(Counter(fruits))
    stats['trader_joes'] = dict(Counter(trader_joes))
    stats['plane_drinks'] = dict(Counter(plane_drinks))
    stats['potatoes'] = dict(Counter(potatoes))
    stats['pasta_shapes'] = dict(Counter(pasta_shapes))
    
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
    
    # Add general stats
    stats['general'] = {
        'total_responses': len(df),
        'last_updated': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
        'new_rows_processed': new_rows,
        'total_rows_processed': len(rows_to_process),
        'cached_rows': cached_rows
    }
    
    # Save updated cache with LLM results
    cache['llm_cache'] = llm_batcher.cache
    save_cache(cache)
    
    # Save to JSON file
    os.makedirs('data', exist_ok=True)
    with open('data/survey-stats.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"Processed {len(df)} responses successfully!")
    print(f"LLM cleaned: {len(fruits)} fruits, {len(trader_joes)} Trader Joe's items, {len(plane_drinks)} drinks, {len(potatoes)} potatoes, {len(pasta_shapes)} pasta shapes")
    print(f"Cache contains {len(llm_batcher.cache)} LLM results")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process survey data with caching')
    parser.add_argument('--force', action='store_true', 
                       help='Force reprocessing of all rows (ignore cache)')
    
    args = parser.parse_args()
    
    # Also check for environment variable (useful for GitHub Actions)
    force_reprocess = args.force or os.environ.get('FORCE_REPROCESS', '').lower() == 'true'
    
    process_survey_data(force_reprocess=force_reprocess)