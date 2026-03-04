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

    def load_user_context(self) -> dict:
        return self.data["user_profile"]

    def update_profile(self, key: str, value):
        self.data["user_profile"][key] = value
        self.save()

    def increment_conversation_count(self):
        self.data["user_profile"]["conversation_count"] += 1
        self.save()

    # --- Facts (long-term memory) ---

    def add_fact(self, fact: str):
        self.data["facts"].append(
            {
                "content": fact,
                "timestamp": datetime.now().isoformat(),
            }
        )
        self.save()

    def has_similar_fact(self, fact: str) -> bool:
        existing = [f["content"].lower() for f in self.data["facts"]]
        return fact.lower() in existing

    def get_facts(self) -> list[dict]:
        return self.data["facts"]

    # --- Recent events (mid-term memory) ---

    def add_recent_event(self, event: str):
        self.data["recent_events"].append(
            {
                "content": event,
                "timestamp": datetime.now().isoformat(),
            }
        )
        # Keep last 30 events
        if len(self.data["recent_events"]) > 30:
            self.data["recent_events"] = self.data["recent_events"][-30:]
        self.save()

    def get_recent_events(self) -> list[dict]:
        return self.data["recent_events"]

    # --- Conversation history (short-term memory) ---

    def add_conversation(self, role: str, content: str):
        self.data["conversation_history"].append(
            {
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat(),
            }
        )
        # Keep last 100 messages
        if len(self.data["conversation_history"]) > 100:
            self.data["conversation_history"] = self.data[
                "conversation_history"
            ][-100:]
        self.save()

    def get_recent_history(self, n: int = 10) -> list[dict]:
        return self.data["conversation_history"][-n:]
