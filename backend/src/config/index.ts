import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: join(__dirname, '../../.env') });

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const config = {
  port: parseInt(process.env.PORT || '3971', 10),

  jimeng: {
    cliPath: process.env.JIMENG_CLI_PATH || '/Users/jerry/.local/bin/dreamina',
    pollIntervalMs: parseInt(process.env.JIMENG_POLL_INTERVAL_MS || '3000', 10),
    timeoutMs: parseInt(process.env.JIMENG_TASK_TIMEOUT_MS || '600000', 10),
  },

  storage: {
    uploadDir: join(__dirname, '../../', uploadDir),
  },

  textModel: {
    timeoutMs: parseInt(process.env.TEXT_MODEL_TIMEOUT_MS || '300000', 10),
  },

  debug: {
    videoDryRun: process.env.VIDEO_DRY_RUN === 'true',
  },
};

console.log('Configuration loaded:', {
  port: config.port,
  uploadDir: config.storage.uploadDir,
  textModelTimeoutMs: config.textModel.timeoutMs,
  videoDryRun: config.debug.videoDryRun,
});
