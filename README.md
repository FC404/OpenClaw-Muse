# OpenClaw-Muse

OpenClaw-Muse 是一个把 OpenClaw、Live2D、Electron 和 GPT-SoVITS 结合在一起的虚拟角色工作台项目。

它不只是一个聊天网页，也不只是一个普通代码助手。这个项目想做的是，把 AI 的工作能力包装成一个更有角色感、陪伴感和桌面存在感的交互界面。

## 项目定位

你可以把它理解成：

> 一个面向日常陪伴与工作场景的 OpenClaw 虚拟角色前端原型。

当前版本重点在于：

- 用 `OpenClaw Gateway` 负责对话能力
- 用 `Live2D + PixiJS` 负责角色表现
- 用 `GPT-SoVITS` 负责语音输出
- 用 `Electron` 提供桌面窗口和日志面板
- 用本地记忆、侧写、历史记录增强持续使用体验

## 当前功能

- 聊天模式 / 工作模式切换
- Live2D 角色展示与交互
- 背景切换、镜头切换、鼠标跟随等界面控制
- 本地用户侧写与聊天历史恢复
- GPT-SoVITS 语音输出接入
- Electron 桌面模式
- 运行日志侧窗

## 技术栈

- 前端：`HTML`、`CSS`、`JavaScript`
- 渲染：`PixiJS`、`Live2D Cubism`
- 后端：`Node.js`、`Express`、`WebSocket`
- 桌面壳：`Electron`
- 语音：`GPT-SoVITS`

## 目录结构

```text
clawmuse/
├─ public/
│  ├─ index.html
│  ├─ style.css
│  ├─ app.js
│  ├─ assets/
│  └─ vendor/
├─ electron/
│  ├─ main.cjs
│  ├─ preload.cjs
│  └─ logs.html
├─ voices/
├─ data/
├─ server.js
├─ gatewayClient.js
├─ memoryStore.js
├─ start-clawmuse.bat
├─ start-clawmuse-electron.bat
├─ .env.example
└─ package.json
```

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，然后根据你本地环境填写配置。

常用项包括：

- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_SESSION_KEY`
- `GPT_SOVITS_API_URL`
- `GPT_SOVITS_REF_AUDIO_ZH`
- `GPT_SOVITS_REF_AUDIO_EN`

### 3. 浏览器模式启动

```bash
npm start
```

默认访问：

- `http://127.0.0.1:8787`

### 4. Electron 桌面模式启动

```bash
npm run desktop
```

或者直接使用：

- `start-clawmuse-electron.bat`

## 可用脚本

- `npm start`：启动本地服务
- `npm run dev`：监听模式启动服务
- `npm run desktop`：启动 Electron 桌面版

## 仓库说明

这个仓库没有提交以下本地运行资源：

- `node_modules/`
- `checkpoints/`
- `GPT_SoVITS/`
- 本地 `.env`
- 运行时缓存与临时文件

也就是说，仓库里保留的是项目源码、界面资源、Electron 壳和当前使用的语音参考素材，但不包含你本地的大模型运行目录。

## 当前阶段

这个项目目前更适合定义为：

- 一个可运行的原型
- 一个 OpenClaw 桌面角色化实验
- 一个持续迭代中的个人项目

它现在最重要的目标不是“大而全”，而是把下面这几件事做顺：

- 角色表现
- 日常聊天体验
- 工作模式体验
- 语音与桌面化协同

## 后续方向

- 更完整的公开文档
- 更稳定的窗口化与桌面体验
- 更清晰的模型 / 语音切换能力
- 更自然的角色动作与待机逻辑
- 更方便的打包与分发流程

## 推荐阅读入口

如果你是第一次看这个仓库，建议从这些文件开始：

- `public/app.js`
- `public/style.css`
- `server.js`
- `electron/main.cjs`
