// 文本转语音服务接口
// 边界：定义 TTS 的契约，具体实现由 infrastructure 层提供

import { Video } from '../entities/Video';
import { SubtitleEntry } from './IASRService';

export interface TTSResult {
  audioUrl: string;
  audioBuffer?: Buffer;
  duration: number; // 秒
}

export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female';
}

export interface ITTSService {
  // 合成语音
  synthesize(text: string, language: string, voiceId?: string): Promise<TTSResult>;
  
  // 根据字幕合成语音（保持时间轴）
  synthesizeSubtitles(entries: SubtitleEntry[], language: string, voiceId?: string): Promise<TTSResult>;
  
  // 获取可用的音色列表
  getAvailableVoices(language?: string): Promise<VoiceOption[]>;
  
  // 下载音频文件
  downloadAudio(url: string): Promise<Buffer>;
}
