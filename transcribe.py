from dotenv import load_dotenv

load_dotenv()


def get_word_timestamps(audio_path):
    from openai import OpenAI
    client = OpenAI()

    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

    words = []
    for word_info in response.words:
        words.append({
            "word": word_info.word,
            "start": word_info.start,
            "end": word_info.end,
        })

    print(f"Transcribed {len(words)} words with timestamps")
    return words
