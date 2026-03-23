from abc import ABC, abstractmethod

from dotenv import load_dotenv

load_dotenv()


class VoiceProvider(ABC):
    @abstractmethod
    def generate(self, text: str, output_path: str, **kwargs) -> str:
        pass

    @abstractmethod
    def list_voices(self) -> list[str]:
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

    def list_voices(self) -> list[str]:
        return self.VOICES


PROVIDERS = {
    "openai": OpenAIVoice,
}


def get_provider(name: str = "openai", **kwargs) -> VoiceProvider:
    if name not in PROVIDERS:
        raise ValueError(f"Unknown provider: {name}. Available: {list(PROVIDERS.keys())}")
    return PROVIDERS[name](**kwargs)
