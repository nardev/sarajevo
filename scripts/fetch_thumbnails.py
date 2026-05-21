#!/usr/bin/env python3
"""
Fetch YouTube thumbnails for all songs in _data/songs.json.
Saves cropped 256x256 covers to assets/img/covers/{id}.jpg.

Usage:
    python3 fetch_thumbnails.py            # fetch all missing
    python3 fetch_thumbnails.py --force    # re-download everything
    python3 fetch_thumbnails.py --id 42    # single entry by id
"""

import sys
import subprocess
import importlib
import argparse
import json
import re
import urllib.parse
from pathlib import Path

import requests
from PIL import Image
from io import BytesIO

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SONGS_FILE   = PROJECT_ROOT / "_data" / "songs.json"
COVERS_DIR   = PROJECT_ROOT / "_site" / "assets" / "img" / "covers"
THUMB_SIZE  = 256
QUALITY     = 88

THUMB_URLS = [
    "https://img.youtube.com/vi/{vid}/maxresdefault.jpg",
    "https://img.youtube.com/vi/{vid}/sddefault.jpg",
    "https://img.youtube.com/vi/{vid}/hqdefault.jpg",
    "https://img.youtube.com/vi/{vid}/mqdefault.jpg",
]


def extract_video_id(url: str) -> str | None:
    if not url:
        return None
    parsed = urllib.parse.urlparse(url)
    if "youtu.be" in parsed.netloc:
        return parsed.path.lstrip("/")
    qs = urllib.parse.parse_qs(parsed.query)
    ids = qs.get("v")
    return ids[0] if ids else None


def fetch_thumbnail(video_id: str) -> Image.Image | None:
    for template in THUMB_URLS:
        url = template.format(vid=video_id)
        try:
            r = requests.get(url, timeout=10)
            if r.status_code == 200 and len(r.content) > 5000:
                return Image.open(BytesIO(r.content)).convert("RGB")
        except Exception:
            continue
    return None


def crop_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top  = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def process_entry(entry: dict, force: bool) -> str:
    entry_id = entry.get("id")
    yt_url   = entry.get("links", {}).get("youtube", "") or ""
    title    = entry.get("title", "")
    artist   = entry.get("artist", "")

    out_path = COVERS_DIR / f"{entry_id}.jpg"

    if out_path.exists() and not force:
        return f"  [{entry_id:>3}] skip  — {out_path.name} already exists"

    video_id = extract_video_id(yt_url)
    if not video_id:
        return f"  [{entry_id:>3}] skip  — no YouTube link  ({artist} – {title})"

    img = fetch_thumbnail(video_id)
    if img is None:
        return f"  [{entry_id:>3}] FAIL  — thumbnail unavailable ({artist} – {title})"

    img = crop_square(img).resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
    img.save(out_path, "JPEG", quality=QUALITY, optimize=True)
    return f"  [{entry_id:>3}] saved — {out_path.name}  ({artist} – {title})"


def main():
    parser = argparse.ArgumentParser(description="Fetch YouTube thumbnails for songs.json")
    parser.add_argument("--force", action="store_true", help="re-download even if file exists")
    parser.add_argument("--id",    type=int,            help="process only this entry id")
    args = parser.parse_args()

    data    = json.loads(SONGS_FILE.read_text(encoding="utf-8"))
    entries = data.get("entries", data) if isinstance(data, dict) else data

    if args.id is not None:
        entries = [e for e in entries if e.get("id") == args.id]
        if not entries:
            sys.exit(f"No entry with id={args.id} found.")

    COVERS_DIR.mkdir(parents=True, exist_ok=True)

    total = len(entries)
    print(f"Processing {total} entr{'y' if total == 1 else 'ies'}...\n")

    saved = skipped = failed = 0
    for i, entry in enumerate(entries, 1):
        result = process_entry(entry, force=args.force)
        print(f"[{i}/{total}] {result}")
        if "saved" in result:
            saved += 1
        elif "FAIL" in result:
            failed += 1
        else:
            skipped += 1

    print(f"\nDone. saved={saved}  skipped={skipped}  failed={failed}")


if __name__ == "__main__":
    main()
