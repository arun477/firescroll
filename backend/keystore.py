import os

from db import get_api_key


def get_key(provider):
    db_key = get_api_key(provider)
    if db_key:
        return db_key

    env_map = {
        "openai": "OPENAI_API_KEY",
        "elevenlabs": "ELEVENLABS_API_KEY",
        "firecrawl": "FIRECRAWL_API_KEY",
    }
    env_name = env_map.get(provider, "")
    return os.environ.get(env_name)
