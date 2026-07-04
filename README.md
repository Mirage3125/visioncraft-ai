# PixelForge AI — 智能生图工作台

一个可直接用于求职作品集展示的 AI 图片生成 Web 应用。项目基于 Next.js App Router、TypeScript 和 Vercel AI SDK，实现提示词输入、视觉风格、画幅控制、真实模型生成、演示模式、本地历史记录和图片下载。

## 作品亮点

- 完整的商业化工作台界面，而不是简单 API Demo
- 使用 Vercel AI SDK `generateImage()` 封装模型调用
- 未配置 API Key 时自动进入演示模式，面试现场也可稳定展示
- 浏览器 LocalStorage 保存最近 12 条生成记录
- 参数验证、错误提示、加载状态、响应式布局
- 可一键部署到 Vercel

## 技术栈

- Next.js 15 / React 19 / TypeScript
- Vercel AI SDK
- OpenAI Image API
- Lucide React
- 原生 CSS

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。

### Windows PowerShell

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

不填写 `OPENAI_API_KEY` 也可以运行，此时页面使用演示模式。

## 接入真实生图模型

编辑 `.env.local`：

```env
OPENAI_API_KEY=你的密钥
OPENAI_IMAGE_MODEL=dall-e-3
```

然后重新启动开发服务器。

## 部署到 Vercel

1. 将项目推送到自己的 GitHub 仓库。
2. 在 Vercel 中选择 **Add New → Project**。
3. 导入仓库。
4. 在 Environment Variables 中添加 `OPENAI_API_KEY`。
5. 点击 Deploy。

## 项目结构

```text
app/
  api/generate/route.ts   # 图片生成接口
  globals.css             # 完整视觉样式
  layout.tsx
  page.tsx
components/
  image-workbench.tsx     # 工作台主交互
lib/
  demo-image.ts           # 无 Key 演示图生成
  types.ts                # 业务类型
```

## 开源说明

本项目是面向作品集的独立二次实现，架构思路参考 Vercel Labs 的 `ai-sdk-image-generator`。发布到公开仓库时，请在 README 中保留参考项目和许可证说明，不要宣称原始模板全部由自己从零编写。
