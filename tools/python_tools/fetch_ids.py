import json
import requests

CONTENT_URL = "https://uc-merced-campus-event-api-backend.onrender.com/contentAPIURL"

response = requests.get(CONTENT_URL, timeout=30)
response.raise_for_status()

data = response.json()

ids = [
    page["id"]
    for page in data.get("pages", [])
    if page.get("id")
]

print(f"Found {len(ids)} IDs")

for item_id in ids:
    print(item_id)

# Optional: save them
with open("page_ids.json", "w") as f:
    json.dump(ids, f, indent=2)