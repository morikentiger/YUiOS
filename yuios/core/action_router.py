"""Action router - maps intents to agents.

YUi acts as the "commander", routing user intent
to the appropriate specialist agent.
"""

from __future__ import annotations

from yuios.agents.base import Agent
from yuios.agents.chat_agent import ChatAgent
from yuios.agents.task_agent import TaskAgent
from yuios.agents.idea_agent import IdeaAgent
from yuios.agents.search_agent import SearchAgent


class ActionRouter:
    def __init__(self, llm_client):
        self.agents: dict[str, Agent] = {
            "chat": ChatAgent(llm_client),
            "task_management": TaskAgent(llm_client),
            "idea_generation": IdeaAgent(llm_client),
            "information_search": SearchAgent(llm_client),
            "memory_update": ChatAgent(llm_client),
        }
        self.default_agent = self.agents["chat"]

    def route(self, intent: str) -> Agent:
        """Route an intent to the appropriate agent."""
        return self.agents.get(intent, self.default_agent)
