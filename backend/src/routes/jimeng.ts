import { Router, Request, Response } from 'express';
import jimeng from '../services/jimeng.js';
import { dbPromise } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface ImageGenBody {
  prompt: string;
  model?: string;
  ratio?: string;
  resolutionType?: string;
  nodeId?: string;
}

interface VideoGenBody {
  prompt: string;
  model?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
  nodeId?: string;
}

interface ImageToVideoBody {
  imagePath: string;
  prompt?: string;
  model?: string;
  duration?: number;
  nodeId?: string;
}

interface FramesToVideoBody {
  firstFramePath: string;
  lastFramePath: string;
  prompt?: string;
  model?: string;
  duration?: number;
  nodeId?: string;
}

// 图片生成
router.post('/image', async (req: Request<{}, {}, ImageGenBody>, res: Response) => {
  try {
    const { prompt, model, ratio, resolutionType, nodeId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const task = await jimeng.generateImage({ prompt, model, ratio, resolutionType });

    if (task.status === 'fail') {
      return res.status(400).json({ error: task.error });
    }

    // 保存任务到数据库
    const taskId = uuidv4();
    const now = new Date().toISOString();

    await dbPromise.run(`
      INSERT INTO tasks (id, node_id, submit_id, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [taskId, nodeId || null, task.submitId, 'image', 'pending', now, now]);

    // 更新节点状态
    if (nodeId) {
      await dbPromise.run(`
        UPDATE nodes SET data = ?, status = ?, updated_at = ? WHERE id = ?
      `, [
        JSON.stringify({ status: 'running' }),
        'running',
        now,
        nodeId
      ]);
    }

    res.json({ taskId, submitId: task.submitId, status: 'pending' });
  } catch (error: any) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message });
  }
});

// 文生视频
router.post('/video', async (req: Request<{}, {}, VideoGenBody>, res: Response) => {
  try {
    const { prompt, model, duration, ratio, resolution, nodeId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const task = await jimeng.generateVideo({ prompt, model, duration, ratio, resolution });

    if (task.status === 'fail') {
      return res.status(400).json({ error: task.error });
    }

    // 保存任务到数据库
    const taskId = uuidv4();
    const now = new Date().toISOString();

    await dbPromise.run(`
      INSERT INTO tasks (id, node_id, submit_id, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [taskId, nodeId || null, task.submitId, 'video', 'pending', now, now]);

    // 更新节点状态
    if (nodeId) {
      await dbPromise.run(`
        UPDATE nodes SET data = ?, status = ?, updated_at = ? WHERE id = ?
      `, [
        JSON.stringify({ status: 'running' }),
        'running',
        now,
        nodeId
      ]);
    }

    res.json({ taskId, submitId: task.submitId, status: 'pending' });
  } catch (error: any) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: error.message });
  }
});

// 图生视频
router.post('/image2video', async (req: Request<{}, {}, ImageToVideoBody>, res: Response) => {
  try {
    const { imagePath, prompt, model, duration, nodeId } = req.body;

    if (!imagePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    const task = await jimeng.imageToVideo({ imagePath, prompt, model, duration });

    if (task.status === 'fail') {
      return res.status(400).json({ error: task.error });
    }

    // 保存任务到数据库
    const taskId = uuidv4();
    const now = new Date().toISOString();

    await dbPromise.run(`
      INSERT INTO tasks (id, node_id, submit_id, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [taskId, nodeId || null, task.submitId, 'image2video', 'pending', now, now]);

    // 更新节点状态
    if (nodeId) {
      await dbPromise.run(`
        UPDATE nodes SET data = ?, status = ?, updated_at = ? WHERE id = ?
      `, [
        JSON.stringify({ status: 'running' }),
        'running',
        now,
        nodeId
      ]);
    }

    res.json({ taskId, submitId: task.submitId, status: 'pending' });
  } catch (error: any) {
    console.error('Error generating image2video:', error);
    res.status(500).json({ error: error.message });
  }
});

// 首尾帧视频
router.post('/frames2video', async (req: Request<{}, {}, FramesToVideoBody>, res: Response) => {
  try {
    const { firstFramePath, lastFramePath, prompt, model, duration, nodeId } = req.body;

    if (!firstFramePath || !lastFramePath) {
      return res.status(400).json({ error: 'First and last frame paths are required' });
    }

    const task = await jimeng.framesToVideo({ firstFramePath, lastFramePath, prompt, model, duration });

    if (task.status === 'fail') {
      return res.status(400).json({ error: task.error });
    }

    // 保存任务到数据库
    const taskId = uuidv4();
    const now = new Date().toISOString();

    await dbPromise.run(`
      INSERT INTO tasks (id, node_id, submit_id, type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [taskId, nodeId || null, task.submitId, 'frames2video', 'pending', now, now]);

    // 更新节点状态
    if (nodeId) {
      await dbPromise.run(`
        UPDATE nodes SET data = ?, status = ?, updated_at = ? WHERE id = ?
      `, [
        JSON.stringify({ status: 'running' }),
        'running',
        now,
        nodeId
      ]);
    }

    res.json({ taskId, submitId: task.submitId, status: 'pending' });
  } catch (error: any) {
    console.error('Error generating frames2video:', error);
    res.status(500).json({ error: error.message });
  }
});

// 查询任务状态
router.get('/task/:submitId', async (req: Request, res: Response) => {
  try {
    const { submitId } = req.params;

    const task = await jimeng.queryTask(submitId);

    // 更新数据库中的任务状态
    const now = new Date().toISOString();
    
    await dbPromise.run(`
      UPDATE tasks SET status = ?, result_url = ?, error_message = ?, progress = ?, updated_at = ?
      WHERE submit_id = ?
    `, [
      task.status,
      task.resultUrl,
      task.error,
      task.status === 'success' ? 100 : task.status === 'fail' ? 0 : 50,
      now,
      submitId
    ]);

    // 如果任务完成，更新关联节点
    if (task.status === 'success' || task.status === 'fail') {
      const taskRow = await dbPromise.get<any>('SELECT node_id FROM tasks WHERE submit_id = ?', [submitId]);
      
      if (taskRow?.node_id) {
        await dbPromise.run(`
          UPDATE nodes SET data = ?, status = ?, result_url = ?, error_message = ?, updated_at = ?
          WHERE id = ?
        `, [
          JSON.stringify({
            status: task.status,
            resultUrl: task.resultUrl,
            error: task.error,
          }),
          task.status === 'success' ? 'success' : 'error',
          task.resultUrl,
          task.error,
          now,
          taskRow.node_id
        ]);
      }
    }

    res.json(task);
  } catch (error: any) {
    console.error('Error querying task:', error);
    res.status(500).json({ error: error.message });
  }
});

// 检查登录状态
router.get('/check-login', async (req: Request, res: Response) => {
  try {
    const credit = await jimeng.checkCredit();
    res.json({ loggedIn: credit.totalCredit >= 0, credit: credit.totalCredit });
  } catch (error: any) {
    res.json({ loggedIn: false, error: error.message });
  }
});

export default router;
