"""Persistent memory store for YUiOS.

Memory is organized in 3 layers:
- Short-term: current conversation (conversation_history)
- Mid-term: recent events and topics (recent_events)
- Long-term: user profile and important facts (user_profile, facts)
"""

from __future__ import annotations

import json
import os
from datetime import datetime

FACTS_CAP = 50
EVENTS_CAP = 30
HISTORY_CAP = 100


class MemoryStore:
    def __init__(self, path: str = "data/memory.json"):
        self.path = path
        self.data = self._load()

    def _load(self) -> dict:
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "user_profile": {
                "name": None,
                "interests": [],
                "vision": None,
                "values": [],
                "conversation_count": 0,
                "last_topic": None,
            },
            "facts": [],
            "recent_events": [],
            "conversation_history": [],
        }

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    # ---- User profile (long-term, structured) ----

    def load_user_context(self) -> dict:
        return self.data["user_profile"]

    def update_profile(self, key: str, value):
        self.data["user_profile"][key] = value
        self.save()

    def add_interest(self, interest: str):
        """Add an interest if not already present (fuzzy)."""
        interests = self.data["user_profile"]["interests"]
        if not self._is_similar_in_list(interest, interests):
            interests.append(interest)
            self.save()

    def add_value(self, value: str):
        """Add a value if not already present (fuzzy)."""
        values = self.data["user_profile"]["values"]
        if not self._is_similar_in_list(value, values):
            values.append(value)
            self.save()

    def increment_conversation_count(self):
        self.data["user_profile"]["conversation_count"] += 1
        self.save()

    # ---- Facts (long-term, unstructured) ----

    def add_fact(self, fact: str):
        if self.has_similar_fact(fact):
            return
        self.data["facts"].append(
            {
                "content": fact,
                "timestamp": datetime.now().isoformat(),
            }
        )
        # Cap: keep newest
        if len(self.data["facts"]) > FACTS_CAP:
            self.data["facts"] = self.data["facts"][-FACTS_CAP:]
        self.save()

    def has_similar_fact(self, fact: str) -> bool:
        """Check if a semantically similar fact already exists.

        Uses substring matching in both directions to catch:
        - exact dupes: "ピアノが好き" == "ピアノが好き"
        - subset dupes: "ピアノが好き" in "趣味はピアノが好きなこと"
        """
        new = fact.lower().strip()
        for f in self.data["facts"]:
            existing = f["content"].lower().strip()
            if new in existing or existing in new:
                return True
        return False

    def get_facts(self) -> list[dict]:
        return self.data["facts"]

    # ---- Recent events (mid-term) ----

    def add_recent_event(self, event: str):
        if self._is_similar_event(event):
            return
        self.data["recent_events"].append(
            {
                "content": event,
                "timestamp": datetime.now().isoformat(),
            }
        )
        if len(self.data["recent_events"]) > EVENTS_CAP:
            self.data["recent_events"] = self.data["recent_events"][
                -EVENTS_CAP:
            ]
        self.save()

    def get_recent_events(self) -> list[dict]:
        return self.data["recent_events"]

    # ---- Conversation history (short-term) ----

    def add_conversation(self, role: str, content: str):
        self.data["conversation_history"].append(
            {
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat(),
            }
        )
        if len(self.data["conversation_history"]) > HISTORY_CAP:
            self.data["conversation_history"] = self.data[
                "conversation_history"
            ][-HISTORY_CAP:]
        self.save()

    def get_recent_history(self, n: int = 10) -> list[dict]:
        return self.data["conversation_history"][-n:]

    # ---- Internal helpers ----

    def _is_similar_in_list(self, item: str, lst: list[str]) -> bool:
        new = item.lower().strip()
        for existing in lst:
            ex = existing.lower().strip()
            if new in ex or ex in new:
                return True
        return False

    def _is_similar_event(self, event: str) -> bool:
        new = event.lower().strip()
        for e in self.data["recent_events"]:
            existing = e["content"].lower().strip()
            if new in existing or existing in new:
                return True
        return False
