"""Speech input - voice-ready architecture.

TODO: Implement with STT service (e.g., OpenAI Whisper).
"""


class SpeechInput:
    """Speech-to-text interface."""

    def __init__(self, language: str = "ja-JP"):
        self.language = language
        self.enabled = False

    def listen(self) -> str:
        """Listen for speech and return text."""
        raise NotImplementedError(
            "Speech input not yet implemented. Use text input."
        )
