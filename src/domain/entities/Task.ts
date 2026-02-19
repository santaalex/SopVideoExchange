// 任务实体
// 边界：封装任务数据，不涉及存储和业务逻辑

import { Video, VideoData } from './Video';
import { TaskStatus } from '../value-objects/Status';

export interface TaskData {
  id: string;
  title: string;
  status: TaskStatus;
  originalVideo?: VideoData;
  mandarinSubtitle?: VideoData;
  cantoneseSubtitle?: VideoData;
  cantoneseAudio?: VideoData;
  outputVideo?: VideoData;
  createdAt?: Date;
  errorMessage?: string;
  retryCount?: number;
}

export class Task {
  private readonly _id: string;
  private readonly _title: string;
  private _status: TaskStatus;
  private _originalVideo?: Video;
  private _mandarinSubtitle?: Video;
  private _cantoneseSubtitle?: Video;
  private _cantoneseAudio?: Video;
  private _outputVideo?: Video;
  private readonly _createdAt: Date;
  private _errorMessage?: string;
  private _retryCount: number;

  constructor(data: TaskData) {
    if (!data.id || !data.title) {
      throw new Error('Task id and title are required');
    }

    this._id = data.id;
    this._title = data.title;
    this._status = data.status || TaskStatus.PENDING;
    this._originalVideo = data.originalVideo ? new Video(data.originalVideo) : undefined;
    this._mandarinSubtitle = data.mandarinSubtitle ? new Video(data.mandarinSubtitle) : undefined;
    this._cantoneseSubtitle = data.cantoneseSubtitle ? new Video(data.cantoneseSubtitle) : undefined;
    this._cantoneseAudio = data.cantoneseAudio ? new Video(data.cantoneseAudio) : undefined;
    this._outputVideo = data.outputVideo ? new Video(data.outputVideo) : undefined;
    this._createdAt = data.createdAt || new Date();
    this._errorMessage = data.errorMessage;
    this._retryCount = data.retryCount || 0;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get status(): TaskStatus {
    return this._status;
  }

  get originalVideo(): Video | undefined {
    return this._originalVideo;
  }

  get mandarinSubtitle(): Video | undefined {
    return this._mandarinSubtitle;
  }

  get cantoneseSubtitle(): Video | undefined {
    return this._cantoneseSubtitle;
  }

  get cantoneseAudio(): Video | undefined {
    return this._cantoneseAudio;
  }

  get outputVideo(): Video | undefined {
    return this._outputVideo;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get errorMessage(): string | undefined {
    return this._errorMessage;
  }

  get retryCount(): number {
    return this._retryCount;
  }

  get isPending(): boolean {
    return this._status === TaskStatus.PENDING;
  }

  get isRunning(): boolean {
    return this._status === TaskStatus.RUNNING;
  }

  get isCompleted(): boolean {
    return this._status === TaskStatus.SUCCESS;
  }

  get isFailed(): boolean {
    return this._status === TaskStatus.FAILED;
  }

  get canRetry(): boolean {
    return this._status === TaskStatus.FAILED && this._retryCount < 3;
  }

  // State transitions
  markAsRunning(): void {
    this._status = TaskStatus.RUNNING;
  }

  markAsSuccess(): void {
    this._status = TaskStatus.SUCCESS;
  }

  markAsFailed(errorMessage: string): void {
    this._status = TaskStatus.FAILED;
    this._errorMessage = errorMessage;
  }

  incrementRetryCount(): void {
    this._retryCount++;
  }

  // Setters for videos
  setOriginalVideo(video: Video): void {
    this._originalVideo = video;
  }

  setMandarinSubtitle(video: Video): void {
    this._mandarinSubtitle = video;
  }

  setCantoneseSubtitle(video: Video): void {
    this._cantoneseSubtitle = video;
  }

  setCantoneseAudio(video: Video): void {
    this._cantoneseAudio = video;
  }

  setOutputVideo(video: Video): void {
    this._outputVideo = video;
  }

  // 转换为 JSON
  toJSON(): TaskData {
    return {
      id: this._id,
      title: this._title,
      status: this._status.value,
      originalVideo: this._originalVideo?.toJSON(),
      mandarinSubtitle: this._mandarinSubtitle?.toJSON(),
      cantoneseSubtitle: this._cantoneseSubtitle?.toJSON(),
      cantoneseAudio: this._cantoneseAudio?.toJSON(),
      outputVideo: this._outputVideo?.toJSON(),
      createdAt: this._createdAt,
      errorMessage: this._errorMessage,
      retryCount: this._retryCount,
    };
  }

  // 转换为 HAP API 字段格式
  toHAPFields(): Record<string, unknown> {
    const fields: Record<string, unknown> = {
      title: this._title,
      status: this._status.toString(),
    };

    if (this._originalVideo) {
      fields.original_video = this._originalVideo.toHAPRequest();
    }
    if (this._mandarinSubtitle) {
      fields.mandarin_subtitle = this._mandarinSubtitle.toHAPRequest();
    }
    if (this._cantoneseSubtitle) {
      fields.cantonese_subtitle = this._cantoneseSubtitle.toHAPRequest();
    }
    if (this._cantoneseAudio) {
      fields.cantonese_audio = this._cantoneseAudio.toHAPRequest();
    }
    if (this._outputVideo) {
      fields.output_video = this._outputVideo.toHAPRequest();
    }

    return fields;
  }
}
