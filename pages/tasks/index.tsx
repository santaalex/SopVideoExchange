'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  canRetry: boolean;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setTasks(data.data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
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

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>历史任务</h1>
        <Link 
          href="/"
          style={{ color: '#0066ff', textDecoration: 'underline' }}
        >
          上传新视频 →
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          加载中...
        </div>
      )}

      {error && (
        <div style={{ 
          padding: '16px', 
          background: '#fee', 
          borderRadius: '8px',
          color: '#c00',
        }}>
          {error}
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <p>暂无任务</p>
          <Link 
            href="/"
            style={{ color: '#0066ff', textDecoration: 'underline', marginTop: '16px', display: 'block' }}
          >
            上传第一个视频 →
          </Link>
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              style={{
                display: 'block',
                padding: '20px',
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'box-shadow 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                    {task.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: '#999' }}>
                    创建时间：{formatDate(task.createdAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    padding: '6px 12px', 
                    background: `${getStatusColor(task.status)}20`,
                    color: getStatusColor(task.status),
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}>
                    {task.status}
                  </span>
                  <span style={{ color: '#ccc' }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
