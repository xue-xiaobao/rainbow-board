import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { writeSidecarForAsset, normalizeLocalAssetPath } from '../dist/services/sidecar.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rainbow-sidecar-'));
const asset = path.join(dir, 'asset.png');
fs.writeFileSync(asset, 'fake');

const normalizedRelative = normalizeLocalAssetPath('/api/assets/asset.png', dir);
assert.equal(normalizedRelative, asset);

const normalizedAbsolute = normalizeLocalAssetPath('http://localhost:3971/api/assets/asset.png', dir);
assert.equal(normalizedAbsolute, asset);

const sidecar = await writeSidecarForAsset(asset, { submitId: 'test-submit', resultUrl: '/api/assets/asset.png' });
assert.equal(sidecar, `${asset}.json`);
assert.equal(JSON.parse(fs.readFileSync(sidecar, 'utf-8')).submitId, 'test-submit');

console.log('sidecar ok', sidecar);
