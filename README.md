# SopVideoExchange

视频处理工具：将普通话操作教程视频自动转换成粤语配音 + 双语字幕版本。

## 功能特性

- 📹 单文件视频上传（支持 mp4/avi/mov，最大 500MB）
- 🎯 后台异步处理（几小时内完成）
- 📝 双语字幕生成（普通话 + 粤语）
- 🔊 粤语配音合成
- ⏱️ 时间轴自动对齐
- 📋 历史任务管理
- 🔄 失败自动重试

## 技术栈

- **前端**: Next.js + React
- **后端**: Next.js API Routes + Vercel Serverless
- **数据库**: HAP（明道云）
- **AI 服务**: 阿里灵杰/百炼（ASR + TTS + LLM）
- **视频处理**: FFmpeg

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/santaalex/SopVideoExchange.git
cd SopVideoExchange
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local，填入你的配置
```

### 4. 启动开发环境

```bash
npm run dev
```

访问 http://localhost:3000

## 环境变量说明

| 变量 | 说明 | 必需 |
|------|------|------|
| HAP_APPKEY | HAP 应用 AppKey | ✅ |
| HAP_SIGN | HAP 签名 | ✅ |
| HAP_WORKSHEET_ID | HAP 工作表 ID | ✅ |
| ALIYUN_API_KEY | 阿里灵杰 API Key | ✅ |
| ALIYUN_BASE_URL | 阿里灵杰 API 地址 | ❌（默认） |

## 部署到 Vercel

1. 推送代码到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. Deploy!

## 项目结构

```
src/
├── domain/                 # 领域层
│   ├── entities/          # 实体
│   ├── value-objects/     # 值对象
│   └── interfaces/        # 接口定义
├── infrastructure/         # 基础设施层
│   ├── hap/              # HAP API 实现
│   ├── aliyun/           # 阿里灵杰 API 实现
│   └── ffmpeg/           # FFmpeg 服务
├── application/           # 应用层
│   ├── services/         # 业务服务
│   └── worker/           # 任务处理编排
├── presentation/          # 表示层
│   ├── api/              # API Routes
│   ├── pages/            # Next.js 页面
│   └── components/       # React 组件
└── utils/                # 工具函数
```

## 开发指南

### 代码规范

- 使用 TypeScript
- 遵循 SOLID 原则
- 每个文件不超过 100 行
- 必须有单元测试

### 测试

```bash
# 运行所有测试
npm test

# 单元测试
npm run test:unit

# 集成测试
npm run test:integration

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 许可证

MIT
