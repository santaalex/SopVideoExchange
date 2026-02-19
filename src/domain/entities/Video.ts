// 视频实体
// 边界：封装视频文件信息，不涉及存储和传输细节

export interface VideoData {
  id?: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  duration?: number; // 秒
}

export class Video {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _url: string;
  private readonly _size: number;
  private readonly _mimeType: string;
  private readonly _duration: number;

  constructor(data: VideoData) {
    if (!data.name || !data.url) {
      throw new Error('Video name and url are required');
    }

    this._id = data.id || crypto.randomUUID();
    this._name = data.name;
    this._url = data.url;
    this._size = data.size || 0;
    this._mimeType = data.mimeType || 'video/mp4';
    this._duration = data.duration || 0;
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get url(): string {
    return this._url;
  }

  get size(): number {
    return this._size;
  }

  get mimeType(): string {
    return this._mimeType;
  }

  get duration(): number {
    return this._duration;
  }

  toJSON(): VideoData {
    return {
      id: this._id,
      name: this._name,
      url: this._url,
      size: this._size,
      mimeType: this._mimeType,
      duration: this._duration,
    };
  }

  // 静态工厂方法：从 HAP API 响应创建实例
  static fromHAPResponse(response: { name: string; url: string; size?: number }): Video {
    return new Video({
      name: response.name,
      url: response.url,
      size: response.size,
    });
  }

  // 转换为 HAP API 请求格式
  toHAPRequest(): { name: string; url: string }[] {
    return [{
      name: this._name,
      url: this._url,
    }];
  }
}
