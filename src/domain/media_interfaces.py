from abc import ABC, abstractmethod

class IMediaProcessor(ABC):
    @abstractmethod
    def extract_audio(self, video_path: str, output_audio_path: str) -> bool:
        """Extract audio segment from a video file."""
        pass
        
    @abstractmethod
    def stretch_audio(self, input_audio_path: str, target_duration_ms: int, output_audio_path: str) -> bool:
        """Stretch or compress audio without changing pitch to meet target duration."""
        pass
        
    @abstractmethod
    def merge_audio_segments(self, audio_paths: list[str], output_path: str) -> bool:
        """Concatenate multiple audio segments into one continuous track."""
        pass
        
    @abstractmethod
    def remux_video_with_audio_and_subs(self, 
                                        original_video_path: str, 
                                        new_audio_path: str, 
                                        srt_path: str, 
                                        output_video_path: str) -> bool:
        """Merge original video context with new generated audio track and burn/embed subtitles."""
        pass
    
    @abstractmethod
    def generate_srt(self, segments, output_srt_path: str) -> bool:
        """Generate an SRT subtitle file from SpeechSegments."""
        pass
