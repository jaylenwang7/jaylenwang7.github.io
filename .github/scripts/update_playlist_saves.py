import requests
import base64
import json
import os
from datetime import datetime, timedelta
import pytz

def get_access_token(client_id, client_secret):
    auth_string = f"{client_id}:{client_secret}"
    auth_bytes = auth_string.encode("utf-8")
    auth_base64 = str(base64.b64encode(auth_bytes), "utf-8")

    url = "https://accounts.spotify.com/api/token"
    headers = {
        "Authorization": f"Basic {auth_base64}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {"grant_type": "client_credentials"}
    result = requests.post(url, headers=headers, data=data)
    json_result = json.loads(result.content)
    token = json_result["access_token"]
    return token

def get_playlist_saves(token, playlist_id):
    playlist_url = f"https://api.spotify.com/v1/playlists/{playlist_id}"
    headers = {"Authorization": f"Bearer {token}"}
    playlist_result = requests.get(playlist_url, headers=headers)
    playlist_json = json.loads(playlist_result.content)
    return playlist_json['followers']['total'], playlist_json['name']

def main():
    client_id = os.environ['CLIENT_ID']
    client_secret = os.environ['CLIENT_SECRET']
    playlist_id = os.environ['PLAYLIST_ID']

    token = get_access_token(client_id, client_secret)
    saves, playlist_name = get_playlist_saves(token, playlist_id)
    
    # Use Eastern Time
    eastern = pytz.timezone('US/Eastern')
    now = datetime.now(eastern)
    
    # Determine if it's EST or EDT
    is_dst = now.astimezone(eastern).dst() != timedelta(0)
    timezone_abbr = "EDT" if is_dst else "EST"
    
    # Format the timestamp without leading zero
    time_str = now.strftime('%I:%M%p').lower().lstrip('0')
    
    if now.date() == datetime.now(eastern).date():
        timestamp = f"today at {time_str} {timezone_abbr}"
    elif now.date() == (datetime.now(eastern) - timedelta(days=1)).date():
        timestamp = f"yesterday at {time_str} {timezone_abbr}"
    else:
        timestamp = now.strftime(f"%b %d at {time_str} {timezone_abbr}")
    
    # Maintain a 7-day history in a JSON file for client-side deltas
    data_dir = 'assets/data'
    json_path = os.path.join(data_dir, 'playlist_saves.json')
    history = []
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as jf:
                existing = json.load(jf)
                if isinstance(existing, dict):
                    history = existing.get('history', []) or []
        except Exception:
            history = []

    today_str = now.strftime('%Y-%m-%d')
    if history and isinstance(history[-1], dict) and history[-1].get('date') == today_str:
        history[-1]['saves'] = saves
    else:
        history.append({'date': today_str, 'saves': saves})
        if len(history) > 7:
            history = history[-7:]

    json_payload = {
        'saves': saves,
        'playlist_name': playlist_name,
        'last_updated': timestamp,
        'history': history,
    }
    with open(json_path, 'w') as jf:
        json.dump(json_payload, jf, indent=2)

    # Update the file path to a public location
    with open('assets/data/playlist_saves.yml', 'w') as f:
        f.write(f"saves: {saves}\n")
        f.write(f"playlist_name: '{playlist_name}'\n")
        f.write(f"last_updated: '{timestamp}'")
    print(f"Updated playlist '{playlist_name}' saves: {saves} as of {timestamp}")

if __name__ == "__main__":
    main()