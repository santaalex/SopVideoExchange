// 阿里灵杰 ASR 服务实现
// 边界：实现 IASRService 接口，封装阿里灵杰语音识别 API 调用

import axios from 'axios';
import { IASRService, ASRResult } from '../../domain/interfaces/IASRService';
import { Video } from '../../domain/entities/Video';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

export class ASRService implements IASRService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.aliyun.apiKey;
    this.baseUrl = config.aliyun.baseUrl;
  }

  async transcribe(video: Video): Promise<ASRResult> {
    logger.info('Starting ASR transcription', { videoUrl: video.url });

    try {
      // 注意：这是简化实现，实际需要根据阿里灵杰 API 文档调整
      const response = await axios.post<{
        results?: { text: string; start_time: number; end_time: number }[];
      }>(`${this.baseUrl}/audio/asr`, {
        model: 'paraformer-v2', // 阿里灵杰 ASR 模型
        input: {
          file_urls: [video.url],
        },
        parameters: {
          enable_words: true,
          enable_sample_rate: true,
        },
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const subtitles = (response.data.results || []).map(result => ({
        startTime: result.start_time,
        endTime: result.end_time,
        text: result.text,
      }));

      const result: ASRResult = {
        subtitles,
        language: 'zh',
        confidence: 0.9, // 简化处理
      };

      logger.info('ASR transcription completed', { 
        videoUrl: video.url, 
        subtitleCount: subtitles.length 
      });

      return result;
    } catch (error) {
      logger.error('ASR transcription failed', error, { videoUrl: video.url });
      throw new Error(`ASR transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  toSRT(result: ASRResult): string {
    let srt = '';
    let index = 1;

    for (const entry of result.subtitles) {
      const startTime = this.formatSRTTime(entry.startTime);
      const endTime = this.formatSRTTime(entry.endTime);

      srt += `${index}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${entry.text}\n\n`;

      index++;
    }

    return srt;
  }

  getSupportedLanguages(): string[] {
    return ['zh', 'zh-CN', 'zh-HK', 'zh-TW', 'en', 'ja', 'ko'];
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)},${this.pad(ms, 3)}`;
  }

  private pad(num: number, length: number = 2): string {
    return num.toString().padStart(length, '0');
  }
}
