'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface TaskDetail {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  errorMessage?: string;
  retryCount: number;
  canRetry: boolean;
  originalVideo?: { name: string; url: string };
  mandarinSubtitle?: { name: string; url: string };
  cantoneseSubtitle?: { name: string; url: string };
  cantoneseAudio?: { name: string; url: string };
  outputVideo?: { name: string; url: string };
}

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTask();
    }
  }, [id]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${id}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setTask(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/tasks/${id}`, { method: 'POST' });
      await fetchTask();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    setActionLoading(true);
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      router.push('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '完成': return '#060';
      case '处理中': return '#0066ff';
      case '待处理': return '#666';
      case '失败': return '#c00';
      default: return '#666';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        加载中...
      </div>
    );
  }

  if (error && !task) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ padding: '16px', background: '#fee', borderRadius: '8px', color: '#c00' }}>
          {error}
        </div>
        <Link href="/tasks" style={{ color: '#0066ff', textDecoration: 'underline', marginTop: '16px', display: 'block' }}>
          ← 返回任务列表
        </Link>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <Link href="/tasks" style={{ color: '#666', textDecoration: 'underline', marginBottom: '24px', display: 'block' }}>
        ← 返回任务列表
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>
            {task.title}
          </h1>
          <p style={{ color: '#999' }}>创建时间：{formatDate(task.createdAt)}</p>
        </div>
        <span style={{ 
          padding: '8px 16px', 
          background: `${getStatusColor(task.status)}20`,
          color: getStatusColor(task.status),
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: '500',
        }}>
          {task.status}
        </span>
      </div>

      {task.status === '失败' && task.errorMessage && (
        <div style={{ 
          padding: '16px', 
          background: '#fee', 
          borderRadius: '8px',
          color: '#c00',
          marginBottom: '24px',
        }}>
          <strong>错误信息：</strong>{task.errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
        {task.originalVideo && (
          <FileCard title="原始视频" file={task.originalVideo} />
        )}
        {task.mandarinSubtitle && (
          <FileCard title="普通话字幕" file={task.mandarinSubtitle} />
        )}
        {task.cantoneseSubtitle && (
          <FileCard title="粤语字幕" file={task.cantoneseSubtitle} />
        )}
        {task.cantoneseAudio && (
          <FileCard title="粤语配音" file={task.cantoneseAudio} />
        )}
        {task.outputVideo && (
          <FileCard title="最终输出视频" file={task.outputVideo} isPrimary />
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {task.canRetry && (
          <button
            onClick={handleRetry}
            disabled={actionLoading}
            style={{
              padding: '12px 24px',
              background: actionLoading ? '#ccc' : '#0066ff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {actionLoading ? '处理中...' : '重新处理'}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={actionLoading}
          style={{
            padding: '12px 24px',
            background: actionLoading ? '#ccc' : '#c00',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: actionLoading ? 'not-allowed' : 'pointer',
          }}
        >
          删除任务
        </button>
      </div>
    </div>
  );
}

function FileCard({ title, file, isPrimary }: { title: string; file: { name: string; url: string }; isPrimary?: boolean }) {
  const downloadFile = async () => {
    try {
      const response = await fetch(file.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      background: isPrimary ? '#f0f7ff' : '#fafafa',
      border: `1px solid ${isPrimary ? '#0066ff20' : '#eee'}`,
      borderRadius: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
            {title}
          </h3>
          <p style={{ fontSize: '14px', color: '#666' }}>
            {file.name}
          </p>
        </div>
        <button
          onClick={downloadFile}
          style={{
            padding: '8px 16px',
            background: '#0066ff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          下载
        </button>
      </div>
    </div>
  );
}
