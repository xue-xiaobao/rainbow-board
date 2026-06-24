-- 七彩画布数据库结构

-- 画布表（单画布模式，预留多画布扩展）
CREATE TABLE IF NOT EXISTS canvases (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT DEFAULT '七彩画布',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  canvas_id TEXT DEFAULT 'default' REFERENCES canvases(id),
  type TEXT NOT NULL CHECK(type IN ('upload', 'image-gen', 'video-gen')),
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  
  -- 通用数据（JSON 存储）
  data JSON,
  
  -- 快捷字段（用于查询）
  status TEXT DEFAULT 'idle',
  prompt TEXT,
  model TEXT,
  result_url TEXT,
  error_message TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 连线表
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  canvas_id TEXT DEFAULT 'default' REFERENCES canvases(id),
  source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作历史表（撤销/重做）
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  canvas_id TEXT DEFAULT 'default' REFERENCES canvases(id),
  action TEXT NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务表（追踪即梦任务）
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  node_id TEXT REFERENCES nodes(id),
  submit_id TEXT UNIQUE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  result_url TEXT,
  error_message TEXT,
  progress INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_nodes_canvas ON nodes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_edges_canvas ON edges(canvas_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_operations_canvas ON operations(canvas_id);
CREATE INDEX IF NOT EXISTS idx_operations_created ON operations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_node ON tasks(node_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- 初始化默认画布
INSERT OR IGNORE INTO canvases (id, name) VALUES ('default', '七彩画布');
