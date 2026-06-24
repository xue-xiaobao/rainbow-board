import { Router, Request, Response } from 'express';
import multer from 'multer';
import storage from '../services/storage.js';

const router = Router();

// 配置 multer 为内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB 限制
  },
});

// 上传文件
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await storage.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取文件
router.get('/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const { buffer, mimeType } = await storage.getFile(filename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    if (error.message === 'File not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error fetching file:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
