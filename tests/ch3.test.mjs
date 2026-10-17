// 第三章《筑基》测试（Task 3）：
//   1. FC.CH3 就绪：meta 定死值正确，节点 id 不与 ch1/ch2 冲突
//   2. registry 合并：ch2_end（terminal）→ ch3_start 章际接线，FC.CH2 原件不改写，ch3_start 检查点注册
//   3. registry 幂等：重复 register() 节点数与检查点数不变；FC.Test.validate(合并图) 全绿
//   4. 机缘三选一：剿矿盗（贡献+丹）/黑市商队（灵石-20 起、张铁走商线）/深山采药（luck≥20 得筑基草）
//   5. 筑基三选一：一枚丹硬闯（失败 injury+60、cultivation-1、丹毒 karma，可重试）/三枚丹稳（time 1095、
//      必成筑基二）/残页辅助（ch2_quanben 且筑基草或 knows_truth → 筑基二 + luck+3）；mortal_pill_used 标记
//   6. 张铁两分岔：黑市线相遇且 aff_zhang_tie≥3 → 走商起家（无家书）；否则 → 家书报丧（张铁的家书）
//   7. 回乡段：time +60、寿元自然流逝；李师姐锦囊 → 筑基成功的传书
//   8. 字数 ≥20000
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
require('../js/content/registry.js');
const FC = globalThis.FC;

function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}
const G = () => FC.Content.graph; // 合并后全图（ch1 + ch2 + ch3）

// —— 走查脚手架（与 ch2.test.mjs 同式）——
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

// —— 第一章走法（沿用 ch2.test.mjs 已验证路线）——
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

// —— 第二章走法（至 ch2_end；灵石不足处在记名岁月多当值补足）——
function ch2To(s, opts) {
  const o = Object.assign({ tieVisits: 0, liVisits: 0, rescue: false, extraDuty: 0, close: 'buy' }, opts);
  // 第一章终 → ch2_start → 榜帖风波 → 备战
  assert.equal(s.nodeId, '第一章终');
  step(s, '继续');
  drain(s);
  assert.equal(s.nodeId, 'ch2_备战');
  // 备战：人情节拍 → 苦修至四层 → 补满三月备战（ch2_prep≥3 才开大比）
  for (let i = 0; i < o.tieVisits; i++) { step(s, '访张铁（约着练手）'); drain(s); }
  for (let i = 0; i < o.liVisits; i++) { step(s, '走访百草堂（看李师姐）'); drain(s); }
  while (s.cultivation < 4) { step(s, '苦修《长春功》（进一层）'); drain(s); }
  while ((s.karma.ch2_prep || 0) < 3) {
    step(s, s.flags.ch2_intel ? '访张铁（约着练手）' : '打探大比规矩与对手');
    drain(s);
  }
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s); // 开幕 → 初试 → 复试
  step(s, '按下不表，稳稳过试');
  drain(s); // 终试前（→ 人情助力）→ 终试
  step(s, '缠住他，耗到破绽');
  assert.equal(s.nodeId, 'ch2_斗法胜', 'cultivation 4 应取胜');
  step(s, '继续'); // 斗法胜 → 救场抉择
  if (o.rescue) step(s, '翻进场中，把张铁拖出来');
  else step(s, '名次就要定了——垂手，别动');
  drainTo(s, 'ch2_记名岁月');
  while (s.cultivation < 6) { step(s, '后山苦修（全本行气）'); drain(s); }
  step(s, '冲击七层关隘'); drain(s);
  s.lingshi = Math.max(s.lingshi, 40); // 保证购得起固本散（走查不测穷困线）
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7);
  for (let i = 0; i < o.extraDuty; i++) { step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s); }
  step(s, '直面七层瓶颈（章末）');
  s.lingshi = Math.max(s.lingshi, 40); // 保证收束走得起，且章末仍留 ≥20 供 ch3 黑市线（走查不测穷困线）
  if (o.close === 'buy') { step(s, '购灵药固本丹（百草堂，十五灵石）'); drain(s); }
  else { step(s, '闭关苦熬，以年月磨这堵墙'); drain(s); }
  assert.ok(s.nodeId === 'ch2_end' || s.nodeId === 'ch3_机缘抉择', '章末收束应至 ch2_end（或经章际接线直达机缘抉择）: ' + s.nodeId);
}
function enterCh3(s) {
  // 幂等入口：ch2To 的收束 drain 可能已越过 ch2_end（章际接线）直达机缘抉择
  if (s.nodeId === 'ch2_end') step(s, '继续'); // → ch3_start
  if (s.nodeId === 'ch3_start') drain(s); // → 机缘抉择
  assert.equal(s.nodeId, 'ch3_机缘抉择');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch3 应有章首检查点（途经 ch3_start 时已写）');
  assert.equal(cp.nodeId, 'ch3_start');
}

// ———— 结构与注册 ————

test('FC.CH3 就绪：meta 定死值正确，ch3_start/ch3_end 存在，节点 id 不与 ch1/ch2 冲突', () => {
  assert.ok(FC.CH3 && FC.CH3.graph, 'FC.CH3 未挂载');
  assert.equal(FC.CH3.meta.chapter, 3);
  assert.equal(FC.CH3.meta.title, '筑基');
  assert.equal(FC.CH3.meta.checkpointNode, 'ch3_start');
  assert.ok(FC.CH3.graph.ch3_start, '缺入口 ch3_start');
  assert.ok(FC.CH3.graph.ch3_end, '缺章末 ch3_end');
  const taken = new Set([...Object.keys(FC.CH1), ...Object.keys(FC.CH2.graph)]);
  for (const id of Object.keys(FC.CH3.graph)) {
    assert.ok(!taken.has(id), '节点 id 与前章冲突: ' + id);
  }
});

test('registry 合并：ch1+ch2+ch3 节点全在图中，ch2_end → ch3_start 接线成立且不改写原件', () => {
  const g = G();
  for (const id of Object.keys(FC.CH3.graph)) assert.ok(g[id], 'ch3 节点丢失: ' + id);
  assert.equal(g['ch2_end'].goto, 'ch3_start', '合并图应把 ch2_end 接到 ch3_start');
  assert.equal(FC.CH2.graph['ch2_end'].goto, undefined, 'FC.CH2 原件不得被改写');
  assert.equal(FC.CH2.graph['ch2_end'].terminal, true, 'FC.CH2 原件保持章末终局标记');
  assert.ok(FC.Engine._checkpointNodes.has('ch3_start'), 'registry 应注册 ch3_start 检查点');
});

test('registry 幂等：重复 register() 后节点数与检查点数不变，validate 仍全绿', () => {
  const before = Object.keys(G()).length;
  const cpBefore = FC.Engine._checkpointNodes.size;
  FC.ContentRegistry.register();
  FC.ContentRegistry.register();
  assert.equal(Object.keys(G()).length, before, '重复注册不得新增节点');
  assert.equal(FC.Engine._checkpointNodes.size, cpBefore, '重复注册不得新增检查点');
  const r = FC.Test.validate(G());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('FC.Test.validate(合并后 graph) 全绿', () => {
  const r = FC.Test.validate(G());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('新道具三件登记在册（筑基草/张铁的家书/青元剑诀），且图中引用的所有物品都有登记', () => {
  for (const id of ['筑基草', '张铁的家书', '青元剑诀']) {
    assert.ok(FC.ITEMS[id], '物品未登记: ' + id);
  }
  const items = new Set();
  const scan = (fx) => (fx || []).forEach((e) => { if (e.type === 'item') items.add(e.id); });
  for (const id of Object.keys(G())) {
    const n = G()[id];
    scan(n.effects);
    for (const c of n.choices || []) scan(c.effects);
    for (const a of n.actions || []) scan(a.effects);
  }
  for (const id of items) assert.ok(FC.ITEMS[id], '图中引用未登记物品: ' + id);
});

// ———— 走查 A·深山采药 → 残页辅助筑基 → 张铁家书分岔 ————

test('走查 A：采药线 luck≥20 得筑基草 → 回乡 time+60 → 残页辅助筑基二（luck+3、寿元+80）→ 家书报丧 → ch3_end', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  assert.equal(s.flags.ch2_quanben, 1);
  enterCh3(s);
  // 机缘三选一：深山采药
  step(s, '入深山采药（九死一生，残页所指的旧径）'); drain(s); // 入山
  assert.equal(s.nodeId, 'ch3_采药');
  const d0 = s.day;
  step(s, '按残页所指的旧径走，稳扎稳打'); // luck 29 ≥ 20 → 奇遇
  assert.equal(s.nodeId, 'ch3_采药奇遇');
  step(s, '继续');
  assert.equal(s.inventory['筑基草'], 1, '奇遇应得筑基草');
  assert.ok(s.luck >= 20, '采药奇遇应有幸运入账');
  // 归山 → 伤退（未走黑市 → 归乡别过）→ 回乡
  drain(s); // 奇遇 → 归山
  step(s, '继续'); // 归山 → 伤退
  assert.equal(s.nodeId, 'ch3_伤退');
  step(s, '继续'); // 伤退 → 归乡别过（条件分岔）
  assert.equal(s.nodeId, 'ch3_归乡别过');
  step(s, '继续'); // → 回乡
  assert.equal(s.nodeId, 'ch3_回乡');
  const dayR = s.day, lifeR = s.lifespanYears;
  step(s, '继续'); // 回乡效果在离开时入账
  assert.equal(s.day, dayR + 60, '回乡段应 time +60 天');
  assert.ok(Math.abs((lifeR - s.lifespanYears) - 60 / 365) < 1e-9, '回乡段寿元应自然流逝 60/365 年');
  drain(s); // 坟前 → 筑基岁月
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  assert.ok(s.day - d0 >= 60, '回乡段累计时间 ≥60 天');
  // 筑基抉择：残页辅助（ch2_quanben=1 且持筑基草）
  const life0 = s.lifespanYears, luck0 = s.luck;
  step(s, '直面筑基关（章末）'); drain(s);
  assert.equal(s.nodeId, 'ch3_筑基抉择');
  step(s, '残页辅助：倒行三关，水到渠成');
  drain(s); // 残页渡关 → 残页成
  assert.equal(s.flags.mortal_pill_used, 'canye', '筑基方式应记为残页辅助');
  assert.equal(s.cultivation, 11, '残页辅助应筑基二层（下标 11）');
  assert.ok(Math.abs((s.lifespanYears - life0) - 80) > 0, '突破应入寿元（+80 减去自然流逝）');
  assert.equal(s.luck, luck0 + 3, '残页辅助应额外 luck+3');
  assert.equal(s.inventory['筑基草'], 0, '筑基草应在渡关时耗去');
  // 章末：内门授诀 → 家书报丧（未走商线）→ 魔气 → ch3_end
  step(s, '继续'); // 残页成 → 内门（寿元 +80 入账）
  step(s, '继续'); // 内门授诀 → 家书分岔
  assert.equal(s.inventory['青元剑诀'], 1, '内门应授青元剑诀');
  assert.equal(s.nodeId, 'ch3_家书', '未走黑市线应走家书报丧分岔');
  step(s, '继续');
  assert.equal(s.inventory['张铁的家书'], 1, '家书报丧应得张铁的家书');
  drainTo(s, 'ch3_end');
  const endText = FC.Engine.view(s, G()).text;
  assert.match(endText, /筑基/, '章末应点出筑基');
  assert.equal(s.flags.ch3_mogui, true, '章末应埋魔气伏笔');
  assert.ok(!s.flags.ch3_tie_merchant, '未走黑市线不得走商');
});

// ———— 走查 B·黑市商队 → 张铁走商分岔 → 三枚丹稳 ————

test('走查 B：黑市线（灵石-20 起）遇张铁 aff≥3 → 走商起家（无家书）；三枚丹稳 time 1095 筑基二寿元+80', () => {
  const s = freshState();
  ch1Qianqi(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  assert.ok((s.karma.aff_zhang_tie || 0) >= 3);
  ch2To(s, { tieVisits: 3, rescue: true, extraDuty: 13 });
  assert.ok(s.lingshi >= 20, '黑市行前灵石应≥20（当前 ' + s.lingshi + '）');
  enterCh3(s);
  // 机缘三选一：黑市商队
  const ls0 = s.lingshi;
  step(s, '随商队走一趟黑市（灰色，灵石 -20 起）');
  assert.equal(s.nodeId, 'ch3_入市');
  step(s, '继续');
  assert.ok(s.lingshi <= ls0 - 20, '黑市行应至少花 20 灵石');
  assert.equal(s.nodeId, 'ch3_卡口');
  step(s, '替商队带那只封了火的木箱'); // 灰色选择
  assert.equal(s.flags.ch3_smuggled, true);
  drain(s); // 市成 → 归山
  assert.equal(s.inventory['筑基丹'], 1, '黑市应购得一枚筑基丹');
  assert.equal(s.flags.ch3_tie_met_market, true, '黑市线应记与张铁相遇');
  assert.ok((s.karma.aff_zhang_tie || 0) >= 4, '黑市同行应涨张铁好感');
  // 伤退 → 走商分岔
  step(s, '继续'); // 归山 → 伤退
  step(s, '继续'); // 伤退 → 走商别过
  assert.equal(s.nodeId, 'ch3_走商别过', '黑市相遇且 aff≥3 应走商分岔');
  assert.equal(s.flags.ch3_tie_merchant, true, '走商分岔应置 ch3_tie_merchant');
  step(s, '继续'); // → 回乡
  step(s, '继续'); drain(s); // 坟前 → 筑基岁月
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  // 三枚丹稳：已有 1 枚，坊市再购 2 枚
  s.lingshi = 200;
  step(s, '坊市求购筑基丹（六十灵石一枚，散修急售）'); drain(s);
  step(s, '坊市求购筑基丹（六十灵石一枚，散修急售）'); drain(s);
  assert.equal(s.inventory['筑基丹'], 3, '三枚丹稳应备齐三枚');
  step(s, '直面筑基关（章末）'); drain(s);
  const day0 = s.day, life0 = s.lifespanYears; // 自筑基抉择起算（直面的一日记在章末账上）
  step(s, '三枚丹稳：以年月换稳妥');
  drain(s); // 三丹温养 → 筑基稳成
  assert.equal(s.day, day0 + 1095, '三枚丹稳应 time 3 年（1095 天）');
  assert.ok(Math.abs((life0 - s.lifespanYears) - 3) < 1e-9, '三年寿元应自然流逝');
  assert.equal(s.flags.mortal_pill_used, 'dan3');
  assert.equal(s.cultivation, 11, '三枚丹稳应筑基二层');
  const lifeAfter = s.lifespanYears;
  step(s, '继续'); // 稳成效果入账
  assert.ok(s.lifespanYears - lifeAfter > 70, '突破应入寿元约 +80（两 层各 +40）');
  // 章末：走商线无家书
  drainTo(s, 'ch3_内门');
  step(s, '继续'); // → 魔气（走商线跳过家书）
  assert.equal(s.nodeId, 'ch3_魔气');
  assert.ok(!s.inventory['张铁的家书'], '走商线不得有家书');
  drainTo(s, 'ch3_end');
});

// ———— 筑基方式：一枚丹硬闯（成/挫/丹毒/重试）————

test('硬闯·成：luck 达标一丹破关 → 筑基一（+3 层）、寿元 +40、mortal_pill_used=dan1、固本丹耗去', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s); // 点卯西矿
  assert.equal(s.nodeId, 'ch3_剿矿');
  const inj0 = s.injury;
  step(s, '先探矿道，再合围'); // luck 29 ≥ 10 → 胜
  assert.equal(s.nodeId, 'ch3_剿矿胜');
  step(s, '继续');
  assert.equal(s.inventory['筑基丹'], 1, '剿矿胜应得筑基丹');
  assert.equal(s.karma.ch3_merit, 1, '剿矿应记宗门贡献');
  assert.ok(s.injury > inj0, '剿矿应有伤势入账');
  step(s, '继续'); drain(s); // 归山 → 伤退 → 归乡别过
  step(s, '继续'); step(s, '继续'); // 回乡
  step(s, '继续'); drain(s); // 坟前 → 筑基岁月
  step(s, '直面筑基关（章末）'); drain(s);
  const life0 = s.lifespanYears;
  assert.ok((s.inventory['灵药固本丹'] || 0) > 0, '走查应持 ch2 购的固本丹');
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  assert.equal(s.inventory['筑基丹'], 0, '硬闯应耗一枚筑基丹');
  assert.equal(s.flags.mortal_pill_used, 'dan1');
  assert.equal(s.nodeId, 'ch3_丹关');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯成');
  step(s, '继续');
  assert.equal(s.cultivation, 10, '硬闯成应筑基一层（下标 10）');
  assert.ok(s.lifespanYears - life0 > 39, '筑基一层应寿元 +40（减自然流逝）');
  assert.equal(s.inventory['灵药固本丹'], 0, '固本丹应在硬闯成时服去');
  drainTo(s, 'ch3_end');
});

test('硬闯·挫：无药低机缘 → injury+60、cultivation-1 退境、丹毒 karma；回攀后可重试成功', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  step(s, '先探矿道，再合围'); // luck 低 → 挫
  assert.equal(s.nodeId, 'ch3_剿矿挫', '低机缘剿矿应受挫');
  step(s, '继续');
  assert.ok(!(s.inventory['筑基丹'] > 0), '剿矿受挫不得有筑基丹');
  assert.equal(s.karma.ch3_merit, 1, '挫也应记宗门贡献（重伤立功）');
  step(s, '继续'); drain(s);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); drain(s); // 伤退→别过→回乡→坟前→hub
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  // 以贡献兑丹
  step(s, '以宗门贡献兑换筑基丹（典库支取）'); drain(s);
  assert.equal(s.inventory['筑基丹'], 1, '贡献应兑得筑基丹');
  step(s, '直面筑基关（章末）'); drain(s);
  s.inventory['灵药固本丹'] = 0; // 摘掉 ch2 的固本丹
  s.luck = 5; // 压低机缘，硬闯必败
  const inj0 = s.injury, cult0 = s.cultivation;
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯挫', '低机缘硬闯应失败');
  step(s, '继续');
  assert.equal(s.injury, Math.min(100, inj0 + 60), '硬闯失败应 injury+60');
  assert.equal(s.cultivation, cult0 - 1, '退境应 cultivation-1');
  assert.equal(s.karma.pill_toxin, 1, '硬闯失败应记丹毒 karma');
  assert.equal(s.nodeId, 'ch3_筑基岁月', '挫后应回筑基岁月（可重试）');
  // 回攀七层再闯（换稳妥的三丹路线收尾）
  while (s.cultivation < 7) { step(s, '苦修正途（后山行气，进一层）'); drain(s); }
  assert.equal(s.cultivation, 7, '苦修应回攀至七层');
  s.lingshi = 200;
  step(s, '坊市求购筑基丹（六十灵石一枚，散修急售）'); drain(s);
  step(s, '坊市求购筑基丹（六十灵石一枚，散修急售）'); drain(s);
  assert.equal(s.inventory['筑基丹'], 2);
  step(s, '直面筑基关（章末）'); drain(s);
  const i1 = pick(s, '一枚丹硬闯：药力不足，拿命去填');
  const i2 = pick(s, '三枚丹稳：以年月换稳妥');
  const v = FC.Engine.view(s, G());
  assert.equal(v.choices[i1].enabled, true, '丹毒在身，硬闯仍可见可试（合同：可重试）');
  assert.equal(v.choices[i2].enabled, false, '三枚丹稳需三枚，两枚不足应禁用');
  s.luck = 30; // 给足机缘，重试硬闯
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯成', '重试硬闯应成功');
  step(s, '继续');
  assert.equal(s.cultivation, 10);
  assert.equal(s.karma.pill_toxin, 1, '丹毒 karma 应保留');
  drainTo(s, 'ch3_end');
});

// ———— 门槛与分支条件 ————

test('残页辅助门槛：ch2_quanben 且（筑基草 或 knows_truth）才可见；缺一不可', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  // 先走到筑基抉择（采药线，得草）
  step(s, '入深山采药（九死一生，残页所指的旧径）'); drain(s);
  step(s, '按残页所指的旧径走，稳扎稳打'); step(s, '继续'); drain(s);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); step(s, '继续'); drain(s);
  step(s, '直面筑基关（章末）'); drain(s);
  assert.ok(FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('残页辅助') >= 0), 'quanben+草 应可见残页辅助');
  assert.ok(s.inventory['筑基草'] > 0);
  // 摘掉筑基草：knows_truth=1 仍在，应仍可见
  s.inventory['筑基草'] = 0;
  assert.ok(FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('残页辅助') >= 0), 'knows_truth 也可开启残页辅助');
  // 再摘 knows_truth：不可见
  s.karma.knows_truth = 0;
  assert.ok(!FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('残页辅助') >= 0), '缺草且缺 knows_truth 应不可见');
  // 无 quanben 的局：ch2 授全本是记名必经，无法走查绕开，此处以裸态落点抉择验证门槛
  const s2 = freshState();
  s2.nodeId = 'ch3_筑基抉择';
  s2.cultivation = 7;
  s2.inventory['筑基草'] = 1;
  s2.karma.knows_truth = 0;
  assert.ok(!FC.Engine.view(s2, G()).choices.some((c) => c.label.indexOf('残页辅助') >= 0), '无 ch2_quanben 不得开启残页辅助');
  s2.flags.ch2_quanben = 1;
  assert.ok(FC.Engine.view(s2, G()).choices.some((c) => c.label.indexOf('残页辅助') >= 0), '补上全本后应可见');
});

test('黑市门槛：灵石不足 20 时选项可见但禁用；采药贪路低机缘 → 坠崖真死（豁免则重伤续行）', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  s.lingshi = 19;
  const v = FC.Engine.view(s, G());
  const i = pick(s, '随商队走一趟黑市（灰色，灵石 -20 起）');
  assert.equal(v.choices[i].enabled, false, '灵石不足 20 黑市应可见但禁用');
  const r = FC.Engine.choose(s, G(), i);
  assert.deepEqual(r, { ok: false, reason: 'disabled' });
  assert.equal(s.nodeId, 'ch3_机缘抉择');
  // 采药贪路 → 坠崖（直接落点采药 combat，压低机缘）
  const s2 = freshState();
  ch1Qianqi(s2, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s2, { tieVisits: 0, rescue: false });
  enterCh3(s2);
  step(s2, '入深山采药（九死一生，残页所指的旧径）'); drain(s2);
  s2.luck = 5;
  step(s2, '那株长在崖畔的更肥美——绕近路');
  assert.equal(s2.nodeId, 'ch3_采药遇险', '贪路低机缘应遇险');
  step(s2, '咬牙认命，先下山养伤');
  assert.equal(s2.nodeId, 'ch3_归山');
  assert.ok(s2.injury >= 40, '遇险应记伤');
  // 崖畔再试 → 坠崖真死
  const s3 = freshState();
  ch1Qianqi(s3, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s3, { tieVisits: 0, rescue: false });
  enterCh3(s3);
  step(s3, '入深山采药（九死一生，残页所指的旧径）'); drain(s3);
  s3.luck = 5;
  step(s3, '那株长在崖畔的更肥美——绕近路');
  step(s3, '那株草就在眼前——再试一把');
  assert.equal(s3.nodeId, 'ch3_崖畔');
  step(s3, '把心一横，徒手攀上去');
  assert.equal(s3.nodeId, 'ch3_坠崖');
  const r3 = FC.Engine.choose(s3, G(), pick(s3, '继续'));
  assert.equal(r3.ok, true);
  assert.equal(s3.dead, 'combat', '坠崖无豁免应真死');
  assert.match(FC.UI.deathText(s3), /伤重不治/);
  const cp3 = FC.Save.load('checkpoint');
  assert.ok(cp3 && cp3.nodeId === 'ch3_start', '死亡不吞进度：检查点仍是 ch3_start 存活进度');
  // 豁免：重伤续行
  const s4 = freshState();
  s4.deathExempt = true;
  ch1Qianqi(s4, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s4, { tieVisits: 0, rescue: false });
  enterCh3(s4);
  step(s4, '入深山采药（九死一生，残页所指的旧径）'); drain(s4);
  s4.luck = 5;
  step(s4, '那株长在崖畔的更肥美——绕近路');
  step(s4, '那株草就在眼前——再试一把');
  step(s4, '把心一横，徒手攀上去');
  step(s4, '继续');
  assert.equal(s4.dead, null, '豁免下坠崖应重伤续行');
  assert.equal(s4.injury, 100);
  assert.equal(s4.nodeId, 'ch3_崖下');
  drain(s4);
  assert.equal(s4.nodeId, 'ch3_归山');
});

test('李师姐传书：锦囊在身 → 内门后开启她筑基成功的传书；无锦囊则跳过', () => {
  const s = freshState();
  ch1Qianqi(s, ['坊市跑腿（替药铺送货，得赏钱）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s, { tieVisits: 0, liVisits: 2, rescue: false });
  assert.equal(s.inventory['李师姐的锦囊'], 1, 'aff_li≥2 应得锦囊');
  enterCh3(s);
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  s.luck = 30; // 确保剿矿与硬闯顺利
  step(s, '先探矿道，再合围');
  step(s, '继续'); step(s, '继续'); drain(s);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); drain(s);
  step(s, '直面筑基关（章末）'); drain(s);
  assert.equal(s.inventory['筑基丹'] >= 1, true);
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯成');
  step(s, '继续'); // 硬闯成 → 内门
  step(s, '继续'); // 内门 → 传书（锦囊在身）
  assert.equal(s.nodeId, 'ch3_传书', '锦囊在身应开启传书');
  const luck0 = s.luck;
  step(s, '继续');
  assert.equal(s.flags.ch3_li_letter, true);
  assert.equal(s.luck, luck0 + 2, '传书应有小奖励');
  step(s, '继续'); // → 家书（未走商线）
  assert.equal(s.nodeId, 'ch3_家书');
  drainTo(s, 'ch3_end');
  // 无锦囊对照：直接落点内门验证跳过
  const s2 = freshState();
  ch1Qianqi(s2, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s2, { tieVisits: 0, rescue: false });
  enterCh3(s2);
  s2.nodeId = 'ch3_内门';
  s2.flags.ch3_tie_merchant = true; // 走商线：内门直通魔气
  step(s2, '继续');
  assert.equal(s2.nodeId, 'ch3_魔气', '无锦囊且有走商线应跳过传书与家书');
});

test('回乡段村评文本随因果变化：took_blame 与张铁存亡各有其文', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  step(s, '先探矿道，再合围'); step(s, '继续'); drain(s);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); drain(s);
  // 顶过罪的局：ch1 走认下路线重走一遍只取回乡文本
  const s2 = freshState();
  step(s2, '继续'); step(s2, '继续'); step(s2, '继续');
  step(s2, '落云宗十年苦契，签！');
  step(s2, '继续'); step(s2, '继续'); step(s2, '继续');
  ch1HubMonths(s2, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  step(s2, '认下：“草是我拿的。”');
  assert.equal(s2.karma.took_blame, 1);
  const t1 = FC.CH3.graph['ch3_回乡'].text(s);
  const t2 = FC.CH3.graph['ch3_回乡'].text(s2);
  assert.notEqual(t1, t2, '不同因果应有不同村评文本');
  assert.match(t2, /顶罪|替.*认下|认下/, 'took_blame 局应提及顶罪旧事');
  const sMerchant = FC.State.create('李恒');
  sMerchant.flags.ch3_tie_merchant = true;
  const t3 = FC.CH3.graph['ch3_回乡'].text(sMerchant);
  assert.notEqual(t3, t2, '张铁存亡（走商）应改变村评文本');
});

// ———— 字数 ————

test('字数统计：第三章正文（各节点 text 并集）+ 选项文案合计 ≥20000 字', () => {
  const probes = [];
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    fn(s);
    return s;
  };
  probes.push(FC.State.create('李恒'));
  probes.push(crafted((s) => { // 主线态：七层+全本+草+令牌+固本丹
    s.cultivation = 7; s.luck = 30; s.flags.ch2_quanben = 1; s.karma.knows_truth = 1;
    s.inventory['筑基草'] = 1; s.inventory['灵药固本丹'] = 2; s.inventory['执法堂令牌'] = 1;
    s.inventory['李师姐的锦囊'] = 1; s.inventory['筑基丹'] = 2; s.lingshi = 40;
  }));
  probes.push(crafted((s) => { // 黑市/走商态
    s.cultivation = 7; s.lingshi = 30; s.flags.ch3_tie_met_market = true;
    s.karma.aff_zhang_tie = 6; s.flags.ch3_smuggled = true; s.flags.ch2_saved_tie = true;
  }));
  probes.push(crafted((s) => { // 落榜/追赶态：低层数无全本
    s.cultivation = 4; s.luck = 3; s.karma.cold_blood = 1; s.karma.ch3_merit = 1;
    s.inventory['筑基丹'] = 0;
  }));
  probes.push(crafted((s) => { // 顶罪态
    s.cultivation = 7; s.karma.took_blame = 1; s.flags.ch2_saved_tie = true; s.karma.aff_zhang_tie = 8;
  }));
  probes.push(crafted((s) => { // 章末诸态：走商+传书
    s.cultivation = 11; s.flags.ch3_tie_merchant = true; s.inventory['李师姐的锦囊'] = 1;
    s.inventory['青元剑诀'] = 1; s.flags.ch3_li_letter = true; s.flags.ch3_mogui = true; s.day = 2000;
  }));
  probes.push(crafted((s) => { // 章末诸态：家书+退境重攀
    s.cultivation = 6; s.karma.pill_toxin = 2; s.inventory['张铁的家书'] = 1;
    s.flags.ch3_letter_tie = true; s.flags.ch2_quanben = 1; s.karma.knows_truth = 1; s.injury = 60;
  }));
  probes.push(crafted((s) => { // 采药诸态：贪路/遇险
    s.cultivation = 7; s.luck = 5; s.flags.ch3_herb_greedy = true; s.flags.ch3_herb_fail = true;
  }));
  const graph = FC.CH3.graph; // 只统计第三章正文
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
  assert.ok(sum >= 20000, '第三章字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 34000, '第三章字数失控: ' + sum);
});
