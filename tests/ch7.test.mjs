// 终章《大限》测试（Task 7）：
//   1. FC.CH7 就绪：meta 定死值正确（chapter 7 / 大限 / ch7_start），节点 id 不与 ch1~ch6 冲突，
//      三结局节点（ending_ascend/ending_legacy）terminal 且无 goto
//   2. registry：CONTENT_SOURCES 预置 CH7（确认）；ch6_end → ch7_start 章际接线，FC.CH6 原件不改写，
//      ch7_start 检查点注册，幂等，validate 全绿
//   3. 新道具登记（飞升台图录/界膜钉），图中引用物品全部在册
//   4. 开局承接：ch7_start 消费 ch6 出口（三钥/inner_demon/婴变古卷/李师姐遗物/张铁的家书/
//      saved_mortals/took_blame/cold_blood/mortal_limit）分支渲染互异；大限只减不增与三线索在文
//   5. 付薪例规：寿元不足千年者 +240 精确（只发一回）；账面足者直达 hub
//   6. 大限结构：人界无进阶（全图无修为效果）；hub 每个 action 必带 time（快进=烧命）；
//      百年闭关整百年；温养 gated injury>0 且 -50；坐化传道任意时刻可见
//   7. 走查 A·集齐飞升：神念三问（揭仙路尽头主题）→ 授图 → 取钉 → 接天阙三宝三钥清点 →
//      登台破界 → ending_ascend terminal（留白灵界、落款）；时间账精确（30+1+90+30+30 天）
//   8. 界膜钉与神念：未听神念不得取钉；辞图线仍可取钉但无图录不启台路
//   9. 走查 B·硬撼两路：门槛（寿元≥300 且 injury=0，可见不可选）；首撼必挫（injury+99、寿元-100 精确、白痕）；
//      养伤复撼必破 → ending_ascend（撼路）；飞升台缺宝时登台不可见、却步可回
//  10. 走查 C·坐化传道：确认 → ending_legacy terminal（青牛/张铁/散尽功力/灵根少年在文）；拒绝 → 回 hub
//  11. 走查 D·倒计时老死：百年闭关烧命至寿元归零 dead='lifespan'；deathText 寿终档含生平段
//      （默认档：张铁/李师姐句，无顶罪/被救句）；检查点仍 ch7_start、存活、寿元为入章原值
//  12. deathText 寿终档生平段：took_blame 与 saved_mortals 两存档结尾文不同；要素无则不出现
//  13. 渲染回归：关键句逐段在正文（悬空分号防线）
//  14. 文面体检：正文无英文杂字、双引号成对、无常见繁体字
//  15. 字数 ≥15000
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
require('../js/content/ch6.js');
require('../js/content/ch7.js');
require('../js/content/registry.js');
const FC = globalThis.FC;

function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}
const G = () => FC.Content.graph; // 合并后全图（ch1 + … + ch7）

// —— 走查脚手架（与 ch6.test.mjs 同式）——
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
function stepMaybeDead(s, label) {
  const r = FC.Engine.choose(s, G(), pick(s, label));
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

// —— 第一章走法（沿用 ch6.test.mjs 已验证路线）——
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
function ch1TailNight(s) {
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '捏紧张铁给的金刃符，贴着田垄摸近档房');
  drain(s);
  step(s, '原样藏回床板，来日再参');
}
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
}
function ch3Finish(s) {
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  assert.equal(s.nodeId, 'ch3_剿矿');
  s.luck = Math.max(s.luck, 30);
  step(s, '先探矿道，再合围');
  assert.equal(s.nodeId, 'ch3_剿矿胜');
  step(s, '继续');
  assert.equal(s.inventory['筑基丹'], 1, '剿矿胜应得筑基丹');
  step(s, '继续');
  step(s, '继续');
  step(s, '继续');
  step(s, '继续');
  drain(s);
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  step(s, '直面筑基关（章末）'); drain(s);
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯成');
  drainTo(s, 'ch4_入侵抉择');
}
function ch4TailDefault(s) {
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）');
  assert.equal(s.nodeId, 'ch4_撤离');
  step(s, '继续');
  step(s, '继续');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  assert.equal(s.inventory['李师姐遗物'], 1, '默认尾应带李师姐遗物');
  while (s.cultivation < 12) { step(s, '苦修正途（流亡行气，进一层）'); drain(s); }
  s.lingshi = Math.max(s.lingshi, 80);
  step(s, '打探结丹机缘（酒肆与坊市的传闻）');
  step(s, '购凝魂丹（坊市丹铺，灵石 -50）'); step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  step(s, '直面结丹关（章末）');
  step(s, '水到渠成，稳渡结丹关（机缘已备，伤势轻）');
  step(s, '继续');
  step(s, '乘势再进一层（结丹二层，再焚一道机缘）');
  step(s, '继续');
  drainTo(s, 'ch5_散修岁月');
  assert.equal(s.cultivation, 14, '开局应为结丹二层');
}
function ch5Climb(s) {
  while (s.cultivation < 15) { step(s, '闭关静修（行气淬炼，结丹层数精进）'); drain(s); }
  assert.equal(s.cultivation, 15);
}
function ch5DouBao(s) {
  step(s, '佣斗夺宝（赏格与机缘，都在刀口上）');
  assert.equal(s.nodeId, 'ch5_初遇夺宝');
  step(s, '继续');
  assert.equal(s.inventory['婴变古卷'], 1, '初遇夺宝应得婴变古卷');
  assert.equal(s.nodeId, 'ch5_散修岁月');
}
function ch5Century(s) {
  step(s, '闭关百年（一键百年，出关物是人非）');
  assert.equal(s.nodeId, 'ch5_出关');
  step(s, '继续');
  assert.equal(s.flags.ch5_century_done, true);
  assert.equal(s.nodeId, 'ch5_散修岁月');
}
function ch5XinmoClean(s, faceCase) {
  step(s, '直面元婴关（章末）');
  assert.equal(s.nodeId, 'ch5_心魔劫');
  if (faceCase) {
    step(s, '执法堂旧案：入梦重回档房那一夜');
    step(s, '继续');
    assert.equal(s.flags.ch5_xinmo_case, true);
  }
  step(s, '执念已了，直面元婴关（章末突破）');
  assert.equal(s.nodeId, 'ch5_元婴抉择');
}
function ch5Breakthrough(s) {
  step(s, '以《婴变古卷》为引，水到渠成闯元婴关');
  assert.equal(s.nodeId, 'ch5_元婴成');
  step(s, '继续');
  assert.equal(FC.REALMS[s.cultivation], '元婴一层');
  assert.equal(s.nodeId, 'ch5_婴成之后');
}
function ch5DuelWin(s) {
  step(s, '出关迎敌（章末对决）');
  assert.equal(s.nodeId, 'ch5_最终对决');
  step(s, '正面迎战：婴变初啼，以战止战');
  assert.equal(s.nodeId, 'ch5_对决胜');
  step(s, '继续');
  assert.equal(s.flags.kurong_slain, true, '胜后应置 kurong_slain');
  assert.equal(s.inventory['枯荣令'], 1, '胜后应得枯荣令');
  assert.equal(s.nodeId, 'ch5_end');
}
function ch1TailNightRoutes(s) {
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
}
function ch1Zhen(s, hubMoves, tail) {
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '先活下来：留镇当账房伙计');
  drain(s); drain(s); drain(s);
  ch1HubMonths(s, hubMoves);
  tail(s);
}

// —— 走到第六章（默认路线：元婴二层、枯荣令、婴变古卷、ch2_quanben、无心魔）——
function reachCh6(s) {
  ch1TailNightRoutes(s);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  ch4TailDefault(s);
  ch5Climb(s);
  ch5DouBao(s);
  ch5Century(s);
  ch5XinmoClean(s, true);
  ch5Breakthrough(s);
  step(s, '乘势再进一层（元婴二层，寿元再添）');
  assert.equal(FC.REALMS[s.cultivation], '元婴二层');
  ch5DuelWin(s);
  step(s, '继续');
  drain(s);
  assert.equal(s.nodeId, 'ch6_元婴岁月', '应进入第六章 hub: ' + s.nodeId);
  assert.equal(s.cultivation, 17, '第六章开局应为元婴二层');
  assert.equal(s.flags.kurong_slain, true);
  assert.equal(s.inventory['枯荣令'], 1);
  assert.equal(s.inventory['婴变古卷'], 1);
  assert.ok(s.flags.ch2_quanben, '默认路线应带 ch2_quanben（界纹玉钥之钥）');
}
function ch6Scout(s) {
  step(s, '打探通天遗府的来历（坊市旧闻与古籍）');
  assert.equal(s.nodeId, 'ch6_遗府传闻');
  step(s, '继续');
  assert.equal(s.flags.ch6_yifu_heard, true);
  assert.equal(s.nodeId, 'ch6_元婴岁月');
}
function ch6Climb(s) {
  while (s.cultivation < 18) { step(s, '闭关静修（行气淬炼，元婴层数精进）'); drain(s); }
  assert.equal(s.cultivation, 18);
}
function ch6Enter(s) {
  step(s, '遣赴坠星原，寻通天遗府（章末入府）');
  assert.equal(s.nodeId, 'ch6_遗府外门');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_外门自开', 'ch2_quanben 残页兑现应外门自开');
  step(s, '继续');
  assert.equal(s.inventory['界纹玉钥'], 1);
  assert.equal(s.flags.key_jade, true);
  assert.equal(s.nodeId, 'ch6_遗府内庭');
}
function ch6Keys(s) {
  step(s, '探星宫，历练夺宝（星核之藏）');
  assert.equal(s.nodeId, 'ch6_星核夺宝');
  step(s, '稳取：以元婴神识缓蚀星傀阵眼，先断灵机');
  assert.equal(s.nodeId, 'ch6_星核得手');
  step(s, '继续');
  assert.equal(s.flags.key_core, true);
  step(s, '以枯荣令为引，炼化通天令');
  step(s, '继续');
  assert.equal(s.flags.key_token, true);
  assert.equal(s.inventory['通天令'], 1);
  assert.equal(s.nodeId, 'ch6_遗府内庭');
}
function ch6HuaShen(s) {
  step(s, '直登化神台（章末突破）');
  assert.equal(s.nodeId, 'ch6_化神抉择');
  step(s, '三钥齐备，以通天之礼稳破化神');
  assert.equal(s.nodeId, 'ch6_化神成');
  step(s, '继续');
  assert.equal(s.cultivation, 19, '应至化神');
  assert.equal(FC.REALMS[s.cultivation], '化神');
  assert.equal(s.flags.mortal_limit, true, '化神成应置 mortal_limit');
  assert.equal(s.nodeId, 'ch6_大限钟声');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_end');
}

// —— 走到终章（默认路线：化神、三钥齐、家书+遗物、无心魔）——
function reachCh7(s) {
  reachCh6(s);
  ch6Scout(s);
  ch6Climb(s);
  ch6Enter(s);
  ch6Keys(s);
  ch6HuaShen(s);
  step(s, '继续'); // ch6_end（章际接线）→ ch7_start
  assert.equal(s.nodeId, 'ch7_start', '应进入终章 ch7_start: ' + s.nodeId);
  assert.equal(FC.REALMS[s.cultivation], '化神');
  assert.equal(s.flags.mortal_limit, true);
  drain(s);
  assert.equal(s.nodeId, 'ch7_hub', '开局应落到大限岁月 hub: ' + s.nodeId);
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入终章应有章首检查点');
  assert.equal(cp.nodeId, 'ch7_start');
  assert.equal(FC.State.isDead(cp), false);
}

// ———— 结构与注册 ————

test('FC.CH7 就绪：meta 定死值正确，ch7_start 存在，三结局 terminal，节点 id 不与 ch1~ch6 冲突', () => {
  assert.ok(FC.CH7 && FC.CH7.graph, 'FC.CH7 未挂载');
  assert.equal(FC.CH7.meta.chapter, 7);
  assert.equal(FC.CH7.meta.title, '大限');
  assert.equal(FC.CH7.meta.checkpointNode, 'ch7_start');
  assert.ok(FC.CH7.graph.ch7_start, '缺入口 ch7_start');
  for (const id of ['ending_ascend', 'ending_legacy']) {
    const n = FC.CH7.graph[id];
    assert.ok(n, '缺结局节点: ' + id);
    assert.equal(n.type, 'scene', id + ' 应为 scene');
    assert.equal(n.terminal, true, id + ' 应为 terminal 终局');
    assert.equal(n.goto, undefined, id + ' 不得有 goto（结局后走既有标题出口）');
  }
  const taken = new Set([
    ...Object.keys(FC.CH1), ...Object.keys(FC.CH2.graph), ...Object.keys(FC.CH3.graph),
    ...Object.keys(FC.CH4.graph), ...Object.keys(FC.CH5.graph), ...Object.keys(FC.CH6.graph),
  ]);
  for (const id of Object.keys(FC.CH7.graph)) {
    assert.ok(!taken.has(id), '节点 id 与前章冲突: ' + id);
  }
});

test('registry：CONTENT_SOURCES 预置 CH7（确认）；ch6_end → ch7_start 接线成立且不改写原件；ch7_start 检查点注册；幂等；validate 全绿', () => {
  assert.ok(FC.CONTENT_SOURCES.indexOf('CH7') >= 0, 'CONTENT_SOURCES 应预置 CH7');
  const g = G();
  for (const id of Object.keys(FC.CH7.graph)) assert.ok(g[id], 'ch7 节点丢失: ' + id);
  assert.equal(g['ch6_end'].goto, 'ch7_start', '合并图应把 ch6_end 接到 ch7_start');
  assert.equal(FC.CH6.graph['ch6_end'].goto, undefined, 'FC.CH6 原件不得被改写');
  assert.equal(FC.CH6.graph['ch6_end'].terminal, true, 'FC.CH6 原件保持章末终局标记');
  assert.ok(FC.Engine._checkpointNodes.has('ch7_start'), 'registry 应注册 ch7_start 检查点');
  const before = Object.keys(g).length;
  const cpBefore = FC.Engine._checkpointNodes.size;
  FC.ContentRegistry.register();
  FC.ContentRegistry.register();
  assert.equal(Object.keys(G()).length, before, '重复注册不得新增节点');
  assert.equal(FC.Engine._checkpointNodes.size, cpBefore, '重复注册不得新增检查点');
  const r = FC.Test.validate(G());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('新道具登记（飞升台图录/界膜钉），且 ch7 图中引用的所有物品都有登记', () => {
  for (const id of ['飞升台图录', '界膜钉']) {
    assert.ok(FC.ITEMS[id], '物品未登记: ' + id);
  }
  const items = new Set();
  const scan = (fx) => (fx || []).forEach((e) => { if (e.type === 'item') items.add(e.id); });
  for (const id of Object.keys(FC.CH7.graph)) {
    const n = FC.CH7.graph[id];
    scan(n.effects);
    for (const c of n.choices || []) scan(c.effects);
    for (const a of n.actions || []) scan(a.effects);
  }
  for (const id of items) assert.ok(FC.ITEMS[id], '图中引用未登记物品: ' + id);
  assert.ok(items.has('飞升台图录') && items.has('界膜钉'), '两件遗宝都应被剧情效果引用');
});

// ———— 开局承接（ch6 出口消费）与付薪例规 ————

test('开局承接：ch7_start 消费 ch6 出口（三钥/inner_demon/婴变古卷/遗物/家书/saved_mortals/took_blame/cold_blood）分支渲染互异；大限只减不增与三线索在文', () => {
  const mk = (fn) => {
    const s = FC.State.create('李恒');
    s.cultivation = 19; s.flags.mortal_limit = true; s.lifespanYears = 900; fn(s);
    return s;
  };
  const tBase = FC.CH7.graph['ch7_start'].text(mk(() => {}));
  const tKeys = FC.CH7.graph['ch7_start'].text(mk((s) => {
    s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
    s.inventory['界纹玉钥'] = 1; s.inventory['星核髓'] = 1; s.inventory['通天令'] = 1;
  }));
  const tDemon = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.flags.inner_demon = true; }));
  const tScroll = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.inventory['婴变古卷'] = 1; }));
  const tRelic = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.inventory['李师姐遗物'] = 1; }));
  const tLetter = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.inventory['张铁的家书'] = 1; }));
  const tSaved = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.karma.saved_mortals = 1; }));
  const tBlame = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.karma.took_blame = 1; }));
  const tCold = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.karma.cold_blood = 1; }));
  const tLow = FC.CH7.graph['ch7_start'].text(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; s.cultivation = 19; s.lifespanYears = 450; }));
  assert.ok(tBase.length > 900, '开局正文应有实文');
  // 大限定死要素
  assert.match(tBase, /化神/, '应显示化神');
  assert.match(tBase, /只减不增/, '应有大限只减不增');
  assert.match(tBase, /飞升台|接天/, '应有三线索之一：飞升台');
  assert.match(tBase, /界膜|薄弱/, '应有三线索之二：界膜');
  assert.match(tBase, /灯|神念|传承/, '应有三线索之三：传承神念');
  // 三钥清点
  assert.notEqual(tBase, tKeys, '三钥在手应改变开局正文');
  assert.match(tKeys, /界纹玉钥/, '三钥态应清点玉钥');
  assert.match(tKeys, /星核髓/, '三钥态应清点星核髓');
  assert.match(tKeys, /通天令/, '三钥态应清点通天令');
  // 各要素
  assert.match(tDemon, /魔种|心魔/, '心魔态应提及魔种');
  assert.notEqual(tKeys, tDemon);
  assert.match(tScroll, /古卷|帛书/, '古卷态应提及古卷');
  assert.notEqual(tKeys, tScroll);
  assert.match(tRelic, /戥子|师姐/, '遗物态应提及戥子');
  assert.notEqual(tKeys, tRelic);
  assert.match(tLetter, /酒囊|张铁/, '家书态应提及张铁');
  assert.notEqual(tKeys, tLetter);
  assert.match(tSaved, /渡口|江南/, '被救者态应提及渡口');
  assert.notEqual(tKeys, tSaved);
  assert.match(tBlame, /孙毅|顶罪|担草/, '顶罪者态应提及旧案');
  assert.notEqual(tKeys, tBlame);
  assert.match(tCold, /垂手|冷/, 'cold_blood 态应有大比那一眼');
  assert.notEqual(tKeys, tCold);
  // 低寿元态显示实数
  assert.match(tLow, /四百五|450/, '低寿元态应显示寿元实数');
});

test('付薪例规：寿元不足千年者经 ch7_付薪 +240 精确、例规旗落定；账面足者直达 hub；两态正文互异', () => {
  cleanSave();
  const sLow = FC.State.create('李恒');
  sLow.cultivation = 19; sLow.flags.mortal_limit = true; sLow.lifespanYears = 900;
  sLow.nodeId = 'ch7_start';
  step(sLow, '继续');
  assert.equal(sLow.nodeId, 'ch7_付薪', '不足千年应经付薪');
  const tPay = FC.Engine.view(sLow, G()).text;
  assert.match(tPay, /薪/, '付薪正文应含薪');
  const life0 = sLow.lifespanYears;
  step(sLow, '继续');
  assert.ok(Math.abs((sLow.lifespanYears - life0) - 240) < 1e-9, '付薪应 +240 精确，实际 ' + (sLow.lifespanYears - life0));
  assert.equal(sLow.flags.ch7_stipend, true, '付薪应落定例规旗');
  assert.equal(sLow.nodeId, 'ch7_hub');

  cleanSave();
  const sRich = FC.State.create('李恒');
  sRich.cultivation = 19; sRich.flags.mortal_limit = true; sRich.lifespanYears = 1100;
  sRich.nodeId = 'ch7_start';
  step(sRich, '继续');
  assert.equal(sRich.nodeId, 'ch7_hub', '账面足者应直达 hub');
  assert.ok(!sRich.flags.ch7_stipend, '未付薪不得有例规旗');
  assert.equal(sRich.lifespanYears, 1100, '账面足者不得被付薪');
  const tStart = FC.CH7.graph['ch7_start'].text(sRich);
  const tStartLow = FC.CH7.graph['ch7_start'].text(sLow);
  assert.notEqual(tStart, tStartLow, '不同寿元态开局正文应互异（账面实数）');
});

// ———— 大限结构（hub 与时间账）————

test('大限结构：全图无修为类效果（人界无进阶）；hub 每个 action 必带 time（快进=烧命）；温养 gated injury>0 且 -50；坐化传道任意时刻可见', () => {
  // 人界无进阶：ch7 全图不得出现 cultivation 效果
  const check = (fx, where) => (fx || []).forEach((e) => {
    assert.ok(!(e.type === 'res' && e.key === 'cultivation'), '终章不得有修为效果: ' + where);
  });
  for (const id of Object.keys(FC.CH7.graph)) {
    const n = FC.CH7.graph[id];
    check(n.effects, id);
    for (const c of n.choices || []) check(c.effects, id + '#choice');
    for (const a of n.actions || []) check(a.effects, id + '#action');
  }
  // hub 行动必带 time
  for (const id of ['ch7_hub', 'ch7_膜隙']) {
    for (const a of FC.CH7.graph[id].actions) {
      const hasTime = (a.effects || []).some((e) => e.type === 'time' && e.days > 0);
      assert.ok(hasTime, id + ' 的行动「' + a.label + '」缺 time（快进=烧命）');
    }
  }
  // 温养：gated injury>0，效果 -50
  const heal = FC.CH7.graph['ch7_hub'].actions.find((a) => a.label.indexOf('温养') >= 0);
  assert.ok(heal, 'hub 应有温养行动');
  assert.equal(heal.show(FC.State.create('李恒')), false, '伤势 0 不得见温养');
  const hurt = FC.State.create('李恒'); hurt.injury = 40;
  assert.equal(heal.show(hurt), true, '带伤应见温养');
  const inj = heal.effects.find((e) => e.type === 'res' && e.key === 'injury');
  assert.ok(inj && inj.delta === -50, '温养应 injury-50');
  // 坐化传道任意时刻可见
  const legacy = FC.CH7.graph['ch7_hub'].actions.find((a) => a.label.indexOf('坐化') >= 0);
  assert.ok(legacy, 'hub 应有坐化传道行动');
  assert.equal(legacy.show(FC.State.create('李恒')), true, '坐化传道任意时刻可见');
  assert.equal(legacy.show(Object.assign(FC.State.create('李恒'), { flags: { mortal_limit: true }, lifespanYears: 50 })), true, '坐化传道大限时亦可见');
});

// ———— 走查 A·集齐飞升 ————

test('走查 A·集齐飞升：神念三问（揭仙路尽头主题）→ 授图 → 取钉（膜漏转急）→ 接天阙点数三宝三钥 → 登台破界 → ending_ascend terminal（留白、落款）；时间账精确', () => {
  const s = freshState();
  reachCh7(s);
  const lifeHub = s.lifespanYears;
  // 西行观膜
  step(s, '西行观膜（西极天垠，界膜薄弱点）');
  assert.equal(s.nodeId, 'ch7_膜隙');
  // 未听神念：不得取钉
  let v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('叩灯问神念') >= 0), '未听神念应见叩灯');
  assert.ok(!v.choices.some((c) => c.label.indexOf('细取界膜钉') >= 0), '未听神念不得见取钉');
  // 神念三问
  step(s, '叩灯问神念（守灯人的传承）');
  assert.equal(s.nodeId, 'ch7_神念一');
  step(s, '问：仙路的尽头，是什么');
  assert.equal(s.nodeId, 'ch7_神念二');
  assert.match(FC.Engine.view(s, G()).text, /仙路尽头/, '神念应揭仙路尽头主题');
  step(s, '问：界外，是什么样子');
  assert.equal(s.nodeId, 'ch7_神念三');
  step(s, '问：当年台开，您为何不走');
  step(s, '双手受图');
  assert.equal(s.nodeId, 'ch7_神念授图');
  step(s, '继续');
  assert.equal(s.flags.ch7_shinian_heard, true, '听完应落定 heard 旗');
  assert.equal(s.inventory['飞升台图录'], 1, '授图应得飞升台图录');
  assert.equal(s.nodeId, 'ch7_膜隙');
  // 取钉
  v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('细取界膜钉') >= 0), '听过神念应见取钉');
  step(s, '细取界膜钉（三月苦功，续膜拔钉）');
  assert.equal(s.nodeId, 'ch7_取钉');
  step(s, '继续');
  assert.equal(s.inventory['界膜钉'], 1, '取钉应得界膜钉');
  assert.equal(s.flags.ch7_nail_pulled, true, '拔钉应落定拔钉旗');
  assert.equal(s.nodeId, 'ch7_膜隙');
  const tMembrane = FC.CH7.graph['ch7_膜隙'].text(s);
  assert.match(tMembrane, /漏得急|破口/, '拔钉后膜隙应见膜漏转急');
  // 回坊市 → 赴台
  step(s, '回青石坊市（大限岁月）');
  assert.equal(s.nodeId, 'ch7_hub');
  const tHub = FC.Engine.view(s, G()).text;
  assert.match(tHub, /图录|接天/, '持图录后 hub 应见台线索');
  step(s, '循图录赴上古飞升台（章末登台）');
  assert.equal(s.nodeId, 'ch7_飞升台');
  const tAltar = FC.Engine.view(s, G()).text;
  assert.match(tAltar, /接天/, '飞升台应含接天阙');
  assert.match(tAltar, /界纹玉钥|星核髓|通天令/, '台上应点数三钥');
  // 登台破界
  v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('登台破界') >= 0), '三宝三钥齐应见登台');
  step(s, '登台破界（人界篇终）');
  assert.equal(s.nodeId, 'ending_ascend', '集齐应至飞升结局');
  assert.equal(s.flags.ch7_ascend_way, '台', '台路应落定破界方式');
  const tEnd = FC.Engine.view(s, G()).text;
  assert.equal(FC.Engine.view(s, G()).choices.length, 0, 'ending_ascend 应为 terminal（无选项）');
  assert.match(tEnd, /没有人回来说过|留白/, '应留白灵界');
  assert.match(tEnd, /终章《大限》终/, '应有终章落款');
  assert.match(tEnd, /人界篇/, '应有人界篇终标记');
  // 时间账：30+1+90+30+30=181 天
  assert.ok(Math.abs((lifeHub - s.lifespanYears) - 181 / 365) < 1e-9, '集齐路时间账应精确 181 天，实际 ' + (lifeHub - s.lifespanYears));
  assert.ok(s.lifespanYears > 0, '集齐路不得烧死');
});

// ———— 神念与界膜钉分支 ————

test('神念分支：问一半退去可再来；辞图者闻道而无图（heard 落定、无图录、hub 不启台）；取钉照开', () => {
  const s = freshState();
  reachCh7(s);
  step(s, '西行观膜（西极天垠，界膜薄弱点）');
  step(s, '叩灯问神念（守灯人的传承）');
  assert.equal(s.nodeId, 'ch7_神念一');
  step(s, '不问，朝灯长揖，退出去');
  assert.equal(s.nodeId, 'ch7_膜隙');
  assert.ok(!s.flags.ch7_shinian_heard, '问一半退去不算闻道');
  assert.ok(FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('叩灯问神念') >= 0), '可再来叩灯');
  // 二访：问到底但辞图
  step(s, '叩灯问神念（守灯人的传承）');
  step(s, '问：仙路的尽头，是什么');
  step(s, '问：界外，是什么样子');
  step(s, '问：当年台开，您为何不走');
  step(s, '不受，只把话带走');
  assert.equal(s.nodeId, 'ch7_神念辞图');
  step(s, '继续');
  assert.equal(s.flags.ch7_shinian_heard, true, '辞图亦算闻道');
  assert.ok(!(s.inventory['飞升台图录'] > 0), '辞图不得有图录');
  step(s, '细取界膜钉（三月苦功，续膜拔钉）');
  step(s, '继续');
  assert.equal(s.inventory['界膜钉'], 1, '辞图者仍可取钉');
  step(s, '回青石坊市（大限岁月）');
  const v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label.indexOf('循图录赴上古飞升台') >= 0), '无图录不得赴台');
  assert.ok(v.choices.some((c) => c.label.indexOf('坐化') >= 0), '无图录者坐化路常在');
  assert.ok(v.choices.some((c) => c.label.indexOf('西行观膜') >= 0), '无图录者硬撼路仍开');
});

// ———— 走查 B·硬撼两路 ————

test('走查 B·硬撼：门槛（寿元≥300 且 injury=0，否则可见不可选）；首撼必挫（injury+99、寿元-100 精确、白痕）；养伤复撼必破 → ending_ascend（撼路）', () => {
  const s = freshState();
  reachCh7(s);
  step(s, '坐关温养（行气守拙，伤势渐复）'); drain(s);
  assert.equal(s.injury, 0, '温养后应无伤（入章伤 20，-50 截 0）');
  step(s, '西行观膜（西极天垠，界膜薄弱点）');
  // 门槛矩阵
  const vein = () => FC.Engine.view(s, G()).choices.find((c) => c.label.indexOf('硬撼界膜') >= 0);
  assert.ok(vein(), '硬撼选项应可见');
  s.injury = 1;
  assert.equal(vein().enabled, false, '带伤应不可选');
  const r0 = FC.Engine.choose(s, G(), pick(s, '硬撼界膜（倾尽全力，搏一线天）'));
  assert.deepEqual(r0, { ok: false, reason: 'disabled' }, '带伤硬撼应被拒');
  s.injury = 0;
  s.lifespanYears = 299.9;
  assert.equal(vein().enabled, false, '寿元不足三百应不可选');
  s.lifespanYears = 300;
  assert.equal(vein().enabled, true, '寿元三百、伤势归零应可选');
  // 首撼必挫（门槛矩阵后恢复账面，免复撼门槛被 -100 卡死）
  s.lifespanYears = 1100;
  const life0 = s.lifespanYears;
  step(s, '硬撼界膜（倾尽全力，搏一线天）');
  assert.equal(s.nodeId, 'ch7_撼膜');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch7_撼膜受挫', '首撼必挫');
  const tFail = FC.Engine.view(s, G()).text;
  assert.match(tFail, /白痕/, '受挫文应留白痕（再撼的凭据）');
  assert.ok(!s.flags.ch7_ascend_way, '受挫不得落定破界方式');
  // 引擎时序：节点效果在离开时结算——伤与寿的账，在离开受挫后落定
  step(s, '继续');
  assert.equal(s.nodeId, 'ch7_膜隙');
  assert.equal(s.injury, 99, '首撼应 injury+99（0→99）');
  assert.ok(Math.abs((life0 - s.lifespanYears) - (100 + 1 / 365)) < 1e-9, '首撼应寿元 -100 再加撼前一日，实际 ' + (life0 - s.lifespanYears));
  assert.equal(s.karma.ch7_mem_struck, 1, '首撼应记一击');
  // 撼后门槛：带伤不可选
  assert.equal(vein().enabled, false, '重伤后硬撼应不可选');
  // 养伤两轮 → 复撼必破
  step(s, '回青石坊市（大限岁月）');
  step(s, '坐关温养（行气守拙，伤势渐复）'); drain(s);
  step(s, '坐关温养（行气守拙，伤势渐复）'); drain(s);
  assert.equal(s.injury, 0, '两轮温养应归零伤');
  step(s, '西行观膜（西极天垠，界膜薄弱点）');
  assert.equal(vein().enabled, true, '养好后硬撼应可选');
  step(s, '硬撼界膜（倾尽全力，搏一线天）');
  assert.equal(s.nodeId, 'ch7_撼膜');
  const tSecond = FC.Engine.view(s, G()).text;
  assert.match(tSecond, /白痕/, '复撼文应指向旧痕');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch7_撼膜破界', '复撼必破');
  step(s, '继续');
  assert.equal(s.nodeId, 'ending_ascend', '硬撼成应同飞升结局');
  assert.equal(s.flags.ch7_ascend_way, '撼', '撼路应落定破界方式');
  const tEnd = FC.Engine.view(s, G()).text;
  assert.equal(FC.Engine.view(s, G()).choices.length, 0, 'ending_ascend 应为 terminal');
  assert.match(tEnd, /没有人回来说过|留白/, '应留白灵界');
  assert.match(tEnd, /终章《大限》终/, '应有终章落款');
  assert.equal(s.karma.ch7_mem_struck, 2, '两撼应记两击');
});

test('飞升台缺宝：有图录无钉（或无钥）时登台不可见、缺项点名、却步可回 hub', () => {
  cleanSave();
  const s = FC.State.create('李恒');
  s.cultivation = 19; s.flags.mortal_limit = true; s.lifespanYears = 900;
  s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
  s.inventory['飞升台图录'] = 1; // 有图录、无钉
  s.nodeId = 'ch7_飞升台';
  let v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label.indexOf('登台破界') >= 0), '缺钉不得登台');
  assert.ok(v.choices.some((c) => c.label.indexOf('却步') >= 0), '却步应在');
  const t = v.text;
  assert.match(t, /界膜钉/, '缺项应点名界膜钉');
  step(s, '却步：宝不齐，改日再来');
  assert.equal(s.nodeId, 'ch7_hub', '却步应回大限岁月');
  // 缺钥态
  cleanSave();
  const s2 = FC.State.create('李恒');
  s2.cultivation = 19; s2.flags.mortal_limit = true; s2.lifespanYears = 900;
  s2.flags.key_jade = true; s2.flags.key_core = true; // 缺通天令
  s2.inventory['飞升台图录'] = 1; s2.inventory['界膜钉'] = 1;
  s2.nodeId = 'ch7_飞升台';
  v = FC.Engine.view(s2, G());
  assert.ok(!v.choices.some((c) => c.label.indexOf('登台破界') >= 0), '缺钥不得登台');
  assert.match(v.text, /通天令/, '缺项应点名通天令');
});

// ———— 走查 C·坐化传道 ————

test('走查 C·坐化传道：确认 → ending_legacy terminal（青牛/张铁/散尽功力/灵根少年/落款在文）；拒绝 → 回 hub 可继续', () => {
  const s = freshState();
  reachCh7(s);
  step(s, '坐化传道（散尽功力，了此残躯）');
  assert.equal(s.nodeId, 'ch7_坐化抉择');
  const t = FC.Engine.view(s, G()).text;
  assert.match(t, /散尽功力|坐化/, '抉择文应含坐化要素');
  assert.ok(FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('再走走看') >= 0), '应可拒绝');
  step(s, '再走走看（大限未至，账未记完）');
  assert.equal(s.nodeId, 'ch7_hub', '拒绝应回大限岁月');
  // 二度择定
  step(s, '坐化传道（散尽功力，了此残躯）');
  step(s, '坐化。把这一身功力，散给天下的灵根少年');
  assert.equal(s.nodeId, 'ending_legacy', '确认应至坐化结局');
  const tEnd = FC.Engine.view(s, G()).text;
  assert.equal(FC.Engine.view(s, G()).choices.length, 0, 'ending_legacy 应为 terminal（无选项）');
  assert.match(tEnd, /青牛/, '灵根少年的名字应取自张铁的村子（青牛）');
  assert.match(tEnd, /张铁/, '应回扣张铁');
  assert.match(tEnd, /散尽功力|散功/, '应含散尽功力定死要素');
  assert.match(tEnd, /灵根.{0,6}少年|少年.{0,6}灵根/, '应含灵根少年');
  assert.match(tEnd, /气起于踵/, '传道应传本门口诀');
  assert.match(tEnd, /终章《大限》终/, '应有终章落款');
  assert.match(tEnd, /人界篇/, '应有人界篇终标记');
  // 死后不走死亡流程：仍是存活状态（terminal，非 death）
  assert.equal(FC.State.isDead(s), false, '坐化结局不得走死亡流程');
});

// ———— 走查 D·倒计时老死 ————

test('走查 D·倒计时老死：百年闭关烧命至寿元归零 dead=\'lifespan\'；deathText 寿终档含张铁/李师姐生平句、无顶罪被救句；检查点仍 ch7_start 存活且寿元为入章原值', () => {
  const s = freshState();
  reachCh7(s);
  // 入章原值：ch7_start 检查点（写于跨入 ch7_start 时，先于任何终章时间）
  const checkpointLife = FC.Save.load('checkpoint').lifespanYears;
  assert.ok(checkpointLife > 0, '检查点应有寿元');
  // —— 烧命：百年闭关直至寿元归零 ——
  let strikes = 0;
  while (!FC.State.isDead(s) && strikes < 40) {
    stepMaybeDead(s, '百年闭关（一出关，人间已换）');
    drain(s);
    strikes++;
    assert.ok(s.nodeId === 'ch7_hub' || FC.State.isDead(s), '闭关后应回 hub: ' + s.nodeId);
  }
  assert.equal(s.dead, 'lifespan', '寿元归零应老死');
  assert.ok(strikes >= 8 && strikes <= 20, '烧命次数应合理（寿元千余）: ' + strikes);
  // deathText：寿终档 + 默认档生平段
  const t = FC.UI.deathText(s);
  assert.match(t, /寿元耗尽/, '应含寿终基本档');
  assert.match(t, /张铁/, '家书在档应含张铁句');
  assert.match(t, /师姐|戥子/, '遗物在档应含李师姐句');
  assert.ok(!/孙毅/.test(t), '默认档无顶罪因不得有孙毅句');
  assert.ok(!/渡口/.test(t), '默认档无被救句');
  // 检查点未被改写
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '检查点应存在');
  assert.equal(cp.nodeId, 'ch7_start', '检查点应为 ch7_start（复活点，不被老死改写）');
  assert.equal(FC.State.isDead(cp), false, '检查点必须是存活进度');
  assert.ok(Math.abs(cp.lifespanYears - checkpointLife) < 1e-9, '检查点寿元不得被烧命改写');
  // 死亡状态写检查点被拒
  const rr = FC.Save.save(s, 'checkpoint');
  assert.deepEqual(rr, { ok: false, reason: 'dead' }, '死亡状态写检查点应被 Save 层拒绝');
});

test('deathText 寿终档生平段：took_blame 与 saved_mortals 两存档结尾文不同；要素无则不出现（裸档=基本档原文）', () => {
  const base = (s) => { s.dead = 'lifespan'; return s; };
  const bare = FC.UI.deathText(base(FC.State.create('李恒')));
  assert.match(bare, /寿元耗尽/, '裸档应含寿终基本档');
  assert.equal(bare, FC.UI._DEATH_TEXTS.lifespan, '裸档生平段应无一句（要素无则不出现）');
  const sBlame = base(FC.State.create('李恒'));
  sBlame.karma.took_blame = 1;
  const tBlame = FC.UI.deathText(sBlame);
  assert.match(tBlame, /孙毅|担草|顶/, '顶罪者存档应含顶罪句');
  assert.ok(!/渡口/.test(tBlame), '顶罪档不应含被救句');
  const sSaved = base(FC.State.create('李恒'));
  sSaved.karma.saved_mortals = 1;
  const tSaved = FC.UI.deathText(sSaved);
  assert.match(tSaved, /渡口|香火|护下/, '被救者存档应含被救句');
  assert.ok(!/孙毅/.test(tSaved), '被救档不应含顶罪句');
  assert.notEqual(tBlame, tSaved, 'took_blame 与 saved_mortals 两存档结尾文不同');
  // 张铁存亡三态
  const sLetter = base(FC.State.create('李恒'));
  sLetter.inventory['张铁的家书'] = 1;
  const tLetter = FC.UI.deathText(sLetter);
  assert.match(tLetter, /张铁/, '家书档应含张铁句');
  const sMerchant = base(FC.State.create('李恒'));
  sMerchant.flags.ch3_tie_merchant = true;
  const tMerchant = FC.UI.deathText(sMerchant);
  assert.match(tMerchant, /张铁/, '行商档应含张铁句');
  assert.notEqual(tLetter, tMerchant, '张铁存亡两态结尾文不同');
  // 李师姐存亡
  const sRelic = base(FC.State.create('李恒'));
  sRelic.inventory['李师姐遗物'] = 1;
  const tRelic = FC.UI.deathText(sRelic);
  assert.match(tRelic, /师姐|戥子/, '遗物档应含李师姐句');
  const sLi = base(FC.State.create('李恒'));
  sLi.inventory['李师姐的锦囊'] = 1;
  const tLi = FC.UI.deathText(sLi);
  assert.notEqual(tRelic, tLi, '李师姐存亡两态结尾文不同');
  // 心魔
  const sDemon = base(FC.State.create('李恒'));
  sDemon.flags.inner_demon = true;
  const tDemon = FC.UI.deathText(sDemon);
  assert.match(tDemon, /魔种|心魔/, '心魔档应含魔种句');
  // 非寿终档不受生平段影响
  const sCombat = FC.State.create('李恒'); sCombat.dead = 'combat';
  assert.equal(FC.UI.deathText(sCombat), FC.UI._DEATH_TEXTS.combat, '非寿终档仍为基本档原文');
});

// ———— 渲染回归（悬空分号防线）————

test('渲染回归：各节点关键句逐段在正文（字符串拼接链完整、无悬空分号截断）', () => {
  const s0 = FC.State.create('李恒');
  s0.cultivation = 19; s0.flags.mortal_limit = true; s0.lifespanYears = 900;
  assert.match(FC.CH7.graph['ch7_start'].text(s0), /只减不增/, 'ch7_start 关键句');
  assert.match(FC.CH7.graph['ch7_付薪'].text(s0), /薪/, '付薪关键句');
  assert.match(FC.CH7.graph['ch7_hub'].text(s0), /大限/, 'hub 关键句');
  assert.match(FC.CH7.graph['ch7_膜隙'].text(s0), /界膜/, '膜隙关键句');
  assert.match(FC.CH7.graph['ch7_神念一'].text(s0), /仙路尽头|灯/, '神念一关键句');
  assert.match(FC.CH7.graph['ch7_神念二'].text(s0), /界外|灯/, '神念二关键句');
  assert.match(FC.CH7.graph['ch7_神念三'].text(s0), /台|守/, '神念三关键句');
  const sAtlas = FC.State.create('李恒');
  assert.match(FC.CH7.graph['ch7_神念授图'].text(sAtlas), /图录|兽皮/, '授图关键句');
  assert.match(FC.CH7.graph['ch7_神念辞图'].text(sAtlas), /灯|图/, '辞图关键句');
  assert.match(FC.CH7.graph['ch7_取钉'].text(sAtlas), /界膜钉|钉/, '取钉关键句');
  assert.match(FC.CH7.graph['ch7_撼膜'].text(sAtlas), /膜|撼/, '撼膜关键句');
  assert.match(FC.CH7.graph['ch7_撼膜受挫'].text(sAtlas), /白痕|还手/, '受挫关键句');
  assert.match(FC.CH7.graph['ch7_撼膜破界'].text(sAtlas), /裂|界/, '破界关键句');
  assert.match(FC.CH7.graph['ch7_飞升台'].text(sAtlas), /接天|台/, '飞升台关键句');
  assert.match(FC.CH7.graph['ch7_坐化抉择'].text(sAtlas), /坐化|功力/, '坐化抉择关键句');
  const tAscend = FC.CH7.graph['ending_ascend'].text(sAtlas);
  assert.match(tAscend, /终章《大限》终/, '飞升结局落款');
  const sLegacy = FC.State.create('李恒');
  sLegacy.inventory['李师姐遗物'] = 1; sLegacy.inventory['张铁的家书'] = 1;
  assert.match(FC.CH7.graph['ending_legacy'].text(sLegacy), /青牛/, '坐化结局青牛句');
});

// ———— 文面体检 ————

test('文面体检：终章正文无英文杂字、双引号成对、无常见繁体字', () => {
  const probes = [];
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    s.cultivation = 19; s.flags.mortal_limit = true; s.lifespanYears = 900;
    fn(s);
    return s;
  };
  probes.push(crafted(() => {}));
  probes.push(crafted((s) => {
    s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
    s.inventory['界纹玉钥'] = 1; s.inventory['星核髓'] = 1; s.inventory['通天令'] = 1;
    s.inventory['婴变古卷'] = 1; s.inventory['李师姐遗物'] = 1; s.inventory['张铁的家书'] = 1;
    s.flags.inner_demon = true; s.karma.saved_mortals = 1; s.karma.took_blame = 1; s.karma.cold_blood = 1;
    s.inventory['飞升台图录'] = 1; s.inventory['界膜钉'] = 1;
    s.flags.ch7_shinian_heard = true; s.flags.ch7_nail_pulled = true; s.injury = 20; s.day = 40000;
  }));
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.inventory['界膜钉'] = 1; s.flags.ch7_nail_pulled = true; }));
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.karma.ch7_mem_struck = 1; s.injury = 99; }));
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.inventory['飞升台图录'] = 1; s.flags.ch7_ascend_way = '台'; }));
  probes.push(crafted((s) => { s.flags.ch7_ascend_way = '撼'; s.karma.ch7_mem_struck = 2; }));
  probes.push(crafted((s) => { s.lifespanYears = 450; }));
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.inventory['飞升台图录'] = 1; s.inventory['界膜钉'] = 1; }));
  const TRAD = /[們這裡來過時說後個於為麼沒開門見當錢賬廢髮歲禮義樂無發應該當歸餘額風飛雲馬鳥龍門長東車貝見貝]/;
  for (const id of Object.keys(FC.CH7.graph)) {
    const n = FC.CH7.graph[id];
    if (typeof n.text !== 'function' && typeof n.text !== 'string') continue;
    const texts = [];
    if (typeof n.text === 'function') {
      for (const st of probes) {
        try { texts.push(String(n.text(st) || '')); } catch (e) { /* 探测态缺字段，跳过 */ }
      }
    } else texts.push(String(n.text || ''));
    for (const t of texts) {
      const eng = t.match(/[A-Za-z]+/g);
      assert.ok(!eng, id + ' 正文混入英文杂字: ' + (eng || []).join(','));
      const lq = (t.match(/“/g) || []).length;
      const rq = (t.match(/”/g) || []).length;
      assert.equal(lq, rq, id + ' 双引号不配对（开 ' + lq + ' 闭 ' + rq + '）');
      const trad = t.match(TRAD);
      assert.ok(!trad, id + ' 正文混入繁体: ' + (trad || []).join(''));
    }
  }
});

// ———— 字数 ————

test('字数统计：终章正文（各节点 text 并集）+ 选项文案合计 ≥15000 字', () => {
  const probes = [];
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    s.cultivation = 19; s.flags.mortal_limit = true; s.lifespanYears = 900;
    fn(s);
    return s;
  };
  probes.push(crafted(() => {}));
  probes.push(crafted((s) => { // 开局·全承接态
    s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
    s.inventory['界纹玉钥'] = 1; s.inventory['星核髓'] = 1; s.inventory['通天令'] = 1;
    s.inventory['婴变古卷'] = 1; s.inventory['李师姐遗物'] = 1; s.inventory['张铁的家书'] = 1;
    s.flags.inner_demon = true; s.karma.saved_mortals = 1; s.karma.took_blame = 1; s.karma.cold_blood = 1;
    s.lingshi = 80; s.day = 40000;
  }));
  probes.push(crafted((s) => { s.lifespanYears = 450; })); // 低账面态
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; })); // 闻道态
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.inventory['飞升台图录'] = 1; })); // 持图态
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.inventory['飞升台图录'] = 1; s.inventory['界膜钉'] = 1; s.flags.ch7_nail_pulled = true; })); // 集齐态
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.karma.ch7_mem_struck = 1; s.injury = 99; })); // 撼后态
  probes.push(crafted((s) => { s.flags.ch7_shinian_heard = true; s.karma.ch7_mem_struck = 2; })); // 复撼态
  probes.push(crafted((s) => { // 飞升台·齐备态
    s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
    s.inventory['飞升台图录'] = 1; s.inventory['界膜钉'] = 1;
    s.flags.ch7_ascend_way = '台';
  }));
  probes.push(crafted((s) => { s.flags.ch7_ascend_way = '撼'; s.karma.ch7_mem_struck = 2; })); // 飞升·撼路态
  probes.push(crafted((s) => { s.inventory['李师姐遗物'] = 1; s.inventory['张铁的家书'] = 1; })); // 坐化·全承接态
  probes.push(crafted((s) => { s.flags.inner_demon = true; })); // 心魔态
  const graph = FC.CH7.graph;
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
  assert.ok(sum >= 15000, '终章字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 40000, '终章字数失控: ' + sum);
});
