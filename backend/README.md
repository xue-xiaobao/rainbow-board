# RainbowBoard Backend

七彩画板后端服务 - 为 AIGC 创作者设计的无限画布工作流编辑器后端。

## 📦 项目简介

RainbowBoard 是一个面向 AIGC 创作者的无限画布工作流编辑器，支持图像生成、视频生成、文本生成等能力。本项目为后端服务，提供：

- 画布节点/连线管理
- 文件上传与资产管理
- 即梦（Dreamina）AI 生成服务集成
- 文本 LLM 集成（OpenAI 协议）
- 画布保存与加载

**注意**: 本项目依赖即梦 CLI（`dreamina`）进行 AI 图像/视频生成，需要用户自行配置。

## 🚀 快速开始

### 前置要求

- Node.js >= 20.x
- npm >= 9.x
- 即梦 CLI（用于 AI 生成能力，可选但推荐）

### 安装

```bash
# 克隆项目
git clone git@github.com:xue-xiaobao/rainbow-board.git
cd rainbow-board/backend

# 安装依赖
npm install
```

### 配置

1. 复制环境变量示例文件：

```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，根据你的环境修改配置：

```env
# 服务器端口
PORT=3971

# 即梦 CLI 路径（如已安装）
JIMENG_CLI_PATH=dreamina

# 任务轮询配置
JIMENG_POLL_INTERVAL_MS=3000
JIMENG_TASK_TIMEOUT_MS=600000

# 存储配置
UPLOAD_DIR=./uploads
DATABASE_PATH=./database.sqlite
```

### 启动服务

#### 开发模式

```bash
npm run dev
```

#### 生产模式

```bash
# 编译
npm run build

# 启动
npm start
```

服务默认运行在 `http://localhost:3971`

## 📡 API 文档

### 核心接口

#### 节点管理

- `GET /api/nodes` - 获取所有节点
- `POST /api/nodes` - 创建节点
- `PUT /api/nodes/:id` - 更新节点
- `DELETE /api/nodes/:id` - 删除节点

#### 连线管理

- `GET /api/edges` - 获取所有连线
- `POST /api/edges` - 创建连线
- `PUT /api/edges/:id` - 更新连线
- `DELETE /api/edges/:id` - 删除连线

#### 文件上传

- `POST /api/upload` - 上传文件
- `GET /api/assets/:filename` - 访问已上传文件

#### AI 生成

- `POST /api/image/text2image` - 文生图
- `POST /api/image/image2image` - 图生图
- `POST /api/video/text2video` - 文生视频
- `POST /api/video/image2video` - 图生视频
- `POST /api/text/generate` - 文本生成（LLM）

#### 任务管理

- `GET /api/task/:submitId` - 查询任务状态
- `POST /api/task/:submitId/cancel` - 取消任务

#### 设置

- `GET /api/settings` - 获取设置
- `PUT /api/settings` - 更新设置

### 请求示例

#### 文生图

```bash
curl -X POST http://localhost:3971/api/image/text2image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_template": "a beautiful landscape",
    "model_version": "gpt-image-2",
    "ratio": "16:9",
    "resolution_type": "1k"
  }'
```

#### 文本生成

```bash
curl -X POST http://localhost:3971/api/text/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_template": "写一首关于春天的诗",
    "references": [],
    "model": "gpt-4"
  }'
```

## 🏗️ 项目结构

```
backend/
├── src/
│   ├── config/          # 配置管理
│   ├── db/              # 数据库（SQLite）
│   ├── routes/          # API 路由
│   │   ├── nodes.ts     # 节点管理
│   │   ├── edges.ts     # 连线管理
│   │   ├── upload.ts    # 文件上传
│   │   ├── jimeng.ts    # 即梦 AI 集成
│   │   ├── text.ts      # 文本生成
│   │   └── settings.ts  # 设置管理
│   ├── services/        # 业务服务
│   │   ├── jimeng.ts    # 即梦服务
│   │   ├── storage.ts   # 存储服务
│   │   └── sidecar.ts   # 侧车文件管理
│   └── index.ts         # 入口文件
├── tests/               # 测试文件
├── uploads/             # 上传文件目录（运行时生成）
├── database.sqlite      # SQLite 数据库（运行时生成）
├── .env.example         # 环境变量示例
└── package.json
```

## 🔧 开发指南

### 添加新的 AI 模型支持

1. 在 `src/services/jimeng.ts` 中添加模型映射
2. 在 `src/routes/compat.ts` 中添加对应路由处理
3. 更新设置接口支持新模型配置

### 数据库迁移

项目使用 SQLite，Schema 定义在 `src/db/schema.sql`。如需修改：

1. 更新 `schema.sql`
2. 修改 `src/db/index.ts` 中的初始化逻辑
3. 考虑向后兼容性或提供迁移脚本

### 测试

```bash
# 运行测试（如已配置）
npm test
```

## 📝 重要说明

### 即梦 CLI 依赖

本项目使用即梦 CLI 进行 AI 生成。你需要：

1. 安装即梦 CLI：参考 [即梦官方文档](https://www.dreamina.cn/)
2. 完成登录：`dreamina login`
3. 在 `.env` 中配置 CLI 路径

**注意**: 即梦 CLI 需要有效的账号和登录态。

### 文本 LLM 配置

文本生成支持 OpenAI 协议，需要在前端设置中配置：

- API URL（如 `https://api.openai.com/v1`）
- API Key
- 模型名称

**安全提示**: API Key 存储在后端运行时设置中，请确保生产环境使用 HTTPS。

### 文件存储

- 上传文件保存在 `uploads/` 目录
- 生产环境建议配置对象存储（如 AWS S3、阿里云 OSS）
- 当前实现为本地存储，适合开发和小型部署

## 🚨 安全注意事项

1. **不要提交 `.env` 文件** - 已加入 `.gitignore`
2. **不要硬编码密钥** - 使用环境变量或运行时设置
3. **生产环境启用 HTTPS** - 特别是涉及 API Key 传输时
4. **限制上传文件大小** - 当前配置在代码中，可根据需要调整
5. **数据库备份** - 定期备份 `database.sqlite`

## 📄 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 开发环境设置

```bash
git clone git@github.com:xue-xiaobao/rainbow-board.git
cd rainbow-board/backend
npm install
cp .env.example .env
# 编辑 .env 配置你的环境
npm run dev
```

## 📞 联系方式

- 项目主页：[https://github.com/xue-xiaobao/rainbow-board](https://github.com/xue-xiaobao/rainbow-board)
- 问题反馈：[GitHub Issues](https://github.com/xue-xiaobao/rainbow-board/issues)

## 🙏 致谢

- [即梦（Dreamina）](https://www.dreamina.cn/) - AI 图像/视频生成
- [Express](https://expressjs.com/) - Web 框架
- [SQLite](https://www.sqlite.org/) - 数据库
- [Vite](https://vitejs.dev/) - 前端构建工具（前端项目）

---

**注意**: 本项目与即梦（Dreamina）无官方关联，仅通过 CLI 集成其服务。使用 AI 生成服务时请遵守相关平台的使用条款。
