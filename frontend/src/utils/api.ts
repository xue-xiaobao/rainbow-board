import type { CreditResponse, VersionResponse, TaskResponse, GenerateRequest, TextModelSettings, SystemCapabilities } from '../types';
import { useCanvasStore } from '../stores/canvasStore';

function getApiBase() {
  const fromStore = useCanvasStore.getState().backendUrl;
  return (fromStore || window.localStorage.getItem('rainbow-board-backend-url') || 'http://localhost:3971').replace(/\/+$/, '');
}

export function toBackendAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('/')) return `${getApiBase()}${path}`;
  return `${getApiBase()}/${path}`;
}

export async function checkBackendVersion(): Promise<VersionResponse> {
  const res = await fetch(`${getApiBase()}/api/system/version`);
  if (!res.ok) throw new Error('后端服务不可达');
  return res.json();
}

export async function getCredit(): Promise<CreditResponse> {
  const res = await fetch(`${getApiBase()}/api/system/credit`);
  if (!res.ok) throw new Error('获取额度失败');
  return res.json();
}

export async function checkAuth(): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/system/auth/status`);
  if (!res.ok) throw new Error('未登录，请先运行 dreamina login --headless');
}

export async function uploadFile(file: File): Promise<{ path: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${getApiBase()}/api/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`上传失败：${await res.text()}`);
  const data = await res.json();
  return { path: data.filename ? `/api/assets/${data.filename}` : data.path, url: data.url };
}

export async function generateText(request: GenerateRequest): Promise<{ content: string; model: string }> {
  const res = await fetch(`${getApiBase()}/api/text/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateImage(request: GenerateRequest): Promise<{ submit_id: string; status?: 'running' | 'success'; result?: { url: string; local_path: string } }> {
  const res = await fetch(`${getApiBase()}/api/image/text2image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateImageFromImage(request: GenerateRequest): Promise<{ submit_id: string; status?: 'running' | 'success'; result?: { url: string; local_path: string } }> {
  const res = await fetch(`${getApiBase()}/api/image/image2image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateVideo(request: GenerateRequest): Promise<{ submit_id: string }> {
  const res = await fetch(`${getApiBase()}/api/video/text2video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateVideoFromImage(request: GenerateRequest): Promise<{ submit_id: string }> {
  const res = await fetch(`${getApiBase()}/api/video/image2video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateVideoFromFrames(request: GenerateRequest): Promise<{ submit_id: string }> {
  const res = await fetch(`${getApiBase()}/api/video/frames2video`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateVideoMultimodal(request: GenerateRequest): Promise<{ submit_id: string }> {
  const res = await fetch(`${getApiBase()}/api/video/multimodal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function queryTask(submitId: string): Promise<TaskResponse> {
  const res = await fetch(`${getApiBase()}/api/task/${submitId}`);
  if (!res.ok) throw new Error('查询任务失败');
  return res.json();
}

export async function cancelTask(submitId: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/task/${submitId}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('取消任务失败');
}

export async function checkFileExists(path: string): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/api/file/check?path=${encodeURIComponent(path)}`);
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.exists;
}

export async function getStorageSettings(): Promise<{ uploadDir: string }> {
  const res = await fetch(`${getApiBase()}/api/settings/storage`);
  if (!res.ok) throw new Error('获取存储设置失败');
  return res.json();
}

export async function saveStorageSettings(uploadDir: string): Promise<{ uploadDir: string }> {
  const res = await fetch(`${getApiBase()}/api/settings/storage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadDir })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getSystemCapabilities(): Promise<SystemCapabilities> {
  const res = await fetch(`${getApiBase()}/api/system/capabilities`);
  if (!res.ok) throw new Error('后端服务不可达');
  return res.json();
}

export async function getTextModelSettings(): Promise<TextModelSettings> {
  const res = await fetch(`${getApiBase()}/api/settings/text-model`);
  if (!res.ok) throw new Error('获取文本模型设置失败');
  return res.json();
}

export async function saveTextModelSettings(settings: TextModelSettings): Promise<TextModelSettings> {
  const res = await fetch(`${getApiBase()}/api/settings/text-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
