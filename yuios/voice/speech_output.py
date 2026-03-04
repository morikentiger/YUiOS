"""Speech output - voice-ready architecture.

TODO: Implement with TTS service (e.g., OpenAI TTS).
"""


class SpeechOutput:
    """Text-to-speech interface."""

    def __init__(self, language: str = "ja-JP"):
        self.language = language
        self.enabled = False

    def speak(self, text: str):
        """Convert text to speech and play it."""
        raise NotImplementedError("Speech output not yet implemented.")
