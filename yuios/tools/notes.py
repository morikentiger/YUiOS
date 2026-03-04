"""Notes tool - save and retrieve notes."""

from __future__ import annotations

import json
import os
from datetime import datetime

NOTES_PATH = "data/notes.json"


def save_note(text: str, tags: list[str] | None = None) -> dict:
    """Save a note."""
    notes = _load_notes()
    note = {
        "content": text,
        "tags": tags or [],
        "created_at": datetime.now().isoformat(),
    }
    notes.append(note)
    _save_notes(notes)
    return {"status": "saved", "note": note}


def list_notes(tag: str | None = None) -> list[dict]:
    """List all notes, optionally filtered by tag."""
    notes = _load_notes()
    if tag:
        notes = [n for n in notes if tag in n.get("tags", [])]
    return notes


def _load_notes() -> list:
    if os.path.exists(NOTES_PATH):
        with open(NOTES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_notes(notes: list):
    os.makedirs(os.path.dirname(NOTES_PATH), exist_ok=True)
    with open(NOTES_PATH, "w", encoding="utf-8") as f:
        json.dump(notes, f, ensure_ascii=False, indent=2)
