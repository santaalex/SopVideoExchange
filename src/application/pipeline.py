import os
import shutil
import uuid
from typing import Optional

from src.domain.entities import VideoTask, TaskStatus
from src.infrastructure.hap_repository import HapRepository
from src.infrastructure.dashscope_service import DashscopeService
from src.infrastructure.ffmpeg_processor import FfmpegMediaProcessor
from src.config import Config

class VideoProcessingPipeline:
    """
    The main Application Service that orchestrates the entire video translation process.
    """
    def __init__(self):
        self.hap_repo = HapRepository()
        self.ai_service = DashscopeService()
        self.media_processor = FfmpegMediaProcessor()
        
        # Ensure temporary workspace exists
        self.workspace_root = os.path.join(os.getcwd(), "tmp_workspace")
        if not os.path.exists(self.workspace_root):
            os.makedirs(self.workspace_root)

    def process_task(self, row_id: str) -> bool:
        """
        Executes the full pipeline for a specific HAP row ID.
        """
        print(f"\n[Pipeline] Starting pipeline for Task ROW_ID: {row_id}")
        
        # 1. Update status to IN_PROGRESS
        self.hap_repo.update_task_status(row_id, TaskStatus.PROCESSING.value, "开始处理...")
        
        # Create a unique workspace for this task
        task_dir = os.path.join(self.workspace_root, row_id)
        if not os.path.exists(task_dir):
            os.makedirs(task_dir)
            
        try:
            # 2. Fetch task details & download video
            print("[Pipeline] 1/7: Fetching and downloading video...")
            video_url, video_name = self.hap_repo.get_pending_task_details(row_id)
            if not video_url:
                raise ValueError("未获取到原视频 URL，任务可能不包含有效附件。")
                
            original_video_path = os.path.join(task_dir, video_name)
            # We need a download helper method in HAP Repo, or use requests here.
            # To keep it cohesive, let's use a quick requests download here for now.
            import requests
            with requests.get(video_url, stream=True, timeout=(10, 60)) as r:
                r.raise_for_status()
                with open(original_video_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
            
            # 3. Extract Audio
            print("[Pipeline] 2/7: Extracting audio...")
            extracted_audio_path = os.path.join(task_dir, "original_audio.wav")
            if not self.media_processor.extract_audio(original_video_path, extracted_audio_path):
                raise RuntimeError("视频音频分离失败。")

            # 4. ASR (Speech to Text & Timestamps)
            print("[Pipeline] 3/7: Running ASR recognition...")
            segments = self.ai_service.transcribe_audio(extracted_audio_path)
            if not segments:
                raise RuntimeError("未识别到任何语音或ASR接口报错。")
            
            # 4.5 LLM Typo Correction (Plan A) & Auto-Detection
            print("[Pipeline] 3.5/7: Auto-detecting industry context and correcting ASR typos via LLM...")
            detected_context = self.ai_service.detect_industry_context(segments)
            print(f"[Pipeline] -> Detected video context: {detected_context}")
            
            segments = self.ai_service.correct_transcription(segments, industry_context=detected_context)

            # --- PROGRESSIVE UPLOAD A: Mandarin Subtitles ---
            print("[Pipeline] -> Uploading intermediate Mandarin Subtitle to Mingdao Cloud...")
            mandarin_srt_path = os.path.join(task_dir, "mandarin_subtitles.srt")
            self.media_processor.generate_srt(segments, mandarin_srt_path)
            self.hap_repo.upload_mandarin_subtitle(row_id, mandarin_srt_path)
            
            # 5. Translate, TTS & Time-Stretch (The core loop)
            print(f"[Pipeline] 4/7: Processing {len(segments)} segments (Translate -> TTS -> Stretch)...")
            final_audio_segments_paths = []
            
            for i, seg in enumerate(segments):
                print(f"  -> Segment {i+1}/{len(segments)}: {seg.text}")
                # a. Translate
                seg.translated_text = self.ai_service.translate_to_cantonese(seg.text)
                
                # b. TTS
                raw_tts_path = os.path.join(task_dir, f"raw_tts_{i}.wav")
                if not self.ai_service.synthesize_speech(seg.translated_text, raw_tts_path):
                     raise RuntimeError(f"片段 {i+1} 语音合成失败。")
                
                # c. Time Stretch
                target_duration_ms = seg.end_time - seg.start_time
                stretched_tts_path = os.path.join(task_dir, f"stretched_tts_{i}.wav")
                if not self.media_processor.stretch_audio(raw_tts_path, target_duration_ms, stretched_tts_path):
                    # Fallback to raw if stretching fails
                    stretched_tts_path = raw_tts_path 
                    
                final_audio_segments_paths.append(stretched_tts_path)

            # 6. Merge Audios and Generate Subtitles
            print("[Pipeline] 5/7: Merging audio and generating SRT...")
            full_cantonese_audio_path = os.path.join(task_dir, "full_cantonese.wav")
            
            # Get original video duration for exact padding
            total_duration_ms = self.media_processor.get_media_duration_ms(original_video_path)
            if total_duration_ms == 0:
                print("Warning: Could not get exact video duration, using fallback length.")
                total_duration_ms = segments[-1].end_time + 5000 if segments else 10000
                
            self.media_processor.merge_audio_segments(
                segments=segments,
                generated_audio_paths=final_audio_segments_paths,
                output_path=full_cantonese_audio_path,
                total_duration_ms=total_duration_ms
            )
            
            srt_path = os.path.join(task_dir, "subtitles.srt")
            self.media_processor.generate_srt(segments, srt_path, use_translated=True)
            
            # --- PROGRESSIVE UPLOAD B & C: Cantonese Subtitles & Audio ---
            print("[Pipeline] -> Uploading intermediate Cantonese Subtitle and Audio to Mingdao Cloud...")
            if not self.hap_repo.upload_cantonese_subtitle(row_id, srt_path):
                print("[Pipeline] Warning: Failed to upload Cantonese Subtitles to Mingdao.")
            
            if not self.hap_repo.upload_cantonese_audio(row_id, full_cantonese_audio_path):
                print("[Pipeline] Warning: Failed to upload Cantonese Audio to Mingdao.")
            
            # 7. Final Remux & Upload
            print("[Pipeline] 6/7: Remuxing video with hard-subs...")
            final_video_path = os.path.join(task_dir, f"translated_{video_name}")
            self.media_processor.remux_video_with_audio_and_subs(
                original_video_path=original_video_path,
                new_audio_path=full_cantonese_audio_path,
                srt_path=srt_path,
                output_video_path=final_video_path
            )
            
            print("[Pipeline] 7/7: Uploading to HAP...")
            if os.path.exists(final_video_path):
                upload_success = self.hap_repo.upload_translated_video(row_id, final_video_path)
                
                # --- ULTIMATE FAILSAFE: Write Download URLs to the Service Log Text Field ---
                try:
                    public_host = os.getenv("PUBLIC_HOST_URL", "").rstrip('/')
                    if public_host:
                        links_text = "✅ 视频互译任务完成！\n\n【专属防封锁直链下载通道】(可直接右键另存为)：\n"
                        links_text += f"🎬 最终合成视频: {public_host}/download/{row_id}/translated_{video_name}\n"
                        links_text += f"🎵 纯净粤语配音: {public_host}/download/{row_id}/full_cantonese.wav\n"
                        links_text += f"📝 粤语纯字幕: {public_host}/download/{row_id}/subtitles.srt\n"
                        links_text += f"📝 国语原字幕: {public_host}/download/{row_id}/mandarin_subtitles.srt\n"
                        
                        if not upload_success:
                            links_text = "⚠️ 由于视频过大被明道云网关拦截，已自动为您开启【专属防封锁直链下载通道】\n\n" + links_text
                            
                        # Push this as the successful "Error Log" so the user sees it in the Mingdao UI
                        self.hap_repo.upload_error_log(row_id, links_text)
                except Exception as link_e:
                    print(f"[Pipeline] Failed to write failsafe links to log: {link_e}")

                # Regardless of attachment upload success (since we have the link failsafe), mark as completed
                self.hap_repo.update_task_status(row_id, TaskStatus.COMPLETED.value, "任务完成 - 请查看执行日志获取直链")
                
                # 故意保留生成的文件不清理 (Do not cleanup!) 
                # 因为我们要通过 HTTP 直链让用户下载这些文件
                print(f"[Pipeline] Files are intentionally preserved for Failsafe URL downloads in: {task_dir}")
                
                return True
            else:
                raise RuntimeError("最终视频文件合成失败，未找到输出文件。")
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            error_msg = f"处理异常: {str(e)}"
            print(f"[Pipeline] ERROR: {error_msg}")
            
            # Update HAP Status
            self.hap_repo.update_task_status(row_id, TaskStatus.FAILED.value, error_msg)
            
            # Push full stack trace back to Mingdao Cloud's service_log field
            # Limit length to 10000 characters just in case of massive blowout
            clipped_trace = error_trace[-50000:] if len(error_trace) > 50000 else error_trace
            log_payload = f"Pipeline Crash Log:\n{error_msg}\n\nTraceback:\n{clipped_trace}"
            self.hap_repo.upload_error_log(row_id, log_payload)
            
            return False
