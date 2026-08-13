# 任务清单 TASKS.md（项目管理）

状态：✅ 完成 ・ 🔄 进行中 ・ ⬜ 待办

## 里程碑 M1-M8 功能开发

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| 1 | 脚手架：Vite+TS(strict)+Phaser3、git init | ✅ | `npm run dev` / `build` |
| 2 | 种子化地图：96×96、湖泊、资源点散布、出生区清理 | ✅ | `systems/World.ts` mulberry32 RNG |
| 3 | Tilemap 渲染 + 水面碰撞 + 相机跟随 | ✅ | tileset 条带纹理，`pixelArt` |
| 4 | 玩家移动（WASD/方向键）、边界、阴影 | ✅ | `systems/Player.ts` |
| 5 | 采集：按住左键/E 采集、5 种节点、进度条、耗尽消失 | ✅ | 跟随帕鲁 ×2 加速 |
| 6 | 背包与物品体系（11 种物品 + 5 种帕鲁球） | ✅ | `data/items.ts` |
| 7 | 建造：幽灵预览、合法性/造价校验、Q/E 旋转、拆除返还 50% | ✅ | `BuildingSystem` |
| 8 | 10 种建筑：风电/燃煤/采矿机/熔炉/组装机/研究所/传送带/储物箱/帕鲁终端/戴森核心 | ✅ | `data/buildings.ts` |
| 9 | 电力：风力波动、燃煤燃烧、赤字降速、UI 告警 | ✅ | `recomputePower` |
| 10 | 生产：配方系统（冶炼/齿轮/电路/红瓶/帕鲁球/戴森组件）、缓冲、帕鲁加成 | ✅ | `RECIPES` |
| 11 | 传送带：段式物流、链式传递、建筑拉货/收货、物品过滤 | ✅ | `BeltSystem` |
| 12 | 野生帕鲁：5 种、稀有度权重、游荡/逃跑/夜间睡觉 | ✅ | `PalSystem` |
| 13 | 帕鲁球投掷：抛物线、命中判定、捕获概率、落空可捡回 | ✅ | `throwSphere` |
| 14 | 帕鲁管理：释放/指派/喂食/放归/跟随，饱食与心情衰减 | ✅ | UI 帕鲁面板 |
| 15 | 科技树：6 项科技、前置依赖、红瓶消耗、自动研究 | ✅ | `TechSystem` |
| 16 | 戴森终局：戴森组件 → 核心 → 胜利结算 + 沙盒继续 | ✅ | `DYSON_NEEDED=10` |
| 17 | 昼夜循环 + 夜间遮罩 | ✅ | 240s/天 |
| 18 | 像素美术：pixel map 贴图、CRT 滤镜、Fusion Pixel 字体 | ✅ | 用户点名"刻意的像素风" |
| 19 | 音效：WebAudio 程序化合成 + 环境 pad | ✅ | `utils/sound.ts` |
| 20 | 存档：自动 20s / 手动 / 继续游戏 / 删除 | ✅ | localStorage |

## 验证与质量

| # | 任务 | 状态 | 备注 |
|---|---|---|---|
| 21 | `tsc --noEmit` 严格模式零错误 | ✅ | |
| 22 | `vite build` 生产构建通过 | ✅ | |
| 23 | 无头浏览器启动 + 截图回归 | ✅ | 全屏像素扫描 + 逐建筑裁剪验证，见 docs/REVIEW.md |
| 24 | 玩法闭环冒烟测试（采集→风电→采矿机→熔炉→红瓶→科技） | ✅ | scripts/smoke.mjs 24 项断言全过 |
| 25 | 代码审查（独立子代理审阅 + 修复清单） | ✅ | 1 Critical + 6 Important + ~20 Minor 全部修复，见 docs/REVIEW.md |
| 26 | GitHub 仓库备份与推送 | ✅ | https://github.com/JiMingXuan1/paldyson |

## 文档

| # | 任务 | 状态 |
|---|---|---|
| 27 | README.md（玩法/操作/技术栈/结构/许可） | ✅ |
| 28 | docs/PLAN.md（调研与设计） | ✅ |
| 29 | docs/TASKS.md（本清单） | ✅ |
| 30 | docs/CHANGELOG.md | ✅ | |
| 31 | docs/REVIEW.md（代码审查记录） | ⬜ |
