import { Router, Request, Response } from 'express';
import { dbPromise } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface NodeData {
  status?: string;
  resultUrl?: string;
  error?: string;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  prompt?: string;
  model?: string;
  sourceImageId?: string;
  firstFrameId?: string;
  lastFrameId?: string;
  referenceVideoId?: string;
}

interface CreateNodeBody {
  id?: string;
  type: 'upload' | 'image-gen' | 'video-gen';
  position: { x: number; y: number };
  data?: NodeData;
}

interface UpdateNodeBody {
  data?: NodeData;
  position?: { x: number; y: number };
}

// 创建节点
router.post('/', async (req: Request<{}, {}, CreateNodeBody>, res: Response) => {
  try {
    const { id: providedId, type, position, data = {} } = req.body;

    if (!type || !position) {
      return res.status(400).json({ error: 'Missing required fields: type, position' });
    }

    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await dbPromise.run(`
      INSERT INTO nodes (id, type, position_x, position_y, data, status, prompt, model, result_url, error_message, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      type,
      position.x,
      position.y,
      JSON.stringify(data),
      data.status || 'idle',
      data.prompt,
      data.model,
      data.resultUrl,
      data.error,
      now,
      now
    ]);

    res.status(201).json({
      id,
      type,
      position,
      data,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('Error creating node:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取所有节点
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await dbPromise.all<any>('SELECT * FROM nodes ORDER BY created_at ASC');

    const nodes = rows.map(row => ({
      ...row,
      position: { x: row.position_x, y: row.position_y },
      data: JSON.parse(row.data || '{}'),
    }));

    res.json(nodes);
  } catch (error: any) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个节点
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = await dbPromise.get<any>('SELECT * FROM nodes WHERE id = ?', [id]);

    if (!row) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({
      ...row,
      position: { x: row.position_x, y: row.position_y },
      data: JSON.parse(row.data || '{}'),
    });
  } catch (error: any) {
    console.error('Error fetching node:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新节点
router.put('/:id', async (req: Request<{ id: string }, {}, UpdateNodeBody>, res: Response) => {
  try {
    const { id } = req.params;
    const { data, position } = req.body;

    // 检查节点是否存在
    const existing = await dbPromise.get<any>('SELECT id FROM nodes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data !== undefined) {
      updates.push('data = ?, status = ?, result_url = ?, error_message = ?, prompt = ?, model = ?');
      values.push(
        JSON.stringify(data),
        data.status,
        data.resultUrl,
        data.error,
        data.prompt,
        data.model
      );
    }

    if (position !== undefined) {
      updates.push('position_x = ?, position_y = ?');
      values.push(position.x, position.y);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    await dbPromise.run(`
      UPDATE nodes SET ${updates.join(', ')} WHERE id = ?
    `, values);

    const updated = await dbPromise.get<any>('SELECT * FROM nodes WHERE id = ?', [id]);

    res.json({
      ...updated,
      position: { x: updated.position_x, y: updated.position_y },
      data: JSON.parse(updated.data || '{}'),
    });
  } catch (error: any) {
    console.error('Error updating node:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除节点
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 检查节点是否存在
    const existing = await dbPromise.get<any>('SELECT id FROM nodes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Node not found' });
    }

    // 删除关联的边
    await dbPromise.run('DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?', [id, id]);

    // 删除节点
    await dbPromise.run('DELETE FROM nodes WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting node:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
