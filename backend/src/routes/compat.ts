import { Router, Request, Response } from 'express';
import jimeng from '../services/jimeng.js';
import storage from '../services/storage.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { getCurrentUploadDir } from './settings.js';
import { writeSidecarForAsset, normalizeLocalAssetPath } from '../services/sidecar.js';
import { dbPromise } from '../db/index.js';

const router = Router();

async function persistSubmittedTask(submitId: string, type: string, status = 'running', resultUrl?: string, error?: string) {
  if (!submitId) return;
  await dbPromise.run(
    `INSERT INTO tasks (id, submit_id, type, status, result_url, error_message, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(submit_id) DO UPDATE SET type = excluded.type, status = excluded.status, result_url = COALESCE(excluded.result_url, tasks.result_url), error_message = COALESCE(excluded.error_message, tasks.error_message), updated_at = excluded.updated_at`,
    [submitId, submitId, type, status, resultUrl || null, error || null, new Date().toISOString()]
  );
}

async function syncTaskStatus(submitId: string, status: string, resultUrl?: string, error?: string) {
  if (!submitId) return;
  await dbPromise.run(
    `UPDATE tasks SET status = ?, result_url = COALESCE(?, result_url), error_message = ?, updated_at = ? WHERE submit_id = ?`,
    [status, resultUrl || null, error || null, new Date().toISOString(), submitId]
  );
}

function buildDryRunResponse(type: string, endpoint: string, body: any) {
  return {
    submit_id: `dryrun_${Date.now()}`,
    status: 'success',
    dry_run: true,
    result: {
      url: '',
      local_path: ''
    },
    request_preview: {
      type,
      endpoint,
      prompt_template: body.prompt_template || '',
      references: Array.isArray(body.references) ? body.references : [],
      model_version: body.model_version,
      duration: body.duration,
      ratio: body.ratio,
      video_resolution: body.video_resolution,
      reference_mode: body.reference_mode,
    }
  };
}

router.post('/image/text2image', async (req: Request, res: Response) => {
  try {
    const { prompt_template, model_version, ratio, resolution_type } = req.body;
    const task = await jimeng.generateImage({
      prompt: prompt_template,
      model: model_version,
      ratio,
      resolutionType: resolution_type,
    });
    if (task.status === 'fail') return res.status(400).json({ error: task.error });
    await persistSubmittedTask(task.submitId, 'image:text2image', task.status === 'querying' ? 'running' : task.status, task.resultUrl, task.error);
    res.json({ submit_id: task.submitId, status: task.status, result: task.resultUrl ? { url: task.resultUrl, local_path: task.resultUrl } : undefined });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/image/image2image', async (req: Request, res: Response) => {
  try {
    const { prompt_template, references, model_version, ratio, resolution_type } = req.body;
    const imageRef = Array.isArray(references) ? references.find((r: any) => r.type === 'image' && r.path) : null;
    if (!imageRef?.path) return res.status(400).json({ error: 'Image reference is required' });
    const prompt = prompt_template || '';
    const localUploadDir = getCurrentUploadDir();
    const localPath = normalizeLocalAssetPath(imageRef.path, localUploadDir);
    const task = await jimeng.imageToImage({
      imagePaths: [localPath],
      prompt,
      model: model_version,
      ratio,
      resolutionType: resolution_type,
    });
    if (task.status === 'fail') return res.status(400).json({ error: task.error });
    await persistSubmittedTask(task.submitId, 'image:image2image', task.status === 'querying' ? 'running' : task.status, task.resultUrl, task.error);
    res.json({ submit_id: task.submitId, status: task.status, result: task.resultUrl ? { url: task.resultUrl, local_path: task.resultUrl } : undefined });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/video/text2video', async (req: Request, res: Response) => {
  try {
    const { prompt_template, model_version, duration, ratio, video_resolution } = req.body;
    if (config.debug.videoDryRun) {
      return res.json(buildDryRunResponse('video:text2video', '/api/video/text2video', req.body));
    }
    const task = await jimeng.generateVideo({
      prompt: prompt_template,
      model: model_version,
      duration: parseInt(String(duration).replace(/\D/g, '')) || undefined,
      ratio,
      resolution: video_resolution,
    });
    if (task.status === 'fail') return res.status(400).json({ error: task.error });
    await persistSubmittedTask(task.submitId, 'video:text2video', task.status === 'querying' ? 'running' : task.status);
    res.json({ submit_id: task.submitId, status: task.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/video/image2video', async (req: Request, res: Response) => {
  try {
    const { prompt_template, references, model_version, duration } = req.body;
    if (config.debug.videoDryRun) {
      return res.json(buildDryRunResponse('video:image2video', '/api/video/image2video', req.body));
    }
    const imageRef = Array.isArray(references) ? references.find((r: any) => r.type === 'image' && r.path) : null;
    if (!imageRef?.path) return res.status(400).json({ error: 'Image reference is required' });
    const localPath = imageRef.path.startsWith('/api/assets/') ? path.join(config.storage.uploadDir, path.basename(imageRef.path)) : imageRef.path;
    const task = await jimeng.imageToVideo({
      imagePath: localPath,
      prompt: prompt_template,
      model: model_version,
      duration: parseInt(String(duration).replace(/\D/g, '')) || undefined,
    });
    if (task.status === 'fail') return res.status(400).json({ error: task.error });
    await persistSubmittedTask(task.submitId, 'video:image2video', task.status === 'querying' ? 'running' : task.status);
    res.json({ submit_id: task.submitId, status: task.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/video/multimodal', async (req: Request, res: Response) => {
  try {
    const { prompt_template, references, model_version, duration } = req.body;
    if (config.debug.videoDryRun) {
      return res.json(buildDryRunResponse('video:multimodal', '/api/video/multimodal', req.body));
    }
    const localUploadDir = getCurrentUploadDir();
    const imagePaths = Array.isArray(references)
      ? references
          .filter((r: any) => r.type === 'image' && r.path)
          .map((r: any) => normalizeLocalAssetPath(r.path, localUploadDir))
          .filter(Boolean)
      : [];
    const videoPaths = Array.isArray(references)
      ? references
          .filter((r: any) => r.type === 'video' && r.path)
          .map((r: any) => normalizeLocalAssetPath(r.path, localUploadDir))
          .filter(Boolean)
      : [];
    const audioPaths = Array.isArray(references)
      ? references
          .filter((r: any) => r.type === 'audio' && r.path)
          .map((r: any) => normalizeLocalAssetPath(r.path, localUploadDir))
          .filter(Boolean)
      : [];
    const task = await jimeng.multimodalVideo({
      imagePaths,
      videoPaths,
      audioPaths,
      prompt: prompt_template,
      model: model_version,
      duration: parseInt(String(duration).replace(/\D/g, '')) || undefined,
    });
    if (task.status === 'fail') return res.status(400).json({ error: task.error });
    await persistSubmittedTask(task.submitId, 'video:multimodal', task.status === 'querying' ? 'running' : task.status);
    res.json({ submit_id: task.submitId, status: task.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/video/frames2video', async (req: Request, res: Response) => {
  try {
    const { prompt_template, references, model_version, duration } = req.body;
    if (config.debug.videoDryRun) {
      return res.json(buildDryRunResponse('video:frames2video', '/api/video/frames2video', req.body));
    }
    const images = Array.isArray(references) ? references.filter((r: any) => r.type === 'image' && r.path) : [];
    if (images.length < 2) return res.status(400).json({ error: 'Two image references are required' });
    const firstPath = images[0].path.startsWith('/api/assets/') ? path.join(config.storage.uploadDir, path.basename(images[0].path)) : images[0].path;
    const lastPath = images[1].path.startsWith('/api/assets/') ? path.join(config.storage.uploadDir, path.basename(images[1].path)) : images[1].path;
    const task = await jimeng.framesToVideo({
      firstFramePath: firstPath,
      lastFramePath: lastPath,
      prompt: prompt_template,
      model: model_version,
      duration: parseInt(String(duration).replace(/\D/g, '')) || undefined,
    });
    if (task.status === 'fail') return res.status(400).json({ error: task.error });
    await persistSubmittedTask(task.submitId, 'video:frames2video', task.status === 'querying' ? 'running' : task.status);
    res.json({ submit_id: task.submitId, status: task.status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/task/:submitId', async (req: Request, res: Response) => {
  try {
    const localTask = await dbPromise.get<{ status: string; result_url?: string; error_message?: string; updated_at?: string }>(
      `SELECT status, result_url, error_message, updated_at FROM tasks WHERE submit_id = ?`,
      [req.params.submitId]
    );
    if (localTask?.status === 'canceled') {
      return res.json({
        submit_id: req.params.submitId,
        status: 'canceled',
        result: localTask.result_url ? { url: localTask.result_url, local_path: localTask.result_url } : undefined,
        error: localTask.error_message || '任务已取消',
      });
    }
    if (localTask?.status === 'success' && localTask.result_url?.startsWith('/api/assets/')) {
      return res.json({
        submit_id: req.params.submitId,
        status: 'success',
        result: { url: localTask.result_url, local_path: localTask.result_url },
        error: localTask.error_message,
      });
    }

    const task = await jimeng.queryTask(req.params.submitId);
    const timeoutMs = 5 * 60 * 1000;
    if (localTask?.status === 'running' && localTask?.updated_at) {
      const lastUpdated = new Date(localTask.updated_at).getTime();
      if (Number.isFinite(lastUpdated) && Date.now() - lastUpdated > timeoutMs) {
        await syncTaskStatus(req.params.submitId, 'failed', localTask.result_url, '任务超时（超过 5 分钟）');
        return res.json({
          submit_id: req.params.submitId,
          status: 'failed',
          result: localTask.result_url ? { url: localTask.result_url, local_path: localTask.result_url } : undefined,
          error: '任务超时（超过 5 分钟）',
        });
      }
    }
    const publicStatus = task.status === 'querying' ? 'running' : task.status;
    let localPath: string | undefined;
    if (task.resultUrl) {
      localPath = task.resultUrl;
      const localUploadDir = getCurrentUploadDir();
      const resolved = normalizeLocalAssetPath(task.resultUrl, localUploadDir);
      if (/^https?:\/\//.test(task.resultUrl)) {
        const downloaded = await storage.saveRemoteFile(task.resultUrl, `generated-${task.submitId || req.params.submitId}`);
        localPath = downloaded.url;
        await syncTaskStatus(task.submitId || req.params.submitId, publicStatus, downloaded.url, task.error);
        await writeSidecarForAsset(path.join(localUploadDir, path.basename(downloaded.url)), {
          submitId: task.submitId,
          sourceUrl: task.resultUrl,
          localUrl: downloaded.url,
          checkedAt: new Date().toISOString(),
        });
      } else if (resolved && fs.existsSync(resolved)) {
        localPath = task.resultUrl;
        await writeSidecarForAsset(resolved, {
          submitId: task.submitId,
          resultUrl: task.resultUrl,
          checkedAt: new Date().toISOString(),
        });
      }
    }
    await syncTaskStatus(task.submitId || req.params.submitId, publicStatus, localPath || task.resultUrl, task.error);
    res.json({
      submit_id: task.submitId,
      status: publicStatus,
      result: task.resultUrl ? { url: task.resultUrl, local_path: localPath } : undefined,
      error: task.error,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/task/:submitId/cancel', async (req: Request, res: Response) => {
  try {
    const { submitId } = req.params;
    const result = await dbPromise.run(`UPDATE tasks SET status = ?, updated_at = ? WHERE submit_id = ?`, ['canceled', new Date().toISOString(), submitId]);
    res.json({ success: true, submit_id: submitId, status: 'canceled', updated: result.changes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/file/check', async (req: Request, res: Response) => {
  const filePath = String(req.query.path || '');
  let resolvedPath = filePath;

  if (filePath.startsWith('/api/assets/')) {
    const relativeAssetPath = filePath.replace(/^\/api\/assets\//, '');
    resolvedPath = path.join(getCurrentUploadDir(), relativeAssetPath);
  } else if (/^https?:\/\//.test(filePath)) {
    try {
      const url = new URL(filePath);
      if (url.pathname.startsWith('/api/assets/')) {
        const relativeAssetPath = url.pathname.replace(/^\/api\/assets\//, '');
        resolvedPath = path.join(getCurrentUploadDir(), relativeAssetPath);
      }
    } catch {
      resolvedPath = filePath;
    }
  }

  const exists = !!resolvedPath && fs.existsSync(resolvedPath);
  res.json({ exists });
});

export default router;
