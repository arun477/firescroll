from abc import ABC, abstractmethod

from dotenv import load_dotenv

load_dotenv()


class VoiceProvider(ABC):
    @abstractmethod
    def generate(self, text: str, output_path: str, **kwargs) -> str:
        pass

    @abstractmethod
    def list_voices(self) -> list[dict]:
        pass


class OpenAIVoice(VoiceProvider):
    VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]

    def __init__(self, voice: str = "nova", model: str = "tts-1-hd"):
        from openai import OpenAI
        from keystore import get_key
        api_key = get_key("openai")
        self.client = OpenAI(api_key=api_key) if api_key else OpenAI()
        self.voice = voice
        self.model = model

    def generate(self, text: str, output_path: str, **kwargs) -> str:
        voice = kwargs.get("voice", self.voice)
        response = self.client.audio.speech.create(
            model=self.model,
            voice=voice,
            input=text,
        )
        response.stream_to_file(output_path)
        print(f"Audio saved: {output_path}")
        return output_path

    def list_voices(self) -> list[dict]:
        return [{"id": v, "name": v.capitalize()} for v in self.VOICES]


VOICE_PRESETS = {
    "natural":     {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0, "speed": 1.0},
    "dramatic":    {"stability": 0.3, "similarity_boost": 0.8, "style": 0.7, "speed": 0.9},
    "energetic":   {"stability": 0.4, "similarity_boost": 0.7, "style": 0.5, "speed": 1.15},
    "calm":        {"stability": 0.8, "similarity_boost": 0.6, "style": 0.1, "speed": 0.9},
    "storyteller": {"stability": 0.6, "similarity_boost": 0.85, "style": 0.4, "speed": 0.95},
}


class ElevenLabsVoice(VoiceProvider):
    DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"

    def __init__(self, voice: str = None, model: str = "eleven_v3"):
        from elevenlabs.client import ElevenLabs
        from keystore import get_key
        api_key = get_key("elevenlabs")
        if not api_key:
            raise ValueError("ElevenLabs API key not configured")
        self.client = ElevenLabs(api_key=api_key)
        self.voice = voice or self.DEFAULT_VOICE_ID
        self.model = model

    def generate(self, text: str, output_path: str, **kwargs) -> str:
        voice_id = kwargs.get("voice", self.voice)
        call_kwargs = {
            "text": text,
            "voice_id": voice_id,
            "model_id": self.model,
            "output_format": "mp3_44100_128",
        }
        # Apply voice settings if provided
        stability = kwargs.get("stability")
        if stability is not None:
            from elevenlabs import VoiceSettings
            call_kwargs["voice_settings"] = VoiceSettings(
                stability=float(kwargs.get("stability", 0.5)),
                similarity_boost=float(kwargs.get("similarity_boost", 0.75)),
                style=float(kwargs.get("style", 0.0)),
                speed=float(kwargs.get("speed", 1.0)),
            )
        audio = self.client.text_to_speech.convert(**call_kwargs)
        with open(output_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        print(f"Audio saved: {output_path}")
        return output_path

    def list_voices(self) -> list[dict]:
        response = self.client.voices.search()
        return [{"id": v.voice_id, "name": v.name} for v in response.voices]


PROVIDERS = {
    "openai": OpenAIVoice,
    "elevenlabs": ElevenLabsVoice,
}


def get_provider(name: str = None, **kwargs) -> VoiceProvider:
    if name is None:
        from keystore import get_key
        name = "elevenlabs" if get_key("elevenlabs") else "openai"
    if name not in PROVIDERS:
        raise ValueError(f"Unknown provider: {name}. Available: {list(PROVIDERS.keys())}")
    return PROVIDERS[name](**kwargs)
