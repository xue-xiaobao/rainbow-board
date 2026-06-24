import { create } from 'zustand';
import type { CanvasNode, Edge, Viewport, NodeType, Workflow, NodeStatus } from '../types';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: 'canvas' | 'node' | null;
  nodeId?: string;
  connectionFromId?: string;
}

interface CanvasStore {
  nodes: CanvasNode[];
  edges: Edge[];
  viewport: Viewport;
  selectedNodeId: string | null;
  backendUrl: string;
  backendVersion: string | null;
  credit: number | null;
  history: Array<{ nodes: CanvasNode[]; edges: Edge[] }>;
  historyIndex: number;
  clipboardNode: CanvasNode | null;
  toast: string | null;
  contextMenu: ContextMenuState;
  isSaved: boolean;

  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  updateNode: (id: string, data: Partial<CanvasNode>) => void;
  deleteNode: (id: string) => void;
  renameNode: (id: string, name: string) => void;
  clearCanvas: () => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  copyNode: (id: string) => void;
  pasteNode: (position?: { x: number; y: number }) => void;

  renameNode: (id: string, name: string) => void;

  addEdge: (from: string, to: string) => void;
  deleteEdge: (id: string) => void;
  getEdgesForNode: (nodeId: string) => { inputs: Edge[]; outputs: Edge[] };

  setViewport: (viewport: Viewport) => void;
  setSelectedNode: (id: string | null) => void;
  setBackendUrl: (url: string) => void;
  setBackendVersion: (version: string) => void;
  setCredit: (credit: number) => void;
  updateNodeStatus: (id: string, status: NodeStatus, error?: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  exportWorkflow: () => Workflow;
  importWorkflow: (workflow: Workflow) => void;
  downloadWorkflowJSON: (workflow: Workflow, filename?: string) => void;
  saveToIndexedDB: () => Promise<void>;
  loadFromIndexedDB: () => Promise<void>;
  showToast: (message: string) => void;
  hideToast: () => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  markSaved: (saved: boolean) => void;
}

function cloneNode(node: CanvasNode, position?: { x: number; y: number }): CanvasNode {
  const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cloned = JSON.parse(JSON.stringify(node)) as CanvasNode;
  if (cloned.type === 'image') {
    delete (cloned.data as any).result;
    delete (cloned.data as any).uploadPath;
    delete (cloned.data as any).mediaSize;
    (cloned.data as any).mode = 'generate';
  }
  if (cloned.type === 'video') {
    delete (cloned.data as any).result;
    delete (cloned.data as any).mediaSize;
  }
  if (cloned.type === 'text') {
    delete (cloned.data as any).result;
  }
  return {
    ...cloned,
    id,
    name: `${node.name} 副本`,
    position: position || { x: node.position.x + 40, y: node.position.y + 40 },
  } as CanvasNode;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { zoom: 0.78, x: 100, y: 50 },
  selectedNodeId: null,
  backendUrl: 'http://localhost:3971',
  backendVersion: null,
  credit: null,
  history: [],
  historyIndex: -1,
  clipboardNode: null,
  toast: null,
  contextMenu: { visible: false, x: 0, y: 0, target: null },
  isSaved: true,

  addNode: (type, position) => {
    const id = `node_${Date.now()}`;
    let data: any = {};
    if (type === 'text') data = { mode: 'direct', content: '', config: { prompt: '', model: '' } };
    else if (type === 'image') data = { mode: 'generate', config: { prompt: '', model_version: '5.0', ratio: '16:9', resolution_type: '2k' } };
    else if (type === 'video') data = { config: { prompt: '', model_version: 'seedance2.0', duration: '4s', ratio: '16:9', video_resolution: '720P' }, previewExpanded: true, previewHeight: 180 };
    const node: CanvasNode = {
      id,
      type,
      position,
      name: `${type === 'text' ? '文本' : type === 'image' ? '图片' : '视频'}节点 ${get().nodes.length + 1}`,
      data,
    };
    set(state => ({
      nodes: [...state.nodes, node],
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      contextMenu: { visible: false, x: 0, y: 0, target: null },
      isSaved: false,
    }));
  },

  updateNode: (id, data) => {
    set(state => ({
      nodes: state.nodes.map(n => (n.id === id ? ({ ...n, ...data } as CanvasNode) : n)),
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      isSaved: false,
    }));
  },

  deleteNode: (id) => {
    set(state => ({
      nodes: state.nodes.filter(n => n.id !== id),
      edges: state.edges.filter(e => e.from !== id && e.to !== id),
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      isSaved: false,
    }));
  },

  renameNode: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set(state => ({
      nodes: state.nodes.map(n => n.id === id ? { ...n, name: trimmed } : n),
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      contextMenu: { visible: false, x: 0, y: 0, target: null },
      isSaved: false,
    }));
  },

  clearCanvas: () => {
    set(state => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      contextMenu: { visible: false, x: 0, y: 0, target: null },
      isSaved: false,
    }));
  },

  moveNode: (id, position) => set(state => ({ nodes: state.nodes.map(n => n.id === id ? { ...n, position } : n), isSaved: false })),

  copyNode: (id) => {
    const node = get().nodes.find(n => n.id === id);
    if (!node) return;
    set({ clipboardNode: JSON.parse(JSON.stringify(node)) });
    get().showToast('已复制节点');
  },

  pasteNode: (position) => {
    const clipboardNode = get().clipboardNode;
    if (!clipboardNode) return;
    const newNode = cloneNode(clipboardNode, position);
    set(state => ({
      nodes: [...state.nodes, newNode],
      selectedNodeId: newNode.id,
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      contextMenu: { visible: false, x: 0, y: 0, target: null },
      isSaved: false,
    }));
    get().showToast('已粘贴节点');
  },

  addEdge: (from, to) => {
    const exists = get().edges.some(e => e.from === from && e.to === to);
    if (exists) return;
    const wouldCreateCycle = checkCycle(from, to, get().edges);
    if (wouldCreateCycle) return;
    const id = `edge_${from}_${to}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set(state => ({
      edges: [...state.edges, { id, from, to }],
      history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
      historyIndex: state.historyIndex + 1,
      isSaved: false,
    }));
  },

  deleteEdge: (id) => set(state => ({
    edges: state.edges.filter(e => e.id !== id),
    history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }],
    historyIndex: state.historyIndex + 1,
    isSaved: false,
  })),

  getEdgesForNode: (nodeId) => ({
    inputs: get().edges.filter(e => e.to === nodeId),
    outputs: get().edges.filter(e => e.from === nodeId),
  }),

  setViewport: (viewport) => set({ viewport }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setBackendUrl: (url) => set({ backendUrl: url }),
  setBackendVersion: (version) => set({ backendVersion: version }),
  setCredit: (credit) => set({ credit }),

  updateNodeStatus: (id, status, error) => set(state => ({
    nodes: state.nodes.map(n => {
      if (n.id !== id) return n;
      if (n.type === 'image' || n.type === 'video') {
        return { ...n, data: { ...n.data, result: { status, localPath: (n.data as any).result?.localPath, error, submitId: (n.data as any).result?.submitId, startedAt: (n.data as any).result?.startedAt, resolvedPrompt: (n.data as any).result?.resolvedPrompt } } } as CanvasNode;
      }
      return n;
    }),
  })),

  pushHistory: () => {
    const state = get();
    set({ history: [...state.history.slice(0, state.historyIndex + 1), { nodes: state.nodes, edges: state.edges }], historyIndex: state.historyIndex + 1 });
  },
  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const prev = state.history[state.historyIndex - 1];
      set({ nodes: prev.nodes, edges: prev.edges, historyIndex: state.historyIndex - 1 });
    }
  },
  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const next = state.history[state.historyIndex + 1];
      set({ nodes: next.nodes, edges: next.edges, historyIndex: state.historyIndex + 1 });
    }
  },
  exportWorkflow: () => ({ version: '1.0', exportedAt: new Date().toISOString(), name: '未命名工作流', viewport: get().viewport, nodes: get().nodes, edges: get().edges }),
  importWorkflow: (workflow) => set({ nodes: workflow.nodes, edges: workflow.edges, viewport: workflow.viewport, isSaved: true }),
  downloadWorkflowJSON: (workflow, filename) => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `rainbow-workflow-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
  saveToIndexedDB: async () => {
    const { saveCurrentWorkflow } = await import('../utils/db');
    const state = get();
    await saveCurrentWorkflow({ nodes: state.nodes, edges: state.edges, viewport: state.viewport });
    set({ isSaved: true });
  },
  loadFromIndexedDB: async () => {
    const { loadCurrentWorkflow } = await import('../utils/db');
    const data = await loadCurrentWorkflow();
    if (data) set({ nodes: data.nodes || [], edges: data.edges || [], viewport: data.viewport || { zoom: 0.78, x: 100, y: 50 }, isSaved: true });
  },
  showToast: (message) => {
    set({ toast: message });
    setTimeout(() => { if (get().toast === message) set({ toast: null }); }, 1800);
  },
  hideToast: () => set({ toast: null }),
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: { visible: false, x: 0, y: 0, target: null } }),
  markSaved: (saved) => set({ isSaved: saved }),
}));

function checkCycle(fromId: string, toId: string, edges: Edge[]): boolean {
  const visited = new Set<string>();
  const stack = [toId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === fromId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const outputs = edges.filter(e => e.from === current);
    for (const edge of outputs) stack.push(edge.to);
  }
  return false;
}
