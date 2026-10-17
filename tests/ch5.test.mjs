// 第五章《元婴》测试（Task 5）：
//   1. FC.CH5 就绪：meta 定死值正确（chapter 5 / 元婴 / ch5_start），节点 id 不与 ch1~ch4 冲突，章末 terminal
//   2. registry 合并：ch4_end（terminal）→ ch5_start 章际接线，FC.CH4 原件不改写，ch5_start 检查点注册，validate 全绿，幂等
//   3. 新道具登记（婴变古卷/枯荣令），图中引用物品全部在册
//   4. 散修岁月 hub×3（坊市风云/佣斗夺宝/闭关静修）；开局结丹二；佣斗夺宝首访 = 初遇结怨（婴变古卷、kurong_grudge=1），再访走佣斗 combat
//   5. 枯荣线中段：借势反制需人脉（ch5_renmai≥2），反制 → grudge=2；忍让 → grudge 不变、luck-2
//   6. 闭关百年高光段：time 36500 天一次快进（day/lifespan 精确断言）；出关文定死要素（坊市易主、故人皆亡）
//      与「张铁的家书」/李师姐遗物追忆变体（四态对照）
//   7. 心魔劫：三执念入口按因果解锁（knows_truth/took_blame/silent_witness）；直面了结置旗、全了方见直上；逃避 → inner_demon=1
//   8. 元婴突破：寿元每层 +150；古卷稳渡；无卷强冲首挫 injury+80、再冲必成；带隐患突破旗标不清（终章承接）
//   9. 带魔强冲 → 兵解：检查点仍是 ch5_start 存活进度（死亡不吞）、死亡写检查点被拒、豁免走余波回元婴抉择
//  10. 最终对决（combat）：胜=境界≥元婴一层 且（持婴变古卷 或 kurong_grudge≥2，二者居一即可，持卷忍让线 grudge=1 同样判胜）
//      → kurong_slain=1、得枯荣令；败 → 兵解（检查点不吞）；胜文两线（卷中婴变/四面合围）分支化；
//      败路持卷分支：持卷败文含帛书且古卷-1（旗 ch5_duel_scroll_taken），无卷败文不提帛书、无「失去」流水
//  11. 章末：terminal、定死承接（pill_poison/saved_mortals/demon_war_battlefield/枯荣令/心魔隐患/灵气伏笔/落款）
//  12. 渲染回归：关键句逐段在正文（悬空分号防线）
//  13. 字数 ≥25000
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/effects.js');
require('../js/save.js');
require('../js/engine.js');
require('../js/ui.js');
require('../js/devpanel.js');
require('../js/content/realm.js');
require('../js/content/items.js');
require('../js/content/ch1.js');
require('../js/content/ch2.js');
require('../js/content/ch3.js');
require('../js/content/ch4.js');
require('../js/content/ch5.js');
require('../js/content/registry.js');
const FC = globalThis.FC;

function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}
const G = () => FC.Content.graph; // 合并后全图（ch1 + ch2 + ch3 + ch4 + ch5）

// —— 走查脚手架（与 ch4.test.mjs 同式）——
function freshState(name) {
  cleanSave();
  return FC.Engine.start(name || '李恒', G());
}
function pick(s, label) {
  const v = FC.Engine.view(s, G());
  const i = v.choices.findIndex((c) => c.label === label);
  if (i < 0) throw new Error('找不到选项「' + label + '」，当前 ' + s.nodeId + ' 可见项: ' + v.choices.map((c) => c.label).join('/'));
  return i;
}
function step(s, label) {
  const r = FC.Engine.choose(s, G(), pick(s, label));
  if (r && r.dead) throw new Error('意外死亡于「' + label + '」：' + s.dead);
  if (!r || r.ok !== true) throw new Error('选择被拒：「' + label + '」 ' + JSON.stringify(r));
  return r;
}
function drain(s) {
  for (let i = 0; i < 40; i++) {
    const v = FC.Engine.view(s, G());
    if (v.choices.length === 1 && v.choices[0].label === '继续') step(s, '继续');
    else return;
  }
  throw new Error('drain 超限：疑似死循环于 ' + s.nodeId);
}
function drainTo(s, nodeId) {
  for (let i = 0; i < 60 && s.nodeId !== nodeId; i++) drain(s);
  if (s.nodeId !== nodeId) throw new Error('未能推进到 ' + nodeId + '，当前 ' + s.nodeId);
}

// —— 第一章走法（沿用 ch4.test.mjs 已验证路线）——
function ch1HubMonths(s, moves) {
  for (const label of moves) {
    step(s, label);
    drain(s);
    if (label.indexOf('偷偷修炼') >= 0) {
      step(s, '先花一文糊上油纸，只练半个时辰');
      drain(s);
    }
  }
  step(s, '灵田秋收（季末，随队下田）');
  drain(s);
}
function ch1TailSilent(s) {
  step(s, '垂下眼皮：“小人来的晚，什么也没瞧见。”');
  drain(s);
  step(s, '原样藏回床板，来日再参');
}
function ch1TailNight(s) {
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '捏紧张铁给的金刃符，贴着田垄摸近档房');
  drain(s);
  step(s, '原样藏回床板，来日再参');
}
function ch1Qianqi(s, hubMoves, tail) {
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '落云宗十年苦契，签！');
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  ch1HubMonths(s, hubMoves);
  tail(s);
}
function ch1Zhen(s, hubMoves, tail) {
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '先活下来：留镇当账房伙计');
  drain(s); drain(s); drain(s);
  ch1HubMonths(s, hubMoves);
  tail(s);
}

// —— 第二章走法（至 ch2_end）——
function ch2To(s, opts) {
  const o = Object.assign({ tieVisits: 0, liVisits: 0, rescue: false, extraDuty: 0, close: 'buy' }, opts);
  assert.equal(s.nodeId, '第一章终');
  step(s, '继续');
  drain(s);
  assert.equal(s.nodeId, 'ch2_备战');
  for (let i = 0; i < o.tieVisits; i++) { step(s, '访张铁（约着练手）'); drain(s); }
  for (let i = 0; i < o.liVisits; i++) { step(s, '走访百草堂（看李师姐）'); drain(s); }
  while (s.cultivation < 4) { step(s, '苦修《长春功》（进一层）'); drain(s); }
  while ((s.karma.ch2_prep || 0) < 3) {
    step(s, s.flags.ch2_intel ? '访张铁（约着练手）' : '打探大比规矩与对手');
    drain(s);
  }
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '缠住他，耗到破绽');
  assert.equal(s.nodeId, 'ch2_斗法胜', 'cultivation 4 应取胜');
  step(s, '继续');
  if (o.rescue) step(s, '翻进场中，把张铁拖出来');
  else step(s, '名次就要定了——垂手，别动');
  drainTo(s, 'ch2_记名岁月');
  while (s.cultivation < 6) { step(s, '后山苦修（全本行气）'); drain(s); }
  step(s, '冲击七层关隘'); drain(s);
  s.lingshi = Math.max(s.lingshi, 40);
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7);
  for (let i = 0; i < o.extraDuty; i++) { step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s); }
  step(s, '直面七层瓶颈（章末）');
  s.lingshi = Math.max(s.lingshi, 40);
  if (o.close === 'buy') { step(s, '购灵药固本丹（百草堂，十五灵石）'); drain(s); }
  else { step(s, '闭关苦熬，以年月磨这堵墙'); drain(s); }
  assert.ok(s.nodeId === 'ch2_end' || s.nodeId === 'ch3_机缘抉择', '章末收束应至 ch2_end（或经章际接线直达机缘抉择）: ' + s.nodeId);
}
function enterCh3(s) {
  if (s.nodeId === 'ch2_end') step(s, '继续');
  if (s.nodeId === 'ch3_start') drain(s);
  assert.equal(s.nodeId, 'ch3_机缘抉择');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch3 应有章首检查点');
  assert.equal(cp.nodeId, 'ch3_start');
}

// —— 第三章走法（定死走法，与 ch4.test.mjs 同式；mortal_pill_used=dan1、家书在手）——
function ch3Finish(s) {
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  assert.equal(s.nodeId, 'ch3_剿矿');
  s.luck = Math.max(s.luck, 30);
  step(s, '先探矿道，再合围');
  assert.equal(s.nodeId, 'ch3_剿矿胜');
  step(s, '继续');
  assert.equal(s.inventory['筑基丹'], 1, '剿矿胜应得筑基丹');
  step(s, '继续'); // 归山 → 伤退
  step(s, '继续'); // 伤退 → 归乡别过
  assert.equal(s.nodeId, 'ch3_归乡别过');
  step(s, '继续'); // 别过 → 回乡
  step(s, '继续'); // 回乡 → 坟前
  drain(s); // 坟前 → 筑基岁月
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  step(s, '直面筑基关（章末）'); drain(s);
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯成');
  assert.equal(s.flags.mortal_pill_used, 'dan1');
  drainTo(s, 'ch4_入侵抉择');
}
function enterCh4(s) {
  drainTo(s, 'ch4_入侵抉择');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch4 应有章首检查点');
  assert.equal(cp.nodeId, 'ch4_start');
  assert.equal(FC.State.isDead(cp), false);
}

// —— 第四章尾（定死默认走法：撤离线 → 师姐别（遗物入手）→ 凝魂丹 → 稳渡 → 乘势再进，开局结丹二）——
function ch4TailDefault(s) {
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）');
  assert.equal(s.nodeId, 'ch4_撤离');
  step(s, '继续'); // +30 → 旧账
  step(s, '继续'); // 旧账 → 师姐别（aff<4）
  step(s, '继续'); // 师姐别 → 流亡（遗物离开时入账）
  assert.equal(s.nodeId, 'ch4_流亡');
  assert.equal(s.inventory['李师姐遗物'], 1, '默认尾应带李师姐遗物（追忆变体之用）');
  while (s.cultivation < 12) { step(s, '苦修正途（流亡行气，进一层）'); drain(s); }
  s.lingshi = Math.max(s.lingshi, 80);
  step(s, '打探结丹机缘（酒肆与坊市的传闻）');
  step(s, '购凝魂丹（坊市丹铺，灵石 -50）'); step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  step(s, '直面结丹关（章末）');
  step(s, '水到渠成，稳渡结丹关（机缘已备，伤势轻）');
  step(s, '继续'); // 结丹成（+80）→ 丹成之后
  step(s, '乘势再进一层（结丹二层，再焚一道机缘）'); // +80 → 结丹二层
  step(s, '继续'); // → ch4_end（章际接线）→ ch5_start
  drainTo(s, 'ch5_散修岁月');
  assert.equal(s.cultivation, 14, '开局应为结丹二层');
  assert.equal(FC.REALMS[s.cultivation], '结丹二层');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch5 应有章首检查点（途经 ch5_start 时已写）');
  assert.equal(cp.nodeId, 'ch5_start');
  assert.equal(FC.State.isDead(cp), false);
}

// —— 第五章走法 ——
function ch5Climb(s) {
  while (s.cultivation < 15) { step(s, '闭关静修（行气淬炼，结丹层数精进）'); drain(s); }
  assert.equal(s.cultivation, 15);
  assert.equal(FC.REALMS[s.cultivation], '结丹三层');
}
function ch5DouBao(s) { // 佣斗夺宝首访：初遇结怨
  step(s, '佣斗夺宝（赏格与机缘，都在刀口上）');
  assert.equal(s.nodeId, 'ch5_初遇夺宝');
  step(s, '继续'); // 效果离开时入账
  assert.equal(s.inventory['婴变古卷'], 1, '初遇夺宝应得婴变古卷');
  assert.equal(s.karma.kurong_grudge, 1, '初遇夺宝应结怨 kurong_grudge=1');
  assert.equal(s.flags.ch5_kurong_met, true);
  assert.equal(s.nodeId, 'ch5_散修岁月');
}
function ch5Renmai(s, n) {
  for (let i = 0; i < n; i++) { step(s, '坊市风云（支摊问药，攒灵石与人脉）'); drain(s); }
  assert.equal(s.karma.ch5_renmai, n, '坊市风云应按次累计人脉');
}
function ch5Counter(s) { // 借势反制
  step(s, '打探枯荣老祖的底细（酒肆坊市的旧闻）');
  assert.equal(s.nodeId, 'ch5_借势抉择');
  step(s, '借势反制：联佣行旧谊与百草堂人脉，断他一条财路');
  assert.equal(s.nodeId, 'ch5_借势反制');
  step(s, '继续'); // 效果离开时入账
  assert.equal(s.karma.kurong_grudge, 2, '借势反制应 grudge 累加至 2');
  assert.equal(s.flags.ch5_kurong_reacted, true, '借势反应旗应落定（打探收口依赖）');
  assert.equal(s.nodeId, 'ch5_散修岁月');
}
function ch5Century(s) { // 闭关百年（精确断言在用例内做，这里只走位）
  step(s, '闭关百年（一键百年，出关物是人非）');
  assert.equal(s.nodeId, 'ch5_出关');
  step(s, '继续');
  assert.equal(s.flags.ch5_century_done, true);
  assert.equal(s.nodeId, 'ch5_散修岁月');
}
function ch5XinmoClean(s, faceCase) { // 直面元婴关 → 心魔劫 →（可选）了结执法堂旧案 → 直上
  step(s, '直面元婴关（章末）');
  assert.equal(s.nodeId, 'ch5_心魔劫');
  if (faceCase) {
    step(s, '执法堂旧案：入梦重回档房那一夜');
    assert.equal(s.nodeId, 'ch5_执念旧案');
    step(s, '继续');
    assert.equal(s.flags.ch5_xinmo_case, true, '直面旧案应置了结旗');
    assert.equal(s.nodeId, 'ch5_心魔劫');
  }
  step(s, '执念已了，直面元婴关（章末突破）');
  assert.equal(s.nodeId, 'ch5_元婴抉择');
}
function ch5Breakthrough(s) { // 古卷稳渡 → 元婴成 → 婴成之后
  const life0 = s.lifespanYears, cult0 = s.cultivation;
  step(s, '以《婴变古卷》为引，水到渠成闯元婴关');
  assert.equal(s.nodeId, 'ch5_元婴成');
  step(s, '继续'); // 效果离开时入账
  assert.equal(s.cultivation, cult0 + 1, '元婴成应进一层');
  assert.equal(FC.REALMS[s.cultivation], '元婴一层');
  assert.ok(Math.abs((s.lifespanYears - life0) - 150) < 1e-9, '元婴一层应寿元 +150（无时间流逝），实际差 ' + (s.lifespanYears - life0));
  assert.equal(s.nodeId, 'ch5_婴成之后');
}
function ch5DuelWin(s) {
  step(s, '出关迎敌（章末对决）');
  assert.equal(s.nodeId, 'ch5_最终对决');
  step(s, '正面迎战：婴变初啼，以战止战');
  assert.equal(s.nodeId, 'ch5_对决胜');
  step(s, '继续'); // 效果离开时入账 → 章末
  assert.equal(s.flags.kurong_slain, true, '胜后应置 kurong_slain');
  assert.equal(s.inventory['枯荣令'], 1, '胜后应得枯荣令');
  assert.equal(s.nodeId, 'ch5_end');
}

// ———— 结构与注册 ————

test('FC.CH5 就绪：meta 定死值正确，ch5_start/ch5_end 存在且章末 terminal，节点 id 不与 ch1~ch4 冲突', () => {
  assert.ok(FC.CH5 && FC.CH5.graph, 'FC.CH5 未挂载');
  assert.equal(FC.CH5.meta.chapter, 5);
  assert.equal(FC.CH5.meta.title, '元婴');
  assert.equal(FC.CH5.meta.checkpointNode, 'ch5_start');
  assert.ok(FC.CH5.graph.ch5_start, '缺入口 ch5_start');
  assert.ok(FC.CH5.graph.ch5_end, '缺章末 ch5_end');
  assert.equal(FC.CH5.graph.ch5_end.terminal, true, '章末应为 terminal 终局场景');
  const taken = new Set([...Object.keys(FC.CH1), ...Object.keys(FC.CH2.graph), ...Object.keys(FC.CH3.graph), ...Object.keys(FC.CH4.graph)]);
  for (const id of Object.keys(FC.CH5.graph)) {
    assert.ok(!taken.has(id), '节点 id 与前章冲突: ' + id);
  }
});

test('registry：CONTENT_SOURCES 预置 CH5；ch4_end → ch5_start 接线成立且不改写原件；ch5_start 检查点注册；幂等；validate 全绿', () => {
  assert.ok(FC.CONTENT_SOURCES.indexOf('CH5') >= 0, 'CONTENT_SOURCES 应预置 CH5');
  const g = G();
  for (const id of Object.keys(FC.CH5.graph)) assert.ok(g[id], 'ch5 节点丢失: ' + id);
  assert.equal(g['ch4_end'].goto, 'ch5_start', '合并图应把 ch4_end 接到 ch5_start');
  assert.equal(FC.CH4.graph['ch4_end'].goto, undefined, 'FC.CH4 原件不得被改写');
  assert.equal(FC.CH4.graph['ch4_end'].terminal, true, 'FC.CH4 原件保持章末终局标记');
  assert.ok(FC.Engine._checkpointNodes.has('ch5_start'), 'registry 应注册 ch5_start 检查点');
  const before = Object.keys(g).length;
  const cpBefore = FC.Engine._checkpointNodes.size;
  FC.ContentRegistry.register();
  FC.ContentRegistry.register();
  assert.equal(Object.keys(G()).length, before, '重复注册不得新增节点');
  assert.equal(FC.Engine._checkpointNodes.size, cpBefore, '重复注册不得新增检查点');
  const r = FC.Test.validate(G());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('新道具登记（婴变古卷/枯荣令），且 ch5 图中引用的所有物品都有登记', () => {
  for (const id of ['婴变古卷', '枯荣令']) {
    assert.ok(FC.ITEMS[id], '物品未登记: ' + id);
  }
  const items = new Set();
  const scan = (fx) => (fx || []).forEach((e) => { if (e.type === 'item') items.add(e.id); });
  for (const id of Object.keys(FC.CH5.graph)) {
    const n = FC.CH5.graph[id];
    scan(n.effects);
    for (const c of n.choices || []) scan(c.effects);
    for (const a of n.actions || []) scan(a.effects);
  }
  for (const id of items) assert.ok(FC.ITEMS[id], '图中引用未登记物品: ' + id);
  assert.ok(items.has('婴变古卷') && items.has('枯荣令'), '两件新道具都应被剧情效果引用');
});

// ———— 走查 A·主线：结怨 → 借势反制 → 闭关百年 → 心魔劫 → 稳渡 → 再进 → 对决胜 ————

test('走查 A：hub×3 齐备（开局结丹二）→ 初遇结怨（古卷+grudge1）→ 坊市攒人脉 → 借势反制（grudge2）→ 闭关百年（day+36500 寿元-100 精确）→ 心魔劫了结旧案 → 稳渡（元婴一 +150）→ 再进（元婴二 +150）→ 对决胜（kurong_slain+枯荣令）→ 章末', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  ch4TailDefault(s);
  // hub×3：坊市风云/佣斗夺宝/闭关静修 三行动可见
  let v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label === '坊市风云（支摊问药，攒灵石与人脉）'), 'hub 应有坊市风云');
  assert.ok(v.choices.some((c) => c.label === '佣斗夺宝（赏格与机缘，都在刀口上）'), 'hub 应有佣斗夺宝');
  assert.ok(v.choices.some((c) => c.label === '闭关静修（行气淬炼，结丹层数精进）'), 'hub 应有闭关静修');
  // 苦修至结丹三层（层数精进 +80 寿元/层）
  const life0 = s.lifespanYears, cult0 = s.cultivation;
  ch5Climb(s);
  assert.ok(Math.abs((s.lifespanYears - life0) - 80) < 1e-9, '结丹层数精进应 +80 寿元/层');
  assert.equal(s.cultivation, cult0 + 1);
  // 佣斗夺宝首访：初遇结怨
  ch5DouBao(s);
  // 佣斗再访：走佣斗 combat（守旗之名）
  step(s, '佣斗夺宝（赏格与机缘，都在刀口上）');
  assert.equal(s.nodeId, 'ch5_佣斗', '初遇后再访应走佣斗 combat');
  const inj0 = s.injury, ls0 = s.lingshi;
  step(s, '结阵硬撼，护定赏格车货'); // cultivation 15 → 必胜
  assert.equal(s.nodeId, 'ch5_佣斗胜');
  step(s, '继续');
  assert.equal(s.lingshi, ls0 + 40, '佣斗胜应得四十灵石');
  assert.equal(s.injury, Math.min(100, inj0 + 5), '佣斗胜应 injury+5');
  assert.equal(s.nodeId, 'ch5_散修岁月');
  // 借势反制：先攒人脉
  step(s, '打探枯荣老祖的底细（酒肆坊市的旧闻）');
  v = FC.Engine.view(s, G());
  const iFan = pick(s, '借势反制：联佣行旧谊与百草堂人脉，断他一条财路');
  assert.equal(v.choices[iFan].enabled, false, '人脉不足时反制应可见但禁用');
  step(s, '暂且按下，先回散修岁月');
  assert.equal(s.nodeId, 'ch5_散修岁月');
  ch5Renmai(s, 2);
  ch5Counter(s);
  // 闭关百年：精确断言
  const dayC = s.day, lifeC = s.lifespanYears;
  step(s, '闭关百年（一键百年，出关物是人非）');
  assert.equal(s.nodeId, 'ch5_出关');
  assert.equal(s.day, dayC + 36500, '闭关百年应一次快进 36500 天');
  assert.ok(Math.abs((lifeC - s.lifespanYears) - 100) < 1e-6, '百年应寿元 -100，实际差 ' + (lifeC - s.lifespanYears));
  const outText = FC.Engine.view(s, G()).text;
  assert.match(outText, /坊市易主/, '出关文应含定死要素：坊市易主');
  assert.match(outText, /故人皆亡/, '出关文应含定死要素：故人皆亡');
  assert.match(outText, /酒囊|张铁/, '家书在手应触发张铁追忆变体');
  assert.match(outText, /戥子|师姐/, '遗物在手应触发李师姐追忆变体');
  step(s, '继续');
  assert.equal(s.flags.ch5_century_done, true);
  assert.equal(s.nodeId, 'ch5_散修岁月');
  // 闭关百年仅一次
  v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label === '闭关百年（一键百年，出关物是人非）'), '闭关百年不得重复');
  // 心魔劫：knows_truth → 执法堂旧案入口 → 了结 → 直上
  ch5XinmoClean(s, true);
  assert.ok(!s.flags.inner_demon, '直面了结不得留下心魔隐患');
  // 突破：古卷稳渡 → 元婴一层 +150
  ch5Breakthrough(s);
  // 再进一层：元婴二层 +150
  const life1 = s.lifespanYears, cult1 = s.cultivation;
  step(s, '乘势再进一层（元婴二层，寿元再添）');
  assert.equal(s.nodeId, 'ch5_婴成之后');
  assert.equal(s.cultivation, cult1 + 1, '再进应至元婴二层');
  assert.equal(FC.REALMS[s.cultivation], '元婴二层');
  assert.ok(Math.abs((s.lifespanYears - life1) - 150) < 1e-9, '元婴二层应再 +150');
  // 对决胜
  ch5DuelWin(s);
  const endText = FC.Engine.view(s, G()).text;
  assert.match(endText, /第五章《元婴》终/);
  assert.match(endText, /枯荣令/, '章末应提及枯荣令');
});

// ———— 走查 B·逃避 → 带魔强冲 → 兵解（检查点不吞）———

test('走查 B：心魔劫逃避（inner_demon=1）→ 带魔强冲兵解真死；检查点仍是 ch5_start 存活进度未被改写；死亡写检查点被拒；豁免则余波续行回元婴抉择', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  ch4TailDefault(s);
  ch5Climb(s);
  ch5Century(s);
  step(s, '直面元婴关（章末）');
  assert.equal(s.nodeId, 'ch5_心魔劫');
  step(s, '闭门不出，把心魔锁在门外（逃避）');
  assert.equal(s.nodeId, 'ch5_心魔逃避');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch5_元婴抉择');
  assert.equal(s.flags.inner_demon, true, '逃避应落定 inner_demon=1');
  const cpBefore = FC.Save.load('checkpoint');
  assert.ok(cpBefore && cpBefore.nodeId === 'ch5_start');
  step(s, '带心魔孤注一掷（心魔反噬，或兵解）');
  assert.equal(s.nodeId, 'ch5_带魔强冲');
  const r = FC.Engine.choose(s, G(), pick(s, '继续'));
  assert.equal(r.ok, true);
  assert.equal(s.dead, '兵解', '带魔强冲无豁免应兵解');
  assert.match(FC.UI.deathText(s), /兵解/);
  assert.ok(FC.Save.load('auto'), '死亡状态照常落 auto');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '章首检查点应存在');
  assert.equal(cp.nodeId, 'ch5_start', '检查点应为 ch5_start（复活点）');
  assert.equal(cp.day, cpBefore.day, '检查点应为入章时刻进度');
  assert.equal(FC.State.isDead(cp), false, '检查点必须是存活进度（死亡不吞进度）');
  assert.notDeepEqual(cp, s, '检查点不得被死亡进度改写');
  const rr = FC.Save.save(s, 'checkpoint');
  assert.deepEqual(rr, { ok: false, reason: 'dead' }, '死亡状态写检查点应被 Save 层拒绝');
  // —— 豁免对照：重伤续行回元婴抉择 ——
  const s2 = freshState();
  s2.deathExempt = true;
  ch1Zhen(s2, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s2, { tieVisits: 0, rescue: false });
  enterCh3(s2);
  ch3Finish(s2);
  enterCh4(s2);
  ch4TailDefault(s2);
  ch5Climb(s2);
  ch5Century(s2);
  step(s2, '直面元婴关（章末）');
  step(s2, '闭门不出，把心魔锁在门外（逃避）');
  step(s2, '继续');
  assert.equal(s2.flags.inner_demon, true);
  step(s2, '带心魔孤注一掷（心魔反噬，或兵解）');
  step(s2, '继续');
  assert.equal(s2.dead, null, '豁免下带魔强冲应重伤续行');
  assert.equal(s2.injury, 100);
  assert.equal(s2.flags.cheated_death_兵解, true);
  assert.equal(s2.nodeId, 'ch5_兵解余波');
  drain(s2);
  assert.equal(s2.nodeId, 'ch5_元婴抉择', '强冲余波应回元婴抉择可再图');
});

// ———— 走查 C·无卷强冲（injury+80 挫 → 再冲必成）→ 延伸至对决败（兵解）———

test('走查 C：无古卷强冲首挫（injury+80、挫旗落定）→ 静养后再冲必成（元婴一 +150）→ 延伸：对决败（无古卷 grudge<2）→ 兵解、检查点不吞', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  ch4TailDefault(s);
  ch5Climb(s);
  ch5Century(s);
  ch5XinmoClean(s, true); // knows_truth：了结旧案
  assert.equal(s.inventory['婴变古卷'] || 0, 0, '本走查未做佣斗，应无古卷');
  const v0 = FC.Engine.view(s, G());
  assert.ok(!v0.choices.some((c) => c.label === '以《婴变古卷》为引，水到渠成闯元婴关'), '无古卷不得见稳渡');
  assert.ok(v0.choices.some((c) => c.label === '无卷强冲，以伤换关（火候未到则重伤）'), '无古卷应见强冲');
  const inj0 = s.injury;
  step(s, '无卷强冲，以伤换关（火候未到则重伤）');
  assert.equal(s.nodeId, 'ch5_强冲挫', '首冲应挫（火候未到）');
  step(s, '继续');
  assert.equal(s.injury, Math.min(100, inj0 + 80), '强冲挫应 injury+80');
  assert.equal(s.flags.ch5_qiangchong_tried, true, '挫应落定重冲旗');
  assert.equal(s.nodeId, 'ch5_散修岁月', '挫应回 hub 可养伤再战');
  // 静养 → 再直面 → 再冲必成
  step(s, '闭关静修（养伤将息，伤势大退）'); drain(s);
  assert.ok(s.injury < 50, '静养后伤势应 <50（当前 ' + s.injury + '）');
  step(s, '直面元婴关（章末）');
  assert.equal(s.nodeId, 'ch5_心魔劫');
  step(s, '执念已了，直面元婴关（章末突破）'); // 旧案已了结，直上直接可见
  assert.equal(s.nodeId, 'ch5_元婴抉择');
  const life0 = s.lifespanYears, cult0 = s.cultivation;
  step(s, '无卷强冲，以伤换关（火候未到则重伤）');
  assert.equal(s.nodeId, 'ch5_元婴成', '再冲应必成（挫旗在）');
  step(s, '继续');
  assert.equal(s.cultivation, cult0 + 1, '再冲成应进一层');
  assert.equal(FC.REALMS[s.cultivation], '元婴一层');
  assert.ok(Math.abs((s.lifespanYears - life0) - 150) < 1e-9, '元婴一层应寿元 +150');
  // 延伸：无古卷、grudge<2 → 对决败 → 兵解
  step(s, '出关迎敌（章末对决）');
  assert.equal(s.nodeId, 'ch5_最终对决');
  step(s, '正面迎战：婴变初啼，以战止战');
  assert.equal(s.nodeId, 'ch5_对决败', '无古卷 grudge<2 应败');
  const cpBefore = FC.Save.load('checkpoint');
  const r = FC.Engine.choose(s, G(), pick(s, '继续'));
  assert.equal(r.ok, true);
  assert.equal(s.dead, '兵解', '对决败无豁免应兵解');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp && cp.nodeId === 'ch5_start', '对决败不得吞检查点（仍为 ch5_start）');
  assert.equal(FC.State.isDead(cp), false);
  assert.equal(cp.day, cpBefore.day, '检查点进度不得被改写');
});

// ———— 心魔劫：三执念入口按因果解锁（裸态探针）———

test('心魔劫入口：knows_truth/took_blame/silent_witness 各自解锁对应执念入口；无因果只见逃避与直上；未了结前直上隐藏，了结后可见', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.nodeId = 'ch5_心魔劫'; fn(s); return s; };
  const labelsOf = (s) => FC.Engine.view(s, G()).choices.map((c) => c.label);
  const sK = mk((s) => { s.karma.knows_truth = 1; });
  const sT = mk((s) => { s.karma.took_blame = 1; });
  const sS = mk((s) => { s.karma.silent_witness = 1; });
  const sN = mk((s) => {});
  assert.ok(labelsOf(sK).some((l) => l.indexOf('执法堂旧案') >= 0), 'knows_truth 应解锁执法堂旧案入口');
  assert.ok(labelsOf(sT).some((l) => l.indexOf('顶罪之悔') >= 0), 'took_blame 应解锁顶罪之悔入口');
  assert.ok(labelsOf(sS).some((l) => l.indexOf('旁观之愧') >= 0), 'silent_witness 应解锁旁观之愧入口');
  const ln = labelsOf(sN);
  assert.ok(!ln.some((l) => l.indexOf('执法堂旧案') >= 0 || l.indexOf('顶罪之悔') >= 0 || l.indexOf('旁观之愧') >= 0), '无因果不得见执念入口');
  assert.ok(ln.some((l) => l.indexOf('逃避') >= 0) && ln.some((l) => l.indexOf('执念已了') >= 0), '无因果应有逃避与直上两路');
  // 未了结前直上隐藏；了结后可见
  assert.ok(!labelsOf(sK).some((l) => l.indexOf('执念已了') >= 0), '有未了执念时直上应隐藏');
  sK.flags.ch5_xinmo_case = true;
  assert.ok(labelsOf(sK).some((l) => l.indexOf('执念已了') >= 0), '了结后直上应可见');
  // 三执念并开：了结其二仍隐藏，逃避仍可选
  const sAll = mk((s) => { s.karma.knows_truth = 1; s.karma.took_blame = 1; s.karma.silent_witness = 1; });
  assert.ok(!labelsOf(sAll).some((l) => l.indexOf('执念已了') >= 0), '三执念未了直上应隐藏');
  sAll.flags.ch5_xinmo_case = true; sAll.flags.ch5_xinmo_blame = true;
  assert.ok(!labelsOf(sAll).some((l) => l.indexOf('执念已了') >= 0), '尚余一执念未了直上仍应隐藏');
  sAll.flags.ch5_xinmo_silent = true;
  assert.ok(labelsOf(sAll).some((l) => l.indexOf('执念已了') >= 0), '三执念全了直上应可见');
  // 三执念正文互异且各自渲染非空
  const t1 = FC.CH5.graph['ch5_执念旧案'].text(FC.State.create('李恒'));
  const t2 = FC.CH5.graph['ch5_执念顶罪'].text(FC.State.create('李恒'));
  const t3 = FC.CH5.graph['ch5_执念旁观'].text(FC.State.create('李恒'));
  assert.ok(t1.length > 400 && t2.length > 400 && t3.length > 400, '三段执念正文都应有实文');
  assert.notEqual(t1, t2);
  assert.notEqual(t2, t3);
  assert.match(t1, /执法堂|档房/);
  assert.match(t2, /孙毅|顶罪/);
  assert.match(t3, /旁|默|装|静/);
});

// ———— 逃避 → 古卷带隐患突破（旗标不清，终章承接）———

test('带隐患突破：逃避落定 inner_demon 后，古卷在怀仍可突破（元婴成），但 inner_demon 旗标不清（终章承接）', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  ch4TailDefault(s);
  ch5Climb(s);
  ch5DouBao(s); // 古卷在手
  ch5Century(s);
  step(s, '直面元婴关（章末）');
  step(s, '闭门不出，把心魔锁在门外（逃避）');
  step(s, '继续');
  assert.equal(s.flags.inner_demon, true);
  // 古卷在怀：稳渡可见（带隐患）
  const v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label === '以《婴变古卷》为引，水到渠成闯元婴关'), '逃避后古卷仍可突破');
  const life0 = s.lifespanYears;
  step(s, '以《婴变古卷》为引，水到渠成闯元婴关');
  assert.equal(s.nodeId, 'ch5_元婴成');
  step(s, '继续');
  assert.equal(FC.REALMS[s.cultivation], '元婴一层');
  assert.ok(Math.abs((s.lifespanYears - life0) - 150) < 1e-9);
  assert.equal(s.flags.inner_demon, true, '带隐患突破后 inner_demon 不得清除（终章承接）');
  const bornText = FC.Engine.view(s, G()).text;
  assert.match(bornText, /心魔|隐患/, '带隐患突破正文应有心魔隐患段');
});

// ———— 忍让对照：grudge 不变、失机缘（luck-2）———

test('忍让避锋：grudge 不变、luck -2（失机缘）、旗标落定，与反制线互异', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  ch4TailDefault(s);
  ch5Climb(s);
  ch5DouBao(s); // grudge=1
  ch5Renmai(s, 2); // 人脉足，但选择忍让
  step(s, '打探枯荣老祖的底细（酒肆坊市的旧闻）');
  assert.equal(s.nodeId, 'ch5_借势抉择');
  const luck0 = s.luck, grudge0 = s.karma.kurong_grudge;
  step(s, '忍让避锋：惹不起，暂避风头');
  assert.equal(s.nodeId, 'ch5_忍让');
  step(s, '继续');
  assert.equal(s.karma.kurong_grudge, grudge0, '忍让 grudge 不得累加');
  assert.equal(s.luck, luck0 - 2, '忍让应失机缘（luck-2）');
  assert.equal(s.flags.ch5_kurong_reacted, true, '忍让反应旗应落定（打探收口依赖）');
  assert.equal(s.nodeId, 'ch5_散修岁月');
  // 打探行动应收口（已反应过）
  const v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label === '打探枯荣老祖的底细（酒肆坊市的旧闻）'), '借势抉择只此一回');
  // 两线正文互异
  const sC = FC.State.create('李恒');
  sC.karma.ch5_renmai = 2;
  const tC = FC.CH5.graph['ch5_借势反制'].text(sC);
  const tY = FC.CH5.graph['ch5_忍让'].text(sC);
  assert.ok(tC.length > 400 && tY.length > 400);
  assert.notEqual(tC, tY);
});

// ———— 出关文四态对照（追忆变体）———

test('出关文变体：家书触发张铁追忆、遗物触发师姐追忆、双全齐发、皆无走泛写；四态均含坊市易主与故人皆亡', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); fn(s); return s; };
  const tBook = FC.CH5.graph['ch5_出关'].text(mk((s) => { s.inventory['张铁的家书'] = 1; }));
  const tItem = FC.CH5.graph['ch5_出关'].text(mk((s) => { s.inventory['李师姐遗物'] = 1; }));
  const tBoth = FC.CH5.graph['ch5_出关'].text(mk((s) => { s.inventory['张铁的家书'] = 1; s.inventory['李师姐遗物'] = 1; }));
  const tNone = FC.CH5.graph['ch5_出关'].text(mk(() => {}));
  for (const [nm, t] of [['家书态', tBook], ['遗物态', tItem], ['双全态', tBoth], ['皆无态', tNone]]) {
    assert.match(t, /坊市易主/, nm + '应含坊市易主');
    assert.match(t, /故人皆亡/, nm + '应含故人皆亡');
  }
  assert.match(tBook, /张铁/, '家书态应有张铁');
  assert.match(tBook, /酒囊/, '家书态应有酒囊');
  assert.match(tItem, /师姐/, '遗物态应有师姐');
  assert.match(tItem, /戥子/, '遗物态应有戥子');
  assert.match(tBoth, /酒囊/);
  assert.match(tBoth, /戥子/);
  assert.doesNotMatch(tNone, /酒囊/, '皆无态不得出现酒囊追忆');
  assert.doesNotMatch(tNone, /戥子/, '皆无态不得出现戥子追忆');
  assert.notEqual(tBook, tNone);
  assert.notEqual(tItem, tNone);
  assert.notEqual(tBoth, tBook);
});

// ———— 最终对决：胜文两线与借势线胜（裸态引擎探针）———

test('对决胜文两线：古卷线含「卷中婴变」、借势线含「四面合围」，互斥分支；借势线（grudge≥2 无古卷）引擎亦判胜并落 kurong_slain+枯荣令', () => {
  // 借势线：引擎级判胜
  cleanSave();
  const s = FC.State.create('李恒');
  s.cultivation = 16; s.karma.kurong_grudge = 2; s.inventory['婴变古卷'] = 0; s.injury = 0;
  s.nodeId = 'ch5_最终对决';
  step(s, '虚与委蛇，诱他入局再合围');
  assert.equal(s.nodeId, 'ch5_对决胜', '境界≥元婴一且 grudge≥2 应判胜');
  const tGrudge = FC.Engine.view(s, G()).text;
  assert.match(tGrudge, /四面合围/, '借势线胜文应含围杀段');
  assert.doesNotMatch(tGrudge, /卷中婴变/, '无古卷不得出现古卷线措辞');
  step(s, '继续'); // 效果离开时入账 → 章末
  assert.equal(s.flags.kurong_slain, true, '胜后应置 kurong_slain');
  assert.equal(s.inventory['枯荣令'], 1, '胜后应得枯荣令');
  // 古卷线：裸态正文对照
  const sScroll = FC.State.create('李恒');
  sScroll.cultivation = 16; sScroll.inventory['婴变古卷'] = 1; sScroll.karma.kurong_grudge = 1;
  const tScroll = FC.CH5.graph['ch5_对决胜'].text(sScroll);
  assert.match(tScroll, /卷中婴变/, '古卷线胜文应含古卷段');
  assert.doesNotMatch(tScroll, /四面合围/, '无借势不得出现围杀段措辞');
  // 败文裸态渲染非空
  const tFail = FC.CH5.graph['ch5_对决败'].text(FC.State.create('李恒'));
  assert.ok(tFail.length > 300, '败文应有实文');
});

// ———— 对决败·豁免：余波走对决分支（老祖在世线）———

test('对决败·豁免：无卷败局（grudge<2 且无古卷）重伤续行走余波老祖在世线，章末不落 kurong_slain、古卷不曾被夺', () => {
  cleanSave();
  const s = FC.State.create('李恒');
  s.deathExempt = true;
  s.cultivation = 16; s.inventory['婴变古卷'] = 0; s.karma.kurong_grudge = 1; s.injury = 0;
  s.nodeId = 'ch5_最终对决';
  step(s, '正面迎战：婴变初啼，以战止战');
  assert.equal(s.nodeId, 'ch5_对决败', '无卷且 grudge<2 应判败（合同：胜需持卷或 grudge≥2）');
  const vFail = FC.Engine.view(s, G());
  assert.ok(!vFail.text.includes('帛书'), '无卷败文不得提及帛书');
  assert.equal(vFail.choices.length, 1, '败局无卷应只有一条继续路（不产生夺卷分支）');
  step(s, '继续'); // 效果离开时结算：旗、死亡→豁免重伤（无夺卷效果）
  assert.equal(s.dead, null, '豁免下对决败应重伤续行');
  assert.equal(s.injury, 100);
  assert.equal(s.flags.cheated_death_兵解, true);
  assert.equal(s.flags.ch5_duel_lost, true, '对决败应落定败局旗');
  assert.ok(!s.flags.ch5_duel_scroll_taken, '无卷败局不得落夺卷旗');
  assert.equal(s.inventory['婴变古卷'] || 0, 0, '无卷败局古卷仍为 0');
  assert.equal(s.nodeId, 'ch5_兵解余波');
  assert.ok(!FC.Engine.view(s, G()).text.includes('帛书'), '无卷败局余波不得提及帛书');
  drain(s);
  assert.equal(s.nodeId, 'ch5_end', '对决败余波应入章末');
  assert.ok(!s.flags.kurong_slain, '败局不得置 kurong_slain');
  const endText = FC.Engine.view(s, G()).text;
  assert.match(endText, /老祖|枯荣/, '老祖在世线章末应提及枯荣老祖');
  assert.match(endText, /第五章《元婴》终/);
});

// ———— 对决胜规则（合同）：境界 ≥ 元婴一层 且（持古卷 或 grudge≥2）————

test('对决胜规则（合同 OR）：持卷+境界达标但 grudge=1（忍让线）必须判胜；境界未达标即便 grudge≥2 也判败', () => {
  // 持卷 + grudge=1：引擎判胜（忍让线不得被兵解吞掉）
  cleanSave();
  const s = FC.State.create('李恒');
  s.cultivation = 16; s.inventory['婴变古卷'] = 1; s.karma.kurong_grudge = 1; s.injury = 0;
  s.nodeId = 'ch5_最终对决';
  step(s, '正面迎战：婴变初啼，以战止战');
  assert.equal(s.nodeId, 'ch5_对决胜', '持卷+元婴一层应判胜（OR 规则，grudge=1 不拦）');
  const tWin = FC.Engine.view(s, G()).text;
  assert.match(tWin, /卷中婴变/, '持卷胜文应含古卷线');
  assert.doesNotMatch(tWin, /四面合围/, 'grudge<2 不得出现围杀段措辞');
  step(s, '继续');
  assert.equal(s.flags.kurong_slain, true, '持卷胜应置 kurong_slain');
  assert.equal(s.inventory['枯荣令'], 1, '持卷胜应得枯荣令');
  // 境界门槛：grudge≥2 但境界未到元婴一层 → 判败
  cleanSave();
  const s2 = FC.State.create('李恒');
  s2.cultivation = 15; s2.inventory['婴变古卷'] = 0; s2.karma.kurong_grudge = 2; s2.injury = 0;
  s2.nodeId = 'ch5_最终对决';
  step(s2, '正面迎战：婴变初啼，以战止战');
  assert.equal(s2.nodeId, 'ch5_对决败', '境界<元婴一层应判败（境界门槛不因 grudge 松动）');
});

// ———— 对决败·持卷分支：夺卷文案与效果只在持卷时生效 ————

test('对决败·持卷分支：持卷败文含帛书、古卷-1、余波含老祖携卷而去；无卷败文不提帛书、无「失去婴变古卷」流水', () => {
  // 持卷败（豁免）：境界未达元婴一层 → 败局，持卷仍被夺
  cleanSave();
  const s = FC.State.create('李恒');
  s.deathExempt = true;
  s.cultivation = 15; s.inventory['婴变古卷'] = 1; s.karma.kurong_grudge = 1; s.injury = 0;
  s.nodeId = 'ch5_最终对决';
  step(s, '正面迎战：婴变初啼，以战止战');
  assert.equal(s.nodeId, 'ch5_对决败');
  assert.ok(FC.Engine.view(s, G()).text.includes('帛书'), '持卷败文应有夺卷段（帛书）');
  step(s, '继续');
  assert.equal(s.dead, null, '豁免下持卷败应重伤续行');
  assert.equal(s.inventory['婴变古卷'] || 0, 0, '持卷败局古卷应被夺（-1）');
  assert.equal(s.flags.ch5_duel_scroll_taken, true, '夺卷应落定夺卷旗');
  const tWave = FC.Engine.view(s, G()).text;
  assert.match(tWave, /帛书/, '持卷败局余波应含老祖携卷而去');
  drain(s);
  assert.equal(s.nodeId, 'ch5_end');
  // 无卷败（引擎）：无夺卷效果、无「失去」流水
  cleanSave();
  const s2 = FC.State.create('李恒');
  s2.deathExempt = true;
  s2.cultivation = 16; s2.inventory['婴变古卷'] = 0; s2.karma.kurong_grudge = 1; s2.injury = 0;
  s2.nodeId = 'ch5_最终对决';
  step(s2, '正面迎战：婴变初啼，以战止战');
  const r = FC.Engine.choose(s2, G(), pick(s2, '继续'));
  assert.equal(r.ok, true);
  assert.ok(r.log.every((l) => l.indexOf('婴变古卷') < 0), '无卷败局不得产生「失去 婴变古卷」流水: ' + r.log.join('；'));
  assert.ok(!s2.flags.ch5_duel_scroll_taken, '无卷败局不得落夺卷旗');
});

// ———— 无卷强冲对带心魔者同样可见（controller ruling）————

test('无卷强冲对带心魔者同样可见：inner_demon+无卷+伤<50 应见强冲选项（与带魔孤注一掷并存）；持卷者仍不见强冲', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.nodeId = 'ch5_元婴抉择'; fn(s); return s; };
  const labels = (s) => FC.Engine.view(s, G()).choices.map((c) => c.label);
  const hasQ = (s) => labels(s).some((l) => l === '无卷强冲，以伤换关（火候未到则重伤）');
  const sD = mk((s) => { s.flags.inner_demon = true; s.injury = 20; });
  assert.ok(hasQ(sD), 'inner_demon+无卷 应见无卷强冲（不再只剩带魔/兵解一条路）');
  assert.ok(labels(sD).some((l) => l.indexOf('带心魔') >= 0), '带魔选项仍在');
  const sH = mk((s) => { s.flags.inner_demon = true; s.injury = 20; s.inventory['婴变古卷'] = 1; });
  assert.ok(!hasQ(sH), '持卷者不得见无卷强冲');
  assert.ok(labels(sH).some((l) => l.indexOf('婴变古卷') >= 0), '持卷稳渡仍在');
  const sClean = mk((s) => { s.injury = 20; });
  assert.ok(hasQ(sClean), '无隐患无卷仍应见强冲（原路径不回退）');
});

// ———— 章末承接 ————

test('章末承接：pill_poison/saved_mortals/demon_war_battlefield/心魔隐患/灵气伏笔/落款各自在文；元婴二层显示正确', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); fn(s); return s; };
  const tBase = FC.CH5.graph['ch5_end'].text(mk((s) => { s.cultivation = 16; }));
  assert.match(tBase, /第五章《元婴》终/);
  assert.match(tBase, /灵气/, '章末应续埋灵气枯竭伏笔');
  assert.match(tBase, /元婴一层|结丹/, '章末境界表述应随境界');
  const tTwo = FC.CH5.graph['ch5_end'].text(mk((s) => { s.cultivation = 17; s.flags.kurong_slain = true; }));
  assert.match(tTwo, /元婴二层/);
  assert.match(tTwo, /枯荣令/, '胜后章末应提及枯荣令');
  const tPoison = FC.CH5.graph['ch5_end'].text(mk((s) => { s.cultivation = 16; s.karma.pill_poison = 1; }));
  assert.match(tPoison, /丹毒/, '丹毒因果应在章末承接');
  const tMort = FC.CH5.graph['ch5_end'].text(mk((s) => { s.cultivation = 16; s.karma.saved_mortals = 1; }));
  assert.match(tMort, /三百一十七|江南/, '护送线因果应在章末承接');
  const tWar = FC.CH5.graph['ch5_end'].text(mk((s) => { s.cultivation = 16; s.karma.demon_war_battlefield = 1; }));
  assert.match(tWar, /旗/, '死战线因果应在章末承接');
  const tDemon = FC.CH5.graph['ch5_end'].text(mk((s) => { s.cultivation = 16; s.flags.inner_demon = true; }));
  assert.match(tDemon, /心魔/, '心魔隐患应在章末埋终章伏笔');
  assert.notEqual(tBase, tPoison);
});

// ———— 开局承接（ch4 出口消费）———

test('开局承接：ch5_start 消费 ch4 出口（pill_poison/saved_mortals/demon_war_battlefield/李师姐遗物）分支渲染互异', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); fn(s); return s; };
  const tBase = FC.CH5.graph['ch5_start'].text(mk(() => {}));
  const tPoison = FC.CH5.graph['ch5_start'].text(mk((s) => { s.karma.pill_poison = 1; }));
  const tMort = FC.CH5.graph['ch5_start'].text(mk((s) => { s.karma.saved_mortals = 1; }));
  const tWar = FC.CH5.graph['ch5_start'].text(mk((s) => { s.karma.demon_war_battlefield = 1; }));
  const tItem = FC.CH5.graph['ch5_start'].text(mk((s) => { s.inventory['李师姐遗物'] = 1; }));
  assert.ok(tBase.length > 600, '开局正文应有实文');
  assert.notEqual(tBase, tPoison, '丹毒因果应改变开局正文');
  assert.match(tPoison, /丹毒/);
  assert.notEqual(tBase, tMort, '护送因果应改变开局正文');
  assert.match(tMort, /三百一十七|江南/);
  assert.notEqual(tBase, tWar, '死战因果应改变开局正文');
  assert.match(tWar, /旗/);
  assert.notEqual(tBase, tItem, '李师姐遗物应改变开局正文');
  assert.match(tItem, /戥子|师姐/);
});

// ———— 渲染回归（悬空分号防线：关键句逐段在正文）———

test('渲染回归：各节点关键句逐段在正文（字符串拼接链完整、无悬空分号截断）', () => {
  const s0 = FC.State.create('李恒');
  assert.match(FC.CH5.graph['ch5_start'].text(s0), /西陲的坊市不问来历/, 'ch5_start 关键句');
  const sHub = FC.State.create('李恒');
  sHub.cultivation = 15; sHub.flags.ch5_century_done = true;
  assert.match(FC.CH5.graph['ch5_散修岁月'].text(sHub), /元婴关不是闯过去/, 'hub 关前关键句');
  assert.match(FC.CH5.graph['ch5_初遇夺宝'].text(s0), /枯荣老祖/, '初遇关键句');
  assert.match(FC.CH5.graph['ch5_出关'].text(s0), /一别百年/, '出关关键句');
  assert.match(FC.CH5.graph['ch5_元婴成'].text(s0), /丹碎/, '元婴成关键句');
  const sWin = FC.State.create('李恒');
  sWin.cultivation = 16; sWin.inventory['婴变古卷'] = 1;
  assert.match(FC.CH5.graph['ch5_对决胜'].text(sWin), /枯荣令/, '对决胜关键句');
  assert.match(FC.CH5.graph['ch5_end'].text(s0), /第五章《元婴》终/, '章末落款');
});

// ———— 字数 ————

test('字数统计：第五章正文（各节点 text 并集）+ 选项文案合计 ≥25000 字', () => {
  const probes = [];
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    fn(s);
    return s;
  };
  probes.push(FC.State.create('李恒'));
  probes.push(crafted((s) => { // 开局·全因果态
    s.cultivation = 14; s.karma.pill_poison = 1; s.karma.saved_mortals = 1; s.karma.demon_war_battlefield = 1;
    s.inventory['李师姐遗物'] = 1; s.inventory['张铁的家书'] = 1; s.lingshi = 60;
  }));
  probes.push(crafted((s) => { // hub 关前态
    s.cultivation = 14; s.injury = 10; s.lingshi = 30; s.karma.ch5_renmai = 2;
  }));
  probes.push(crafted((s) => { // hub 关前百年态
    s.cultivation = 15; s.flags.ch5_century_done = true; s.karma.kurong_grudge = 2;
  }));
  probes.push(crafted((s) => { // 初遇/佣斗态
    s.cultivation = 15; s.flags.ch5_kurong_met = true; s.inventory['婴变古卷'] = 1; s.karma.kurong_grudge = 1;
  }));
  probes.push(crafted((s) => { // 借势两线
    s.cultivation = 15; s.karma.ch5_renmai = 3; s.karma.kurong_grudge = 1;
  }));
  probes.push(crafted((s) => { // 出关·家书态
    s.cultivation = 15; s.inventory['张铁的家书'] = 1; s.day = 4000;
  }));
  probes.push(crafted((s) => { // 出关·遗物态
    s.cultivation = 15; s.inventory['李师姐遗物'] = 1; s.day = 4000;
  }));
  probes.push(crafted((s) => { // 心魔劫·三执念态
    s.cultivation = 15; s.karma.knows_truth = 1; s.karma.took_blame = 1; s.karma.silent_witness = 1;
  }));
  probes.push(crafted((s) => { // 元婴抉择·古卷态
    s.cultivation = 15; s.inventory['婴变古卷'] = 1; s.injury = 10;
  }));
  probes.push(crafted((s) => { // 元婴成·带隐患态
    s.cultivation = 15; s.inventory['婴变古卷'] = 1; s.flags.inner_demon = true;
  }));
  probes.push(crafted((s) => { // 婴成之后·二层态
    s.cultivation = 17; s.injury = 5; s.luck = 30; s.flags.kurong_slain = true;
  }));
  probes.push(crafted((s) => { // 对决·古卷胜态
    s.cultivation = 16; s.inventory['婴变古卷'] = 1; s.inventory['枯荣令'] = 1; s.flags.kurong_slain = true;
  }));
  probes.push(crafted((s) => { // 对决·借势胜态
    s.cultivation = 16; s.karma.kurong_grudge = 2; s.flags.ch5_duel_ambush = true;
  }));
  probes.push(crafted((s) => { // 兵解余波·对决败态
    s.cultivation = 16; s.injury = 100; s.flags.ch5_duel_lost = true; s.flags.cheated_death_兵解 = true;
  }));
  probes.push(crafted((s) => { // 章末·全承接态
    s.cultivation = 17; s.flags.kurong_slain = true; s.karma.pill_poison = 1; s.karma.saved_mortals = 1;
    s.karma.demon_war_battlefield = 1; s.inventory['枯荣令'] = 1; s.inventory['李师姐遗物'] = 1; s.day = 40000;
  }));
  const graph = FC.CH5.graph; // 只统计第五章正文
  let total = 0;
  for (const id of Object.keys(graph)) {
    const n = graph[id];
    let best = 0;
    const texts = [];
    if (typeof n.text === 'function') {
      for (const st of probes) {
        try { texts.push(String(n.text(st) || '')); } catch (e) { /* 探测状态不完整，忽略 */ }
      }
    } else texts.push(String(n.text || ''));
    for (const t of texts) best = Math.max(best, t.length);
    total += best;
  }
  let labels = 0;
  for (const id of Object.keys(graph)) {
    const n = graph[id];
    for (const c of n.choices || []) labels += String(c.label || '').length;
    for (const a of n.actions || []) labels += String(a.label || '').length;
  }
  const sum = total + labels;
  assert.ok(sum >= 25000, '第五章字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 42000, '第五章字数失控: ' + sum);
});
