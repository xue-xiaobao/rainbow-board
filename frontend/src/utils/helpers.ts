import type { CanvasNode, ReferenceMarker, Edge } from '../types';

function getTextNodeOutput(node: CanvasNode): string {
  if (node.type !== 'text') return '';
  const data: any = node.data;
  if (data.mode === 'generate') {
    return data.result?.content || '';
  }
  return data.content || '';
}

function hasMarker(promptTemplate: string, node: CanvasNode): boolean {
  return promptTemplate.includes(`[@${node.name}]`) || promptTemplate.includes(`[@${node.id}]`);
}

export function parseReferences(
  promptTemplate: string,
  nodes: CanvasNode[]
): { parsedPrompt: string; references: ReferenceMarker[] } {
  const references: ReferenceMarker[] = [];
  let parsedPrompt = promptTemplate;

  const regex = /\[@([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(promptTemplate)) !== null) {
    const fullMatch = match[0];
    const nodeName = match[1];

    const node = nodes.find(n => n.name === nodeName || n.id === nodeName);
    if (!node) {
      console.warn(`未找到节点：${nodeName}`);
      continue;
    }

    if (node.type === 'text') {
      const content = getTextNodeOutput(node);
      references.push({
        marker: fullMatch,
        type: 'text',
        content
      });
      parsedPrompt = parsedPrompt.replace(fullMatch, content);
    } else if (node.type === 'image') {
      const imageData = node.data as any;
      const localPath = imageData.result?.localPath || imageData.uploadPath;
      if (localPath) {
        references.push({
          marker: fullMatch,
          type: 'image',
          path: localPath
        });
      }
    }
  }

  return { parsedPrompt, references };
}

export function buildGenerateRequest(
  node: CanvasNode,
  nodes: CanvasNode[],
  edges: Edge[]
): any {
  if (node.type === 'text') {
    const textData = node.data as any;
    const config = textData.config || { prompt: '', model: '' };

    const inputEdges = edges.filter(e => e.to === node.id);
    const inputNodes = inputEdges
      .map(e => nodes.find(n => n.id === e.from))
      .filter((n): n is CanvasNode => !!n);

    const textNodes = inputNodes.filter((n): n is any => n.type === 'text');

    let promptTemplate = config?.prompt || '';
    for (const textNode of textNodes) {
      const output = getTextNodeOutput(textNode);
      if (!hasMarker(promptTemplate, textNode) && output) {
        promptTemplate += ` ${output}`;
      }
    }

    const { parsedPrompt, references } = parseReferences(promptTemplate, nodes);

    return {
      endpoint: '/api/text/generate',
      body: {
        prompt_template: parsedPrompt,
        references,
        model: config?.model || '',
      }
    };
  }

  if (node.type === 'image') {
    const imageData = node.data as any;
    const config = imageData.config;

    const inputEdges = edges.filter(e => e.to === node.id);
    const inputNodes = inputEdges
      .map(e => nodes.find(n => n.id === e.from))
      .filter((n): n is CanvasNode => !!n);

    const textNodes = inputNodes.filter((n): n is any => n.type === 'text');
    const imageInputNodes = inputNodes.filter((n): n is any => n.type === 'image');

    let promptTemplate = config?.prompt || '';
    for (const textNode of textNodes) {
      const output = getTextNodeOutput(textNode);
      if (!hasMarker(promptTemplate, textNode) && output) {
        promptTemplate += ` ${output}`;
      }
    }

    const { parsedPrompt, references } = parseReferences(promptTemplate, nodes);

    for (const imgNode of imageInputNodes) {
      if (hasMarker(promptTemplate, imgNode)) continue;
      const imgData = imgNode.data as any;
      const localPath = imgData.result?.localPath || imgData.uploadPath;
      if (localPath) {
        references.push({
          marker: '',
          type: 'image',
          path: localPath
        });
      }
    }

    const hasImageInput = imageInputNodes.length > 0;
    const endpoint = hasImageInput ? '/api/image/image2image' : '/api/image/text2image';

    return {
      endpoint,
      body: {
        prompt_template: parsedPrompt,
        references,
        model_version: config?.model_version || '5.0',
        ratio: config?.ratio || (config?.model_version === 'gpt-image-2' ? 'auto' : '16:9'),
        resolution_type: config?.resolution_type || (config?.model_version === 'gpt-image-2' ? '1k' : '2k')
      }
    };
  } else if (node.type === 'video') {
    const videoData = node.data as any;
    const config = videoData.config;

    const inputEdges = edges.filter(e => e.to === node.id);
    const inputNodes = inputEdges
      .map(e => nodes.find(n => n.id === e.from))
      .filter((n): n is CanvasNode => !!n);

    const textNodes = inputNodes.filter((n): n is any => n.type === 'text');
    const imageInputNodes = inputNodes.filter((n): n is any => n.type === 'image');

    let promptTemplate = config?.prompt || '';
    for (const textNode of textNodes) {
      const output = getTextNodeOutput(textNode);
      if (!hasMarker(promptTemplate, textNode) && output) {
        promptTemplate += ` ${output}`;
      }
    }

    const { parsedPrompt, references } = parseReferences(promptTemplate, nodes);

    for (const imgNode of imageInputNodes) {
      if (hasMarker(promptTemplate, imgNode)) continue;
      const imgData = imgNode.data as any;
      const localPath = imgData.result?.localPath || imgData.uploadPath;
      if (localPath) {
        references.push({
          marker: '',
          type: 'image',
          path: localPath
        });
      }
    }

    let endpoint = '/api/video/text2video';
    const imageReferences = references.filter(ref => ref.type === 'image' && ref.path);
    if (imageReferences.length > 0) {
      endpoint = '/api/video/multimodal';
    }

    return {
      endpoint,
      body: {
        prompt_template: parsedPrompt,
        references,
        model_version: config?.model_version || 'seedance2.0',
        duration: config?.duration || '4s',
        ratio: config?.ratio || '16:9',
        video_resolution: config?.video_resolution || '720P',
        reference_mode: 'multimodal'
      }
    };
  }

  return null;
}

export function checkInputsReady(
  nodeId: string,
  nodes: CanvasNode[],
  edges: Edge[]
): boolean {
  const inputEdges = edges.filter(e => e.to === nodeId);

  for (const edge of inputEdges) {
    const sourceNode = nodes.find(n => n.id === edge.from);
    if (!sourceNode) return false;

    if (sourceNode.type === 'text') {
      const data: any = sourceNode.data;
      if (data.mode === 'generate') {
        if (!data.result || data.result.status !== 'success' || !data.result.content) {
          return false;
        }
      }
    }

    if (sourceNode.type === 'image' || sourceNode.type === 'video') {
      const result = (sourceNode.data as any).result;
      if (!result || result.status !== 'success') {
        return false;
      }
    }
  }

  return true;
}
