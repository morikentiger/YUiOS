"""Main conversation engine for YUiOS.

This is the heart of YUiOS. It orchestrates:
1. User input -> Memory context loading
2. Intent detection
3. Agent routing
4. Response generation
5. Memory updates (facts, events, profile)
"""

from yuios.core.llm_client import LLMClient
from yuios.core.intent_engine import IntentEngine
from yuios.core.action_router import ActionRouter
from yuios.memory.memory_store import MemoryStore


class ConversationEngine:
    def __init__(self, config: dict):
        self.llm = LLMClient(config["llm"])
        self.memory = MemoryStore(config["memory"]["path"])
        self.intent_engine = IntentEngine(self.llm)
        self.router = ActionRouter(self.llm)
        self.memory.increment_conversation_count()

    def process(self, user_input: str) -> str:
        """Process user input through the full YUiOS pipeline."""

        # 1. Record user input
        self.memory.add_conversation("user", user_input)

        # 2. Build context from memory (short + mid + long term)
        context = {
            "profile": self.memory.load_user_context(),
            "facts": self.memory.get_facts(),
            "recent_events": self.memory.get_recent_events(),
            "history": self.memory.get_recent_history(20),
        }

        # 3. Detect intent
        intent = self.intent_engine.detect(user_input)

        # 4. Route to appropriate agent
        agent = self.router.route(intent)

        # 5. Execute agent
        response = agent.run(user_input, context)

        # 6. Save response
        self.memory.add_conversation("assistant", response)

        # 7. Extract and save memorable information
        self._extract_and_save_facts(user_input)

        return response

    def _extract_and_save_facts(self, user_input: str):
        """Extract memorable facts from user input and save to long-term memory."""
        prompt = (
            "以下のユーザーの発言から、長期的に覚えておくべき個人的な事実を抽出してください。\n"
            "名前、趣味、仕事、好きなもの、家族、目標、プロジェクト、価値観など。\n\n"
            f"発言: {user_input}\n\n"
            "事実がなければ「なし」と返してください。\n"
            "事実があれば、1行1事実で箇条書きしてください（「- 」で始める）。"
        )

        messages = [{"role": "user", "content": prompt}]
        result = self.llm.chat(messages, temperature=0.0)

        if "なし" in result.strip() or not result.strip():
            return

        for line in result.strip().split("\n"):
            line = line.strip()
            if line.startswith("- "):
                fact = line[2:].strip()
                if fact and not self.memory.has_similar_fact(fact):
                    self.memory.add_fact(fact)
