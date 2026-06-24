// 节点类型定义
export type NodeType = 'text' | 'image' | 'video';

// 节点执行状态
export type NodeStatus = 'idle' | 'running' | 'success' | 'failed' | 'canceled';

export type TextNodeMode = 'direct' | 'generate';

// 图片节点模式
export type ImageMode = 'upload' | 'generate';

// 画布位置
export interface Position {
  x: number;
  y: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

// 画布视图状态
export interface Viewport {
  zoom: number;
  x: number;
  y: number;
}

export interface TextNodeConfig {
  prompt: string;
  model: string;
}

export interface TextNodeResult {
  status: NodeStatus;
  content?: string;
  error?: string;
  startedAt?: string;
}

// 文本节点内容
export interface TextNodeData {
  mode: TextNodeMode;
  content: string;
  config?: TextNodeConfig;
  result?: TextNodeResult;
  height?: number;
}

// 图片节点配置
export interface ImageNodeConfig {
  prompt: string;
  model_version: string;
  ratio: string;
  resolution_type: string;
}

// 图片节点结果
export interface ImageNodeResult {
  status: NodeStatus;
  localPath?: string;
  error?: string;
  submitId?: string;
  startedAt?: string;
}

// 图片节点数据
export interface ImageNodeData {
  mode: ImageMode;
  uploadPath?: string;
  config?: ImageNodeConfig;
  result?: ImageNodeResult;
  mediaSize?: NodeSize;
}

// 视频节点配置
export interface VideoNodeConfig {
  prompt: string;
  model_version: string;
  duration: string;
  ratio: string;
  video_resolution: string;
}

// 视频节点结果
export interface VideoNodeResult {
  status: NodeStatus;
  localPath?: string;
  error?: string;
  submitId?: string;
  startedAt?: string;
  resolvedPrompt?: string;
}

// 视频节点数据
export interface VideoNodeData {
  config: VideoNodeConfig;
  result?: VideoNodeResult;
  mediaSize?: NodeSize;
  previewExpanded?: boolean;
  previewHeight?: number;
}

// 节点联合类型
export type NodeData = TextNodeData | ImageNodeData | VideoNodeData;

// 基础节点
export interface BaseNode {
  id: string;
  type: NodeType;
  position: Position;
  name: string;
}

// 文本节点
export interface TextNode extends BaseNode {
  type: 'text';
  data: TextNodeData;
}

// 图片节点
export interface ImageNode extends BaseNode {
  type: 'image';
  data: ImageNodeData;
}

// 视频节点
export interface VideoNode extends BaseNode {
  type: 'video';
  data: VideoNodeData;
}

// 所有节点类型
export type CanvasNode = TextNode | ImageNode | VideoNode;

// 连线
export interface Edge {
  id: string;
  from: string;
  to: string;
}

// 工作流
export interface Workflow {
  version: string;
  exportedAt: string;
  name: string;
  viewport: Viewport;
  nodes: CanvasNode[];
  edges: Edge[];
}

// 后端 API 响应
export interface CreditResponse {
  credits: number;
}

export interface VersionResponse {
  version: string;
  latest_version: string;
  download_url: string;
}

export interface TaskResponse {
  submit_id: string;
  status: 'running' | 'success' | 'failed' | 'canceled';
  result?: {
    url: string;
    local_path: string;
  };
  error?: string;
}

export interface TextModelSettings {
  protocol: 'openai';
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface SystemCapabilities {
  backend: { available: boolean };
  dreamina: {
    available: boolean;
    loggedIn: boolean;
    installCommand?: string;
    message?: string;
  };
  gpt: {
    available: boolean;
    loggedIn: boolean;
    message?: string;
  };
  install: {
    backendRepo: string;
    dreaminaCli: string;
  };
  error?: string;
}

// 引用解析结果
export interface ReferenceMarker {
  marker: string;
  type: 'image' | 'text' | 'video' | 'audio';
  path?: string;
  content?: string;
}

// 发送给后端的请求
export interface GenerateRequest {
  prompt_template: string;
  references: ReferenceMarker[];
  model_version?: string;
  model?: string;
  ratio?: string;
  resolution_type?: string;
  duration?: string;
  video_resolution?: string;
  reference_mode?: string;
}
