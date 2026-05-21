#!/usr/bin/env python3
"""Download videos or audio from songs.json YouTube links using yt-dlp.

Usage:
    python scripts/download.py            # download video (best quality)
    python scripts/download.py --audio    # download audio only
    python scripts/download.py -a         # same
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

YTDLP = "/opt/yt-dlp"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SONGS_JSON = PROJECT_ROOT / "_data" / "songs.json"
MEDIA_DIR = PROJECT_ROOT / "media"


def video_id_from_url(url: str) -> str:
    """Extract video ID from a YouTube watch URL."""
    url = url.strip()
    for sep in ("?v=", "&v="):
        if sep in url:
            return url.split(sep)[1].split("&")[0]
    # handle youtu.be/ID form
    if "youtu.be/" in url:
        return url.split("youtu.be/")[1].split("?")[0]
    return ""


def already_downloaded(video_id: str, media_dir: Path) -> bool:
    """Return True if any file in media_dir contains [video_id] in its name."""
    if not media_dir.exists():
        return False
    for f in media_dir.iterdir():
        if f"[{video_id}]" in f.name:
            return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download songs from _data/songs.json via yt-dlp"
    )
    parser.add_argument(
        "-a", "--audio", "--audio-only",
        dest="audio_only",
        action="store_true",
        help="Extract audio only (best available format)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be downloaded without actually downloading",
    )
    args = parser.parse_args()

    if not Path(YTDLP).exists():
        sys.exit(f"yt-dlp not found at {YTDLP}")

    with open(SONGS_JSON, encoding="utf-8") as f:
        data = json.load(f)

    entries = data.get("entries", [])
    MEDIA_DIR.mkdir(exist_ok=True)

    skipped = downloaded = errors = 0

    for entry in entries:
        yt_url = (entry.get("links") or {}).get("youtube", "").strip()
        if not yt_url:
            continue

        vid_id = video_id_from_url(yt_url)
        if not vid_id:
            print(f"[warn]  cannot parse video ID: {yt_url}")
            continue

        title = entry.get("title", "Unknown")

        if already_downloaded(vid_id, MEDIA_DIR):
            print(f"[skip]  {title} [{vid_id}]")
            skipped += 1
            continue

        mode = "audio" if args.audio_only else "video"
        print(f"[{mode}] {title} — {yt_url}")

        if args.dry_run:
            downloaded += 1
            continue

        cmd = [
            YTDLP,
            "--output", str(MEDIA_DIR / "%(title)s [%(id)s].%(ext)s"),
            "--no-playlist",
        ]
        if args.audio_only:
            cmd += ["--extract-audio", "--audio-format", "best"]
        else:
            cmd += ["--format", "bestvideo+bestaudio/best", "--merge-output-format", "mp4"]

        cmd.append(yt_url)

        result = subprocess.run(cmd)
        if result.returncode == 0:
            downloaded += 1
        else:
            print(f"[error] failed: {yt_url}")
            errors += 1

    print(f"\nDone — downloaded: {downloaded}, skipped: {skipped}, errors: {errors}")


if __name__ == "__main__":
    main()
