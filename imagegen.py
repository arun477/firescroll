import os
from abc import ABC, abstractmethod

from dotenv import load_dotenv

load_dotenv()


class ImageProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, output_path: str, **kwargs) -> str:
        pass

    @abstractmethod
    def generate_bulk(self, prompt: str, output_dir: str, count: int, **kwargs) -> list[str]:
        pass

    @abstractmethod
    def list_models(self) -> list[str]:
        pass


class OpenAIImage(ImageProvider):
    MODELS = ["dall-e-2", "dall-e-3", "gpt-image-1"]
    MAX_PER_CALL = 10

    def __init__(self, model: str = "gpt-image-1", size: str = "1024x1536"):
        from openai import OpenAI
        self.client = OpenAI()
        self.model = model
        self.size = size

    def _save_image(self, image_data, output_path):
        import base64
        if hasattr(image_data, "b64_json") and image_data.b64_json:
            img_bytes = base64.b64decode(image_data.b64_json)
            with open(output_path, "wb") as f:
                f.write(img_bytes)
        elif hasattr(image_data, "url") and image_data.url:
            import urllib.request
            urllib.request.urlretrieve(image_data.url, output_path)

    def generate(self, prompt: str, output_path: str, **kwargs) -> str:
        size = kwargs.get("size", self.size)
        response = self.client.images.generate(
            model=self.model,
            prompt=prompt,
            n=1,
            size=size,
        )
        self._save_image(response.data[0], output_path)
        print(f"Image saved: {output_path}")
        return output_path

    def generate_bulk(self, prompt: str, output_dir: str, count: int, **kwargs) -> list[str]:
        os.makedirs(output_dir, exist_ok=True)
        size = kwargs.get("size", self.size)
        paths = []
        remaining = count

        batch_num = 0
        while remaining > 0:
            n = min(remaining, self.MAX_PER_CALL)
            response = self.client.images.generate(
                model=self.model,
                prompt=prompt,
                n=n,
                size=size,
            )
            for i, img_data in enumerate(response.data):
                idx = batch_num * self.MAX_PER_CALL + i
                path = os.path.join(output_dir, f"bg_{idx:03d}.png")
                self._save_image(img_data, path)
                paths.append(path)

            remaining -= n
            batch_num += 1

        print(f"Bulk generated {count} images in {output_dir}")
        return paths

    def list_models(self) -> list[str]:
        return self.MODELS


PROVIDERS = {
    "openai": OpenAIImage,
}


def get_provider(name: str = "openai", **kwargs) -> ImageProvider:
    if name not in PROVIDERS:
        raise ValueError(f"Unknown provider: {name}. Available: {list(PROVIDERS.keys())}")
    return PROVIDERS[name](**kwargs)
