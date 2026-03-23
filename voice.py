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
        audio = self.client.text_to_speech.convert(
            text=text,
            voice_id=voice_id,
            model_id=self.model,
            output_format="mp3_44100_128",
        )
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
