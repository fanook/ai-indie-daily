# AI × INDIE LAB

为独立开发者准备的四栏目资讯站：AI 资讯、AI 学习、游戏工具、游戏创意。

## 网站
GitHub Pages: https://fanook.github.io/ai-indie-daily/

在 GitHub 仓库 **Settings → Pages → Build and deployment** 中选择 **Deploy from a branch**，分支 `main`，目录 `/(root)`，保存后等待 Pages 部署。首次启用前上述地址不可用。

## 内容结构
- `index.html`：响应式前端，四个 Tab、关键词搜索、展开详情
- `data/news.json`：资讯条目，包含 category、date、title、summary、facts、value、action、url
- `scripts/update.py`：从项目官方 Atom feeds 抓取更新
- `.github/workflows/refresh.yml`：每天北京时间 09:30（UTC 01:30）定时运行，也可手动运行

## 目前自动更新范围
官方 Codex、Claude Code、ComfyUI、Godot 版本更新。AI 学习和游戏创意暂时为人工策划条目。自动抓取内容保留官方原文链接，使用保守摘要，不会伪装为深度原创研究。GitHub Actions 的 cron 是尽力调度，可能延迟。

后续可以增加可靠 RSS 源、内容审核、模型解读和人工编辑流程；若接入收费 AI API，应将密钥存放在 GitHub Actions Secrets，勿写入仓库。
