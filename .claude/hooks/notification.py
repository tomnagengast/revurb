#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = ["requests", "elevenlabs"]
# ///
# Usage:
import os
import sys
import json
import requests
from datetime import datetime, timezone
from elevenlabs import play, save
from elevenlabs.client import ElevenLabs

DISCORD_WEBHOOK_URL = os.environ.get("CLAUDE_CODE_DISCORD_WEBHOOK_URL")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.environ.get(
    "ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"
)  # Default to Rachel voice

if DISCORD_WEBHOOK_URL is None:
    print("Missing DISCORD_WEBHOOK_URL in env")
    sys.exit(0)


def send_discord(title, message, color=0x0099FF):
    payload = {
        "title": title,
        "description": message,
        "color": color,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    assert DISCORD_WEBHOOK_URL is not None  # Type hint for type checker
    requests.post(DISCORD_WEBHOOK_URL, json={"embeds": [payload]})


def send_to_elevenlabs(text):
    """Send text to ElevenLabs API for text-to-speech"""
    ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
    if not ELEVENLABS_API_KEY:
        return  # Skip if API key not configured

    ELEVENLABS_API_KEY = "21m00Tcm4TlvDq8ikWAM"

    try:
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

        # Generate audio from text
        audio = client.generate(
            text=text[:500],  # Limit to 500 chars for notifications
            voice=ELEVENLABS_VOICE_ID,
            model="eleven_monolingual_v1",
        )

        # Play the audio
        play(audio)
    except Exception as e:
        print(f"ElevenLabs TTS failed: {e}", file=sys.stderr)


input_data = json.loads(sys.stdin.read())
cwd = input_data["cwd"].replace(os.path.expanduser("~"), "~")
message = None

if input_data["hook_event_name"] == "UserPromptSubmit":
    message = input_data["prompt"]
    send_discord(cwd, message)
    send_to_elevenlabs(f"New prompt in {cwd}: {message[:100]}")  # Announce new prompts

if input_data["hook_event_name"] == "Stop":
    for line in open(input_data["transcript_path"]):
        data = json.loads(line)
        try:
            message = data["message"]["content"][0]["text"][:2000]
        except Exception:
            pass
    send_discord(cwd, message, 0xD2691E)
    send_to_elevenlabs(f"Task completed in {cwd}")  # Announce completion
