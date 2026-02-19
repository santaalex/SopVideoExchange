// 百炼 LLM 服务实现
// 边界：实现 ITranslator 接口，封装百炼 LLM API 调用

import axios from 'axios';
import { ITranslator, TranslationResult, TranslatedEntry } from '../../domain/interfaces/ITranslator';
import { SubtitleEntry } from '../../domain/interfaces/IASRService';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

export class LLMService implements ITranslator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor() {
    const config = getConfig();
    this.apiKey = config.aliyun.apiKey;
    this.baseUrl = config.aliyun.baseUrl;
    this.model = 'qwen2.5-7b-instruct'; // 可配置
  }

  async translate(
    entries: SubtitleEntry[],
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<TranslationResult> {
    logger.info('Starting translation', { 
      entryCount: entries.length,
      sourceLanguage,
      targetLanguage 
    });

    try {
      // 构建翻译提示词
      const prompt = this.buildTranslationPrompt(entries, sourceLanguage, targetLanguage);

      const response = await axios.post<{
        choices: { message: { content: string } }[];
      }>(`${this.baseUrl}/chat/completions`, {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following subtitles from ${sourceLanguage} to ${targetLanguage}. 
            Keep the same meaning and tone. For video subtitles, keep translations concise and natural.
            Return ONLY the translated text, one entry per line, in the same format as the input.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const translatedTexts = response.data.choices[0]?.message?.content
        ?.split('\n')
        .filter(line => line.trim()) || [];

      const result: TranslationResult = {
        entries: entries.map((entry, index) => ({
          originalEntry: entry,
          translatedText: translatedTexts[index] || entry.text,
        })),
      };

      logger.info('Translation completed', { 
        sourceLanguage, 
        targetLanguage,
        translatedCount: result.entries.length 
      });

      return result;
    } catch (error) {
      logger.error('Translation failed', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  toSRT(result: TranslationResult, includeOriginal: boolean): string {
    let srt = '';
    let index = 1;

    for (const entry of result.entries) {
      const startTime = this.formatSRTTime(entry.originalEntry.startTime);
      const endTime = this.formatSRTTime(entry.originalEntry.endTime);

      srt += `${index}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      
      if (includeOriginal) {
        srt += `${entry.originalEntry.text}\n${entry.translatedText}\n\n`;
      } else {
        srt += `${entry.translatedText}\n\n`;
      }

      index++;
    }

    return srt;
  }

  getSupportedLanguages(): string[] {
    return [
      'zh', 'zh-CN', 'zh-HK', 'zh-TW',
      'en', 'en-US', 'en-GB',
      'ja', 'ko',
      'fr', 'de', 'es', 'pt',
      'ru', 'ar'
    ];
  }

  private buildTranslationPrompt(
    entries: SubtitleEntry[],
    sourceLanguage: string,
    targetLanguage: string
  ): string {
    const entriesText = entries
      .map((entry, index) => `[${index}] ${entry.text}`)
      .join('\n');

    return `Translate the following ${entries.length} subtitle entries from ${sourceLanguage} to ${targetLanguage}.

Entries:
${entriesText}

Return format: Only the translated text, one entry per line, in the same order.`;
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
