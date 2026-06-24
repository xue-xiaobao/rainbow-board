import { useEffect, useState } from 'react';
import type { NodeStatus, SystemCapabilities } from './types';
import { useCanvasStore } from './stores/canvasStore';
import { Toolbar } from './components/toolbar/Toolbar';
import { TopBar } from './components/panels/TopBar';
import { BottomBar } from './components/panels/BottomBar';
import { Canvas } from './components/canvas/Canvas';
import { QuickStart } from './components/canvas/QuickStart';
import { checkBackendVersion, getCredit, checkAuth, queryTask, toBackendAssetUrl, getSystemCapabilities } from './utils/api';

function App() {
  const { setBackendVersion, backendUrl, loadFromIndexedDB, saveToIndexedDB, setCredit, nodes, updateNode, toast, hideToast } = useCanvasStore();
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const taskTimeoutMs = 5 * 60 * 1000;
  
  useEffect(() => {
    loadFromIndexedDB().catch(console.error);
    checkBackendVersion().then(version => setBackendVersion(version.version)).catch(() => {
      setBackendUnavailable(true);
    });
    checkAuth().catch(() => {});
    getCredit().then(data => setCredit(data.credits)).catch(() => {});
    getSystemCapabilities().then(data => {
      setCapabilities(data);
      setBackendUnavailable(false);
    }).catch(() => {
      setBackendUnavailable(true);
      setCapabilities(null);
    });
  }, [backendUrl, setBackendVersion, loadFromIndexedDB, setCredit]);
  
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const runningNodes = nodes.filter((n: any) => (n.type === 'image' || n.type === 'video') && n.data?.result?.status === 'running' && n.data?.result?.submitId);
    runningNodes.forEach((node: any) => {
      const submitId = node.data.result.submitId;
      const startedAt = node.data.result?.startedAt ? new Date(node.data.result.startedAt).getTime() : NaN;
      const markTerminal = (status: NodeStatus, error?: string, localPath?: string) => {
        const latestNode = useCanvasStore.getState().nodes.find((n: any) => n.id === node.id) as any;
        if (!latestNode?.data?.result?.submitId || latestNode.data.result.submitId !== submitId) {
          return;
        }
        updateNode(node.id, {
          data: {
            ...latestNode.data,
            result: {
              ...(latestNode.data.result || {}),
              status,
              error,
              submitId,
              localPath: localPath ?? latestNode.data.result?.localPath,
              startedAt: latestNode.data.result?.startedAt,
            }
          }
        });
      };
      const poll = async () => {
        try {
          if (Number.isFinite(startedAt) && Date.now() - startedAt > taskTimeoutMs) {
            markTerminal('failed', '任务超时（超过 5 分钟）');
            return;
          }
          const result = await queryTask(submitId);
          if (result.status === 'success') {
            markTerminal('success', undefined, toBackendAssetUrl(result.result?.local_path || result.result?.url));
            getCredit().then(data => setCredit(data.credits)).catch(() => {});
            return;
          }
          if (result.status === 'failed' || result.status === 'canceled') {
            markTerminal(result.status, result.error || '任务失败');
            return;
          }
          timers.push(setTimeout(poll, 2000));
        } catch {
          if (Number.isFinite(startedAt) && Date.now() - startedAt > taskTimeoutMs) {
            markTerminal('failed', '任务超时（超过 5 分钟）');
            return;
          }
          timers.push(setTimeout(poll, 5000));
        }
      };
      poll();
    });
    return () => timers.forEach(clearTimeout);
  }, [nodes, updateNode, setCredit]);

  useEffect(() => {
    const timer = setTimeout(() => saveToIndexedDB().catch(console.error), 1000);
    return () => clearTimeout(timer);
  }, [saveToIndexedDB, nodes]);
  
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <TopBar />
      <Toolbar />
      <BottomBar />
      <QuickStart />
      {backendUnavailable && (
        <div style={{ position: 'fixed', top: 72, left: 18, right: 18, zIndex: 5200, padding: '12px 14px', borderRadius: 14, background: '#fff4ea', border: '1px solid #e3c7ac', color: '#7a4b21', fontSize: 13, lineHeight: 1.6 }}>
          后端当前不可用。请先到 <a href="https://github.com/xue-xiaobao/rainbow-board" target="_blank" rel="noreferrer">https://github.com/xue-xiaobao/rainbow-board</a> 安装并启动本地后端。
        </div>
      )}
      {!backendUnavailable && capabilities && (!capabilities.dreamina.available || !capabilities.dreamina.loggedIn || !capabilities.gpt.available) && (
        <div style={{ position: 'fixed', top: 72, left: 18, right: 18, zIndex: 5200, padding: '12px 14px', borderRadius: 14, background: '#fff9ee', border: '1px solid #e2d2ab', color: '#695126', fontSize: 13, lineHeight: 1.7 }}>
          {!capabilities.dreamina.available && <div>即梦 CLI 不可用：{capabilities.dreamina.message} 安装命令：<code>{capabilities.install.dreaminaCli}</code></div>}
          {capabilities.dreamina.available && !capabilities.dreamina.loggedIn && <div>即梦 CLI 已安装但未登录：{capabilities.dreamina.message}</div>}
          {!capabilities.gpt.available && <div>GPT/Codex 不可用：{capabilities.gpt.message} 如需使用 gpt-image-2，请先登录或订阅 GPT。</div>}
        </div>
      )}
      <Canvas />
      {toast && (
        <div onClick={hideToast} style={{ position: 'fixed', right: 22, bottom: 72, padding: '10px 14px', borderRadius: 14, background: '#191c20', color: '#fff', zIndex: 3000, fontSize: 13, boxShadow: '0 12px 32px rgba(0,0,0,.18)' }}>{toast}</div>
      )}
    </div>
  );
}

export default App;
