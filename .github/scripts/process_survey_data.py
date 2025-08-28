import pandas as pd
import json
import gspread
import os
import requests
from collections import Counter
import re
from oauth2client.service_account import ServiceAccountCredentials

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

def clean_with_llm(text, question_type):
    """Use Groq API to clean and categorize responses"""
    api_key = os.environ.get('GROQ_API_KEY')
    if not api_key:
        return text.lower().strip()
    
    prompts = {
        'fruit': f"""Standardize this fruit name: '{text}'
Return only the common English fruit name (e.g., "Apple", "Mango", "Strawberry").
Examples: "The humble Apple" → "Apple", "litchi" → "Lychee", "D'Anjou Pear" → "Pear"
Answer:""",

        'trader_joes': f"""Categorize this Trader Joe's item: '{text}'
If it's "idk" or "don't shop there" or similar → "Don't Shop There"
If it's a specific product → keep the main product name clean and short
Examples: "Ube Mochi Ice Cream" → "Ube Mochi Ice Cream", "idk" → "Don't Shop There"
Answer:""",

        'plane_drink': f"""Standardize this airplane drink: '{text}'
Common options: Water, Coffee, Tea, Soda, Juice, Alcohol, Other
Examples: "bottled water"/"worter" → "Water", "diet coke"/"coke zero" → "Soda", "orange juice" → "Juice"
Answer:""",

        'potato': f"""Categorize this fried potato: '{text}'
Return one of: French Fries, Curly Fries, Waffle Fries, Tater Tots, Hash Browns, Potato Chips, Other
Examples: "Standard french fry" → "French Fries", "Crinkle cut fries" → "French Fries", "Latkes" → "Hash Browns"
Answer:""",

        'pasta': f"""Standardize this pasta shape: '{text}'
Common shapes: Penne, Shells, Fusilli, Rigatoni, Macaroni, Spaghetti, Other
Examples: "Fusilli (spirally ones)" → "Fusilli", "shells" → "Shells"
Answer:"""
    }
    
    if question_type not in prompts:
        return text.lower().strip()
    
    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "mixtral-8x7b-32768",
                "messages": [{"role": "user", "content": prompts[question_type]}],
                "temperature": 0.1,
                "max_tokens": 30
            },
            timeout=10
        )
        
        if response.status_code == 200:
            cleaned = response.json()['choices'][0]['message']['content'].strip()
            # Remove "Answer:" if the model includes it
            cleaned = cleaned.replace("Answer:", "").strip()
            return cleaned
        else:
            return text.lower().strip()
            
    except Exception as e:
        print(f"LLM cleaning failed for '{text}': {e}")
        return text.lower().strip()

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

def process_survey_data():
    """Main function to process survey data"""
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
    
    stats = {}
    
    # Process fruits (LLM cleaned)
    fruits = []
    for fruit in df['fruit']:
        if pd.notna(fruit) and fruit != '':
            cleaned = clean_with_llm(str(fruit), 'fruit')
            fruits.append(cleaned)
    stats['fruits'] = dict(Counter(fruits))
    
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
    
    # Process Trader Joe's items (LLM cleaned)
    trader_joes = []
    for item in df['trader_joes']:
        if pd.notna(item) and item != '':
            cleaned = clean_with_llm(str(item), 'trader_joes')
            trader_joes.append(cleaned)
    stats['trader_joes'] = dict(Counter(trader_joes))
    
    # Process plane drinks (LLM cleaned)
    plane_drinks = []
    for drink in df['plane_drink']:
        if pd.notna(drink) and drink != '':
            cleaned = clean_with_llm(str(drink), 'plane_drink')
            plane_drinks.append(cleaned)
    stats['plane_drinks'] = dict(Counter(plane_drinks))
    
    # Process potatoes (LLM cleaned)
    potatoes = []
    for potato in df['potato']:
        if pd.notna(potato) and potato != '':
            cleaned = clean_with_llm(str(potato), 'potato')
            potatoes.append(cleaned)
    stats['potatoes'] = dict(Counter(potatoes))
    
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
    
    # Process pasta shapes (LLM cleaned)
    pasta_shapes = []
    for pasta in df['pasta_shape']:
        if pd.notna(pasta) and pasta != '':
            cleaned = clean_with_llm(str(pasta), 'pasta')
            pasta_shapes.append(cleaned)
    stats['pasta_shapes'] = dict(Counter(pasta_shapes))
    
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
        'last_updated': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S UTC')
    }
    
    # Save to JSON file
    os.makedirs('data', exist_ok=True)
    with open('data/survey-stats.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"Processed {len(df)} responses successfully!")
    print(f"LLM cleaned: {len(fruits)} fruits, {len(trader_joes)} Trader Joe's items, {len(plane_drinks)} drinks, {len(potatoes)} potatoes, {len(pasta_shapes)} pasta shapes")

if __name__ == "__main__":
    process_survey_data()