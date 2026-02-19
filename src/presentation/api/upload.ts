// 上传 API
// 边界：HTTP 适配层，处理文件上传请求

import { NextApiRequest, NextApiResponse } from 'next';
import { UploadServiceImpl } from '@/application/services/UploadService';
import { TaskServiceImpl } from '@/application/services/TaskService';
import { HAPClient } from '@/infrastructure/hap/HAPClient';
import { logger } from '@/utils/logger';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, videoUrl, fileName, fileSize, mimeType } = req.body;

    if (!title || !videoUrl) {
      return res.status(400).json({ error: 'Title and videoUrl are required' });
    }

    logger.info('Upload API called', { title, fileName });

    // 初始化服务
    const hapClient = new HAPClient();
    const taskService = new TaskServiceImpl(hapClient);
    const uploadService = new UploadServiceImpl(taskService);

    // 处理上传
    const result = await uploadService.uploadVideo(title, {
      name: fileName || 'video.mp4',
      url: videoUrl,
      size: fileSize,
      mimeType,
    });

    logger.info('Upload API completed', { taskId: result.taskId });

    return res.status(200).json({
      success: true,
      data: {
        taskId: result.taskId,
        title: result.title,
        videoUrl: result.videoUrl,
      },
    });
  } catch (error) {
    logger.error('Upload API error', error);
    return res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
