// 语音识别服务接口
// 边界：定义语音识别的契约，具体实现由 infrastructure 层提供

import { Video } from '../entities/Video';

export interface SubtitleEntry {
  startTime: number; // 秒
  endTime: number; // 秒
  text: string;
}

export interface ASRResult {
  subtitles: SubtitleEntry[];
  language: string;
  confidence: number;
}

export interface IASRService {
  // 识别视频中的语音，返回 SRT 格式字幕
  transcribe(video: Video): Promise<ASRResult>;
  
  // 将 ASR 结果转换为 SRT 格式
  toSRT(result: ASRResult): string;
  
  // 获取支持的语言列表
  getSupportedLanguages(): string[];
}
