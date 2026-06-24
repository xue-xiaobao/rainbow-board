import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { getCurrentUploadDir } from '../routes/settings.js';

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

class StorageService {
  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getUploadDir() {
    const dir = getCurrentUploadDir?.() || config.storage.uploadDir;
    this.ensureDir(dir);
    return dir;
  }

  async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadedFile> {
    const ext = this.getExtensionFromMime(mimeType) || path.extname(originalName) || '.bin';
    const filename = `${uuidv4()}${ext.startsWith('.') ? ext : `.${ext}`}`;
    const uploadDir = this.getUploadDir();
    const filepath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filepath, buffer);
    const stat = await fs.promises.stat(filepath);
    return {
      filename,
      originalName,
      mimeType,
      size: stat.size,
      url: `/api/assets/${filename}`,
    };
  }

  async saveRemoteFile(url: string, suggestedBaseName = 'generated-image'): Promise<UploadedFile> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`下载生成结果失败: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'image/png';
    const extFromUrl = path.extname(new URL(url).pathname);
    const ext = extFromUrl || this.getExtensionFromMime(mimeType) || '.png';
    const originalName = `${suggestedBaseName}${ext}`;
    return this.saveFile(buffer, originalName, mimeType);
  }

  async getFile(filename: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const filepath = path.join(this.getUploadDir(), filename);
    if (!fs.existsSync(filepath)) {
      throw new Error('File not found');
    }
    const buffer = await fs.promises.readFile(filepath);
    const mimeType = this.getMimeTypeFromExtension(path.extname(filename));
    return { buffer, mimeType };
  }

  async deleteFile(filename: string): Promise<void> {
    const filepath = path.join(this.getUploadDir(), filename);
    if (fs.existsSync(filepath)) {
      await fs.promises.unlink(filepath);
    }
  }

  private getExtensionFromMime(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
    };
    return mimeToExt[mimeType] || '.bin';
  }

  private getMimeTypeFromExtension(ext: string): string {
    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
    };
    return extToMime[ext] || 'application/octet-stream';
  }
}

export default new StorageService();
