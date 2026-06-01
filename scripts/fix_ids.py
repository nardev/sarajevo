import json

with open("_data/songs.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for i, entry in enumerate(data["entries"], start=1):
    entry["id"] = i

with open("_data/songs.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Fixed {len(data['entries'])} entries.")