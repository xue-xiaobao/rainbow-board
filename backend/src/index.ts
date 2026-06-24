import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import db from './db/index.js';
import nodesRouter from './routes/nodes.js';
import edgesRouter from './routes/edges.js';
import uploadRouter from './routes/upload.js';
import jimengRouter from './routes/jimeng.js';
import canvasRouter from './routes/canvas.js';
import systemRouter, { detectDreaminaStatus, detectGptStatus } from './routes/system.js';
import compatRouter from './routes/compat.js';
import settingsRouter, { getCurrentUploadDir } from './routes/settings.js';
import textRouter from './routes/text.js';

async function main() {
  const dreaminaStatus = await detectDreaminaStatus();
  if (!dreaminaStatus.available) {
    console.warn('⚠️  未检测到即梦 CLI。');
    console.warn('   安装命令：curl -s https://jimeng.jianying.com/cli | bash');
  } else if (!dreaminaStatus.loggedIn) {
    console.warn('⚠️  即梦 CLI 已安装，但未登录。');
    console.warn('   请先执行：dreamina login');
  } else {
    console.log('✅ 即梦 CLI 已登录');
  }

  const gptStatus = await detectGptStatus();
  if (!gptStatus.available) {
    console.warn('⚠️  GPT/Codex 不可用，gpt-image-2 模型将无法使用。');
    console.warn(`   ${gptStatus.message}`);
  } else {
    console.log('✅ GPT/Codex 凭证可用，可使用 gpt-image-2');
  }

  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 静态文件服务（上传的资源）
  app.use('/api/assets', (req, res, next) => {
    return express.static(getCurrentUploadDir())(req, res, next);
  });

  // API 路由
  app.use('/api/nodes', nodesRouter);
  app.use('/api/edges', edgesRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/jimeng', jimengRouter);
  app.use('/api/canvas', canvasRouter);
  app.use('/api/system', systemRouter);
  app.use('/api/settings', settingsRouter);
  console.log('🧩 Mounting text router at /api/text');
  app.use('/api/text', textRouter);
  app.use('/api', compatRouter);

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 启动服务器
  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📁 Upload directory: ${config.storage.uploadDir}`);
  });
}

main().catch(console.error);
