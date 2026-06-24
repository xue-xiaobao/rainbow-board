import { useEffect, useLayoutEffect, useRef, useState } from 'react';


import { useCanvasStore } from '../../stores/canvasStore';
import { TextNode } from '../nodes/TextNode';
import { ImageNode } from '../nodes/ImageNode';
import { VideoNode } from '../nodes/VideoNode';
import { uploadFile } from '../../utils/api';
import type { Edge, NodeType } from '../../types';

const NODE_WIDTH: Record<NodeType, number> = {
  text: 270,
  image: 326,
  video: 334,
};

export function Canvas() {
  const {
    nodes, edges, viewport, setViewport, selectedNodeId, setSelectedNode,
    addEdge, deleteEdge, moveNode, openContextMenu, closeContextMenu,
    contextMenu, addNode, undo, redo, pasteNode, copyNode, clipboardNode, renameNode
  } = useCanvasStore();
  const isEmptyCanvas = nodes.length === 0;
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ from: string; x: number; y: number } | null>(null);
  const [hoverInputNodeId, setHoverInputNodeId] = useState<string | null>(null);
  const [dragLine, setDragLine] = useState<{ startX: number; startY: number; endX: number; endY: number; from: string } | null>(null);
  const connectingRef = useRef<{ from: string; x: number; y: number } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeDeleteButton, setEdgeDeleteButton] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [edgeDeleteAnchor, setEdgeDeleteAnchor] = useState<{ x: number; y: number } | null>(null);
  const [edgeLayoutVersion, setEdgeLayoutVersion] = useState(0);
  const [pendingConnectionMenu, setPendingConnectionMenu] = useState<{ fromId: string; x: number; y: number } | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  useLayoutEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setEdgeLayoutVersion(v => v + 1);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [viewport.x, viewport.y, viewport.zoom, nodes, edges]);

  useEffect(() => {
    const handleWindowMove = (event: MouseEvent) => {
      if (isDragging) setViewport({ ...viewport, x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
      if (draggingNode) {
        const x = (event.clientX - viewport.x) / viewport.zoom - draggingNode.offsetX;
        const y = (event.clientY - viewport.y) / viewport.zoom - draggingNode.offsetY;
        moveNode(draggingNode.id, { x, y });
      }
      if (connecting) setConnecting(c => {
        if (!c) return c;
        const next = { ...c, x: (event.clientX - viewport.x) / viewport.zoom, y: (event.clientY - viewport.y) / viewport.zoom };
        connectingRef.current = next;
        return next;
      });
      if (dragLine) {
        setDragLine(line => line ? { ...line, endX: event.clientX, endY: event.clientY } : line);
        const nearest = nodes
          .filter(n => n.id !== dragLine.from && (n.type === 'image' || n.type === 'video'))
          .map(n => {
            const center = getPortCenter(n.id, 'input');
            if (!center) return null;
            const dx = center.x - event.clientX;
            const dy = center.y - event.clientY;
            const dist = Math.hypot(dx, dy);
            return { id: n.id, dist };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.dist - b.dist)[0] as { id: string; dist: number } | undefined;
        setHoverInputNodeId(nearest && nearest.dist <= 84 ? nearest.id : null);
      }
    };
    const handleWindowUp = (event: MouseEvent) => {
      const activeConnection = connectingRef.current || connecting;
      if (activeConnection) {
        const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        const inputPort = element?.closest('[data-input-port="true"]') as HTMLElement | null;
        const nearest = nodes
          .filter(n => n.id !== activeConnection.from && (n.type === 'image' || n.type === 'video'))
          .map(n => {
            const center = getPortCenter(n.id, 'input');
            if (!center) return null;
            const dist = Math.hypot(center.x - event.clientX, center.y - event.clientY);
            return { id: n.id, dist };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.dist - b.dist)[0] as { id: string; dist: number } | undefined;
        const targetNodeId = inputPort?.dataset.nodeId || (nearest && nearest.dist <= 112 ? nearest.id : null);
        if (targetNodeId && targetNodeId !== activeConnection.from) {
          addEdge(activeConnection.from, targetNodeId);
        } else {
          setPendingConnectionMenu({ fromId: activeConnection.from, x: event.clientX, y: event.clientY });
          openContextMenu({ visible: true, x: event.clientX, y: event.clientY, target: 'canvas', connectionFromId: activeConnection.from });
        }
      }
      setIsDragging(false);
      setDraggingNode(null);
      connectingRef.current = null;
      setConnecting(null);
      setHoverInputNodeId(null);
      setDragLine(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('textarea, input, select, [contenteditable="true"], [data-block-canvas-shortcuts="true"]')) {
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === 'c' && selectedNodeId) {
        event.preventDefault();
        copyNode(selectedNodeId);
      }
      if (event.key.toLowerCase() === 'v' && clipboardNode) {
        event.preventDefault();
        const centerX = ((window.innerWidth / 2) - viewport.x) / viewport.zoom;
        const centerY = ((window.innerHeight / 2) - viewport.y) / viewport.zoom;
        pasteNode({ x: centerX, y: centerY });
      }
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }
      if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, dragStart, draggingNode, connecting, viewport, moveNode, setViewport, selectedNodeId, copyNode, clipboardNode, pasteNode, undo, redo, addEdge, dragLine, nodes]);

  useEffect(() => {
    if (!selectedEdgeId) {
      setEdgeDeleteButton(null);
      return;
    }
    const edge = edges.find(item => item.id === selectedEdgeId);
    if (!edge) {
      setSelectedEdgeId(null);
      setEdgeDeleteButton(null);
      return;
    }
    const metrics = getEdgeMetrics(edge);
    if (!metrics) {
      setEdgeDeleteButton(null);
      return;
    }
    const margin = 56;
    const anchorX = edgeDeleteAnchor?.x ?? metrics.midX;
    const anchorY = edgeDeleteAnchor?.y ?? metrics.midY;
    const x = Math.min(window.innerWidth - margin, Math.max(margin, anchorX + 18));
    const y = Math.min(window.innerHeight - margin, Math.max(margin, anchorY - 18));
    setEdgeDeleteButton({ edgeId: edge.id, x, y });
  }, [selectedEdgeId, edges, nodes, viewport, edgeDeleteAnchor]);

  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('textarea, input, select, [contenteditable="true"], [data-block-canvas-wheel="true"]')) {
      return;
    }
    if (isEmptyCanvas) {
      e.preventDefault();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport({ ...viewport, zoom: Math.max(0.1, Math.min(2.0, viewport.zoom * delta)) });
    } else {
      setViewport({ ...viewport, x: viewport.x - e.deltaX, y: viewport.y - e.deltaY });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    closeContextMenu();
    setPendingConnectionMenu(null);
    setSelectedEdgeId(null);
    setEdgeDeleteAnchor(null);
    if (isEmptyCanvas) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.card')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    setSelectedNode(null);
  };

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(id);
    setSelectedEdgeId(null);
    setEdgeDeleteAnchor(null);
    closeContextMenu();
  };

  const handleNodeContextMenu = (id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('textarea, input, select, [contenteditable="true"], [data-block-canvas-shortcuts="true"]')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setSelectedNode(id);
    setSelectedEdgeId(null);
    setEdgeDeleteAnchor(null);
    const node = nodes.find(n => n.id === id);
    setRenameDraft(node?.name || '');
    openContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: 'node', nodeId: id });
  };

  const handleNodeDragStart = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    setDraggingNode({
      id,
      offsetX: (e.clientX - viewport.x) / viewport.zoom - node.position.x,
      offsetY: (e.clientY - viewport.y) / viewport.zoom - node.position.y,
    });
    setSelectedNode(id);
    setSelectedEdgeId(null);
    setEdgeDeleteAnchor(null);
  };

  const handleOutputPortMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = getPortCenter(nodeId, 'output') || { x: e.clientX, y: e.clientY };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'crosshair';
    const connection = { from: nodeId, x: start.x, y: start.y };
    connectingRef.current = connection;
    setConnecting(connection);
    setDragLine({ from: nodeId, startX: start.x, startY: start.y, endX: e.clientX, endY: e.clientY });
    setSelectedEdgeId(null);
    setEdgeDeleteAnchor(null);
  };

  const finishConnection = (fromId: string, toId?: string | null) => {
    if (toId && fromId !== toId) addEdge(fromId, toId);
    connectingRef.current = null;
    setConnecting(null);
    setHoverInputNodeId(null);
    setDragLine(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const createNodeFromMenu = (type: 'text' | 'image' | 'video') => {
    const menu = pendingConnectionMenu;
    const position = {
      x: ((contextMenu.x - viewport.x) / viewport.zoom) + 16,
      y: ((contextMenu.y - viewport.y) / viewport.zoom) + 16,
    };
    addNode(type, position);
    if (menu?.fromId) {
      const nextNodeId = useCanvasStore.getState().nodes[useCanvasStore.getState().nodes.length - 1]?.id;
      if (nextNodeId) {
        requestAnimationFrame(() => useCanvasStore.getState().addEdge(menu.fromId!, nextNodeId));
      }
    }
    setPendingConnectionMenu(null);
    closeContextMenu();
  };

  const handleInputPortMouseUp = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const activeConnection = connectingRef.current || connecting;
    if (activeConnection) finishConnection(activeConnection.from, nodeId);
  };

  const handleInputPortMouseEnter = (nodeId: string) => {
    if (connecting) setHoverInputNodeId(nodeId);
  };

  const handleInputPortMouseLeave = (nodeId: string) => {
    if (hoverInputNodeId === nodeId) setHoverInputNodeId(null);
  };

  const menuCanvasPos = {
    x: ((contextMenu.x - viewport.x) / viewport.zoom),
    y: ((contextMenu.y - viewport.y) / viewport.zoom)
  };

  const handleCanvasUpload = async (file: File) => {
    const position = { ...menuCanvasPos };
    const nodeCount = nodes.length + 1;
    const id = `node_${Date.now()}`;
    try {
      const result = await uploadFile(file);
      useCanvasStore.setState(state => ({
        nodes: [...state.nodes, {
          id,
          type: 'image',
          position,
          name: `图片节点 ${nodeCount}`,
          data: {
            mode: 'upload',
            uploadPath: result.path,
            result: { status: 'success', localPath: result.url }
          }
        } as any],
        selectedNodeId: id,
        contextMenu: { visible: false, x: 0, y: 0, target: null }
      }));
    } catch {
      alert('上传失败，请检查后端服务');
    }
  };

  const getPortCenter = (nodeId: string, kind: 'input' | 'output') => {
    const el = document.querySelector(`[data-port-kind="${kind}"][data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const getCanvasPortPosition = (nodeId: string, kind: 'input' | 'output') => {
    const center = getPortCenter(nodeId, kind);
    if (!center) return null;
    return {
      x: (center.x - viewport.x) / viewport.zoom,
      y: (center.y - viewport.y) / viewport.zoom,
    };
  };

  const edgePaths = edges.map(edge => {
      void edgeLayoutVersion;
      const from = getCanvasPortPosition(edge.from, 'output');
      const to = getCanvasPortPosition(edge.to, 'input');
      if (!from || !to) return null;
      const path = `M ${from.x} ${from.y} C ${from.x + 100} ${from.y}, ${to.x - 100} ${to.y}, ${to.x} ${to.y}`;
      const midX = ((from.x + (from.x + 100)) * 0.125) + (((from.x + 100) + (to.x - 100)) * 0.375) + (((to.x - 100) + to.x) * 0.375) + (to.x * 0.125);
      const midY = (from.y * 0.125) + (from.y * 0.375) + (to.y * 0.375) + (to.y * 0.125);
      return { edge, path, midX, midY };
    }).filter(Boolean) as Array<{ edge: Edge; path: string; midX: number; midY: number }>;

  const getEdgeMetrics = (edge: Edge) => {
    const fromCenter = getPortCenter(edge.from, 'output');
    const toCenter = getPortCenter(edge.to, 'input');
    if (!fromCenter || !toCenter) return null;
    const startControlX = fromCenter.x + 100;
    const endControlX = toCenter.x - 100;
    const midX = ((fromCenter.x + startControlX) * 0.125) + ((startControlX + endControlX) * 0.375) + ((endControlX + toCenter.x) * 0.375) + (toCenter.x * 0.125);
    const midY = (fromCenter.y * 0.125) + (fromCenter.y * 0.375) + (toCenter.y * 0.375) + (toCenter.y * 0.125);
    const path = `M ${fromCenter.x} ${fromCenter.y} C ${startControlX} ${fromCenter.y}, ${endControlX} ${toCenter.y}, ${toCenter.x} ${toCenter.y}`;
    return { path, midX, midY, fromCenter, toCenter };
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('textarea, input, select, [contenteditable="true"], [data-block-canvas-shortcuts="true"]')) {
      return;
    }
    e.preventDefault();
    if (!target?.closest('.card')) {
      setSelectedNode(null);
      setSelectedEdgeId(null);
      setEdgeDeleteAnchor(null);
      openContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: 'canvas' });
    }
  };

  const handleEdgeClick = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(null);
    setSelectedEdgeId(edgeId);
    setEdgeDeleteAnchor({ x: e.clientX, y: e.clientY });
    closeContextMenu();
  };

  return (
    <>
      {edges.length > 0 && (
        null
      )}

      {edgeDeleteButton && (
        <button
          className="edge-delete-btn"
          style={{ left: edgeDeleteButton.x, top: edgeDeleteButton.y }}
          onClick={(e) => {
            e.stopPropagation();
            deleteEdge(edgeDeleteButton.edgeId);
            setSelectedEdgeId(null);
            setEdgeDeleteAnchor(null);
          }}
        >
          删除连线
        </button>
      )}

      <div
        ref={canvasRef}
        className="dot-grid"
        onMouseDown={handleMouseDown}
        onMouseUp={() => { setIsDragging(false); setDraggingNode(null); }}
        onWheel={handleWheel}
        onContextMenu={handleCanvasContextMenu}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: isEmptyCanvas ? 'default' : (isDragging ? 'grabbing' : 'grab'), zIndex: 20 }}
      >
        <div onContextMenu={handleCanvasContextMenu} style={{ position: 'absolute', left: viewport.x, top: viewport.y, transform: `scale(${viewport.zoom})`, transformOrigin: '0 0', width: '10000px', height: '10000px' }}>
          <style>{`@keyframes flow { to { stroke-dashoffset: -240; } }`}</style>
          {edgePaths.length > 0 && (
            <svg style={{ position: 'absolute', inset: 0, width: '10000px', height: '10000px', overflow: 'visible', zIndex: 5, pointerEvents: 'none' }}>
              {edgePaths.map(({ edge, path }) => {
                const isSelected = selectedEdgeId === edge.id || selectedNodeId === edge.from || selectedNodeId === edge.to;
                return (
                  <g key={edge.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={20}
                      data-edge-hit="true"
                      data-edge-id={edge.id}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      onClick={(e) => handleEdgeClick(edge.id, e as any)}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={isSelected ? '#2f6780' : '#999'}
                      strokeWidth={isSelected ? 2.2 : 1.5}
                      strokeDasharray={isSelected ? '8 8' : 'none'}
                      style={{ pointerEvents: 'none', animation: isSelected ? 'flow 2s linear infinite' : 'none' }}
                    />
                  </g>
                );
              })}
            </svg>
          )}
          {nodes.map(node => {
            const common = {
              key: node.id,
              node,
              onClick: handleNodeClick,
              onDragStart: handleNodeDragStart,
              onContextMenu: handleNodeContextMenu,
              isDragging: draggingNode?.id === node.id
            } as any;
            if (node.type === 'text') return <TextNode {...common} onOutputPortMouseDown={handleOutputPortMouseDown} />;
            if (node.type === 'image') return <ImageNode {...common} isSelected={selectedNodeId === node.id} onOutputPortMouseDown={handleOutputPortMouseDown} onInputPortMouseUp={handleInputPortMouseUp} onInputPortMouseEnter={handleInputPortMouseEnter} onInputPortMouseLeave={handleInputPortMouseLeave} />;
            if (node.type === 'video') return <VideoNode {...common} isSelected={selectedNodeId === node.id} onOutputPortMouseDown={handleOutputPortMouseDown} onInputPortMouseUp={handleInputPortMouseUp} onInputPortMouseEnter={handleInputPortMouseEnter} onInputPortMouseLeave={handleInputPortMouseLeave} />;
            return null;
          })}
        </div>
      </div>

      {dragLine && (
        <svg style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1500, overflow: 'visible' }}>
          {(() => {
            let endX = dragLine.endX;
            let endY = dragLine.endY;
            if (hoverInputNodeId) {
              const center = getPortCenter(hoverInputNodeId, 'input');
              if (center) {
                endX = center.x;
                endY = center.y;
              }
            }
            const path = `M ${dragLine.startX} ${dragLine.startY} C ${dragLine.startX + 100} ${dragLine.startY}, ${endX - 100} ${endY}, ${endX} ${endY}`;
            return (
              <>
                <path d={path} fill="none" stroke="rgba(47,103,128,0.18)" strokeWidth={10} strokeLinecap="round" />
                <path d={path} fill="none" stroke={hoverInputNodeId ? '#2f6780' : '#5f8fa3'} strokeWidth={3} strokeLinecap="round" />
                <circle cx={dragLine.startX} cy={dragLine.startY} r={6} fill="#2f6780" />
                <circle cx={endX} cy={endY} r={5} fill={hoverInputNodeId ? '#2f6780' : '#5f8fa3'} />
              </>
            );
          })()}
        </svg>
      )}

      {contextMenu.visible && (
        <div style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, width: 240, borderRadius: 24, background: 'rgba(255,255,255,.96)', border: '1px solid rgba(220,220,220,.9)', boxShadow: '0 18px 48px rgba(27,31,35,.16)', padding: 10, zIndex: 2000 }}>
          {contextMenu.target === 'canvas' && (
            <>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px' }} onClick={() => uploadInputRef.current?.click()}>上传</button>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px' }} onClick={() => createNodeFromMenu('text')}>添加文本节点</button>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px' }} onClick={() => createNodeFromMenu('image')}>添加图片节点</button>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px' }} onClick={() => createNodeFromMenu('video')}>添加视频节点</button>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px' }} onClick={undo}>撤销</button>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px' }} onClick={redo}>重做</button>
              <button className="btn" style={{ width: '100%', justifyContent: 'space-between', padding: '14px 16px', opacity: clipboardNode ? 1 : .5 }} disabled={!clipboardNode} onClick={() => pasteNode(menuCanvasPos)}>粘贴</button>
              <input
                ref={uploadInputRef}
                data-canvas-upload="true"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await handleCanvasUpload(file);
                  e.currentTarget.value = '';
                  closeContextMenu();
                }}
              />
            </>
          )}
          {contextMenu.target === 'node' && contextMenu.nodeId && (
            <>
              <div style={{ padding: '8px 8px 10px' }}>
                <div style={{ fontSize: 12, color: '#6f746f', marginBottom: 6 }}>节点名称</div>
                <input
                  className="input"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      renameNode(contextMenu.nodeId!, renameDraft);
                    }
                  }}
                  placeholder="输入节点名称"
                />
              </div>
              <button className="btn" style={{ width: '100%', padding: '14px 16px' }} onClick={() => renameNode(contextMenu.nodeId!, renameDraft)}>修改名称</button>
              <button className="btn" style={{ width: '100%', padding: '14px 16px' }} onClick={() => copyNode(contextMenu.nodeId!)}>复制节点</button>
              <button className="btn" style={{ width: '100%', padding: '14px 16px', opacity: clipboardNode ? 1 : .5 }} disabled={!clipboardNode} onClick={() => pasteNode()}>粘贴节点</button>
              <button className="btn" style={{ width: '100%', padding: '14px 16px', color: '#a04f42' }} onClick={() => {
                useCanvasStore.getState().deleteNode(contextMenu.nodeId!);
                closeContextMenu();
              }}>删除节点</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
