import { Router, Request, Response } from 'express';
import { dbPromise } from '../db/index.js';

const router = Router();

interface CanvasSaveBody {
  nodes: any[];
  edges: any[];
}

function mapNodeRow(row: any) {
  return {
    id: row.id,
    type: row.type,
    position: { x: row.position_x, y: row.position_y },
    data: JSON.parse(row.data || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEdgeRow(row: any) {
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    createdAt: row.created_at,
  };
}

// 获取画布数据
router.get('/', async (req: Request, res: Response) => {
  try {
    const nodesRows = await dbPromise.all<any>('SELECT * FROM nodes ORDER BY created_at ASC');
    const edgesRows = await dbPromise.all<any>('SELECT * FROM edges ORDER BY created_at ASC');

    const nodes = nodesRows.map(mapNodeRow);
    const edges = edgesRows.map(mapEdgeRow);

    const canvas = await dbPromise.get<any>('SELECT * FROM canvases WHERE id = ?', ['default']);

    res.json({
      canvas: {
        id: canvas?.id || 'default',
        name: canvas?.name || '七彩画布',
        lastUpdatedAt: canvas?.updated_at,
      },
      nodes,
      edges,
    });
  } catch (error: any) {
    console.error('Error fetching canvas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 保存画布数据
router.post('/save', async (req: Request<{}, {}, CanvasSaveBody>, res: Response) => {
  try {
    const { nodes, edges } = req.body;
    const now = new Date().toISOString();

    // 使用事务保存
    await dbPromise.run('BEGIN TRANSACTION');

    try {
      // 清空现有数据
      await dbPromise.run('DELETE FROM edges');
      await dbPromise.run('DELETE FROM nodes');

      // 插入节点
      for (const node of nodes) {
        await dbPromise.run(`
          INSERT INTO nodes (id, type, position_x, position_y, data, status, prompt, model, result_url, error_message, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          node.id,
          node.type,
          node.position?.x || 0,
          node.position?.y || 0,
          JSON.stringify(node.data || {}),
          node.data?.status || 'idle',
          node.data?.prompt,
          node.data?.model,
          node.data?.resultUrl,
          node.data?.error,
          node.createdAt || now,
          now
        ]);
      }

      // 插入连线
      for (const edge of edges) {
        await dbPromise.run(`
          INSERT INTO edges (id, source_node_id, target_node_id, created_at)
          VALUES (?, ?, ?, ?)
        `, [
          edge.id,
          edge.sourceNodeId,
          edge.targetNodeId,
          edge.createdAt || now
        ]);
      }

      // 更新画布时间戳
      await dbPromise.run('UPDATE canvases SET updated_at = ? WHERE id = ?', [now, 'default']);

      await dbPromise.run('COMMIT');

      res.json({ success: true, savedAt: now });
    } catch (error) {
      await dbPromise.run('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Error saving canvas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 导出画布
router.get('/export', async (req: Request, res: Response) => {
  try {
    const nodesRows = await dbPromise.all<any>('SELECT * FROM nodes ORDER BY created_at ASC');
    const edgesRows = await dbPromise.all<any>('SELECT * FROM edges ORDER BY created_at ASC');

    const nodes = nodesRows.map(mapNodeRow);
    const edges = edgesRows.map(mapEdgeRow);

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      canvas: { nodes, edges },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="canvas-export.json"');
    res.json(exportData);
  } catch (error: any) {
    console.error('Error exporting canvas:', error);
    res.status(500).json({ error: error.message });
  }
});

// 导入画布
router.post('/import', async (req: Request, res: Response) => {
  try {
    const importData = req.body;

    if (!importData.canvas || !importData.canvas.nodes || !importData.canvas.edges) {
      return res.status(400).json({ error: 'Invalid import format' });
    }

    const { nodes, edges } = importData.canvas;
    const now = new Date().toISOString();

    // 使用事务保存（与 /save 相同的逻辑）
    await dbPromise.run('BEGIN TRANSACTION');

    try {
      // 清空现有数据
      await dbPromise.run('DELETE FROM edges');
      await dbPromise.run('DELETE FROM nodes');

      // 插入节点
      for (const node of nodes) {
        await dbPromise.run(`
          INSERT INTO nodes (id, type, position_x, position_y, data, status, prompt, model, result_url, error_message, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          node.id,
          node.type,
          node.position?.x || 0,
          node.position?.y || 0,
          JSON.stringify(node.data || {}),
          node.data?.status || 'idle',
          node.data?.prompt,
          node.data?.model,
          node.data?.resultUrl,
          node.data?.error,
          node.createdAt || now,
          now
        ]);
      }

      // 插入连线
      for (const edge of edges) {
        await dbPromise.run(`
          INSERT INTO edges (id, source_node_id, target_node_id, created_at)
          VALUES (?, ?, ?, ?)
        `, [
          edge.id,
          edge.sourceNodeId,
          edge.targetNodeId,
          edge.createdAt || now
        ]);
      }

      // 更新画布时间戳
      await dbPromise.run('UPDATE canvases SET updated_at = ? WHERE id = ?', [now, 'default']);

      await dbPromise.run('COMMIT');

      res.json({ success: true, nodesImported: nodes.length, edgesImported: edges.length });
    } catch (error) {
      await dbPromise.run('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Error importing canvas:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
