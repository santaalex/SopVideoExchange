'use client';

import { useState } from 'react';

interface UploadResponse {
  success: boolean;
  data: {
    taskId: string;
    title: string;
    videoUrl: string;
  };
}

export default function Home() {
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResponse['data'] | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, videoUrl }),
      });

      const data: UploadResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
        视频处理工具
      </h1>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        上传普通话视频，自动生成粤语配音 + 双语字幕
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            视频标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入视频标题"
            required
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            视频链接
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://..."
            required
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
            }}
          />
          <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
            支持 mp4、avi、mov 格式，最大 500MB
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '14px',
            background: loading ? '#ccc' : '#0066ff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '处理中...' : '开始处理'}
        </button>
      </form>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '16px', 
          background: '#fee', 
          borderRadius: '8px',
          color: '#c00',
        }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          background: '#efe', 
          borderRadius: '8px',
        }}>
          <h3 style={{ marginBottom: '12px', color: '#060' }}>✅ 处理已启动</h3>
          <p><strong>任务 ID：</strong>{result.taskId}</p>
          <p><strong>标题：</strong>{result.title}</p>
          <p style={{ marginTop: '12px' }}>
            <a 
              href={`/tasks/${result.taskId}`}
              style={{ color: '#0066ff', textDecoration: 'underline' }}
            >
              查看任务进度 →
            </a>
          </p>
        </div>
      )}

      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <a 
          href="/tasks"
          style={{ color: '#666', textDecoration: 'underline' }}
        >
          查看历史任务 →
        </a>
      </div>
    </div>
  );
}
