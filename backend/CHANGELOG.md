# 变更日志

所有重要更改将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 初始开源发布
- 文生图、图生图功能（gpt-image-2 支持）
- 文生视频、图生视频功能
- 文本生成支持（OpenAI 协议）
- 画布节点和连线管理
- 文件上传和资产管理
- 运行时设置配置（支持热更新）
- 任务状态查询和取消

### Changed
- 无

### Deprecated
- 无

### Removed
- 无

### Fixed
- 无

### Security
- 无

---

## 版本说明

### 版本号规则

- **MAJOR.MINOR.PATCH** (主版本号。次版本号。修订号)
- MAJOR: 不兼容的 API 更改
- MINOR: 向后兼容的功能新增
- PATCH: 向后兼容的问题修复

### 更新步骤

1. 更新此 CHANGELOG.md
2. 更新 package.json 版本号
3. 提交并打 tag
4. 发布到包管理器（如适用）
