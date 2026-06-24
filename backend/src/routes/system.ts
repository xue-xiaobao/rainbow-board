import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../config/index.js';

const router = express.Router();
const execAsync = promisify(exec);

async function commandExists(command: string) {
  try {
    await execAsync(`command -v ${command}`);
    return true;
  } catch {
    return false;
  }
}

export async function detectDreaminaStatus() {
  const cliPath = config.jimeng.cliPath;
  const binaryName = path.basename(cliPath || 'dreamina');
  const binaryExists = cliPath.includes('/') ? fs.existsSync(cliPath) : await commandExists(binaryName);
  if (!binaryExists) {
    return {
      available: false,
      loggedIn: false,
      installCommand: 'curl -s https://jimeng.jianying.com/cli | bash',
      message: '未检测到即梦 CLI，请先安装后再使用即梦相关模型。',
    };
  }

  const commands = [
    `${cliPath} user_credit`,
    `${cliPath} list_task --limit=1`
  ];

  for (const command of commands) {
    try {
      const { stdout, stderr } = await execAsync(command);
      const output = `${stdout || ''}\n${stderr || ''}`;
      if (!output.includes('未检测到有效登录态')) {
        return { available: true, loggedIn: true, installCommand: 'curl -s https://jimeng.jianying.com/cli | bash', probe: command, raw: output.trim(), message: '即梦 CLI 可用' };
      }
    } catch (error: any) {
      const output = `${error?.stdout || ''}\n${error?.stderr || ''}\n${error?.message || ''}`;
      if (!output.includes('未检测到有效登录态')) {
        return { available: true, loggedIn: true, installCommand: 'curl -s https://jimeng.jianying.com/cli | bash', probe: command, raw: output.trim(), message: '即梦 CLI 可用' };
      }
    }
  }

  return { available: true, loggedIn: false, installCommand: 'curl -s https://jimeng.jianying.com/cli | bash', probe: commands[0], raw: '未检测到有效登录态', message: '即梦 CLI 已安装，但未登录。' };
}

export async function detectGptStatus() {
  const candidates = [
    path.join(os.homedir(), '.codex', 'auth.json'),
    path.join(process.env.CODEX_HOME || '', 'auth.json'),
  ].filter(Boolean);
  const authPath = candidates.find(p => fs.existsSync(p));
  if (!authPath) {
    return {
      available: false,
      loggedIn: false,
      message: '未检测到本地 GPT/Codex 登录凭证，无法使用 gpt-image-2。请先登录或订阅可用账号。',
    };
  }
  try {
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const accessToken = authData?.tokens?.access_token;
    if (!accessToken) {
      return {
        available: false,
        loggedIn: false,
        message: 'GPT/Codex 登录凭证缺少 access_token，无法使用 gpt-image-2。请重新登录。',
      };
    }
    const payloadBase64 = accessToken.split('.')?.[1];
    const payload = payloadBase64 ? JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) : null;
    const exp = payload?.exp;
    if (typeof exp === 'number' && Date.now() >= exp * 1000 - 5 * 60 * 1000) {
      return {
        available: false,
        loggedIn: false,
        message: '本地 GPT/Codex 登录已过期或即将过期，无法使用 gpt-image-2。请重新登录或确认订阅。',
      };
    }
    return {
      available: true,
      loggedIn: true,
      message: 'GPT/Codex 凭证可用',
    };
  } catch (error: any) {
    return {
      available: false,
      loggedIn: false,
      message: `GPT/Codex 凭证读取失败：${error?.message || '未知错误'}`,
    };
  }
}

router.get('/version', async (_req, res) => {
  try {
    const pkg = await import('../../package.json', { assert: { type: 'json' } });
    const currentVersion = pkg.default.version;
    res.json({
      version: currentVersion,
      latest_version: currentVersion,
      download_url: 'https://github.com/xue-xiaobao/rainbow-board/releases'
    });
  } catch {
    res.json({
      version: '1.0.0',
      latest_version: '1.0.0',
      download_url: 'https://github.com/xue-xiaobao/rainbow-board/releases'
    });
  }
});

router.get('/credit', async (_req, res) => {
  try {
    const jimeng = (await import('../services/jimeng.js')).default;
    const credit = await jimeng.checkCredit();
    res.json({ credits: credit.totalCredit });
  } catch (error: any) {
    console.error('查询额度失败:', error.message);
    res.status(500).json({ error: '查询额度失败', details: error.message });
  }
});

router.get('/auth/status', async (_req, res) => {
  try {
    const result = await detectDreaminaStatus();
    res.json(result);
  } catch (error: any) {
    res.json({ available: false, loggedIn: false, error: error.message });
  }
});

router.get('/capabilities', async (_req, res) => {
  try {
    const [dreamina, gpt] = await Promise.all([detectDreaminaStatus(), detectGptStatus()]);
    res.json({
      backend: { available: true },
      dreamina,
      gpt,
      install: {
        backendRepo: 'https://github.com/xue-xiaobao/rainbow-board',
        dreaminaCli: 'curl -s https://jimeng.jianying.com/cli | bash',
      }
    });
  } catch (error: any) {
    res.status(500).json({
      backend: { available: false },
      error: error.message,
      install: {
        backendRepo: 'https://github.com/xue-xiaobao/rainbow-board',
        dreaminaCli: 'curl -s https://jimeng.jianying.com/cli | bash',
      }
    });
  }
});

export default router;
