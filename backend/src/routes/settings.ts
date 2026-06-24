import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(__dirname, '../../runtime-settings.json');

export interface TextModelSettings {
  protocol: 'openai';
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface PersistedSettings {
  uploadDir?: string;
  textModel?: Partial<TextModelSettings>;
}

const defaultTextModelSettings: TextModelSettings = {
  protocol: 'openai',
  apiUrl: '',
  apiKey: '',
  model: '',
};

function loadPersistedSettings(): PersistedSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) || {};
    }
  } catch {}
  return {};
}

function savePersistedSettings(next: PersistedSettings) {
  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
}

function loadPersistedUploadDir() {
  const persisted = loadPersistedSettings();
  if (typeof persisted.uploadDir === 'string' && persisted.uploadDir) {
    return path.resolve(persisted.uploadDir);
  }
  return config.storage.uploadDir;
}

function persistUploadDir(uploadDir: string) {
  const persisted = loadPersistedSettings();
  savePersistedSettings({ ...persisted, uploadDir });
}

function loadTextModelSettings(): TextModelSettings {
  const persisted = loadPersistedSettings();
  return {
    ...defaultTextModelSettings,
    ...(persisted.textModel || {}),
    protocol: 'openai',
  };
}

function persistTextModelSettings(settings: TextModelSettings) {
  const persisted = loadPersistedSettings();
  savePersistedSettings({ ...persisted, textModel: settings });
}

let currentUploadDir = loadPersistedUploadDir();
let currentTextModelSettings = loadTextModelSettings();
fs.mkdirSync(currentUploadDir, { recursive: true });

router.get('/storage', (_req: Request, res: Response) => {
  res.json({ uploadDir: currentUploadDir });
});

router.post('/storage', (req: Request, res: Response) => {
  const { uploadDir } = req.body || {};
  if (!uploadDir || typeof uploadDir !== 'string') {
    return res.status(400).json({ error: 'uploadDir is required' });
  }
  const resolved = path.resolve(uploadDir);
  fs.mkdirSync(resolved, { recursive: true });
  currentUploadDir = resolved;
  persistUploadDir(currentUploadDir);
  res.json({ uploadDir: currentUploadDir });
});

router.get('/text-model', (_req: Request, res: Response) => {
  res.json({
    protocol: 'openai',
    apiUrl: currentTextModelSettings.apiUrl,
    apiKey: currentTextModelSettings.apiKey,
    model: currentTextModelSettings.model,
  });
});

router.post('/text-model', (req: Request, res: Response) => {
  const { protocol, apiUrl, apiKey, model } = req.body || {};
  if (protocol !== 'openai') {
    return res.status(400).json({ error: 'Only OpenAI protocol is supported' });
  }
  if (!apiUrl || typeof apiUrl !== 'string') {
    return res.status(400).json({ error: 'apiUrl is required' });
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'apiKey is required' });
  }
  if (!model || typeof model !== 'string') {
    return res.status(400).json({ error: 'model is required' });
  }
  currentTextModelSettings = {
    protocol: 'openai',
    apiUrl: apiUrl.replace(/\/+$/, ''),
    apiKey,
    model,
  };
  persistTextModelSettings(currentTextModelSettings);
  res.json({
    protocol: currentTextModelSettings.protocol,
    apiUrl: currentTextModelSettings.apiUrl,
    apiKey: currentTextModelSettings.apiKey,
    model: currentTextModelSettings.model,
  });
});

export function getCurrentUploadDir() {
  return currentUploadDir;
}

export function getCurrentTextModelSettings() {
  return currentTextModelSettings;
}

export default router;
