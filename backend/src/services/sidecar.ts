import fs from 'fs';
import path from 'path';

export async function writeSidecarForAsset(localFilePath: string, payload: Record<string, any>) {
  try {
    const sidecarPath = `${localFilePath}.json`;
    await fs.promises.writeFile(sidecarPath, JSON.stringify(payload, null, 2), 'utf-8');
    return sidecarPath;
  } catch {
    return null;
  }
}

export function normalizeLocalAssetPath(urlOrPath: string, uploadDir: string) {
  if (!urlOrPath) return '';
  let assetPath = urlOrPath;
  try {
    assetPath = new URL(urlOrPath).pathname;
  } catch {
    // already a local path or relative API path
  }
  if (assetPath.startsWith('/api/assets/')) {
    return path.join(uploadDir, path.basename(assetPath));
  }
  return urlOrPath;
}
