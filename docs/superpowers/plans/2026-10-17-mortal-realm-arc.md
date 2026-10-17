# 《凡人问道·文字卷》人界篇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把游戏从"第一章·炼气二层"扩为完整人界篇：炼气→筑基→结丹→元婴→化神→终局抉择（老死/飞升/坐化），约 12-15 万字。

**Architecture:** 引擎零大改——扩境界表、检查点多节点注册、死亡文案扩档，其余全部以剧情内容包（js/content/chN.js）实现；新增内容注册器把各章 graph 合并进 FC.Content。突破/大限压迫感复用既有 res/time/death 效果与 terminal 节点。

**Tech Stack:** 纯 HTML/CSS/JS（零依赖零构建、file:// 直开、全局命名空间 FC），Node v22 `node:test`。

**Spec:** `docs/superpowers/specs/2026-10-17-mortal-realm-arc-design.md`（人界篇设计，同读）；既有引擎接口见 `docs/superpowers/plans/2026-10-17-mortal-cultivator-text-game.md` 与源码。

## Global Constraints

- 零 npm 依赖、零构建；禁止 import/export；js 文件首行必须原样保留：`var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};`
- 全中文文案；凡人流文风（谨慎、小人物、有代价、不爽文）；引号统一全角“”。
- 存档 `saveVersion` 恒为 1；REALMS 只追加不改既有索引；旧存档（cultivation 0-2）必须可继续游玩。
- 死亡不吞进度：死亡状态下无任何写 'checkpoint' 的路径（引擎已保证，新内容不得绕过）。
- 突破/战斗成败全部由 state 条件决定，禁止引入随机数。
- karma/flags/inventory 保持 JSON-serializable。
- 每任务完成：全量测试 `node --test "tests/*.test.mjs"` 绿（现基线 131 例，不得回归），提交 commit。
- 测试运行注意：Node v22.19.0 目录形式 `node --test tests/` 会报错，用 glob 形式。

## Review Focus

1. **旧存档兼容**：v1 存档（cultivation≤2）载入扩容后游戏——境界名/显示/剧情承接不得错乱 → Task 1 测试 `旧存档 cultivation=1|2 载入后 REALMS[cultivation] 不变`。
2. **注册器幂等与顺序**：registry 重复执行、章节文件缺失时不得重复注册节点或抛错 → Task 2 测试。
3. **突破失败路径**：硬闯突破的死亡（兵解/丹毒）不得写检查点，退境（cultivation-1）可恢复 → 各章任务测试。
4. **终章倒计时**：大限期间 time 快进持续消耗寿元，归零触发老死结局且结局文含生平因果段 → Task 7 测试。
5. **字数下限**：每章正文（text 字段并集）不足目标字数即为缺陷 → 各章测试（沿用 content.test.mjs 字数测试模式）。

---

### Task 1: 系统扩容《筑基之上》

**Files:**
- Modify: `js/content/realm.js`（REALMS 追加 + REALM_TIERS）
- Modify: `js/engine.js`（setCheckpointNode 多节点累积）
- Modify: `js/ui.js`（deathText 扩至六档）
- Modify: `js/devpanel.js`（setRealm 寿元加成表扩至 20 级）
- Test: `tests/system-upgrade.test.mjs`（新建）；既有 realm/devpanel 相关断言同步更新

**Interfaces:**
- Consumes: 既有 `FC.REALMS`、`FC.Engine.setCheckpointNode(node)`、`FC.UI.deathText(state)`、`FC.Dev.setRealm(state,i)`
- Produces:
  - `FC.REALMS`：20 项，索引 0-12 不变，13-15=结丹一~三层，16-18=元婴一~三层，19=化神
  - `FC.REALM_TIERS`：`{凡人:0,炼气:1,筑基:10,结丹:13,元婴:16,化神:19}`
  - `FC.Engine.setCheckpointNode(nodeOrArray)`：字符串或数组均可；多次调用**累积**（内部去重）；`_enter` 命中任一注册节点且存活时写 'checkpoint'。既有单值调用（ch1.js:461）行为不变。
  - `FC.UI.deathText(state)` 六档 cause：寿终/战死/中毒/冻毙/兵解/丹毒（各档非空、互不相同）；寿终档暂不读 karma（终章 Task 7 再扩生平段）
  - `FC.Dev.setRealm` 寿元加成：索引 0-12 照旧（0×10,40,80,120），13-15 每层 +80，16-18 每层 +150，19 +300（叠加语义保持现状，评审已裁定可接受）

- [ ] **Step 1: 写失败测试**（tests/system-upgrade.test.mjs）：
  - `FC.REALMS.length===20` 且 `REALMS[12]==='筑基三层'`、`REALMS[13]==='结丹一层'`、`REALMS[19]==='化神'`
  - 旧存档兼容：`FC.State.create` 后 `REALMS[1]==='炼气一层'`、`REALMS[2]==='炼气二层'` 不变
  - `FC.REALM_TIERS` 五键值如上
  - setCheckpointNode：注册数组 ['a','b']，先后 enter a、b 均写 checkpoint（存活时），再 enter c 不写；重复注册同节点不重复累积
  - deathText：六种 cause 返回值互不相同且非空；未知 cause 走兜底档
  - setRealm(s,15) → lifespanYears 增加 80；setRealm(s,19) → 增加 300
- [ ] **Step 2: 运行确认失败**：`node --test tests/system-upgrade.test.mjs`
- [ ] **Step 3: 实现**（按 Interfaces 逐条；engine 的 `_checkpoint` 内部改 Set；devpanel BONUS 表扩为 20 项数组）
- [ ] **Step 4: 全量测试**：`node --test "tests/*.test.mjs"` 全绿（更新 devpanel.test.mjs 中依赖旧 BONUS 表的断言）
- [ ] **Step 5: Commit**：`feat: 境界表扩至化神、检查点多节点、死亡文案六档`

---

### Task 2: 第二章《外门大比》+ 内容注册器

**Files:**
- Create: `js/content/ch2.js`（导出 `FC.CH2={graph, meta:{chapter:2,title:'外门大比',checkpointNode:'ch2_start'}}`）
- Create: `js/content/registry.js`（加载于所有 chN.js 之后；将存在的 FC.CH2…FC.CH7 的 graph 合并进 `FC.Content.graph`（Object.assign），并对每章调用 `FC.Engine.setCheckpointNode(meta.checkpointNode)`；幂等：重复执行不重复合并/注册）
- Modify: `index.html`（增补 ch2.js、registry.js 的 script 标签，registry 在最后）
- Modify: `js/content/items.js`（按剧情追加道具，id 见下）
- Test: `tests/ch2.test.mjs`

**Interfaces:**
- Consumes: FC.Effects 全效果、FC.REALMS、FC.REALM_TIERS、engine setCheckpointNode(数组)、FC.Content（ch1.js 定义）
- Produces: `FC.CH2`；registry 模式（后续章节照抄）；新道具 id：`筑基丹`、`灵药固本丹`、`李师姐的锦囊`、`执法堂令牌`

**剧情合同（定死值）**：
- 入口承接第一章终（外门大比将至）；境界曲线：炼气二 →（大比备战/苦功线）炼气四 → 授《引气诀》全本 → hub 月循环快进 → 炼气七层卡瓶颈收尾
- 大比三条夺名路径：苦功流（knows_truth → 残页对照勘误奖励 luck+5）、人情流（aff_zhang_tie≥3 或 aff_li_shijie≥3 → 助力）、险棋流（knows_truth → 揭发作弊动用执法堂旧案）
- 关键抉择定死：大比中救张铁 vs 保名次（karma aff_zhang_tie 兑现，救=名次降、aff+2；保=aff-1、karma cold_blood=1）；李师姐筑基赠别（aff_li_shijie≥2 → 得 `李师姐的锦囊`）
- 大比结果三分支：入前十（记名弟子）/ 名落孙山（hub 重整一年再战，限两次，第三次强制结局式劝退回外门杂役线）/ 险棋流特殊（得罪内门，karma enemy_inner=1，第三章承接）
- 章末：授全本+残页对照发现"气起于踵"多出半句（flag ch2_quanben=1）；瓶颈选项"购灵药固本丹"（灵石≥15，引出第三章）与"闭关苦熬"（time 365×2，寿元自然流逝）
- 突破示例照第一章模式：突破失败路径必须存在（硬闯药量不足 → injury+40 且退境 cultivation-1）
- 字数目标：正文（各节点 text 并集）≥15000 字

- [ ] **Step 1: 写失败测试**（tests/ch2.test.mjs）：registry 幂等（调用两次 graph 节点数不变、checkpoint 注册不变）；`FC.Test.validate(合并后 graph)` 全绿；大比三路径走查（各至 ch2_end）；救张铁/保名次因果断言；瓶颈选项 enabled 条件；字数 ≥15000
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 写内容**（ch2.js + registry.js + items 追加 + index.html script）
- [ ] **Step 4: 全量测试绿**
- [ ] **Step 5: Commit**：`feat(quest): 第二章 外门大比 + 内容注册器`

---

### Task 3: 第三章《筑基》

**Files:**
- Create: `js/content/ch3.js`（`FC.CH3={graph, meta:{chapter:3,title:'筑基',checkpointNode:'ch3_start'}}`）
- Modify: `js/content/registry.js`（幂等遍历列表加入 'CH3'——实现建议：registry 维护待注册章节数组常量，本任务只往里加一项）
- Modify: `index.html`（+ch3.js）
- Modify: `js/content/items.js`（追加：`筑基草`、`张铁的家书`、`青元剑诀`）
- Test: `tests/ch3.test.mjs`

**Interfaces:**
- Consumes: FC.CH2 的出口（ch2_end 及其 flags/karma）；registry
- Produces: `FC.CH3`；道具如上；flag `mortal_pill_used`（筑基方式标记）、karma `enemy_inner` 承接

**剧情合同**：
- 开局炼气七层瓶颈；机缘三选一：剿矿盗（危险正道，injury 风险，得宗门贡献）/黑市商队（灵石 -20 起、灰色、遇张铁走商线）/深山采药（九死一生，残页共鸣 luck≥20 → 奇遇得 `筑基草`）
- 回乡探亲段（定死）：time ≥60 天，父母已故坟头草高；took_blame/张铁存亡影响村中评价文本
- 筑基抉择（三选一，定死数值）：一枚丹硬闯（`筑基丹`×1，失败分支 injury+60、cultivation-1 退境、丹毒 karma，可重试）/三枚丹稳（`筑基丹`×3，time 3 年，必成）/残页辅助（ch2_quanben 且 `筑基草` 或 knows_truth → 水到渠成，额外 luck+3）
- 张铁分岔定死：黑市线相遇且 aff_zhang_tie≥3 → 他走商队起家（后续章可再现）；否则 → 家书报丧（`张铁的家书`，老死青牛镇，专属文案）
- 章末：筑基一~二（寿元各 +40，效果写入突破节点），授《青元剑诀》，魔气隐现伏笔；李师姐线：锦囊在身可开启她筑基成功的传书
- 字数 ≥20000

- [ ] **Step 1: 写失败测试**（ch3 走查至章末；三种筑基方式分支断言（含退境与丹毒）；张铁两分岔；回乡段 time/lifespan 断言；validate 绿；字数 ≥20000）
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 写内容**
- [ ] **Step 4: 全量测试绿**
- [ ] **Step 5: Commit**：`feat(quest): 第三章 筑基`

---

### Task 4: 第四章《结丹》

**Files:**
- Create: `js/content/ch4.js`（meta:{chapter:4,title:'结丹',checkpointNode:'ch4_start'}）
- Modify: `js/content/registry.js`（+CH4）、`index.html`（+ch4.js）、`js/content/items.js`（+`李师姐遗物`、`地火髓`、`前辈玉简`、`凝魂丹`）
- Test: `tests/ch4.test.mjs`

**Interfaces:**
- Consumes: ch3 出口（mortal_pill_used、enemy_inner、张铁存亡 flag）
- Produces: `FC.CH4`；karma `demon_war_battlefield`（死战线）、`saved_mortals`（护送线）

**剧情合同**：
- 开局筑基二；魔道入侵三路线：撤离（保命，宗门repository失散）/死战（`demon_war_battlefield`，injury+50 风险、因果高光：当年顶罪者舍命报恩——took_blame≥1 专属段落）/护送凡人（`saved_mortals`，耗时 time 180 天）
- 李师姐收束定死：aff_li_shijie≥4 → 她结丹失败兵解，遗言托付（得 `李师姐遗物`，luck+2）；否则 → 远走他方临别赠物（同一道具，文案不同）
- 流亡散修 hub：坊市/佣斗/寻机缘（循环攒灵石与人脉）
- 结丹机缘三选一：地火淬体（`地火髓`，injury+30 必经）/前辈洞府（`前辈玉简`+传承，需 knows_truth 或 luck≥15）/丹药凝魂（`凝魂丹`，灵石 -50）
- 结丹突破抉择（定死）：条件齐（机缘道具+伤势<30）→ 必成，寿元每层 +80；条件缺硬闯 → 失败分支：`丹毒`（寿元 -20、injury+50、karma pill_poison=1）或 `兵解`（death 效果，走死亡流程复活到 ch4_start）
- 章末：结丹一~二，灵气枯竭传闻初现（伏笔文本）
- 字数 ≥20000

- [ ] **Step 1: 写失败测试**（三路线走查；李师姐两分支；结丹成/丹毒/兵解三分支（兵解后检查点未被改写断言）；寿元 +80 断言；validate 绿；字数 ≥20000）
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 写内容**
- [ ] **Step 4: 全量测试绿**
- [ ] **Step 5: Commit**：`feat(quest): 第四章 结丹`

---

### Task 5: 第五章《元婴》

**Files:**
- Create: `js/content/ch5.js`（meta:{chapter:5,title:'元婴',checkpointNode:'ch5_start'}）
- Modify: `js/content/registry.js`（+CH5）、`index.html`（+ch5.js）、`js/content/items.js`（+`枯荣令`、`婴变古卷`）
- Test: `tests/ch5.test.mjs`

**Interfaces:**
- Consumes: ch4 出口（pill_poison、saved_mortals、demon_war_battlefield）
- Produces: `FC.CH5`；karma `kurong_grudge`（与枯荣老祖的恩怨计数）；flag `kurong_slain`

**剧情合同**：
- 开局结丹二；散修岁月 hub×3（坊市风云/佣斗夺宝/闭关静修）
- 枯荣老祖线（定死）：初遇夺宝结怨（kurong_grudge=1）→ 中段借势反制或忍让（grudge 累加，忍让=grudge 不变但失机缘）
- **闭关百年**高光段：time 36500 天一次快进；出关文本定死要素：坊市易主、故人皆亡、`张铁的家书`/李师姐遗物触发追忆变体
- 心魔劫（元婴瓶颈，定死）：三执念入口按因果解锁——执法堂旧案（knows_truth）、顶罪之悔（took_blame）、旁观之愧（silent_witness）；直面了结 → 心魔劫稳过；逃避 → 元婴突破带隐患 flag inner_demon=1（终章承接）
- 元婴突破：寿元每层 +150；强冲失败 = `兵解` 或 injury+80
- 最终对决（combat 节点，定死）：胜=境界≥元婴一层 且 （`婴变古卷` 或 kurong_grudge≥2 的借势线）；败=`兵解`。胜后 `kurong_slain=1`，得 `枯荣令`
- 章末：元婴一~二
- 字数 ≥25000

- [ ] **Step 1: 写失败测试**（百年闭关 day/lifespan 精确断言；心魔劫三执念入口与 inner_demon；对决胜败两分支（兵解不吞检查点）；validate 绿；字数 ≥25000）
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 写内容**
- [ ] **Step 4: 全量测试绿**
- [ ] **Step 5: Commit**：`feat(quest): 第五章 元婴`

---

### Task 6: 第六章《化神》

**Files:**
- Create: `js/content/ch6.js`（meta:{chapter:6,title:'化神',checkpointNode:'ch6_start'}）
- Modify: `js/content/registry.js`（+CH6）、`index.html`（+ch6.js）、`js/content/items.js`（+`界纹玉钥`、`星核髓`、`通天令`）
- Test: `tests/ch6.test.mjs`

**Interfaces:**
- Consumes: ch5 出口（kurong_slain/`枯荣令`、inner_demon、ch2_quanben 残页线）
- Produces: `FC.CH6`；flag `mortal_limit`（化神成时置 true——终章入口条件）；三钥状态 `key_jade`/`key_core`/`key_token`

**剧情合同**：
- 开局元婴二；灵气枯竭真相揭开（上古大战打碎界膜，文本定死基调：仙路尽头先是荒芜）
- 通天遗府：三钥收集（定死）——钥一 `界纹玉钥`（残页兑现：ch2_quanben 且炼气期"气起于踵"伏笔 → 遗府外门自开）；钥二 `星核髓`（遗府内历练夺宝）；钥三 `通天令`（`枯荣令` 炼化，或 inner_demon 线以心魔为引的暗路）
- 化神突破抉择（定死）：三钥齐 → 稳成；两钥+借枯荣遗泽 → 成但 injury+50；一钥以下燃寿硬闯 → 寿元 -200，成功概率无随机——带 `婴变古卷` 则成，否则 `兵解`
- 化神成：寿元 +300、`mortal_limit=true`、天地异象与大限钟声（定死段落）
- 字数 ≥25000

- [ ] **Step 1: 写失败测试**（三钥条件分支；突破三路径（稳/借泽/燃寿+兵解）；mortal_limit 置位；validate 绿；字数 ≥25000）
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 写内容**
- [ ] **Step 4: 全量测试绿**
- [ ] **Step 5: Commit**：`feat(quest): 第六章 化神`

---

### Task 7: 终章《大限》+ 三结局

**Files:**
- Create: `js/content/ch7.js`（meta:{chapter:7,title:'大限',checkpointNode:'ch7_start'}）
- Modify: `js/content/registry.js`（+CH7）、`index.html`（+ch7.js）、`js/content/items.js`（+`飞升台图录`、`界膜钉`）
- Modify: `js/ui.js`（deathText 寿终档扩展：读取 karma/flags 拼接生平段——顶罪者、被救者、张铁/李师姐存亡、inner_demon，每要素一句，无则不出现）
- Test: `tests/ch7.test.mjs`

**Interfaces:**
- Consumes: ch6 出口（mortal_limit、三钥状态、三结局条件）
- Produces: `FC.CH7`；三个 terminal 结局节点：`ending_ascend`（飞升离界）、`ending_legacy`（坐化传道）、老死走死亡流程（dead='lifespan' → deathText 寿终档）

**剧情合同**：
- 开局化神（寿元 ~1100+）；大限结构：人界无进阶，所有 time 快进=烧命；三线索 hub（飞升台集遗宝/界膜薄弱点硬撼/传承神念对话——对话节点揭"仙路尽头"主题）
- 飞升条件（定死）：集齐 `飞升台图录`+`界膜钉`+三钥道具 → `ending_ascend`；或 无图录硬撼界膜：需寿元≥300 且 injury=0，成功同结局，失败 injury+99 且寿元 -100（可再试或转其他结局）
- 坐化传道：任意时刻可择（`ending_legacy`），散尽功力文本定死要素：灵根少年的名字取自当年张铁的村子
- 老死：寿元归零 → deathText 寿终档生平段（测试断言：took_blame 与 saved_mortals 两种存档生成的结尾文不同）
- 结局节点均为 terminal；结局后 UI 走既有"标题"出口
- 字数 ≥15000

- [ ] **Step 1: 写失败测试**（倒计时烧命至老死结局；飞升两路径（集齐/硬撼成与败）；坐化结局；deathText 生平段两变体；validate 绿；字数 ≥15000）
- [ ] **Step 2: 确认失败**
- [ ] **Step 3: 写内容**
- [ ] **Step 4: 全量测试绿**
- [ ] **Step 5: Commit**：`feat(quest): 终章 大限 三结局`

---

### Task 8: 人界篇整体验收

**Files:**
- Test: `tests/acceptance-realm.test.mjs`（新建）
- Modify: `js/devpanel.js`（章节跳转支持 7 章——读取 FC.Content.chapters 或等价注册表，若 registry 已暴露则零改动，验收时确认即可）

**Interfaces:**
- Consumes: 全部章节；registry；FC.Test.validate
- Produces: 验收报告（含真实浏览器走查清单结果）

- [ ] **Step 1: 写验收测试**：
  - 全篇走查（最短通关路径）：ch1→ch7，断言终态 cultivation===19（化神）、day 合理（≤3000）、各检查点存活可复活
  - 旧存档兼容：以 cultivation=1 的手工 state 直接进入 ch2 入口节点可继续
  - registry 幂等终验：validate 全绿且节点无重复
  - `~` 面板境界跳转至 19 不越界
- [ ] **Step 2: 全量测试绿**
- [ ] **Step 3: 真实浏览器走查**（Chromium/CDP 或控制器浏览器工具）：标题→新开局→面板跳 ch2_start→抽验各章入口→终章三结局各触发一次→截图
- [ ] **Step 4: Commit**：`test: 人界篇整体验收`

---

## Self-Review 记录

1. **Spec 覆盖**：设计文档四（机制扩展 4.1-4.5）→ Task 1；五章结构（五）→ Task 2-7；验收（红线）→ Task 8。状态栏大境界标记在设计 4.1 提及——裁定不加：境界全名（如"结丹一层"）已含大境界信息，纯文字下无色彩可用（YAGNI）。
2. **步骤可执行**：每章任务的数值/因果/字数均为定死值；文案措辞留给实现者。
3. **类型一致性**：setCheckpointNode(字符串|数组)、FC.CHN={graph,meta}、checkpointNode 命名 chN_start 统一。
4. **Review Focus**：五项均已绑定到 owning task 的测试步骤。
5. **比例**：计划以合同值为主，未转录正文。
