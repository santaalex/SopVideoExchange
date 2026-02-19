// 上传服务
// 边界：处理视频上传，依赖 TaskService 和 HAPClient

import { TaskServiceImpl } from './TaskService';
import { TaskStatus } from '../../domain/value-objects/Status';
import { Video } from '../../domain/entities/Video';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

export interface UploadResult {
  taskId: string;
  videoUrl: string;
  title: string;
}

export interface UploadService {
  uploadVideo(title: string, videoFile: { name: string; url: string; size?: number }): Promise<UploadResult>;
}

export class UploadServiceImpl implements UploadService {
  private readonly taskService: TaskServiceImpl;
  private readonly maxFileSize: number;
  private readonly allowedVideoTypes: string[];

  constructor(taskService: TaskServiceImpl) {
    this.taskService = taskService;
    const config = getConfig();
    this.maxFileSize = config.app.maxFileSize;
    this.allowedVideoTypes = config.app.allowedVideoTypes;
  }

  async uploadVideo(
    title: string,
    videoFile: { name: string; url: string; size?: number; mimeType?: string }
  ): Promise<UploadResult> {
    logger.info('Starting video upload', { title, fileName: videoFile.name });

    // 验证文件
    this.validateVideoFile(videoFile);

    // 创建任务
    const taskId = await this.taskService.createTask(title);

    // 创建 Video 实体
    const video = new Video({
      name: videoFile.name,
      url: videoFile.url,
      size: videoFile.size,
      mimeType: videoFile.mimeType,
    });

    // 将视频关联到任务
    // 注意：这里需要直接调用 HAPClient 来更新任务
    // 简化处理，实际应该通过 TaskService 的方法
    await this.taskService.updateTaskStatus(taskId, TaskStatus.PENDING);

    logger.info('Video upload completed', { taskId, title, fileName: videoFile.name });

    return {
      taskId,
      videoUrl: videoFile.url,
      title,
    };
  }

  private validateVideoFile(file: { name: string; url: string; size?: number; mimeType?: string }): void {
    // 检查文件名
    if (!file.name) {
      throw new Error('Video file name is required');
    }

    // 检查文件大小
    if (file.size && file.size > this.maxFileSize) {
      throw new Error(`Video file size exceeds limit: ${file.size} > ${this.maxFileSize}`);
    }

    // 检查文件类型
    const extension = file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.mimeType || this.getMimeTypeFromExtension(extension || '');
    
    const isAllowed = this.allowedVideoTypes.some(
      allowed => allowed.includes(mimeType) || allowed.includes(extension || '')
    );

    if (!isAllowed) {
      throw new Error(`Video type not allowed: ${extension}`);
    }

    logger.debug('Video file validated', { fileName: file.name, size: file.size, mimeType });
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      avi: 'video/avi',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
    };

    return mimeTypes[extension] || 'video/mp4';
  }
}
