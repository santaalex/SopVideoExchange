// HAP 客户端实现
// 边界：实现 IHAPClient 接口，封装 HAP V3 API 调用

import axios, { AxiosInstance } from 'axios';
import { IHAPClient, TaskData, TaskFilter } from '../../domain/interfaces/IHAPClient';
import { Task, TaskData } from '../../domain/entities/Task';
import { Video, VideoData } from '../../domain/entities/Video';
import { TaskStatus, Status } from '../../domain/value-objects/Status';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';

export class HAPClient implements IHAPClient {
  private readonly client: AxiosInstance;
  private readonly worksheetId: string;

  constructor() {
    const config = getConfig();
    
    this.client = axios.create({
      baseURL: 'https://api.mingdao.com/v3/app/worksheets',
      headers: {
        'HAP-Appkey': config.hap.appkey,
        'HAP-Sign': config.hap.sign,
        'Content-Type': 'application/json',
      },
    });

    this.worksheetId = config.hap.worksheetId;
  }

  async createTask(data: TaskData): Promise<string> {
    logger.info('Creating task in HAP', { title: data.title });

    const fields: Record<string, unknown> = {
      title: data.title,
      status: (data.status || TaskStatus.PENDING).toString(),
    };

    if (data.originalVideo) {
      fields.original_video = data.originalVideo.toHAPRequest();
    }

    const response = await this.client.post<{
      success: boolean;
      data: { id: string };
    }>(`/${this.worksheetId}/rows`, {
      fields,
      triggerWorkflow: false,
    });

    if (!response.data.success) {
      throw new Error('Failed to create task in HAP');
    }

    logger.info('Task created successfully', { taskId: response.data.data.id });
    return response.data.data.id;
  }

  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    logger.info('Fetching tasks from HAP', { filter });

    const pageSize = filter?.pageSize || 50;
    const pageIndex = filter?.pageIndex || 1;

    const body: Record<string, unknown> = {
      pageSize,
      pageIndex,
      responseFormat: 'json',
    };

    // 添加筛选条件
    if (filter?.status) {
      body.filter = {
        type: 'condition',
        field: 'status',
        operator: 'eq',
        value: [filter.status.toString()],
      };
    }

    // 添加排序
    if (filter?.sortBy) {
      body.sorts = [{
        field: filter.sortBy,
        isAsc: filter.sortOrder === 'asc',
      }];
    }

    const response = await this.client.post<{
      success: boolean;
      data: { rows: unknown[] };
    }>(`/${this.worksheetId}/rows/list`, body);

    if (!response.data.success) {
      throw new Error('Failed to fetch tasks from HAP');
    }

    const tasks: Task[] = [];
    for (const row of response.data.data.rows) {
      const task = this.parseRowToTask(row);
      if (task) {
        tasks.push(task);
      }
    }

    logger.info('Fetched tasks successfully', { count: tasks.length });
    return tasks;
  }

  async getTask(id: string): Promise<Task | null> {
    logger.info('Fetching task from HAP', { taskId: id });

    try {
      const response = await this.client.get<{
        success: boolean;
        data: unknown;
      }>(`/${this.worksheetId}/rows/${id}`, {
        params: { responseFormat: 'json' },
      });

      if (!response.data.success) {
        throw new Error('Failed to fetch task from HAP');
      }

      const task = this.parseRowToTask(response.data.data);
      logger.info('Task fetched successfully', { taskId: id });
      return task;
    } catch (error) {
      logger.error('Failed to fetch task', error, { taskId: id });
      return null;
    }
  }

  async updateTask(id: string, data: Partial<TaskData>): Promise<void> {
    logger.info('Updating task in HAP', { taskId: id, data });

    const fields: Record<string, unknown> = {};

    if (data.title) {
      fields.title = data.title;
    }

    if (data.status) {
      fields.status = data.status.toString();
    }

    if (data.originalVideo) {
      fields.original_video = data.originalVideo.toHAPRequest();
    }

    const response = await this.client.patch<{
      success: boolean;
    }>(`/${this.worksheetId}/rows/${id}`, {
      fields,
      triggerWorkflow: false,
    });

    if (!response.data.success) {
      throw new Error('Failed to update task in HAP');
    }

    logger.info('Task updated successfully', { taskId: id });
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    await this.updateTask(id, { status });
  }

  async updateTaskVideoField(id: string, field: string, video: Video): Promise<void> {
    logger.info('Updating task video field in HAP', { taskId: id, field });

    const fieldMap: Record<string, string> = {
      originalVideo: 'original_video',
      mandarinSubtitle: 'mandarin_subtitle',
      cantoneseSubtitle: 'cantonese_subtitle',
      cantoneseAudio: 'cantonese_audio',
      outputVideo: 'output_video',
    };

    const hapField = fieldMap[field] || field;

    const response = await this.client.patch<{
      success: boolean;
    }>(`/${this.worksheetId}/rows/${id}`, {
      fields: {
        [hapField]: video.toHAPRequest(),
      },
      triggerWorkflow: false,
    });

    if (!response.data.success) {
      throw new Error(`Failed to update task field ${field} in HAP`);
    }

    logger.info('Task video field updated successfully', { taskId: id, field });
  }

  async deleteTask(id: string): Promise<void> {
    logger.info('Deleting task from HAP', { taskId: id });

    const response = await this.client.delete<{
      success: boolean;
    }>(`/${this.worksheetId}/rows/${id}`, {
      data: {
        permanent: false,
        triggerWorkflow: false,
      },
    });

    if (!response.data.success) {
      throw new Error('Failed to delete task from HAP');
    }

    logger.info('Task deleted successfully', { taskId: id });
  }

  // 解析 HAP 返回的行为 Task 对象
  private parseRowToTask(row: unknown): Task | null {
    try {
      const data = row as {
        id: string;
        title?: string;
        status?: string;
        original_video?: { name: string; url: string }[];
        mandarin_subtitle?: { name: string; url: string }[];
        cantonese_subtitle?: { name: string; url: string }[];
        cantonese_audio?: { name: string; url: string }[];
        output_video?: { name: string; url: string }[];
        _createdAt?: string;
      };

      if (!data.id || !data.title) {
        return null;
      }

      const parseVideo = (files?: { name: string; url: string }[]): VideoData | undefined => {
        if (!files || files.length === 0) return undefined;
        return files[0];
      };

      return new Task({
        id: data.id,
        title: data.title,
        status: data.status ? TaskStatus.fromString(data.status) : TaskStatus.PENDING,
        originalVideo: parseVideo(data.original_video),
        mandarinSubtitle: parseVideo(data.mandarin_subtitle),
        cantoneseSubtitle: parseVideo(data.cantonese_subtitle),
        cantoneseAudio: parseVideo(data.cantonese_audio),
        outputVideo: parseVideo(data.output_video),
        createdAt: data._createdAt ? new Date(data._createdAt) : undefined,
      });
    } catch (error) {
      logger.error('Failed to parse row to task', error);
      return null;
    }
  }
}
