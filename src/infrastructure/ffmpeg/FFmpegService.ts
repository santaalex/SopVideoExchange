// FFmpeg 服务实现
// 边界：实现 IFFmpegService 接口，封装 FFmpeg 视频处理

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import axios from 'axios';
import { IFFmpegService, FFmpegResult, SubtitleOption, AudioOption } from '../../domain/interfaces/IFFmpegService';
import { Video } from '../../domain/entities/Video';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdtempAsync = promisify(fs.mkdtemp);

export class FFmpegService implements IFFmpegService {
  private readonly tempDir: string;

  constructor() {
    this.tempDir = process.env.TEMP_DIR || '/tmp';
  }

  async combine(
    video: Video,
    subtitles: SubtitleOption[],
    audio?: AudioOption
  ): Promise<FFmpegResult> {
    logger.info('Starting video combination', { 
      videoUrl: video.url,
      subtitleCount: subtitles.length,
      hasAudio: !!audio 
    });

    const tempDir = await this.createTempDir();
    const tempVideoPath = path.join(tempDir, 'input.mp4');
    const tempSrtPath = path.join(tempDir, 'subtitles.srt');
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
      // 下载视频
      await this.downloadFile(video.url, tempVideoPath);

      // 烧录双语字幕
      if (subtitles.length > 0) {
        // 合并所有字幕到一个 SRT 文件
        const combinedSrt = subtitles.map(s => s.srtContent).join('\n');
        await writeFileAsync(tempSrtPath, combinedSrt, 'utf-8');

        // 构建 FFmpeg 命令
        await this.burnSubtitlesToVideo(tempVideoPath, tempSrtPath, outputPath);
      } else {
        // 只复制视频（无字幕）
        await this.copyVideo(tempVideoPath, outputPath);
      }

      // 混合音频（如果需要）
      if (audio) {
        await this.mixAudio(outputPath, audio.audioUrl, audio.volume);
      }

      // 获取输出视频信息
      const info = await this.getVideoInfo(new Video({ name: 'output.mp4', url: outputPath }));

      // 上传到 HAP 或返回本地路径
      // 简化处理：返回本地文件路径，实际应该上传到存储服务
      const result: FFmpegResult = {
        videoUrl: outputPath,
        duration: info.duration,
      };

      logger.info('Video combination completed', { duration: result.duration });
      return result;
    } finally {
      // 清理临时文件
      await this.cleanupTempDir(tempDir);
    }
  }

  async burnSubtitles(video: Video, srtContent: string): Promise<Video> {
    logger.info('Burning subtitles to video', { videoUrl: video.url });

    const tempDir = await this.createTempDir();
    const tempVideoPath = path.join(tempDir, 'input.mp4');
    const tempSrtPath = path.join(tempDir, 'subtitles.srt');
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
      await this.downloadFile(video.url, tempVideoPath);
      await writeFileAsync(tempSrtPath, srtContent, 'utf-8');
      await this.burnSubtitlesToVideo(tempVideoPath, tempSrtPath, outputPath);

      return new Video({
        name: `with_subtitles_${video.name}`,
        url: outputPath,
      });
    } finally {
      await this.cleanupTempDir(tempDir);
    }
  }

  async mixAudio(videoUrl: string, audioUrl: string, volume?: number): Promise<string> {
    logger.info('Mixing audio', { videoUrl, audioUrl, volume });

    const tempDir = await this.createTempDir();
    const videoPath = path.join(tempDir, 'video.mp4');
    const audioPath = path.join(tempDir, 'audio.wav');
    const outputPath = path.join(tempDir, 'mixed.mp4');

    try {
      await this.downloadFile(videoUrl, videoPath);
      await this.downloadFile(audioUrl, audioPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .input(audioPath)
          .complexFilter(`[0:a][1:a]amix=inputs=2:duration=first:weights=${1} ${volume || 1}[a]`)
          .outputOptions(['-map 0:v', '-map [a]'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      });

      return outputPath;
    } finally {
      await this.cleanupTempDir(tempDir);
    }
  }

  async adjustAudioSpeed(audioUrl: string, targetDuration: number): Promise<string> {
    logger.info('Adjusting audio speed', { audioUrl, targetDuration });

    const tempDir = await this.createTempDir();
    const inputPath = path.join(tempDir, 'input.wav');
    const outputPath = path.join(tempDir, 'output.wav');

    try {
      await this.downloadFile(audioUrl, inputPath);

      // 获取原始时长
      const originalDuration = await this.getAudioDuration(inputPath);

      // 计算速度比率
      const speedRatio = originalDuration / targetDuration;

      // 使用 atempo 调整速度（FFmpeg 只支持 0.5-2.0 范围）
      if (speedRatio >= 0.5 && speedRatio <= 2.0) {
        await this.adjustSpeedSingle(inputPath, outputPath, speedRatio);
      } else if (speedRatio > 2.0) {
        // 需要分两步调整
        const intermediatePath = path.join(tempDir, 'intermediate.wav');
        await this.adjustSpeedSingle(inputPath, intermediatePath, 2.0);
        await this.adjustSpeedSingle(intermediatePath, outputPath, speedRatio / 2);
      } else {
        const intermediatePath = path.join(tempDir, 'intermediate.wav');
        await this.adjustSpeedSingle(inputPath, intermediatePath, 0.5);
        await this.adjustSpeedSingle(intermediatePath, outputPath, speedRatio * 2);
      }

      return outputPath;
    } finally {
      await this.cleanupTempDir(tempDir);
    }
  }

  async getVideoInfo(video: Video): Promise<{ duration: number; width: number; height: number }> {
    const tempDir = await this.createTempDir();
    const videoPath = path.join(tempDir, 'video.mp4');

    try {
      await this.downloadFile(video.url, videoPath);

      return await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          resolve({
            duration: metadata.format.duration || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
          });
        });
      });
    } finally {
      await this.cleanupTempDir(tempDir);
    }
  }

  async downloadFile(url: string, savePath?: string): Promise<string> {
    const tempDir = await this.createTempDir();
    const filePath = savePath || path.join(tempDir, path.basename(url).split('?')[0] || 'file');

    const response = await axios.get<Buffer>(url, {
      responseType: 'arraybuffer',
    });

    await writeFileAsync(filePath, response.data);

    return filePath;
  }

  private async burnSubtitlesToVideo(
    inputPath: string,
    srtPath: string,
    outputPath: string
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .input(srtPath)
        .complexFilter([
          '[0:v][1:s]overlay[v]'
        ])
        .outputOptions([
          '-map [v]',
          '-map 0:a',
          '-c:a copy'
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        . subtitles(srtPath, { strict: -1 })
        .run();
    });
  }

  private async copyVideo(inputPath: string, outputPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    return await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  private async adjustSpeedSingle(
    inputPath: string,
    outputPath: string,
    speedRatio: number
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([`-atempo=${speedRatio}`])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private async createTempDir(): Promise<string> {
    return mkdtempAsync(path.join(this.tempDir, 'ffmpeg-'));
  }

  private async cleanupTempDir(dir: string): Promise<void> {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      await unlinkAsync(path.join(dir, file));
    }
    await fs.promises.rmdir(dir);
  }
}
