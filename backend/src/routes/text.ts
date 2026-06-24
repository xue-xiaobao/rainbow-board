import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import { getCurrentTextModelSettings } from './settings.js';

const router = Router();

function buildPromptWithReferences(promptTemplate: string, references: Array<{ marker?: string; type?: string; content?: string }>) {
  let prompt = String(promptTemplate || '');
  for (const ref of references || []) {
    if (ref?.type === 'text' && ref.content) {
      if (ref.marker && prompt.includes(ref.marker)) {
        prompt = prompt.split(ref.marker).join(ref.content);
      }
    }
  }
  return prompt.trim();
}

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt_template, references, model } = req.body || {};
    const settings = getCurrentTextModelSettings();
    if (!settings.apiUrl || !settings.apiKey) {
      return res.status(400).json({ error: '文本模型未配置，请先在设置中填写 API URL 和 API Key' });
    }
    const finalPrompt = buildPromptWithReferences(prompt_template || '', Array.isArray(references) ? references : []);
    if (!finalPrompt) {
      return res.status(400).json({ error: 'prompt_template is required' });
    }

    const response = await fetch(`${settings.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: model || settings.model,
        messages: [
          { role: 'user', content: finalPrompt }
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(config.textModel.timeoutMs),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text || '文本生成失败' });
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: '文本模型返回了无效 JSON' });
    }
    const content = parsed?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return res.status(500).json({ error: '文本模型未返回有效内容' });
    }
    res.json({ content, model: model || settings.model });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '文本生成失败' });
  }
});

export default router;
