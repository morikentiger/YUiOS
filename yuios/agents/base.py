"""Base agent interface for YUiOS.

All agents implement a common interface so they can be
freely added, removed, or replaced.
"""

from abc import ABC, abstractmethod


class Agent(ABC):
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    @abstractmethod
    def run(self, input_data: str, context: dict) -> str:
        """Execute the agent's task and return a response."""
        pass
