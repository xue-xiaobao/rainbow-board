import { useCanvasStore } from '../../stores/canvasStore';

export function BottomBar() {
  const { viewport, setViewport, clearCanvas } = useCanvasStore();

  const zoomLevels = [10, 25, 50, 75, 100, 125, 150, 200];

  const handleZoomIn = () => {
    const nextZoom = zoomLevels.find(z => z > viewport.zoom * 100) || 200;
    setViewport({ ...viewport, zoom: nextZoom / 100 });
  };

  const handleZoomOut = () => {
    const prevZoom = zoomLevels.slice().reverse().find(z => z < viewport.zoom * 100) || 10;
    setViewport({ ...viewport, zoom: prevZoom / 100 });
  };

  const handleResetView = () => {
    setViewport({ ...viewport, x: 0, y: 0 });
  };

  const handleClearCanvas = () => {
    const confirmed = window.confirm('确定要重置吗？这会清空所有节点和连线。');
    if (!confirmed) return;
    clearCanvas();
  };

  return (
    <div style={{
      position: 'fixed',
      left: 18,
      bottom: 18,
      height: 40,
      padding: '0 14px',
      borderRadius: 999,
      background: 'rgba(255, 251, 245, 0.88)',
      border: '1px solid #d9cfc1',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      fontSize: 13,
      color: '#34373c',
      zIndex: 5000,
      pointerEvents: 'auto'
    }}>
      <button onClick={handleClearCanvas} className="btn" style={{ padding: '6px 12px', fontSize: 13, height: 28 }}>重置</button>
      <button onClick={handleResetView} className="btn" style={{ padding: '6px 12px', fontSize: 13, height: 28 }}>复原位置</button>
      <button onClick={handleZoomOut} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>−</button>
      <strong>{Math.round(viewport.zoom * 100)}%</strong>
      <button onClick={handleZoomIn} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>＋</button>
    </div>
  );
}
