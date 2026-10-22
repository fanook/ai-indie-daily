# AI × INDIE LAB 项目约定

## 开始前

- 网站是原生 HTML/CSS/JS，部署到 GitHub Pages 的 `main` 根目录。保留 Jekyll 自动发现 `_data/articles/*.json`，不要添加 `.nojekyll`。保持低维护成本。
- 日常内容由用户的定时模型会话创作。先读 `docs/CONTENT_GUIDE.md`。
- 用户个人目录与网络策略继续适用。不要自行恢复每日 RSS 自动写入，也不要擅自创建另一套定时任务。
- 先检查 `git status`，保留其他会话/用户改动。多人同时写内容时先拉取最新内容，不强制推送。

## UI 与兼容

- 浅色默认、克制的蓝灰点缀、中文阅读优先。不要恢复大 Hero、侧边栏或深色仪表盘。
- 页头只有标题、栏目下拉（默认 All）与 Shuffle。普通字体，不使用手写字体/无关插画。栏目保存在 localStorage，Shuffle 只打乱当前筛选的文章。
- 所有样式维护在 `styles.css`。不要再增加覆盖用的 light/minimal CSS。
- 列表和详情共用 `app.js`、`content.mjs`。文章 URL 必须使用稳定 ID。
- 一篇文章一个 `_data/articles/<id>.json` 文件，文件名、`id`、`slug` 一致。不能更改旧 `id`、`slug` 或 `legacyIndex`；新增不填写 `legacyIndex`。不要手工维护首页、路由或索引。
- 配图只用对应原文或官方素材，提供 coverProvenance；无可靠配图就用文字卡片，不能拿概念插画补位。
- 不能删除历史条目来控制数量。分页控制显示量，不控制存档量。
- 文章数据中的 HTML 不直接执行；使用支持的正文块。图片必须有替代文本。

## 验证与发布

- 内容或逻辑改动：`npm run check`、`npm test`、`npm run build`。用 `python3 -m http.server 8767 --directory dist` 预览，不能静态服务源码根目录。
- UI 改动：检查桌面及 390px 手机视口、栏目持久化、All、Shuffle、收藏、详情、返回、无图/坏图回退和禁用存储。
- 对用户要求先确认的界面改动，展示截图后等待确认，再提交/推送。
- 日常定时内容发布按用户给定的授权执行；本文件不额外要求逐篇审批。
- 提交后核实 Pages 部署与线上内容。不要把成功 push 当作成功上线。
