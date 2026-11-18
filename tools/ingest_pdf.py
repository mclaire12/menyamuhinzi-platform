"""Turn a reference PDF into unverified draft chunks for facilitator search.

Farmer answers never use these chunks until a person approves a lesson.
The original wording stays out of git. content/drafts is gitignored.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "content" / "drafts"


def chunks(text: str, size: int = 700) -> list[str]:
    clean = re.sub(r"\s+", " ", text).strip()
    parts = []
    start = 0
    while start < len(clean):
        parts.append(clean[start : start + size])
        start += size
    return [part for part in parts if len(part) > 80]


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python tools/ingest_pdf.py <file.pdf> [more.pdf]")
        sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    for raw in sys.argv[1:]:
        path = Path(raw)
        reader = PdfReader(str(path))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        pieces = chunks(text)[:40]
        payload = {
            "title": path.name,
            "rights": "Unverified draft extracted for facilitator search. Not approved for farmers.",
            "status": "draft",
            "chunks": [{"id": f"{path.stem}:{index}", "text": piece} for index, piece in enumerate(pieces)],
        }
        target = OUT / f"{path.stem}.json"
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{path.name}: {len(pieces)} draft chunks -> {target}")


if __name__ == "__main__":
    main()
