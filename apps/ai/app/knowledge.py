"""Load published tomato lessons and optional unverified draft chunks."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
COURSE_PATH = ROOT / "content" / "tomato" / "course.json"
GLOSSARY_PATH = ROOT / "content" / "glossary" / "kinyarwanda.json"
DRAFTS_DIR = ROOT / "content" / "drafts"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def published_passages() -> list[dict]:
    course = load_json(COURSE_PATH)
    passages: list[dict] = []
    for lesson in course["lessons"]:
        if lesson.get("status") != "published":
            continue
        for beat in lesson["beats"]:
            passages.append(
                {
                    "id": f"{lesson['id']}:{beat['id']}",
                    "lessonId": lesson["id"],
                    "lessonTitle": lesson["title"],
                    "beatId": beat["id"],
                    "status": "published",
                    "text": beat["text"],
                }
            )
    return passages


def draft_passages() -> list[dict]:
    if not DRAFTS_DIR.exists():
        return []
    passages: list[dict] = []
    for path in sorted(DRAFTS_DIR.glob("*.json")):
        try:
            payload = load_json(path)
        except json.JSONDecodeError:
            continue
        for chunk in payload.get("chunks", []):
            passages.append(
                {
                    "id": chunk["id"],
                    "lessonId": None,
                    "lessonTitle": {"rw": payload.get("title", path.name), "en": payload.get("title", path.name)},
                    "beatId": "source-draft",
                    "status": "draft",
                    "rights": payload.get("rights"),
                    "text": {"rw": chunk["text"], "en": chunk["text"]},
                }
            )
    return passages


def glossary_terms() -> list[dict]:
    return load_json(GLOSSARY_PATH)["entries"]
