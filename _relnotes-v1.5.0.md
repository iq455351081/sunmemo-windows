# SunMemo for Windows v1.5.0 — 悬停即放大

## ✨ 新增

- **悬停图片自动放大**：鼠标悬停绳上图片卡（无需点击），照片原地 Dock 式弹簧放大 **3×**，小图瞬间可读；深阴影浮起质感，移开即回落
  - `prefers-reduced-motion` 与省电模式自动禁用
  - 设置「悬停时图片自动放大」可随时开关（默认开启）

![悬停放大对比](https://raw.githubusercontent.com/suzike/sunmemo-windows/main/docs/img/06-imgzoom.png)

## 🛠 修复

- **图片卡缩略图丢失（三级自愈）**：缩略图原本随广播「一次性发送」——打开搜索 / 预览等任何窗口都会烧掉发送额度，renderer 崩溃自动重载后图片卡更是永久变空盒。现在：
  1. 主进程在每次页面加载完成时清额度并重发全部缩略图；
  2. renderer 发现缺图时经 `line:thumb` 主动向主进程拉取自愈；
  3. 空 thumb 不再写 `src=""`（杜绝指向 line.html 的死链破图）。
- **渲染恢复**：晾衣绳窗口崩溃自动重载后，软件渲染标记（sw 类）与卡片字号档随页面重载一并回推。

## ✅ 质量

- 状态机自测 **19/19** 通过
- 端到端 **26/26** 通过（含悬停放大 3× 用例）
- 真光标注入实测 **11/11**：真光标悬停放大、拖入图片 → 移到回收站（卡片消失 / 文件离位 / 进入回收站）、缩略图自愈

**完整变更**：[CHANGELOG.md](https://github.com/suzike/sunmemo-windows/blob/main/CHANGELOG.md)
