# 项目移交说明（HANDOVER）

> 适用对象：接手下一位 agent / 开发者
> 最后更新：2026-08-30
> 项目根目录：`d:\05 ai作品集\00 zuopinji`

---

## 〇、一句话总览

这是一个 **Framer 模板站「Creatie®」的本地化改造项目** —— 已把原始英文模板改造成**寿姝琦 SUKI 的「AIGC 产品经理作品集」中文个人站**，主交付物是 `index.html`（约 758 KB，单文件，内含 SSR 中文 + 运行时替换脚本）。

**当前文件是可用、可预览的**：`http://127.0.0.1:8000/` 即可查看。改造整体已完成，仅剩少量细节待完善（见「四、待完成」）。

---

## 一、项目总任务

把 Framer 模板站 **Creatie®（创意设计师作品集）** 本地化改造为个人中文作品集——**寿姝琦 SUKI 的「AIGC 产品经理作品集」**：

- 全站英文文案 → 中文（身份、求职方向、教育/实习、项目、能力、方法论、FAQ 等）
- 项目卡片收敛为 3 个目标项目（科技馆数字导览、Khaki Girl、星耳小狐・Lumi）
- 保持 Framer 原版的滚动 / 动效 / 响应式架构

---

## 二、核心难点（移交前必读，是最重要的认知）

`index.html` 是 Framer 的 **SSR + hydration** 架构。**直接改 SSR 文字不够**——Framer 的 JS 在页面加载后的 hydration 阶段，会把 SSR 里的文字**重新恢复成英文**。因此必须「**改 SSR + 注入运行时替换脚本**」双管齐下：

1. **改 SSR 静态文字**：让首屏/无 JS 时能看到中文（针对渲染树里的静态文本）。
2. **注入 `suki-text` 运行时脚本**：在 hydration 完成后，用 TreeWalker 遍历所有文本节点，用映射表把英文替换成中文，并挂 MutationObserver（防抖）监听后续 DOM 变化。

> ⚠️ **只改 SSR 不注入脚本，刷新后仍是英文；只注入脚本不改 SSR，无 JS / SEO 环境仍是英文。两者都要做。**

---

## 三、当前实际状态（2026-08-30 实测）

### ✅ 已完成并验证

| 项 | 说明 | 位置 |
|---|---|---|
| 本地环境 | `index.html` / `exact-framer.html` / `assets/` 已就绪，`http.server:8000` 可预览 | 项目根目录 |
| 原始备份 | `index.html.bak` = 改造前英文原版；`index.html.bak2` = 中文版（行高达改动前的基线，用于回滚） | — |
| SSR 静态文字 | 首屏 hero、标题、项目名等已替换为中文 | `index.html` 约第 960 行等 |
| `<title>` / og / twitter | 标题已改为「SUKI® – AIGC 产品经理作品集」 | 约第 645 / 654 / 659 行 |
| **运行时替换脚本** | `suki-text` 脚本：TreeWalker 遍历 + MutationObserver 防抖，hydration 后英文→中文（已验证生效） | `index.html` 末段 `<script id="suki-text">`，约第 747499 字符起 |
| 分区映射表 | `G`（全局）、`SERVICES`、`HERO`、`PROJECT` 数组，用 `closest('#services'/'#hero'/'#project')` 区分同名文字 | 脚本内 |
| 项目卡片过滤 | `syncProjectCards` 在项目区和首页预览堆栈中只保留 2 个目标项目：`Khaki Girl`、`星耳小狐・Lumi` | `allowedProjects` / `removedProjects` |
| 页面板块精简 | 已隐藏 `#services`、`#reviews`、`#faqs` 及其无效导航入口 | `removed-content-sections` |
| 项目滚动堆叠 | 参考 `stack-scroll-reveal.framer.ai`，两个横板项目通过 sticky + scroll progress 逐层覆盖揭示；前卡轻微上移、缩小和变暗，点击仍打开原 Framer 详情弹窗 | `apple-project-scroll-stack` / `mountProjectScrollStack` |
| **首屏标题行高 → 100%** | 通过 `<style>` 覆盖 `--framer-line-height: 100% !important`，只作用于首屏主标题容器 `.framer-19mtef4` | headEnd 区 |
| 实测渲染 | 身份 / 求职 / 教育 / 项目 / 能力 / 方法论 / FAQ 问题等均显示中文 | — |

### 🔒 关于「首屏标题行高 100%」

这是用户明确的视觉偏好，**务必保留**。实现方式是在 headEnd 注入一段 `<style>`：

```html
<!-- Start of headEnd -->
    <style>
        /* 首屏主标题：行高统一为 100% */
        .framer-19mtef4 h6.framer-styles-preset-17gsj7w,
        .framer-19mtef4 .framer-styles-preset-17gsj7w {
            --framer-line-height: 100% !important;
            line-height: 100% !important;
        }
    </style>
        <!-- End of headEnd -->
```

> 注意：只影响 `framer-styles-preset-17gsj7w` 这个 Framer 预设（就是首屏主标题在用的），避免波及其它用到同一预设的标题。`index.html.bak2` 是目前的正基线（含此设置 + 原始响应式标题）。

---

## 四、待完成 / 已知问题 ⚠️（下一 agent 的活）

### ✅ 已解决（2026-08-30）：左上角卡片悬停描述中文化

**现象**（用户给了截图确认）：在**桌面宽度（≥1440px）**下，**把鼠标悬停 / 选中左上角头像卡片**，会出现一条模板自带的英文描述：

> **I design clean websites, landing pages, and product interfaces that look sharper, feel clearer, and convert better.**

用户希望把它换成中文（例如）：**融合产品思维、AIGC 与视觉表达，将想法快速转化为可验证的产品方案。**

**技术定位（已实测确认）：**
- 这条英文**不在 SSR 静态文件里**，静态 grep 全文（含 `convert`/`clearer`/`interfaces`/`productinterfaces`）结果均为 0。
- 它是 Framer **运行时**注入的。实测 DOM 载体如下（桌面版卡片 `framer-v-pyr9gz` 下）：
  ```
  SPAN.framer-text                                              ← host，含这句英文
    P.framer-text
      DIV.framer-megei4   data-framer-name="I design clean websites, landing pages, ..."  ← RichTextContainer
        DIV.framer-1p7ie4i  data-framer-name="profile-info"
          DIV.framer-7qgno6   data-framer-name="1"
            DIV.framer-DPOZw.framer-pyr9gz.framer-v-pyr9gz
  ```
- 相关节点：卡片数据名 `Sarah - Product Designer`（SSR 里出现 2 次，已在 `suki-text` 的 `G` 映射中替换为 `寿姝琦 SUKI｜AIGC 产品经理`）；`.framer-megei4` 就是这条描述的 RichTextContainer。
- 平板 / 移动宽度下卡片是**另一个变体**（`framer-v-pngd4r`，data-framer-name="Tablet"），不一定渲染这条描述；**重点处理桌面版**。

**完成情况**：已在 `suki-text` 的全局映射中加入该动态文案，并继续沿用现有 `MutationObserver` 处理 hover 后按需插入的 `.framer-megei4`。桌面端 `1600×900` 已实际触发悬停验证：描述显示为“融合产品思维、AIGC 与视觉表达，将想法快速转化为可验证的产品方案。”，可见正文中不再含原英文；同时将能力行改为“产品策略 · AIGC 应用 · 原型设计”。

### 🟡 其它遗留问题（沿用上次记录）

1. **浏览器标签页标题已解决**：`suki-text` 现在会在启动时同步标题，并监听 `<head>` 的运行时变化；实测稳定显示 `SUKI® – AIGC 产品经理作品集`。
2. **遗留英文文本**（替换表未覆盖到）：顶部 Dock 区占位文本 `asaf sdag` ×3；链接 `aria-label="View WAXYWEB case study"`；`About me` 二级标题；项目区标签 `Projects`。
3. **一处替换出错（半中半英）**：FAQ 第一条答案渲染成 `...the digital stuff 产品价值 judge you by first.`（映射写错，需修）。
4. **SEO 元信息仍是英文/原站**：`meta description`、`og:description`、`og:image`、favicon、`canonical`/`og:url`（仍指向 `creatiie.framer.website`）。
5. **handover 数据未改**：`__framer__handoverData` 里 collection 动态字段（项目名 `Sunoma`、类型 `Figma`、年份 `2026`、链接 `sunoma.co`）仍英文，目前靠脚本兜底，未直接改数据源。
6. **Hydration 报错**：控制台出现 React #418 / #422 / #425（服务器/客户端文本不一致），属「可恢复」错误，但可能引起闪烁。
7. **资源联网依赖**：字体 / 图片来自 `framerusercontent.com`，离线或超时会 `ERR_TIMED_OUT`。
8. **README.md 未更新**（仍是 `Creatie Portfolio Replica` 旧描述）。
9. **响应式断点**：移动端 `390×844` 首屏已做烟雾测试，未出现横向溢出或主标题叠字；平板与移动端全页仍待系统验证，部署发布未做。

---

## 五、关键文件

| 文件 | 说明 |
|---|---|
| `index.html` | **主交付物**（含 SSR 中文 + `suki-text` 运行时脚本 + headEnd 行高 style） |
| `index.html.bak` | 改造前英文原版（回滚用） |
| `index.html.bak2` | 中文版基线（含行高 100% + 原始响应式标题，**当前最准回滚点**） |
| `exact-framer.html` | 原始 Framer 镜像（对比英文原文用） |
| `index-handcrafted.html` | 早期手工版（已弃用，仅保留） |
| `styles.css` / `app.js` | 服务于 `index-handcrafted.html` 的辅助文件（主站 `index.html` 不用） |
| `README.md` | 环境说明（**待更新**） |
| `HANDOVER.md` | 本文档 |

---

## 六、环境备忘

- Python 解释器：`D:/00.project/python.exe`（3.14，用于处理大文件中文编辑，注意 stdout 会 GBK 乱码，写文件再读更稳）
- 本地预览：在项目目录运行 `python -m http.server 8000`，打开 `http://127.0.0.1:8000/`
- 中文替换用 Python 脚本：`open(..., encoding='utf-8', newline='')` 读写，避免 PowerShell 引号/编码问题
- **大文件坑**：`index.html` 是超长单行压缩文件，**避免用正则做全局替换**（会灾难性回溯卡死）；用 `str.find` / 精确字符串窗口更稳。静态全文搜索用 Grep 工具/ripgrep。
- **浏览器缓存坑**：改动后务必让用户 **`Ctrl+F5` / `Cmd+Shift+R` 强刷**，否则看到的是旧缓存。

---

## 七、运行时替换脚本速查（`suki-text`）

- 位置：`index.html` 靠近末尾，`<script id="suki-text">` 起。
- 核心结构：一个 IIFE，含映射数组（`G` / `SERVICES` / `HERO` / `PROJECT`）、一个遍历函数（TreeWalker 文本节点）、一个 `fix()` 替换函数、一个 MutationObserver（防抖）监听整页 DOM 变化后重新 `fix()`。
- 新增替换对 = 往对应数组加 `['英文','中文']`，并确认能用 `closest(选择器)` 区分同名文本所在分区。
- `id="suki-text"` 是自定义标记，找该脚本就搜索这个 id 即可。
