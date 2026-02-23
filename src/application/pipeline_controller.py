import os
import requests
from src.domain.entities import VideoTask, TaskStatus
from src.domain.interfaces import IHapRepository
from src.domain.ai_interfaces import IAiServices
from src.domain.media_interfaces import IMediaProcessor

class VideoPipelineController:
    """
    Application Layer Service orchestrating the video processing sequence.
    Follows Dependency Inversion by depending on abstract interfaces.
    """
    def __init__(self, 
                 repository: IHapRepository, 
                 ai_client: IAiServices, 
                 media_processor: IMediaProcessor,
                 workspace_dir: str = "./workspace"):
        self.repo = repository
        self.ai = ai_client
        self.media = media_processor
        self.workspace_dir = workspace_dir
        os.makedirs(self.workspace_dir, exist_ok=True)

    def _download_video(self, url: str, local_path: str) -> bool:
        try:
            r = requests.get(url, stream=True)
            r.raise_for_status()
            with open(local_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        except Exception as e:
            print(f"Error downloading video: {e}")
            return False

    def process_task(self, row_id: str) -> bool:
        print(f"[Pipeline] Starting process for row_id: {row_id}")
        
        # 1. Fetch Task Metadata
        task = self.repo.get_task_by_id(row_id)
        if not task or not task.original_video_url:
            print(f"Task not found or no video attached for {row_id}")
            self.repo.update_task_status(row_id, TaskStatus.FAILED)
            return False
            
        # Update status to processing
        self.repo.update_task_status(row_id, TaskStatus.PROCESSING)
        
        # Setup paths
        task_dir = os.path.join(self.workspace_dir, row_id)
        os.makedirs(task_dir, exist_ok=True)
        
        original_video = os.path.join(task_dir, "original.mp4")
        original_audio = os.path.join(task_dir, "original_audio.wav")
        final_audio = os.path.join(task_dir, "final_audio.wav")
        srt_file = os.path.join(task_dir, "subtitles.srt")
        output_video = os.path.join(task_dir, "output.mp4")

        try:
            # 2. Download Video
            print("[Pipeline] Downloading video...")
            if not self._download_video(task.original_video_url, original_video):
                raise Exception("Failed to download video")
                
            # 3. Extract Audio
            print("[Pipeline] Extracting audio...")
            if not self.media.extract_audio(original_video, original_audio):
                raise Exception("Failed to extract audio")
                
            # 4. ASR (Speech to Text with timestamps)
            print("[Pipeline] Running ASR...")
            segments = self.ai.transcribe_audio(original_audio)
            if not segments:
                raise Exception("ASR returned no segments")
            
            # Placeholder for the new aligned audio fragments
            aligned_audio_fragments = []
            
            # 5. Translation and TTS Loop
            print(f"[Pipeline] Translating and synthesizing {len(segments)} segments...")
            for i, segment in enumerate(segments):
                # 5a. Translation
                segment.translated_text = self.ai.translate_to_cantonese(segment.text)
                
                # 5b. TTS Generation
                raw_tts_path = os.path.join(task_dir, f"raw_tts_{i}.wav")
                if not self.ai.synthesize_speech(segment.translated_text, raw_tts_path):
                    continue
                    
                # 5c. Time Stretching (Aligning)
                target_duration = segment.end_time - segment.start_time
                aligned_tts_path = os.path.join(task_dir, f"aligned_tts_{i}.wav")
                
                if self.media.stretch_audio(raw_tts_path, target_duration, aligned_tts_path):
                    segment.audio_path = aligned_tts_path
                    aligned_audio_fragments.append(aligned_tts_path)
                else:
                    # Fallback to the raw if stretch fails
                    aligned_audio_fragments.append(raw_tts_path)
                    
            # 6. Merge Aligned Audio Fragments
            print("[Pipeline] Merging aligned audio tracks...")
            if not self.media.merge_audio_segments(aligned_audio_fragments, final_audio):
                raise Exception("Failed to merge final audio")
                
            # 7. Generate SRT
            print("[Pipeline] Generating SRT subtitle file...")
            self.media.generate_srt(segments, srt_file)
            
            # 8. Remux Final Video
            print("[Pipeline] Remuxing video with new cantonese track and subs...")
            if not self.media.remux_video_with_audio_and_subs(original_video, final_audio, srt_file, output_video):
                raise Exception("Failed to remux final video")
                
            # 9. Upload Results to HAP
            print("[Pipeline] Uploading results to Mingdao Cloud...")
            if srt_file and os.path.exists(srt_file):
                self.repo.upload_attachment(row_id, "cantonese_subtitle", srt_file) # Assuming this map
            if output_video and os.path.exists(output_video):
                self.repo.upload_attachment(row_id, "output_video", output_video)
                
            print(f"[Pipeline] Process complete for {row_id} 🎉")
            self.repo.update_task_status(row_id, TaskStatus.COMPLETED)
            return True

        except Exception as e:
            print(f"[Pipeline] Fatal error processing {row_id}: {e}")
            self.repo.update_task_status(row_id, TaskStatus.FAILED)
            return False
