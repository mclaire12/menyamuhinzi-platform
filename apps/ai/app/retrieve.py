"""Lexical retrieval over approved lesson text.

This is the phase-1 index. It is not a trained language model.
When GEMINI_API_KEY is set, Gemini may phrase an answer from the
passages this module returns. It may not add facts from outside them.
"""

from __future__ import annotations

import re
from collections import Counter

from .knowledge import glossary_terms

STOP = {
    "ni", "na", "mu", "ku", "kwa", "no", "yo", "ya", "ba", "cy", "cyangwa",
    "kugira", "ngo", "niba", "ari", "kuva", "kandi", "ibi", "iki", "icyo",
    "the", "a", "an", "of", "to", "and", "or", "in", "on", "for", "is", "are",
    "what", "how", "when", "where", "does", "do", "iyi", "iri", "rya",
}

TOKEN = re.compile(r"[0-9a-zA-Z''’]+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return [part.lower() for part in TOKEN.findall(text or "") if part.lower() not in STOP and len(part) > 1]


def _synonyms() -> dict[str, set[str]]:
    groups: dict[str, set[str]] = {}
    for entry in glossary_terms():
        words = [entry["rw"], entry["en"], *entry.get("also", [])]
        bag = {token for word in words for token in tokenize(word)}
        for token in bag:
            groups.setdefault(token, set()).update(bag)
    return groups


SYNONYMS = _synonyms()


def expand(tokens: list[str]) -> set[str]:
    expanded = set(tokens)
    for token in tokens:
        expanded.update(SYNONYMS.get(token, set()))
    return expanded


def score_passage(query: str, passage: dict) -> float:
    q = expand(tokenize(query))
    if not q:
        return 0.0
    hay = tokenize(passage["text"].get("rw", "") + " " + passage["text"].get("en", ""))
    if not hay:
        return 0.0
    counts = Counter(hay)
    overlap = sum(counts[token] for token in q if token in counts)
    return overlap / (len(q) ** 0.5)


def search(query: str, passages: list[dict], limit: int = 3, min_score: float = 0.75) -> list[dict]:
    ranked = []
    for passage in passages:
        value = score_passage(query, passage)
        if value >= min_score:
            ranked.append({**passage, "score": round(value, 3)})
    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked[:limit]


def unknown_answer() -> dict:
    return {
        "rw": "Iyi somo ntirigira igisubizo cy'icyo kibazo. Baza umutoza, cyangwa hitamo irindi somo ry'inyanya.",
        "en": "This course does not contain an answer to that question. Ask a facilitator, or choose another tomato lesson.",
        "grounded": False,
    }


def answer_from_passages(query: str, passages: list[dict], limit: int = 3) -> dict:
    hits = search(query, passages, limit=limit)
    if not hits:
        payload = unknown_answer()
        payload["passages"] = []
        return payload
    best = hits[0]
    return {
        "rw": best["text"]["rw"],
        "en": best["text"]["en"],
        "grounded": True,
        "lessonId": best.get("lessonId"),
        "passages": [
            {"id": hit["id"], "lessonId": hit.get("lessonId"), "score": hit["score"], "status": hit["status"]}
            for hit in hits
        ],
    }
