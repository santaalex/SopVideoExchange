// 环境变量配置管理
// 边界：只负责读取和验证配置，不涉及业务逻辑

export interface Config {
  // HAP 配置
  hap: {
    appkey: string;
    sign: string;
    worksheetId: string;
  };
  
  // 阿里灵杰/百炼配置
  aliyun: {
    apiKey: string;
    baseUrl: string;
  };
  
  // 应用配置
  app: {
    maxFileSize: number; // bytes
    allowedVideoTypes: string[];
    cronInterval: string; // cron 格式
  };
}

export function loadConfig(): Config {
  // 验证必需的环境变量
  const requiredEnvVars = [
    'HAP_APPKEY',
    'HAP_SIGN',
    'HAP_WORKSHEET_ID',
    'ALIYUN_API_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    hap: {
      appkey: process.env.HAP_APPKEY!,
      sign: process.env.HAP_SIGN!,
      worksheetId: process.env.HAP_WORKSHEET_ID!,
    },
    aliyun: {
      apiKey: process.env.ALIYUN_API_KEY!,
      baseUrl: process.env.ALIYUN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
    app: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000'), // 500MB default
      allowedVideoTypes: (process.env.ALLOWED_VIDEO_TYPES || 'video/mp4,video/avi,video/mov').split(','),
      cronInterval: process.env.CRON_INTERVAL || '*/5 * * * *', // 每5分钟检查一次
    },
  };
}

// 单例模式：确保配置只加载一次
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
