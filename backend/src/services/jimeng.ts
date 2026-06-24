import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config/index.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import storage from './storage.js';

function parsePngDimensions(buffer: Buffer): { width: number; height: number } | null {
  const signature = buffer.subarray(0, 8);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!signature.equals(pngSignature)) return null;
  if (buffer.length < 24) return null;
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function expectedOrientation(ratio?: string): 'landscape' | 'portrait' | 'square' | null {
  const normalized = String(ratio || '').toLowerCase();
  if (!normalized || normalized === 'auto') return null;
  const [rw, rh] = normalized.split(':').map(Number);
  if (!rw || !rh) return null;
  if (rw > rh) return 'landscape';
  if (rw < rh) return 'portrait';
  return 'square';
}

const execAsync = promisify(exec);
const GPT_IMAGE_RESPONSES_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
const GPT_IMAGE_MODEL = 'gpt-5.4';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface JimengTask {
  submitId: string;
  status: 'querying' | 'success' | 'fail';
  resultUrl?: string;
  error?: string;
}

export interface ImageGenParams {
  prompt: string;
  model?: string;
  ratio?: string;
  resolutionType?: string;
}

export interface GptImageTask extends JimengTask {
  localPath?: string;
}

async function fileToDataUrl(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function normalizeImageResolution(model: string | undefined, resolutionType: string | undefined): string | undefined {
  if (!resolutionType) return undefined;
  const normalized = String(resolutionType).toLowerCase();
  if (String(model || '') === '5.0' && normalized === '1k') return '2k';
  return normalized;
}

function ratioToSize(ratio?: string, resolutionType?: string): string {
  const normalizedResolution = String(resolutionType || '1k').toLowerCase();
  const normalizedRatio = String(ratio || '1:1').toLowerCase();
  if (normalizedRatio === 'auto') return '1024x1024';

  const presets: Record<string, Record<string, string>> = {
    '1k': {
      '21:9': '1536x656',
      '16:9': '1536x864',
      '3:2': '1344x896',
      '4:3': '1365x1024',
      '1:1': '1024x1024',
      '3:4': '1024x1365',
      '2:3': '896x1344',
      '9:16': '864x1536',
    },
    '2k': {
      '21:9': '3072x1312',
      '16:9': '3072x1728',
      '3:2': '2688x1792',
      '4:3': '2736x2048',
      '1:1': '2048x2048',
      '3:4': '2048x2736',
      '2:3': '1792x2688',
      '9:16': '1728x3072',
    },
    '4k': {
      '21:9': '4096x1755',
      '16:9': '4096x2304',
      '3:2': '3840x2560',
      '4:3': '4096x3072',
      '1:1': '4096x4096',
      '3:4': '3072x4096',
      '2:3': '2736x4096',
      '9:16': '2304x4096',
    },
  };

  return presets[normalizedResolution]?.[normalizedRatio] || presets['1k']['1:1'];
}

export interface ImageToImageParams {
  imagePaths: string[];
  prompt?: string;
  model?: string;
  ratio?: string;
  resolutionType?: string;
}

export interface VideoGenParams {
  prompt: string;
  model?: string;
  duration?: number;
  ratio?: string;
  resolution?: string;
}

export interface ImageToVideoParams {
  imagePath: string;
  prompt?: string;
  model?: string;
  duration?: number;
}

export interface FramesToVideoParams {
  firstFramePath: string;
  lastFramePath: string;
  prompt?: string;
  model?: string;
  duration?: number;
}

export interface MultimodalVideoParams {
  imagePaths?: string[];
  videoPaths?: string[];
  audioPaths?: string[];
  prompt?: string;
  model?: string;
  duration?: number;
}

class JimengService {
  private gptImageTasks = new Map<string, GptImageTask>();

  /**
   * 执行 dreamina CLI 命令
   */
  private async execDreamina(args: string[]): Promise<{ stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execAsync(`${config.jimeng.cliPath} ${args.join(' ')}`);
      return { stdout, stderr };
    } catch (error: any) {
      // CLI 非零退出码也返回输出，便于分析错误
      return { stdout: error.stdout || '', stderr: error.stderr || '' };
    }
  }

  /**
   * 图片生成
   */
  async generateImage(params: ImageGenParams): Promise<JimengTask> {
    if (params.model === 'gpt-image-2') {
      return this.generateGptImage(params);
    }
    const args = ['text2image', `--prompt="${params.prompt}"`];
    
    if (params.model) args.push(`--model_version=${params.model}`);
    if (params.ratio) args.push(`--ratio=${params.ratio}`);
    const normalizedResolution = normalizeImageResolution(params.model, params.resolutionType);
    if (normalizedResolution) args.push(`--resolution_type=${normalizedResolution}`);
    
    const { stdout, stderr } = await this.execDreamina(args);
    return this.parseTaskResult(stdout, stderr);
  }

  async imageToImage(params: ImageToImageParams): Promise<JimengTask> {
    if (params.model === 'gpt-image-2') {
      return this.generateGptImageFromImage(params);
    }
    const args = ['image2image'];
    params.imagePaths.forEach(p => args.push(`--images=${p}`));
    if (params.prompt) args.push(`--prompt="${params.prompt}"`);
    if (params.model) args.push(`--model_version=${params.model}`);
    if (params.ratio) args.push(`--ratio=${params.ratio}`);
    const normalizedResolution = normalizeImageResolution(params.model, params.resolutionType);
    if (normalizedResolution) args.push(`--resolution_type=${normalizedResolution}`);
    const { stdout, stderr } = await this.execDreamina(args);
    return this.parseTaskResult(stdout, stderr);
  }

  /**
   * 文生视频
   */
  async generateVideo(params: VideoGenParams): Promise<JimengTask> {
    const args = ['text2video', `--prompt="${params.prompt}"`];
    
    if (params.model) args.push(`--model_version=${params.model}`);
    if (params.duration) args.push(`--duration=${params.duration}`);
    if (params.ratio) args.push(`--ratio=${params.ratio}`);
    if (params.resolution) args.push(`--video_resolution=${params.resolution}`);
    
    const { stdout, stderr } = await this.execDreamina(args);
    return this.parseTaskResult(stdout, stderr);
  }

  /**
   * 图生视频（单图）
   */
  async imageToVideo(params: ImageToVideoParams): Promise<JimengTask> {
    const args = ['image2video', `--image=${params.imagePath}`];
    
    if (params.prompt) args.push(`--prompt="${params.prompt}"`);
    if (params.model) args.push(`--model_version=${params.model}`);
    if (params.duration) args.push(`--duration=${params.duration}`);
    
    const { stdout, stderr } = await this.execDreamina(args);
    return this.parseTaskResult(stdout, stderr);
  }

  /**
   * 首尾帧视频
   */
  async framesToVideo(params: FramesToVideoParams): Promise<JimengTask> {
    const args = [
      'frames2video',
      `--first=${params.firstFramePath}`,
      `--last=${params.lastFramePath}`
    ];
    
    if (params.prompt) args.push(`--prompt="${params.prompt}"`);
    if (params.model) args.push(`--model_version=${params.model}`);
    if (params.duration) args.push(`--duration=${params.duration}`);
    
    const { stdout, stderr } = await this.execDreamina(args);
    return this.parseTaskResult(stdout, stderr);
  }

  /**
   * 全能参考视频（多素材）
   */
  async multimodalVideo(params: MultimodalVideoParams): Promise<JimengTask> {
    const args = ['multimodal2video'];
    
    params.imagePaths?.forEach(p => args.push(`--image=${p}`));
    params.videoPaths?.forEach(p => args.push(`--video=${p}`));
    params.audioPaths?.forEach(p => args.push(`--audio=${p}`));
    
    if (params.prompt) args.push(`--prompt="${params.prompt}"`);
    if (params.model) args.push(`--model_version=${params.model}`);
    if (params.duration) args.push(`--duration=${params.duration}`);
    
    const { stdout, stderr } = await this.execDreamina(args);
    return this.parseTaskResult(stdout, stderr);
  }

  /**
   * 查询任务状态
   */
  async queryTask(submitId: string): Promise<JimengTask> {
    const cached = this.gptImageTasks.get(submitId);
    if (cached) {
      return {
        submitId: cached.submitId,
        status: cached.status,
        resultUrl: cached.localPath,
        error: cached.error,
      };
    }
    const { stdout, stderr } = await this.execDreamina([
      'query_result',
      `--submit_id=${submitId}`
    ]);
    return this.parseTaskResult(stdout, stderr);
  }

  /**
   * 列出历史任务
   */
  async listTasks(limit?: number, status?: string): Promise<JimengTask[]> {
    const args = ['list_task'];
    
    if (limit) args.push(`--limit=${limit}`);
    if (status) args.push(`--gen_status=${status}`);
    
    const { stdout } = await this.execDreamina(args);
    return this.parseTaskList(stdout);
  }

  /**
   * 检查积分余额
   */
  async checkCredit(): Promise<{ totalCredit: number }> {
    const { stdout } = await this.execDreamina(['user_credit']);
    try {
      const parsed = JSON.parse(stdout);
      if (typeof parsed.total_credit === 'number') {
        return { totalCredit: parsed.total_credit };
      }
    } catch {}
    const match = stdout.match(/"total_credit"\s*:\s*(\d+)/) || stdout.match(/total_credit:\s*(\d+)/);
    return {
      totalCredit: match ? parseInt(match[1]) : 0,
    };
  }

  private readCodexAuth() {
    const candidates = [
      path.join(os.homedir(), '.codex', 'auth.json'),
      path.join(process.env.CODEX_HOME || '', 'auth.json'),
    ].filter(Boolean);
    const authPath = candidates.find(p => fs.existsSync(p));
    if (!authPath) {
      throw new Error(`未找到可用的 Codex 登录凭证，请先运行 codex login`);
    }
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const tokens = authData.tokens || {};
    if (!tokens.access_token) {
      throw new Error('auth.json 中缺少 access_token，请重新运行 codex login');
    }
    const payload = this.decodeJwt(tokens.access_token);
    const exp = payload?.exp;
    if (typeof exp !== 'number' || Date.now() >= exp * 1000 - TOKEN_REFRESH_BUFFER_MS) {
      throw new Error('本地 Codex token 接近过期，请先重新运行 codex login');
    }
    const accountId = payload?.['https://api.openai.com/auth']?.chatgpt_account_id || tokens.account_id || '';
    return { accessToken: tokens.access_token, accountId };
  }

  private decodeJwt(accessToken: string): any {
    const payload = accessToken?.split('.')?.[1];
    if (!payload) return null;
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }

  private parseSseEvents(sseText: string) {
    return sseText
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .filter(payload => payload && payload !== '[DONE]')
      .map(payload => {
        try {
          return JSON.parse(payload);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  private readGptImageResult(sseText: string) {
    let base64 = '';
    let size = '';
    let backendError = '';
    for (const event of this.parseSseEvents(sseText)) {
      if (event.type === 'response.output_item.done') {
        const item = event.item;
        if (item?.type === 'image_generation_call' && typeof item.result === 'string' && item.result.length > 128) {
          base64 = item.result;
          size = typeof item.size === 'string' ? item.size : '';
        }
      }
      if (event.type === 'response.failed' || event.type === 'error') {
        backendError = event?.error?.message || event?.response?.error?.message || backendError;
      }
    }
    if (!base64) {
      throw new Error(backendError || '后端没有返回图片数据');
    }
    return { base64, size };
  }

  private async generateGptImage(params: ImageGenParams): Promise<JimengTask> {
    const session = this.readCodexAuth();
    const size = ratioToSize(params.ratio, params.resolutionType);
    console.log('[gpt-image-2 text2image]', {
      promptPreview: String(params.prompt || '').slice(0, 120),
      ratio: params.ratio,
      resolutionType: params.resolutionType,
      requestedModel: params.model,
      upstreamModel: GPT_IMAGE_MODEL,
      size,
    });
    const body = {
      model: GPT_IMAGE_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      tool_choice: 'auto',
      instructions: `Generate the requested image immediately with the image_generation tool. The output must strictly use a ${size} canvas and preserve the requested ${params.ratio || '1:1'} aspect ratio. If a landscape canvas is requested, do not return a portrait composition.`,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: params.prompt }],
        },
      ],
      tools: [
        {
          type: 'image_generation',
          size,
          quality: 'high',
        },
      ],
    };
    return this.executeGptImageRequest(body, params.ratio);
  }

  private async generateGptImageFromImage(params: ImageToImageParams): Promise<JimengTask> {
    const size = ratioToSize(params.ratio, params.resolutionType);
    console.log('[gpt-image-2 image2image]', {
      promptPreview: String(params.prompt || '').slice(0, 120),
      ratio: params.ratio,
      resolutionType: params.resolutionType,
      requestedModel: params.model,
      upstreamModel: GPT_IMAGE_MODEL,
      size,
      imageCount: params.imagePaths?.length || 0,
    });
    const imageDataUrl = await fileToDataUrl(params.imagePaths[0]);
    const body = {
      model: GPT_IMAGE_MODEL,
      stream: true,
      store: false,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      tool_choice: 'auto',
      instructions: `Use the provided reference image and prompt to generate a new image with the image_generation tool. The output must strictly use a ${size} canvas and preserve the requested ${params.ratio || '1:1'} aspect ratio. If a landscape canvas is requested, do not return a portrait composition.`,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: params.prompt || 'Generate a transformed image based on the provided reference.' },
            { type: 'input_image', image_url: imageDataUrl },
          ],
        },
      ],
      tools: [
        {
          type: 'image_generation',
          size,
          quality: 'high',
        },
      ],
    };
    return this.executeGptImageRequest(body, params.ratio);
  }

  private async executeGptImageRequest(body: any, requestedRatio?: string): Promise<JimengTask> {
    const session = this.readCodexAuth();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      originator: 'codex_cli_rs',
      'User-Agent': 'codex_cli_rs/0.130.0',
      'x-codex-turn-metadata': JSON.stringify({
        session_id: randomUUID(),
        turn_id: randomUUID(),
        sandbox: 'seatbelt',
      }),
    };
    if (session.accountId) headers['ChatGPT-Account-ID'] = session.accountId;
    const response = await fetch(GPT_IMAGE_RESPONSES_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600000),
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`gpt-image-2 请求失败: ${response.status} ${responseText.slice(0, 300)}`);
    }
    const result = this.readGptImageResult(responseText);
    const submitId = `gptimg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const imageBuffer = Buffer.from(result.base64, 'base64');
    const dimensions = parsePngDimensions(imageBuffer);
    if (!dimensions?.width || !dimensions?.height) {
      throw new Error('无法识别返回图片尺寸');
    }
    const actualOrientation = dimensions.width > dimensions.height ? 'landscape' : dimensions.width < dimensions.height ? 'portrait' : 'square';
    const wantedOrientation = expectedOrientation(requestedRatio);
    console.log('[gpt-image-2 result]', {
      requestedRatio,
      wantedOrientation,
      width: dimensions.width,
      height: dimensions.height,
      actualOrientation,
      upstreamReportedSize: result.size,
    });
    if (wantedOrientation && actualOrientation !== wantedOrientation) {
      throw new Error(`上游返回图片方向与请求比例不符：请求 ${requestedRatio}，实际 ${dimensions.width}x${dimensions.height}`);
    }
    const saved = await storage.saveFile(imageBuffer, `${submitId}.png`, 'image/png');
    const task: GptImageTask = { submitId, status: 'success', resultUrl: saved.url, localPath: saved.url };
    this.gptImageTasks.set(submitId, task);
    return task;
  }

  /**
   * 解析任务提交结果
   */
  private parseTaskResult(stdout: string, stderr: string): JimengTask {
    // 检查登录态
    if (stdout.includes('未检测到有效登录态') || stderr.includes('未检测到有效登录态')) {
      return {
        submitId: '',
        status: 'fail',
        error: '即梦 CLI 未登录，请先执行 dreamina login',
      };
    }

    // 检查合规确认
    if (stdout.includes('AigcComplianceConfirmationRequired')) {
      return {
        submitId: '',
        status: 'fail',
        error: '部分模型需要先在即梦 Web 端完成授权确认',
      };
    }
    
    // 尝试解析 JSON 格式输出（新版 CLI）
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        if (json.submit_id) {
          const resultUrl = json.result_url
            || json.output_url
            || json.result_json?.images?.[0]?.image_url
            || json.result_json?.videos?.[0]?.video_url;
          return {
            submitId: json.submit_id,
            status: (json.gen_status || 'querying') as 'querying' | 'success' | 'fail',
            resultUrl,
            error: json.fail_reason || json.error,
          };
        }
      }
    } catch (e) {
      // 不是 JSON 格式，继续传统解析
    }
    
    // 传统格式解析
    const submitIdMatch = stdout.match(/submit_id:\s*([\w-]+)/);
    const statusMatch = stdout.match(/gen_status:\s*(\w+)/);
    const failReasonMatch = stdout.match(/fail_reason:\s*(.+)/);
    const resultUrlMatch = stdout.match(/result_url:\s*(.+)/);
    
    if (!submitIdMatch) {
      return {
        submitId: '',
        status: 'fail',
        error: stderr || stdout || 'Failed to submit task',
      };
    }
    
    return {
      submitId: submitIdMatch[1],
      status: (statusMatch?.[1] || 'querying') as 'querying' | 'success' | 'fail',
      resultUrl: resultUrlMatch?.[1],
      error: failReasonMatch?.[1],
    };
  }

  /**
   * 解析任务列表
   */
  private parseTaskList(stdout: string): JimengTask[] {
    // 简化实现：按行解析
    const tasks: JimengTask[] = [];
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const submitIdMatch = line.match(/submit_id:\s*([\w-]+)/);
      const statusMatch = line.match(/gen_status:\s*(\w+)/);
      
      if (submitIdMatch) {
        tasks.push({
          submitId: submitIdMatch[1],
          status: (statusMatch?.[1] || 'querying') as 'querying' | 'success' | 'fail',
        });
      }
    }
    
    return tasks;
  }
}

export default new JimengService();
