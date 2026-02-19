// 任务服务
// 边界：实现任务业务逻辑，依赖 IHAPClient 接口

import { IHAPClient, TaskData, TaskFilter } from '../../domain/interfaces/IHAPClient';
import { Task } from '../../domain/entities/Task';
import { TaskStatus } from '../../domain/value-objects/Status';
import { logger } from '../../utils/logger';

export interface TaskService {
  createTask(title: string): Promise<string>;
  getTasks(filter?: TaskFilter): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  updateTaskStatus(id: string, status: TaskStatus): Promise<void>;
  markTaskAsRunning(id: string): Promise<void>;
  markTaskAsSuccess(id: string): Promise<void>;
  markTaskAsFailed(id: string, errorMessage: string): Promise<void>;
  retryTask(id: string): Promise<void>;
  deleteTask(id: string): Promise<void>;
}

export class TaskServiceImpl implements TaskService {
  private readonly hapClient: IHAPClient;

  constructor(hapClient: IHAPClient) {
    this.hapClient = hapClient;
  }

  async createTask(title: string): Promise<string> {
    logger.info('Creating task', { title });

    if (!title || title.trim().length === 0) {
      throw new Error('Task title is required');
    }

    const taskData: TaskData = {
      title: title.trim(),
      status: TaskStatus.PENDING,
    };

    const taskId = await this.hapClient.createTask(taskData);
    
    logger.info('Task created', { taskId, title });
    return taskId;
  }

  async getTasks(filter?: TaskFilter): Promise<Task[]> {
    logger.info('Fetching tasks', { filter });
    return this.hapClient.getTasks(filter);
  }

  async getTask(id: string): Promise<Task | null> {
    if (!id || id.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    return this.hapClient.getTask(id);
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    logger.info('Updating task status', { taskId: id, status });

    if (!id || id.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    await this.hapClient.updateTaskStatus(id, status);
    logger.info('Task status updated', { taskId: id, status });
  }

  async markTaskAsRunning(id: string): Promise<void> {
    await this.updateTaskStatus(id, TaskStatus.RUNNING);
  }

  async markTaskAsSuccess(id: string): Promise<void> {
    await this.updateTaskStatus(id, TaskStatus.SUCCESS);
  }

  async markTaskAsFailed(id: string, errorMessage: string): Promise<void> {
    logger.error('Task failed', new Error(errorMessage), { taskId: id });
    await this.updateTaskStatus(id, TaskStatus.FAILED);
  }

  async retryTask(id: string): Promise<void> {
    logger.info('Retrying task', { taskId: id });

    const task = await this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (!task.canRetry) {
      throw new Error(`Task cannot be retried: ${id}, status: ${task.status}, retryCount: ${task.retryCount}`);
    }

    // 重置状态为待处理
    await this.updateTaskStatus(id, TaskStatus.PENDING);
    
    logger.info('Task retry scheduled', { taskId: id });
  }

  async deleteTask(id: string): Promise<void> {
    logger.info('Deleting task', { taskId: id });

    if (!id || id.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    await this.hapClient.deleteTask(id);
    logger.info('Task deleted', { taskId: id });
  }
}
