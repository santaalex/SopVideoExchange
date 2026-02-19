// FFmpeg 服务接口
// 边界：定义视频处理的契约，具体实现由 infrastructure 层提供

import { Video } from '../entities/Video';

export interface FFmpegResult {
  videoUrl: string;
  duration: number;
}

export interface SubtitleOption {
  srtContent: string;
  position: 'top' | 'bottom'; // 双语字幕的位置
  fontSize?: number;
  fontColor?: string;
}

export interface AudioOption {
  audioUrl: string;
  volume?: number; // 0-1
  startTime?: number;
  duration?: number;
}

export interface IFFmpegService {
  // 合成视频：原视频 + 字幕 + 配音
  combine(
    video: Video,
    subtitles: SubtitleOption[],
    audio?: AudioOption
  ): Promise<FFmpegResult>;
  
  // 烧录字幕到视频
  burnSubtitles(video: Video, srtContent: string): Promise<Video>;
  
  // 混合音频
  mixAudio(videoUrl: string, audioUrl: string, volume?: number): Promise<string>;
  
  // 调整音频速度（用于时间轴对齐）
  adjustAudioSpeed(audioUrl: string, targetDuration: number): Promise<string>;
  
  // 获取视频信息
  getVideoInfo(video: Video): Promise<{ duration: number; width: number; height: number }>;
  
  // 下载远程文件到本地
  downloadFile(url: string): Promise<string>;
}
