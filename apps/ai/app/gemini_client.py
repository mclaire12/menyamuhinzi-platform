"""Gemini calls for wording, transcription, and speech. All optional."""

from __future__ import annotations

import base64
import io
import os
import re
import wave
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[3]


def _load_env_file() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"


def configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def _model(name: str, default: str) -> str:
    return os.environ.get(name, default)


async def generate(prompt: str, system: str) -> str | None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    model = _model("GEMINI_MODEL", "gemini-2.5-flash")
    url = f"{API_ROOT}/models/{model}:generateContent"
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2},
    }
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.post(url, params={"key": key}, json=body)
        response.raise_for_status()
        data = response.json()
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(part.get("text", "") for part in parts).strip()


async def transcribe(audio_bytes: bytes, mime_type: str) -> str | None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    model = _model("GEMINI_STT_MODEL", "gemini-2.5-flash")
    url = f"{API_ROOT}/models/{model}:generateContent"
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": "Transcribe this Kinyarwanda speech into Kinyarwanda text only. Do not translate."
                    },
                    {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(audio_bytes).decode()}},
                ],
            }
        ]
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, params={"key": key}, json=body)
        response.raise_for_status()
        data = response.json()
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(part.get("text", "") for part in parts).strip()


def pcm_to_wav(pcm: bytes, rate: int = 24000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm)
    return buffer.getvalue()


async def synthesize(text: str) -> bytes | None:
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    model = _model("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts")
    url = f"{API_ROOT}/models/{model}:generateContent"
    body = {
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": "Kore"}}},
        },
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, params={"key": key}, json=body)
        response.raise_for_status()
        data = response.json()
    parts = data["candidates"][0]["content"]["parts"]
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data"):
            raw = base64.b64decode(inline["data"])
            mime = inline.get("mimeType") or inline.get("mime_type") or "audio/L16;rate=24000"
            if "wav" in mime:
                return raw
            match = re.search(r"rate=(\d+)", mime)
            return pcm_to_wav(raw, int(match.group(1)) if match else 24000)
    return None
