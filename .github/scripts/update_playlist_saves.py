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
    
    # Format the timestamp
    time_str = now.strftime('%I:%M%p').lower()  # This will give us "2:30pm" format
    if now.date() == datetime.now(eastern).date():
        timestamp = f"today as of {time_str} {timezone_abbr}"
    elif now.date() == (datetime.now(eastern) - timedelta(days=1)).date():
        timestamp = f"yesterday as of {time_str} {timezone_abbr}"
    else:
        timestamp = now.strftime(f"%b %d at {time_str} {timezone_abbr}")
    
    # Update the file path to a public location
    with open('assets/data/playlist_saves.yml', 'w') as f:
        f.write(f"saves: {saves}\n")
        f.write(f"playlist_name: '{playlist_name}'\n")
        f.write(f"last_updated: '{timestamp}'")
    print(f"Updated playlist '{playlist_name}' saves: {saves} as of {timestamp}")

if __name__ == "__main__":
    main()