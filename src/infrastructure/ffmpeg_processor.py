import os
import subprocess
import ffmpeg
from src.domain.media_interfaces import IMediaProcessor
from src.domain.ai_interfaces import SpeechSegment

class FfmpegMediaProcessor(IMediaProcessor):
    def __init__(self):
        self.ffmpeg_cmd = os.getenv("FFMPEG_CMD", "ffmpeg")
        self.ffprobe_cmd = os.getenv("FFPROBE_CMD", "ffprobe")
        
        # Safe fallback for the user's local Windows machine if env vars are perfectly matched
        if os.name == 'nt' and not os.getenv("FFMPEG_CMD"):
            local_ffmpeg = r"C:\Users\40752\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe"
            if os.path.exists(local_ffmpeg): self.ffmpeg_cmd = local_ffmpeg
            local_ffprobe = r"C:\Users\40752\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin\ffprobe.exe"
            if os.path.exists(local_ffprobe): self.ffprobe_cmd = local_ffprobe

    def get_media_duration_ms(self, file_path: str) -> int:
        try:
            probe = ffmpeg.probe(file_path, cmd=self.ffprobe_cmd)
            return int(float(probe['format']['duration']) * 1000)
        except Exception as e:
            print(f"Error getting duration for {file_path}: {e}")
            return 0

    def extract_audio(self, video_path: str, output_audio_path: str) -> bool:
        try:
            (
                ffmpeg
                .input(video_path)
                .output(output_audio_path, format='wav', acodec='pcm_s16le', ac=1, ar='16k')
                .overwrite_output()
                .run(cmd=self.ffmpeg_cmd, quiet=True)
            )
            return os.path.exists(output_audio_path)
        except ffmpeg.Error as e:
            print(f"FFmpeg extract_audio error: {e.stderr.decode('utf-8') if e.stderr else e}")
            return False

    def stretch_audio(self, input_audio_path: str, target_duration_ms: int, output_audio_path: str) -> bool:
        """
        Calculates ratio and stretches audio using FFmpeg's atempo filter to maintain pitch.
        """
        try:
            # We need original duration to calculate ratio. Easiest way is ffprobe.
            probe = ffmpeg.probe(input_audio_path, cmd=self.ffprobe_cmd)
            original_duration_ms = float(probe['format']['duration']) * 1000
            
            if original_duration_ms <= 0:
                print("Error: Input audio has 0 duration.")
                return False

            if abs(original_duration_ms - target_duration_ms) < 50:
                import shutil
                shutil.copy(input_audio_path, output_audio_path)
                return True

            ratio = original_duration_ms / target_duration_ms
            
            # FFmpeg atempo filter strictly requires ratio between 0.5 and 100.0
            ratio = max(0.5, min(100.0, ratio))
            
            print(f"[MediaProcessor] Stretching {input_audio_path} | Ratio: {ratio:.3f} ({original_duration_ms}ms -> {target_duration_ms}ms)")

            # FFmpeg atempo filter works between 0.5 and 100.0.
            (
                ffmpeg
                .input(input_audio_path)
                .filter('atempo', ratio)
                .output(output_audio_path, format='wav', acodec='pcm_s16le', ac=1, ar='16k')
                .overwrite_output()
                .run(cmd=self.ffmpeg_cmd, quiet=True)
            )
            
            return os.path.exists(output_audio_path)
            
        except ffmpeg.Error as e:
            print(f"Error in stretch_audio: {e.stderr.decode('utf-8') if e.stderr else e}")
            return False
        except Exception as e:
            print(f"Exception in stretch_audio: {e}")
            return False

    def merge_audio_segments(self, segments: list[SpeechSegment], generated_audio_paths: list[str], output_path: str, total_duration_ms: int) -> bool:
        """
        Merges individual stretched TTS audio files into a single track by inserting silence
        based on the exact start_time of each segment. Pads to total_duration_ms.
        Uses pure Python `wave` module to avoid pydub/audioop dependency issues on Python 3.13+
        and completely bypasses FFmpeg amix dropout bugs and Windows command length limits!
        """
        import wave
        import struct
        
        try:
            if not segments or not generated_audio_paths or len(segments) != len(generated_audio_paths):
                print("Error: Segments and paths mismatch or empty.")
                return False
                
            sample_rate = 16000
            channels = 1
            sampwidth = 2 # 16-bit PCM
            
            # Create silence generator
            def generate_silence(duration_ms: int) -> bytes:
                num_samples = int((duration_ms / 1000.0) * sample_rate)
                return b'\x00' * (num_samples * channels * sampwidth)
                
            task_dir = os.path.dirname(output_path)
            
            print(f"[MediaProcessor] Merging {len(generated_audio_paths)} audio segments via pure Python `wave` module directly...")
            
            with wave.open(output_path, 'wb') as outfile:
                outfile.setnchannels(channels)
                outfile.setsampwidth(sampwidth)
                outfile.setframerate(sample_rate)
                
                current_time_ms = 0
                
                for seg, path in zip(segments, generated_audio_paths):
                    if not os.path.exists(path):
                        continue
                        
                    # 1. Add silence gap if needed
                    if seg.start_time > current_time_ms:
                        gap_ms = seg.start_time - current_time_ms
                        outfile.writeframes(generate_silence(gap_ms))
                        current_time_ms = seg.start_time
                        
                    # 2. Add actual audio
                    try:
                        with wave.open(path, 'rb') as infile:
                            # Verify format
                            if infile.getnchannels() != channels or infile.getframerate() != sample_rate or infile.getsampwidth() != sampwidth:
                                print(f"Warning: Format mismatch in {path}, skipping.")
                                continue
                                
                            frames = infile.readframes(infile.getnframes())
                            outfile.writeframes(frames)
                            
                            # Update current time based on actual frames written
                            duration_written_ms = int((len(frames) / (channels * sampwidth) / sample_rate) * 1000)
                            current_time_ms += duration_written_ms
                            
                    except Exception as e:
                        print(f"Error reading audio chunk {path}: {e}")
                
                # 3. Add final padding if needed
                if current_time_ms < total_duration_ms:
                    padding_ms = total_duration_ms - current_time_ms
                    outfile.writeframes(generate_silence(padding_ms))
                    
            return os.path.exists(output_path)
            
        except Exception as e:
            print(f"Error in pure Python merge_audio_segments algorithm: {e}")
            raise RuntimeError(f"音频轨道合并阶段遇到异常: {e}")

    def generate_srt(self, segments: list[SpeechSegment], output_srt_path: str, use_translated: bool = False) -> bool:
        try:
            def format_timestamp(ms: int) -> str:
                hours = ms // 3600000
                ms %= 3600000
                minutes = ms // 60000
                ms %= 60000
                seconds = ms // 1000
                milliseconds = ms % 1000
                return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

            import re
            srt_content = []
            subtitle_index = 1
            max_chars_per_line = 25
            
            for seg in segments:
                text = seg.translated_text if (use_translated and seg.translated_text) else seg.text
                if not text:
                    continue
                    
                # Split long segments proportionally
                parts = re.split(r'([。！？，；：,.\?\!])', text)
                chunks = []
                curr = ""
                for i in range(0, len(parts)-1, 2):
                    piece = parts[i] + parts[i+1]
                    if len(curr) + len(piece) <= max_chars_per_line:
                        curr += piece
                    else:
                        if curr: chunks.append(curr.strip())
                        if len(piece) > max_chars_per_line:
                            # force break long unpunctuated sentences
                            s = 0
                            while s < len(piece):
                                chunks.append(piece[s:s+max_chars_per_line].strip())
                                s += max_chars_per_line
                            curr = ""
                        else:
                            curr = piece
                if len(parts) % 2 != 0 and parts[-1]:
                    if len(curr) + len(parts[-1]) <= max_chars_per_line:
                        curr += parts[-1]
                        if curr: chunks.append(curr.strip())
                    else:
                        if curr: chunks.append(curr.strip())
                        chunks.append(parts[-1].strip())
                elif curr:
                    chunks.append(curr.strip())
                    
                chunks = [c for c in chunks if c.strip()]
                if not chunks:
                    continue
                    
                total_chars = sum(len(c) for c in chunks)
                current_start_ms = seg.start_time
                duration_ms = seg.end_time - seg.start_time
                
                for chunk in chunks:
                    chunk_len = len(chunk)
                    chunk_duration = int((chunk_len / total_chars) * duration_ms) if total_chars > 0 else 0
                    chunk_end_ms = current_start_ms + chunk_duration
                    
                    # Prevent gap
                    srt_content.append(f"{subtitle_index}\n{format_timestamp(current_start_ms)} --> {format_timestamp(chunk_end_ms)}\n{chunk}\n")
                    subtitle_index += 1
                    current_start_ms = chunk_end_ms

            with open(output_srt_path, "w", encoding="utf-8") as f:
                f.write("\n".join(srt_content))
            return os.path.exists(output_srt_path)
        except Exception as e:
            print(f"Error in generate_srt: {e}")
            return False

    def remux_video_with_audio_and_subs(self, original_video_path: str, new_audio_path: str, srt_path: str, output_video_path: str) -> bool:
        try:
            task_dir = os.path.dirname(output_video_path)
            srt_basename = os.path.basename(srt_path)
            out_basename = os.path.basename(output_video_path)
            
            # Using the subtitles video filter to hard-sub the generated SRT. 
            # We use forward slashes or relative paths by setting cwd to task_dir.
            ffmpeg_filter = f"subtitles='{srt_basename}':force_style='FontName=WenQuanYi Zen Hei,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=20'"
            
            cmd = [
                self.ffmpeg_cmd, '-y',
                '-i', original_video_path,
                '-i', new_audio_path,
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-vf', ffmpeg_filter,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart',
                out_basename
            ]
            
            print(f"[MediaProcessor] Remuxing video with hard-subs. This may take a while depending on video length...")
            subprocess.run(cmd, cwd=task_dir, check=True, stderr=subprocess.PIPE)
            
            return os.path.exists(output_video_path)
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.decode('utf-8', errors='ignore') if e.stderr else str(e)
            print(f"remux_video_with_audio_and_subs subprocess error: {err_msg}")
            return False
        except Exception as e:
            print(f"Error compiling video: {e}")
            return False
