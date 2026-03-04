"""Main conversation engine for YUiOS.

This is the heart of YUiOS. It orchestrates:
1. User input -> Memory context loading
2. Intent detection + last_topic update (immediate, no extra cost)
3. Agent routing
4. Response generation (returned immediately)
5. Memory updates in background thread (profile, facts, events)
"""

from __future__ import annotations

import threading

from yuios.core.llm_client import LLMClient
from yuios.core.intent_engine import IntentEngine
from yuios.core.action_router import ActionRouter
from yuios.memory.memory_store import MemoryStore

MEMORY_EXTRACTION_PROMPT = """\
以下のユーザーの発言を分析し、記憶すべき情報を3カテゴリで抽出してください。

## カテゴリと形式

### profile（プロフィール更新）
名前・趣味/興味・ビジョン/夢・価値観に該当する情報。
形式（1行1件）:
  profile:name:値
  profile:interest:値
  profile:vision:値
  profile:value:値

### fact（長期記憶）
長期的に覚えておくべき個人的な事実（profile以外）。
仕事、家族、スキル、所属、経歴、持ち物など。
形式: fact:内容

### event（中期記憶）
最近起きた出来事、今取り組んでいること、今日の出来事、近況。
形式: event:内容

## ルール
- 該当するものだけ出力する（無理に作らない）
- 何もなければ「なし」とだけ返す
- 1行1件、余計な説明は不要

発言: {user_input}
"""


class ConversationEngine:
    def __init__(self, config: dict):
        self.llm = LLMClient(config["llm"])
        self.memory = MemoryStore(config["memory"]["path"])
        self.intent_engine = IntentEngine(self.llm)
        self.router = ActionRouter(self.llm)
        self.memory.increment_conversation_count()

    def process(self, user_input: str) -> str:
        """Process user input through the full YUiOS pipeline.

        Timeline:
          [blocking]  intent detect → agent run → return response
          [background]                              → _update_memory
        """

        # 1. Record user input (short-term)
        self.memory.add_conversation("user", user_input)

        # 2. Build context from all 3 memory layers
        context = {
            "profile": self.memory.load_user_context(),
            "facts": self.memory.get_facts(),
            "recent_events": self.memory.get_recent_events(),
            "history": self.memory.get_recent_history(20),
        }

        # 3. Detect intent + extract topic (single LLM call)
        result = self.intent_engine.detect(user_input)
        intent = result["intent"]
        topic = result["topic"]

        # 4. Update last_topic immediately (cost: 0)
        if topic:
            self.memory.update_profile("last_topic", topic)

        # 5. Route to appropriate agent
        agent = self.router.route(intent)

        # 6. Execute agent
        response = agent.run(user_input, context)

        # 7. Save response (short-term)
        self.memory.add_conversation("assistant", response)

        # 8. Update memory in background (profile/facts/events)
        #    Does NOT block the response.
        thread = threading.Thread(
            target=self._update_memory,
            args=(user_input,),
            daemon=True,
        )
        thread.start()

        return response

    def _update_memory(self, user_input: str):
        """Extract profile, facts, and events from user input.

        Runs in a background thread — never blocks the response.
        """
        try:
            prompt = MEMORY_EXTRACTION_PROMPT.format(user_input=user_input)
            messages = [{"role": "user", "content": prompt}]
            result = self.llm.chat(messages, temperature=0.0)

            if not result.strip() or result.strip() == "なし":
                return

            for line in result.strip().split("\n"):
                line = line.strip()
                if not line or line == "なし":
                    continue

                if line.startswith("profile:"):
                    self._handle_profile(line)
                elif line.startswith("fact:"):
                    fact = line[5:].strip()
                    if fact:
                        self.memory.add_fact(fact)
                elif line.startswith("event:"):
                    event = line[6:].strip()
                    if event:
                        self.memory.add_recent_event(event)
        except Exception:
            pass  # Background thread — don't crash the app

    def _handle_profile(self, line: str):
        """Parse and apply a profile update line.

        Format: profile:field:value
        """
        parts = line.split(":", 2)  # ["profile", "field", "value"]
        if len(parts) < 3:
            return

        field = parts[1].strip().lower()
        value = parts[2].strip()
        if not value:
            return

        if field == "name":
            self.memory.update_profile("name", value)
        elif field == "interest":
            self.memory.add_interest(value)
        elif field == "vision":
            self.memory.update_profile("vision", value)
        elif field == "value":
            self.memory.add_value(value)
