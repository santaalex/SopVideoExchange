from abc import ABC, abstractmethod
from typing import List
from pydantic import BaseModel

class SpeechSegment(BaseModel):
    start_time: int  # in milliseconds
    end_time: int    # in milliseconds
    text: str
    translated_text: str = ""
    audio_path: str = ""

class IAiServices(ABC):
    @abstractmethod
    def transcribe_audio(self, audio_file_path: str) -> List[SpeechSegment]:
        """Extract text and timestamps from audio."""
        pass
        
    @abstractmethod
    def translate_to_cantonese(self, text: str) -> str:
        """Translate Mandarin text to Cantonese colloquialism."""
        pass
        
    @abstractmethod
    def synthesize_speech(self, text: str, output_path: str) -> bool:
        """Generate Cantonese audio from text."""
        pass
