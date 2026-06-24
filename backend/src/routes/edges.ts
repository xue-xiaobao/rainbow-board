import { Router, Request, Response } from 'express';
import { dbPromise } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface CreateEdgeBody {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
}

// 创建连线
router.post('/', async (req: Request<{}, {}, CreateEdgeBody>, res: Response) => {
  try {
    const { id: providedId, sourceNodeId, targetNodeId } = req.body;

    if (!sourceNodeId || !targetNodeId) {
      return res.status(400).json({ error: 'Missing required fields: sourceNodeId, targetNodeId' });
    }

    // 检查节点是否存在
    const sourceNode = await dbPromise.get<any>('SELECT id FROM nodes WHERE id = ?', [sourceNodeId]);
    const targetNode = await dbPromise.get<any>('SELECT id FROM nodes WHERE id = ?', [targetNodeId]);
    
    if (!sourceNode || !targetNode) {
      return res.status(400).json({ error: 'Source or target node does not exist' });
    }

    const id = providedId || uuidv4();
    const now = new Date().toISOString();

    await dbPromise.run(`
      INSERT INTO edges (id, source_node_id, target_node_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [id, sourceNodeId, targetNodeId, now]);

    res.status(201).json({
      id,
      sourceNodeId,
      targetNodeId,
      createdAt: now,
    });
  } catch (error: any) {
    console.error('Error creating edge:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取所有连线
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await dbPromise.all<any>('SELECT * FROM edges ORDER BY created_at ASC');
    const edges = rows.map((row) => ({
      id: row.id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      createdAt: row.created_at,
    }));
    res.json(edges);
  } catch (error: any) {
    console.error('Error fetching edges:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除连线
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await dbPromise.get<any>('SELECT id FROM edges WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Edge not found' });
    }

    await dbPromise.run('DELETE FROM edges WHERE id = ?', [id]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting edge:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
