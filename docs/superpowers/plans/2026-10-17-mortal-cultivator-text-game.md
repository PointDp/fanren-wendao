# 《凡人问道·文字卷》第一章（引擎 + 全系统 + 剧情第一章）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可玩的纯文字修仙游戏第一章：剧情引擎 + 七分剧情三分经营全系统 + 开发者金手指 + 存档 + 加速，浏览器直接打开 HTML 即玩。

**Architecture:** 无框架无构建。引擎逻辑放在独立 JS 文件中，以全局命名空间 `FC` 挂载（`<script>` 标签顺序加载，兼容 `file://` 直接打开，ES module 在 file:// 下会被 CORS 拦截，故禁用）。同一批文件在 Node 内置 `node:test` 下通过同一命名空间做单元测试（文件头部用 `typeof window!=='undefined'?window:globalThis` 探测宿主）。剧情以**数据**（节点图）而非代码表达，正文存 `js/content/`。

**Tech Stack:** 纯 HTML/CSS/JS（ES2020+，无依赖）、Node v22 内置 test runner、localStorage。

**Spec:** `docs/superpowers/specs/2026-10-17-mortal-cultivator-text-game-design.md`（本计划所有决定均以该 spec 为据，执行者须同读）。

## Global Constraints

- 纯 HTML/CSS/JS，**零 npm 依赖、零构建**；禁止 `import`/`export` 语句（file:// 直开约束）。
- 双端宿主：所有 js 文件挂载到 `FC` 命名空间，宿主探测写法固定为文件首行：
  `var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};`
- 全中文文案；现代浏览器 Chrome/Edge；开发环境 Windows。
- 存档 localStorage，key 前缀 `fcw.save.`；必须有内存兜底（localStorage 被禁时不崩）。
- 玩家死亡不吞进度：死亡不改写检查点存档。
- v1 不做二周目，但 karma/flags 数据结构必须可被将来的二周目读取（留位）。

## Review Focus

1. **`file://` 直接打开必须可玩** — 若误用 ES module 或 fetch 本地文件，双击 index.html 即白屏。期望：直接打开即可玩。测试：Task 1 的静态检查测试扫描 js/ 下无 `import `/`export `语句。
2. **死亡不吞进度** — 玩家寿元耗尽后若检查点被死亡时的自动存档覆盖，进度丢失。期望：复活回到最近检查点。测试：Task 4 `death does not overwrite checkpoint`。
3. **加速不得跳过效果执行** — 快进/跳过文本若连"资源变化、时间推进、因果记录"一起跳过，经营系统崩坏。期望：跳过只影响展示，效果照常入账。测试：Task 5 `choose applies effects even in fast-forward mode`。
4. **寿元归零必死且"必死局豁免"生效** — 豁免开着时致命事件应改为重伤+警告而不是死。测试：Task 2 `lifespan zero kills` / `exempt converts death to injury`。
5. **无痕模式/禁用 localStorage 不崩** — 期望降级为内存存档并提示。测试：Task 4 `falls back to memory storage`。

---

### Task 1: 项目骨架与双宿主约定

**Files:**
- Create: `index.html`（空壳：引入 css 与全部 js，含 `<div id="app">` 挂载点）
- Create: `css/style.css`（基础中文排版：正文衬线、行高 1.9、最大宽度 42em 居中）
- Create: `js/state.js`（仅命名空间声明占位）
- Test: `tests/env.test.mjs`

**Interfaces:**
- Produces: `FC` 全局命名空间约定（每个 js 文件首行统一写 Global Constraints 中的挂载行）；后续所有任务依赖。

- [ ] **Step 1: 写测试**（静态检查 file:// 约束）

```js
import { test } from 'node:test'; import { readFileSync, readdirSync } from 'node:fs';
test('js files are ES-module-free for file:// compatibility', () => {
  for (const f of readdirSync('js', { recursive: true }).filter(f => f.endsWith('.js'))) {
    const src = readFileSync('js/' + f, 'utf8');
    if (!/^\s*(import|export)\s/m.test(src)) continue;
    throw new Error(f + ' uses import/export');
  }
});
test('FC namespace mounts on window and globalThis', async () => {
  const { execSync } = await import('node:child_process');
  const out = execSync('node -e "require(\'./js/state.js\'); console.log(typeof globalThis.FC)"').toString().trim();
  if (out !== 'object') throw new Error('FC not mounted: ' + out);
});
```

- [ ] **Step 2: 跑测试确认失败** — `node --test tests/env.test.mjs`，预期 FAIL（state.js 不存在）
- [ ] **Step 3: 实现** — 建 index.html（按 js 依赖顺序引入 state/effects/save/engine/ui/devpanel/content/ch1）、style.css、js/state.js（仅挂载行）。execSync 的 require 兼容：state.js 需同时支持 `require`（CommonJS 简单探测 `typeof module!=='undefined'&&module.exports` 时 `module.exports=FC`）
- [ ] **Step 4: 跑测试通过** — Expected: PASS
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: project skeleton with dual-host FC namespace"`

### Task 2: 状态模型（资源、境界、寿元、死亡判定）

**Files:**
- Create: `js/state.js`
- Create: `js/content/realm.js`（境界表）
- Test: `tests/state.test.mjs`

**Interfaces:**
- Produces:
  - `FC.REALMS`：`['凡人','炼气一层','炼气二层','炼气三层','炼气四层','炼气五层','炼气六层','炼气七层','炼气八层','炼气九层','筑基一层','筑基二层','筑基三层']`（v1 用到炼气段）
  - `FC.State.create(name)` → state：`{saveVersion:1, name, day:1, cultivation:1(=炼气一层), lingshi:2, lifespanYears:9, injury:0, luck:0, inventory:{}, karma:{}, flags:{}, nodeId:'start', dead:null, deathExempt:false}`
  - `FC.State.advanceDays(state, days)` → 原地推进：`day+=days`；每 365 天 `lifespanYears` 按 `lifespanYears -= days/365`（保留小数）；`lifespanYears<=0` 时置 `dead='lifespan'`（豁免开着时改为 `injury=100`、`dead=null`、追加 flag `escaped_death`）
  - `FC.State.isDead(state)` → bool

- [ ] **Step 1: 写失败测试** — 断言：create 的初值如上；advanceDays(365) 后 day=366 且 lifespanYears 减少 1；lifespanYears 归零后 isDead=true 且 dead==='lifespan'；deathExempt=true 时同场景 dead=null 且 injury=100；injury 取值 0..100 越界截断。
- [ ] **Step 2: 跑测试确认失败** — `node --test tests/state.test.mjs` → FAIL
- [ ] **Step 3: 实现** — realm.js 导出境界表；state.js 实现 create/advanceDays/isDead，纯函数式修改（无 DOM）
- [ ] **Step 4: 跑测试通过** — PASS
- [ ] **Step 5: Commit** — `feat: state model with lifespan death and exemption`

### Task 3: 效果系统（剧情对状态的写入 DSL）

**Files:**
- Create: `js/effects.js`
- Test: `tests/effects.test.mjs`

**Interfaces:**
- Consumes: `FC.State`（Task 2）
- Produces: `FC.Effects.apply(state, effects)`；effects 为数组，元素类型（type/字段名固定）：
  - `{type:'res', key:'cultivation'|'lingshi'|'lifespan'|'injury'|'luck', delta:number}`（`'lifespan'` 是别名，读写 state 的 `lifespanYears` 字段）
  - `{type:'item', id:string, count:number}`（负数移除，库存不足时 count 截到 0）
  - `{type:'karma', id:string, value:any}`（同一 id 多次出现时累加为计数，供延迟后果）
  - `{type:'flag', id:string, value:any}`
  - `{type:'time', days:number}`（内部转调 `FC.State.advanceDays`）
  - `{type:'death', cause:string}`（置 dead，尊重豁免：豁免时改为 injury=100 + flag `cheated_death_<cause>`）
- Produces: `apply` 返回 `{state, log:[string]}`，log 为中文摘要（"灵石 +5""寿元 -2 年"等），供 UI 流水与调试。

- [ ] **Step 1: 写失败测试** — 覆盖每种 type 的生效断言 + karma 累加 + item 库存截断 + death 豁免分支 + log 摘要非空
- [ ] **Step 2: 确认失败** — `node --test tests/effects.test.mjs` → FAIL
- [ ] **Step 3: 实现** js/effects.js
- [ ] **Step 4: 通过** — PASS
- [ ] **Step 5: Commit** — `feat: effect DSL applying story consequences to state`

### Task 4: 存档系统（检查点/自动/3 手动位 + 内存兜底）

**Files:**
- Create: `js/save.js`
- Test: `tests/save.test.mjs`

**Interfaces:**
- Consumes: `FC.State`（Task 2）
- Produces:
  - `FC.Save.save(state, slot)`；slot ∈ `'auto'|'checkpoint'|'m1'|'m2'|'m3'`；JSON.stringify 写 `localStorage['fcw.save.'+slot]`；localStorage 抛异常或缺失时降级到内存 Map 并在返回值 `{ok:true, storage:'memory'}` 标注
  - `FC.Save.load(slot)` → state 或 null；带 `saveVersion` 校验，版本不符返回 null（不做迁移，v1 只有 1 版）
  - `FC.Save.list()` → `{auto:boolean, checkpoint:boolean, m1:boolean, m2:boolean, m3:boolean}`
- 关键不变量：**死亡流程不改写 checkpoint**（UI 层约定：引擎置 dead 后禁止再调用 save 到 checkpoint；save.js 在 state.dead 非空时对 slot==='checkpoint' 直接拒绝返回 `{ok:false,reason:'dead'}`）

- [ ] **Step 1: 写失败测试** — 覆盖：save/load 往返等值；list 反映占用；用 stub 替换 localStorage 抛异常时降级 memory 且可读回；state.dead 非空时 save 到 'checkpoint' 被拒绝；saveVersion 不符 load 返回 null
- [ ] **Step 2: 确认失败** — FAIL
- [ ] **Step 3: 实现** js/save.js（globalThis 探测 localStorage，包 try/catch）
- [ ] **Step 4: 通过** — PASS
- [ ] **Step 5: Commit** — `feat: save system with checkpoint guard and memory fallback`

### Task 5: 剧情引擎（节点图执行器）

**Files:**
- Create: `js/engine.js`
- Test: `tests/engine.test.mjs`

**Interfaces:**
- Consumes: `FC.State`、`FC.Effects`、`FC.Save`
- Produces:
  - 节点图 `graph = { [nodeId]: node }`，node 类型与字段（固定）：
    - `{type:'scene', text:(state)=>string 或 string, effects?:[], goto:'id'|((state)=>'id')}`
    - `{type:'choice', text, effects?:[], choices:[{label, tag?, show?:(state)=>bool, effects?:[], goto}]}`
    - `{type:'hub', text, actions:[{label, effects?含 time, show?, goto|stay:true}]}`（stay=true 表示执行后回到本 hub；hub 每次进入自动存 'auto'）
    - `{type:'combat', text, resolve:{test:(state)=>bool, pass:'id', fail:'id'}, choices:[...决策项写入 flags/items, 不直接定胜负], effects?}`
    - `{type:'death', cause:string, text:(state)=>string}`（终局；revive 由 UI 从 'checkpoint' load）
  - `FC.Engine.view(state, graph)` → `{text, choices:[{label, tag, enabled}]}`（纯读取，供 UI 渲染；choice.show 为 false 的项不出现，tag 默认 ''）
  - `FC.Engine.choose(state, graph, index)` → 执行：当前节点 effects → 选中项 effects → goto 跳转 → **然后统一落盘 `'auto'`**；无论 UI 是否处于快进模式，效果与时间照常执行（Review Focus #3）
  - `FC.Engine.start(name, graph)` → 初始化 state 并落到 graph.start
- graph 约定：入口节点 id 固定 `'start'`。

- [ ] **Step 1: 写失败测试**（用一个小型 5 节点测试图，不依赖正式剧情）— scene 链推进；choice 的 show 过滤；goto 函数分支；hub stay 循环与 time 效果；combat 依据 test 分 pass/fail；死亡后 choose 拒绝继续（返回 {dead:true}）
- [ ] **Step 2: 确认失败** — FAIL
- [ ] **Step 3: 实现** js/engine.js
- [ ] **Step 4: 通过** — PASS
- [ ] **Step 5: Commit** — `feat: story graph engine with hub, combat, death flow`

### Task 6: 开发者金手指面板

**Files:**
- Create: `js/devpanel.js`
- Test: `tests/devpanel.test.mjs`

**Interfaces:**
- Consumes: `FC.State`、`FC.REALMS`
- Produces:
  - `FC.Dev.setRes(state, key, val)`（cultivation/lingshi/lifespanYears/injury/luck 越界按 Task 2 规则截断）
  - `FC.Dev.addItem(state, id, count)`、`FC.Dev.setRealm(state, i)`（同时把 cultivation 设为该层起点并加寿命加成：炼气段 +0，筑基起每层 +40 年，写死在表里）
  - `FC.Dev.jump(state, graph, nodeId)`（跳章节：置 nodeId 并校验目标存在）
  - `FC.Dev.toggleExempt(state)`、`FC.Dev.setLuck(state, v)`
  - UI 侧：`~` 键切换面板 DOM（面板逻辑与 UI 渲染解耦，此处只测数据函数；按键绑定在 Task 7 手工验证）

- [ ] **Step 1: 写失败测试** — 每个 API 的断言：setRes 修值、setRealm 换境界并加寿、jump 目标不存在时抛错、toggleExempt 翻转
- [ ] **Step 2: 确认失败** — FAIL
- [ ] **Step 3: 实现** js/devpanel.js（数据函数 + 简单 DOM 面板模板：滑杆与按钮，暴露 `FC.Dev.mount(el, getState, rerender)`）
- [ ] **Step 4: 通过** — PASS
- [ ] **Step 5: Commit** — `feat: developer panel with cheats, realm jump, death exemption`

### Task 7: 文字 UI（渲染、状态栏、打字机、加速）

**Files:**
- Create: `js/ui.js`
- Modify: `css/style.css`（正文区、状态栏、按钮、快进按钮、死亡画面、开发者面板样式）
- Test: `tests/ui.test.mjs`（仅测纯逻辑部分）＋手工验证清单

**Interfaces:**
- Consumes: `FC.Engine.view/choose`、`FC.Save`、`FC.Dev.mount`
- Produces: `FC.UI.mount(document.getElementById('app'), {graph})`，接管整个游戏循环：渲染 view、状态栏（修为境界/灵石/寿元/伤势/背包摘要/第 N 天）、选择按钮（tag 徽标）、打字机（速度 ~28ms/字，**点击正文区立即补全**；右上"⏩ 加速"切换全局快进=直接全文显示）、hub 的行动按钮、死亡画面（结局文 + "从检查点苏醒"按钮 → load('checkpoint') 复活）、存档菜单（3 手动位 + 读档 + 自动/检查点信息显示）。
- 纯逻辑抽出以便 Node 测试：`FC.UI.summary(state)` → 状态栏字符串；`FC.UI.deathText(state)` → 按死因选结局文（'lifespan'/'combat'/'poison'/'exiled' 四档，文案 v1 简短版）

- [ ] **Step 1: 写失败测试** — summary 含境界名/灵石数/寿元年数；deathText 四档各返回非空且互不相同
- [ ] **Step 2: 确认失败** — FAIL
- [ ] **Step 3: 实现** js/ui.js 与样式
- [ ] **Step 4: 通过 + 手工验证** — 测试 PASS 后，`start index.html` 打开浏览器，按清单核对：开局文字打字机→点击补全；加速开关生效；状态栏随选择变化；~呼出面板改灵石立即反映；关页面重开"继续游戏"恢复；死亡→结局文→复活回检查点
- [ ] **Step 5: Commit** — `feat: text UI with typewriter, fast-forward, death screen, saves menu`

### Task 8: 第一章剧情《测灵》

**Files:**
- Create: `js/content/ch1.js`
- Create: `js/content/items.js`（物品表：id→{名称,类型,描述,基础价}，v1 约 12-16 件：回气散、金刃符、引气诀残页、灵草、杂役月牌等）
- Test: `tests/ch1.test.mjs`

**Interfaces:**
- Consumes: Task 2-6 全部 API；节点图结构同 Task 5
- Produces: `FC.CH1`（节点图，入口 `'start'`，注册进 index.html 的 graph 合并 `Object.assign({}, FC.CH1)`）

**剧情大纲（结构固定，文字由实现者按凡人流基调撰写：谨慎、算计、机缘、卑微）**：

1. **开局**：青牛镇，山村孤儿李恒（可改名）随流民入镇，测灵大典——伪灵根受辱。
2. **抉择①（入仙门）**：落云宗执事收杂役：签十年苦契（稳）/ 花光全部积蓄托关系补测（赌）/ 留镇当账房苟着（flag，后续可再入）。三个分支不同开场。
3. **外门杂役生涯 hub（月循环，循环 3 次）**：杂役当值（+灵石2，-时间30天）/ 偷偷修炼（-时间30天，+修为，被抓住有惩罚分支）/ 坊市跑腿（+灵石，遇李师姐）/ 访张铁（好感+）。hub 循环到"灵田秋收"节点自动结束。
4. **事件：灵田失窃案**（本章戏眼）：三师兄丢灵草，王管事要拿新人顶罪。抉择②：顶罪（因果 `took_blame`，张铁好感++）/ 指认真凶但证据不足（因果 `exposed_early`，王管事记恨 flag）/ 装傻沉默（因果 `silent_witness`）/ 偷偷夜探灵田找真相（胆量检定：伪灵根+准备不足→受伤逃回，发现真正线索 flag `knows_truth`）。
5. **章末：执法堂对峙**：根据因果组合有 3 种走向（洗清/顶罪受罚但得赏识/沉默混过），任何走向都以"夜里整理床铺，发现床板夹层的《引气诀》残页"收束——**机缘**（luck 或 `knows_truth` 影响残页品相描述分支），置检查点，钩子文案引出第二章。

**因果/好感变量（固定）**：karma: `took_blame`/`exposed_early`/`silent_witness`/`knows_truth`；flag: `left_in_town`/`signed_contract`/`bought_way`/`steward_grudge`；好感：karma `aff_zhang_tie`/`aff_li_shijie`/`aff_steward`（数值）。

- [ ] **Step 1: 写失败测试（图完整性校验）** — 新增 `FC.Test.validate(graph)` 于 js/engine.js 内（本任务补）：断言 ch1 图——所有 goto 目标存在；所有非 death/hub 节点至少 1 个 choice 或 goto；所有 choice.goto 可达；从 'start' 出发无不可达节点；所有 death 节点有 cause；hub 每个 action 有 time 效果或显式 days
- [ ] **Step 2: 确认失败** — FAIL（ch1.js 不存在）
- [ ] **Step 3: 撰写 ch1.js 与 items.js** — 按上述大纲写全部节点与正文（正文字数目标：分支合计 8000-12000 字）；文字要符合 spec 的"首读值得读"标准
- [ ] **Step 4: 通过** — `node --test tests/ch1.test.mjs` PASS
- [ ] **Step 5: 手工全流程走查** — 浏览器完整通关一次（三条入仙门路线各走一次至章末），核对：因果组合对应不同章末走向；hub 三循环时间/资源入账正确；死亡路径（开豁免→关豁免→寿元调 0）结局文正常
- [ ] **Step 6: Commit** — `feat(quest): chapter 1 测灵 with branching karma outcomes`

### Task 9: 收尾集成与验收

**Files:**
- Modify: `index.html`（标题《凡人问道·文字卷》、meta charset/viewport、开局菜单：继续游戏(读 auto)/新开局(改名)/读档）
- Test: `tests/acceptance.test.mjs`

**Interfaces:**
- Consumes: 全部前序任务

- [ ] **Step 1: 写失败测试（端到端脚本级）** — Node 中模拟一局：start → 走完签苦契路线 → hub 三循环 → 失窃案装傻 → 章末，断言：全程无异常；结束时 day 合理（≤400）、lifespanYears 已随时间减少、checkpoint 存档存在且可 load、karma.silent_witness≥1
- [ ] **Step 2: 确认失败** — FAIL
- [ ] **Step 3: 实现开局菜单与接线** — index.html 图注册 + 开局菜单 + "继续游戏"按钮
- [ ] **Step 4: 全部测试通过** — `node --test tests/` 全绿
- [ ] **Step 5: 手工验收对照 spec** — 目标 §二 1-7 逐条打勾（代入感/选择多/延迟后果/经营/加速/存档/金手指）；`file://` 双击直开核验
- [ ] **Step 6: Commit** — `feat: title menu, wiring, acceptance pass`

---

## 交付后

Task 9 完成 = 第一章可玩。**交给用户试玩确认文风与手感**（spec §七分批交付）。认可后再为第二、三章单独写计划。
