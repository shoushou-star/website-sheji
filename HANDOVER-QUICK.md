# ⚡ 交接速览（给下一位 agent 的 30 秒版）

完整说明见 `HANDOVER.md`。这里是**最重要的事实**。

## 这个项目是什么
Framer「Creatie®」模板 → 中文个人站「寿姝琦 SUKI · AIGC 产品经理作品集」。主交付物 = **`index.html`**。

## 最重要的架构认知（必读，不看会白干）
`index.html` 是 Framer **SSR + hydration** 架构。**改 SSR 文字不够**——hydration 时 Framer 会把文字恢复成英文。
解法 = **改 SSR + 注入 `suki-text` 运行时脚本**（TreeWalker + MutationObserver，hydration 后把英文换成中文）。两者都要做。

## 当前可用
- 预览：项目目录跑 `python -m http.server 8000` → 打开 `http://127.0.0.1:8000/`
- **首屏标题行高已固定 100%（用户明确要求，保留）**，在 headEnd 的 `<style>` 里。

## ✅ 2026-08-30 最新完成
- 桌面端左上资料卡 hover 动态描述已中文化；`1600×900` 实际悬停验证通过。
- 资料卡能力行已改为“产品策略 · AIGC 应用 · 原型设计”。
- Framer 运行时覆盖浏览器标题的问题已修复，当前标题为 `SUKI® – AIGC 产品经理作品集`。
- 移动端 `390×844` 首屏烟雾测试通过，无横向溢出或标题叠字。
- 项目展示区和首页右下角项目预览堆栈均已移除“科技馆数字导览”，只保留 `Khaki Girl` 与 `星耳小狐・Lumi`。
- 首页被移除项目留下的透明玻璃外框已一并隐藏；Capabilities、Process、Principles 三个整页板块及其导航入口已隐藏。
- 项目区已按 `stack-scroll-reveal.framer.ai` 改为横向 Apple 极简滚动堆叠：滚动时下一张卡覆盖揭示，前卡轻微上移、缩小和变暗；点击卡片仍打开原详情弹窗。

## 下一步
继续清理交接文档列出的遗留英文、SEO 元信息和 hydration 警告，并完成平板/移动端全页响应式验证；不要只检查首屏。

## 文件
- `index.html` = 主交付物（SSR中文 + suki-text脚本 + headEnd行高style）
- `index.html.bak` = 英文原版 · `index.html.bak2` = 中文基线（含行高100%，最准回滚点）
- `exact-framer.html` = 英文原文参考

## 环境 / 坑
- Python：`D:/00.project/python.exe`（stdout 会 GBK 乱码，写文件再读）
- `index.html` 是超长单行压缩文件 → **别用正则全局替换**（会卡死），用精确字符串 find/窗口
- 改完让用户 **Ctrl+F5 强刷**，否则看旧缓存
