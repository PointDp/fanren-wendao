// 第六章《化神》测试（Task 6）：
//   1. FC.CH6 就绪：meta 定死值正确（chapter 6 / 化神 / ch6_start），节点 id 不与 ch1~ch5 冲突，章末 terminal
//   2. registry 合并：ch5_end（terminal）→ ch6_start 章际接线，FC.CH5 原件不改写，ch6_start 检查点注册，validate 全绿，幂等
//   3. 新道具登记（界纹玉钥/星核髓/通天令），图中引用物品全部在册
//   4. 开局承接：ch6_start 消费 ch5 出口（kurong_slain/婴变古卷/inner_demon/ch2_quanben）分支渲染互异；
//      灵气枯竭真相定死要素（上古大战/界膜/灵气外泄/仙路尽头先是荒芜）在两线（老祖洞府线/古籍线）均在文
//   5. 三钥条件分支：界纹玉钥（ch2_quanben 残页兑现外门自开；无全本硬撼 injury+30、复入不重扣不重发）；
//      星核髓（combat 稳/险两案，稳看境界、险看机缘，受挫 injury+35 可复探）；通天令（枯荣令炼化 -1/+1；心魔暗路 inner_demon）
//   6. 化神突破三路径：三钥齐→稳成；两钥+借枯荣遗泽→成但 injury+50；一钥以下燃寿→寿元-200
//      （带婴变古卷则成；无卷兵解不吞检查点；豁免走余波回抉择）
//   7. 突破门槛：直登化神台唯 cultivation===18 可见；闭关静修净 +80/层（time 730 + 显性 +82）
//   8. 化神成：进层至化神、寿元 +300 精确、mortal_limit=true；天地异象与大限钟声定死段落在文
//   9. 章末承接：ch6_end terminal、落款、mortal_limit 大限、心魔/枯荣令/通天令诸态
//  10. 渲染回归：关键句逐段在正文（悬空分号防线）
//  11. 字数 ≥25000
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
require('../js/content/registry.js');
const FC = globalThis.FC;

function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}
const G = () => FC.Content.graph; // 合并后全图（ch1 + ch2 + ch3 + ch4 + ch5 + ch6）

// —— 走查脚手架（与 ch5.test.mjs 同式）——
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

// —— 第一章走法（沿用 ch5.test.mjs 已验证路线）——
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

// —— 第二章走法（至 ch2_end；默认路线含 ch2_quanben 全本对照）——
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

// —— 第三章走法（定死走法，与 ch5.test.mjs 同式）——
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
  step(s, '继续'); // 别过 → 回乡
  step(s, '继续'); // 回乡 → 坟前
  drain(s); // 坟前 → 筑基岁月
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  step(s, '直面筑基关（章末）'); drain(s);
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵');
  assert.equal(s.nodeId, 'ch3_硬闯成');
  drainTo(s, 'ch4_入侵抉择');
}
function enterCh4(s) {
  drainTo(s, 'ch4_入侵抉择');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch4 应有章首检查点');
  assert.equal(cp.nodeId, 'ch4_start');
  assert.equal(FC.State.isDead(cp), false);
}

// —— 第四章尾（定死默认走法，开局结丹二）——
function ch4TailDefault(s) {
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）');
  assert.equal(s.nodeId, 'ch4_撤离');
  step(s, '继续'); // +30 → 旧账
  step(s, '继续'); // 旧账 → 师姐别（aff<4）
  step(s, '继续'); // 师姐别 → 流亡（遗物离开时入账）
  assert.equal(s.nodeId, 'ch4_流亡');
  assert.equal(s.inventory['李师姐遗物'], 1, '默认尾应带李师姐遗物');
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
}

// —— 第五章走法（定死默认走法：斗宝得卷 → 闭关百年 → 心魔了结 → 稳渡 → 再进 → 对决胜）——
function ch5Climb(s) {
  while (s.cultivation < 15) { step(s, '闭关静修（行气淬炼，结丹层数精进）'); drain(s); }
  assert.equal(s.cultivation, 15);
}
function ch5DouBao(s) {
  step(s, '佣斗夺宝（赏格与机缘，都在刀口上）');
  assert.equal(s.nodeId, 'ch5_初遇夺宝');
  step(s, '继续');
  assert.equal(s.inventory['婴变古卷'], 1, '初遇夺宝应得婴变古卷');
  assert.equal(s.karma.kurong_grudge, 1);
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

// —— 走到第六章（默认路线：元婴二层、枯荣令、婴变古卷、ch2_quanben、无心魔）——
function reachCh6(s, opts) {
  const o = Object.assign({ demon: false }, opts);
  ch1TailNightRoutes(s);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  ch4TailDefault(s);
  ch5Climb(s);
  ch5DouBao(s);
  ch5Century(s);
  if (o.demon) {
    step(s, '直面元婴关（章末）');
    assert.equal(s.nodeId, 'ch5_心魔劫');
    step(s, '闭门不出，把心魔锁在门外（逃避）');
    step(s, '继续');
    assert.equal(s.flags.inner_demon, true, '逃避应落定 inner_demon');
  } else {
    ch5XinmoClean(s, true);
  }
  assert.ok(!s.flags.inner_demon === !o.demon, 'inner_demon 应与走法一致');
  ch5Breakthrough(s);
  step(s, '乘势再进一层（元婴二层，寿元再添）');
  assert.equal(FC.REALMS[s.cultivation], '元婴二层');
  ch5DuelWin(s);
  step(s, '继续'); // ch5_end（章际接线）→ ch6_start
  drain(s);
  assert.equal(s.nodeId, 'ch6_元婴岁月', '应进入第六章 hub: ' + s.nodeId);
  assert.equal(s.cultivation, 17, '第六章开局应为元婴二层');
  assert.equal(FC.REALMS[s.cultivation], '元婴二层');
  assert.equal(s.flags.kurong_slain, true);
  assert.equal(s.inventory['枯荣令'], 1);
  assert.equal(s.inventory['婴变古卷'], 1);
  assert.ok(s.flags.ch2_quanben, '默认路线应带 ch2_quanben（界纹玉钥之钥）');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch6 应有章首检查点（途经 ch6_start 时已写）');
  assert.equal(cp.nodeId, 'ch6_start');
  assert.equal(FC.State.isDead(cp), false);
}
function ch1TailNightRoutes(s) {
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
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

// —— 第六章内的常规推进片段 ——
function ch6Scout(s) { // 打探遗府 → 传闻 → hub
  step(s, '打探通天遗府的来历（坊市旧闻与古籍）');
  assert.equal(s.nodeId, 'ch6_遗府传闻');
  const rumor = FC.Engine.view(s, G()).text;
  assert.match(rumor, /通天遗府/);
  assert.match(rumor, /界纹玉钥|星核髓|通天令/);
  step(s, '继续');
  assert.equal(s.flags.ch6_yifu_heard, true);
  assert.equal(s.nodeId, 'ch6_元婴岁月');
}
function ch6Climb(s) { // 攀至元婴三层（18）
  const life0 = s.lifespanYears;
  const cult0 = s.cultivation;
  while (s.cultivation < 18) { step(s, '闭关静修（行气淬炼，元婴层数精进）'); drain(s); }
  assert.equal(s.cultivation, cult0 + (18 - cult0));
  assert.ok(Math.abs((s.lifespanYears - life0) - (18 - cult0) * 80) < 1e-9, '闭关静修应净 +80 寿元/层');
}
function ch6Enter(s) { // 入府（默认全本线：外门自开）
  step(s, '遣赴坠星原，寻通天遗府（章末入府）');
  assert.equal(s.nodeId, 'ch6_遗府外门');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_外门自开', 'ch2_quanben 残页兑现应外门自开');
  assert.match(FC.Engine.view(s, G()).text, /气起于踵/, '残页兑现应含气起于踵');
  step(s, '继续');
  assert.equal(s.inventory['界纹玉钥'], 1);
  assert.equal(s.flags.key_jade, true);
  assert.equal(s.nodeId, 'ch6_遗府内庭');
}

// ———— 结构与注册 ————

test('FC.CH6 就绪：meta 定死值正确，ch6_start/ch6_end 存在且章末 terminal，节点 id 不与 ch1~ch5 冲突', () => {
  assert.ok(FC.CH6 && FC.CH6.graph, 'FC.CH6 未挂载');
  assert.equal(FC.CH6.meta.chapter, 6);
  assert.equal(FC.CH6.meta.title, '化神');
  assert.equal(FC.CH6.meta.checkpointNode, 'ch6_start');
  assert.ok(FC.CH6.graph.ch6_start, '缺入口 ch6_start');
  assert.ok(FC.CH6.graph.ch6_end, '缺章末 ch6_end');
  assert.equal(FC.CH6.graph.ch6_end.terminal, true, '章末应为 terminal 终局场景');
  const taken = new Set([...Object.keys(FC.CH1), ...Object.keys(FC.CH2.graph), ...Object.keys(FC.CH3.graph), ...Object.keys(FC.CH4.graph), ...Object.keys(FC.CH5.graph)]);
  for (const id of Object.keys(FC.CH6.graph)) {
    assert.ok(!taken.has(id), '节点 id 与前章冲突: ' + id);
  }
});

test('registry：CONTENT_SOURCES 预置 CH6；ch5_end → ch6_start 接线成立且不改写原件；ch6_start 检查点注册；幂等；validate 全绿', () => {
  assert.ok(FC.CONTENT_SOURCES.indexOf('CH6') >= 0, 'CONTENT_SOURCES 应预置 CH6');
  const g = G();
  for (const id of Object.keys(FC.CH6.graph)) assert.ok(g[id], 'ch6 节点丢失: ' + id);
  assert.equal(g['ch5_end'].goto, 'ch6_start', '合并图应把 ch5_end 接到 ch6_start');
  assert.equal(FC.CH5.graph['ch5_end'].goto, undefined, 'FC.CH5 原件不得被改写');
  assert.equal(FC.CH5.graph['ch5_end'].terminal, true, 'FC.CH5 原件保持章末终局标记');
  assert.ok(FC.Engine._checkpointNodes.has('ch6_start'), 'registry 应注册 ch6_start 检查点');
  const before = Object.keys(g).length;
  const cpBefore = FC.Engine._checkpointNodes.size;
  FC.ContentRegistry.register();
  FC.ContentRegistry.register();
  assert.equal(Object.keys(G()).length, before, '重复注册不得新增节点');
  assert.equal(FC.Engine._checkpointNodes.size, cpBefore, '重复注册不得新增检查点');
  const r = FC.Test.validate(G());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('新道具登记（界纹玉钥/星核髓/通天令），且 ch6 图中引用的所有物品都有登记', () => {
  for (const id of ['界纹玉钥', '星核髓', '通天令']) {
    assert.ok(FC.ITEMS[id], '物品未登记: ' + id);
  }
  const items = new Set();
  const scan = (fx) => (fx || []).forEach((e) => { if (e.type === 'item') items.add(e.id); });
  for (const id of Object.keys(FC.CH6.graph)) {
    const n = FC.CH6.graph[id];
    scan(n.effects);
    for (const c of n.choices || []) scan(c.effects);
    for (const a of n.actions || []) scan(a.effects);
  }
  for (const id of items) assert.ok(FC.ITEMS[id], '图中引用未登记物品: ' + id);
  assert.ok(items.has('界纹玉钥') && items.has('星核髓') && items.has('通天令'), '三钥道具都应被剧情效果引用');
});

// ———— 开局承接（ch5 出口消费）———

test('开局承接：ch6_start 消费 ch5 出口（kurong_slain/婴变古卷/inner_demon/ch2_quanben/元婴层数）分支渲染互异；灵气枯竭真相定死要素两线均在文', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.cultivation = 17; fn(s); return s; };
  const tBase = FC.CH6.graph['ch6_start'].text(mk(() => {}));
  const tKuron = FC.CH6.graph['ch6_start'].text(mk((s) => { s.flags.kurong_slain = true; }));
  const tScroll = FC.CH6.graph['ch6_start'].text(mk((s) => { s.flags.kurong_slain = true; s.inventory['婴变古卷'] = 1; }));
  const tDemon = FC.CH6.graph['ch6_start'].text(mk((s) => { s.flags.kurong_slain = true; s.flags.inner_demon = true; }));
  const tQuanben = FC.CH6.graph['ch6_start'].text(mk((s) => { s.flags.kurong_slain = true; s.flags.ch2_quanben = 1; }));
  const tOne = FC.CH6.graph['ch6_start'].text(mk((s) => { s.cultivation = 16; }));
  assert.ok(tBase.length > 900, '开局正文应有实文');
  // 真相定死要素：两线（老祖洞府线/古籍线）均在文
  for (const [nm, t] of [['老祖洞府线', tKuron], ['古籍线', tBase]]) {
    assert.match(t, /上古大战/, nm + '应含上古大战');
    assert.match(t, /界膜/, nm + '应含界膜');
    assert.match(t, /外泄/, nm + '应含灵气外泄');
    assert.match(t, /仙路尽头/, nm + '应含仙路尽头');
    assert.match(t, /荒芜/, nm + '应含荒芜');
  }
  assert.notEqual(tBase, tKuron, '老祖洞府线应改变开局正文');
  assert.notEqual(tKuron, tScroll, '古卷在手应改变开局正文');
  assert.match(tScroll, /古卷|帛书/, '古卷态应提及古卷');
  assert.notEqual(tKuron, tDemon, '心魔隐患应改变开局正文');
  assert.match(tDemon, /魔种|心魔/, '心魔态应提及魔种');
  assert.notEqual(tKuron, tQuanben, '残页线应改变开局正文');
  assert.match(tQuanben, /气起于踵/, '残页态应提及气起于踵');
  assert.notEqual(tBase, tOne, '元婴一层开局应改变正文');
  assert.match(tOne, /元婴一层/, '一层态应显示元婴一层');
  assert.match(tKuron, /元婴二层/, '二层态应显示元婴二层');
});

// ———— 走查 A·主线：打探 → 攀层 → 自开得玉钥 → 星核稳取 → 炼化通天令 → 三钥稳成 → 大限钟声 → 章末 ————

test('走查 A：开局元婴二（枯荣令/古卷/全本承接）→ 打探（三钥传闻）→ 闭关攀层（净+80/层）→ 外门自开（气起于踵兑现，界纹玉钥）→ 星核稳取（星核髓+injury10）→ 炼化（枯荣令-1 通天令+1）→ 三钥唯稳成 → 化神成（化神、+300、mortal_limit）→ 大限钟声 → 章末 terminal', () => {
  const s = freshState();
  reachCh6(s);
  ch6Scout(s);
  ch6Climb(s);
  assert.equal(s.cultivation, 18);
  ch6Enter(s);
  // 星核：稳取（元婴三层必胜）
  const injA = s.injury;
  step(s, '探星宫，历练夺宝（星核之藏）');
  assert.equal(s.nodeId, 'ch6_星核夺宝');
  step(s, '稳取：以元婴神识缓蚀星傀阵眼，先断灵机');
  assert.equal(s.nodeId, 'ch6_星核得手');
  step(s, '继续');
  assert.equal(s.inventory['星核髓'], 1, '星核得手应得星核髓');
  assert.equal(s.flags.key_core, true);
  assert.equal(s.injury, Math.min(100, injA + 10), '星核得手应 injury+10');
  assert.equal(s.nodeId, 'ch6_遗府内庭');
  // 通天令：炼化枯荣令
  step(s, '以枯荣令为引，炼化通天令');
  assert.equal(s.nodeId, 'ch6_炼化通天令');
  assert.match(FC.Engine.view(s, G()).text, /枯荣|通天/);
  step(s, '继续');
  assert.equal(s.inventory['枯荣令'] || 0, 0, '炼化应耗去枯荣令');
  assert.equal(s.inventory['通天令'], 1, '炼化应得通天令');
  assert.equal(s.flags.key_token, true);
  assert.equal(s.nodeId, 'ch6_遗府内庭');
  // 三钥齐：唯稳成可见
  step(s, '直登化神台（章末突破）');
  assert.equal(s.nodeId, 'ch6_化神抉择');
  let v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label === '三钥齐备，以通天之礼稳破化神'), '三钥齐应见稳成');
  assert.ok(!v.choices.some((c) => c.label.indexOf('借枯荣遗泽') >= 0), '三钥齐不得见借泽');
  assert.ok(!v.choices.some((c) => c.label.indexOf('燃寿') >= 0), '三钥齐不得见燃寿');
  assert.ok(v.choices.some((c) => c.label.indexOf('暂且收步') >= 0), '缓一路常在');
  const lifeB = s.lifespanYears, cultB = s.cultivation, injB = s.injury;
  step(s, '三钥齐备，以通天之礼稳破化神');
  assert.equal(s.nodeId, 'ch6_化神成');
  assert.equal(s.flags.ch6_path, '稳成', '稳成应落定路径旗');
  const winText = FC.Engine.view(s, G()).text;
  assert.match(winText, /天地异象/, '化神成应含天地异象定死段');
  step(s, '继续'); // 效果离开时入账 → 大限钟声
  assert.equal(s.cultivation, cultB + 1, '化神成应进一层');
  assert.equal(FC.REALMS[s.cultivation], '化神', '应至人界顶点化神');
  assert.ok(Math.abs((s.lifespanYears - lifeB) - 300) < 1e-9, '化神成应寿元 +300，实际差 ' + (s.lifespanYears - lifeB));
  assert.equal(s.injury, injB, '稳成不得加伤');
  assert.equal(s.flags.mortal_limit, true, '化神成应置 mortal_limit');
  assert.equal(s.nodeId, 'ch6_大限钟声');
  const bell = FC.Engine.view(s, G()).text;
  assert.match(bell, /大限钟声/, '钟声定死段应在大限钟声节点');
  assert.match(bell, /九下|九声/, '钟声应有九响');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_end');
  assert.equal(FC.Engine.view(s, G()).choices.length, 0, '章末应为 terminal 终局（无选项）');
  assert.match(FC.Engine.view(s, G()).text, /第六章《化神》终/);
});

// ———— 走查 B·心魔线：暗路取令 → 两钥借泽（injury+50）→ 章末承接心魔 ————

test('走查 B：逃避落定 inner_demon → 入府 → 心魔暗路得通天令（不耗枯荣令、心魔不除）→ 两钥唯借泽 → 借泽闯关（injury+50）→ 化神成 → 章末承接心魔', () => {
  const s = freshState();
  reachCh6(s, { demon: true });
  ch6Scout(s);
  ch6Climb(s);
  ch6Enter(s);
  // 内庭：炼化与暗路并陈（持令+带魔）
  let v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('枯荣令为引') >= 0), '持令者应见炼化之路');
  assert.ok(v.choices.some((c) => c.label.indexOf('心魔为引') >= 0), '带心魔者应见暗路');
  step(s, '以心魔为引，行走阴脉暗路（遗府私路，以魔为灯）');
  assert.equal(s.nodeId, 'ch6_心魔暗路');
  const darkText = FC.Engine.view(s, G()).text;
  assert.match(darkText, /魔种|心魔/, '暗路正文应写心魔为引');
  step(s, '继续');
  assert.equal(s.inventory['通天令'], 1, '暗路应得通天令');
  assert.equal(s.flags.key_token, true);
  assert.equal(s.flags.ch6_dark_walk, true, '暗路应落定暗路旗（终章承接）');
  assert.equal(s.inventory['枯荣令'], 1, '暗路不得耗枯荣令');
  assert.equal(s.flags.inner_demon, true, '心魔不因暗路清除');
  assert.equal(s.nodeId, 'ch6_遗府内庭');
  // 令已在手，两路皆收口
  v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label.indexOf('枯荣令为引') >= 0), '得令后炼化应收口');
  assert.ok(!v.choices.some((c) => c.label.indexOf('心魔为引') >= 0), '得令后暗路应收口');
  // 两钥（玉钥+通天令，星核未取）→ 唯借泽可见
  step(s, '直登化神台（章末突破）');
  assert.equal(s.nodeId, 'ch6_化神抉择');
  v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label.indexOf('稳破化神') >= 0), '两钥不得见稳成');
  assert.ok(v.choices.some((c) => c.label.indexOf('借枯荣遗泽') >= 0), '两钥+枯荣遗泽应见借泽');
  assert.ok(!v.choices.some((c) => c.label.indexOf('燃寿') >= 0), '两钥+遗泽不得见燃寿');
  const injC = s.injury;
  step(s, '两钥借枯荣遗泽，以伤换关');
  assert.equal(s.nodeId, 'ch6_借泽闯关');
  step(s, '继续');
  assert.equal(s.injury, Math.min(100, injC + 50), '借泽应 injury+50');
  assert.equal(s.flags.ch6_path, '借泽');
  assert.equal(s.nodeId, 'ch6_化神成');
  const lifeC = s.lifespanYears, cultC = s.cultivation;
  step(s, '继续'); // 化神成效果离开时入账 → 大限钟声
  assert.equal(s.cultivation, cultC + 1, '借泽成应进一层');
  assert.ok(Math.abs((s.lifespanYears - lifeC) - 300) < 1e-9, '借泽成亦应寿元 +300');
  assert.equal(s.flags.mortal_limit, true, '借泽成亦应置 mortal_limit');
  assert.equal(s.nodeId, 'ch6_大限钟声');
  step(s, '继续'); // → 章末
  assert.equal(s.nodeId, 'ch6_end');
  const endText = FC.Engine.view(s, G()).text;
  assert.match(endText, /第六章《化神》终/);
  assert.match(endText, /魔种|心魔/, '章末应承接心魔隐患（终章伏笔）');
});

// ———— 走查 C·燃寿兵解（无古卷）：死亡不吞检查点；豁免走余波 ————

test('走查 C：燃寿-200 精确；无古卷兵解真死——检查点仍是 ch6_start 存活进度（寿元未被燃寿改写）、死亡写检查点被拒；豁免则余波续行回化神抉择', () => {
  // 预置章首检查点（等价于从 ch6_start 入章的存活进度）
  cleanSave();
  const seed = FC.State.create('李恒');
  seed.nodeId = 'ch6_start';
  seed.cultivation = 18;
  seed.lifespanYears = 500;
  seed.day = 40000;
  assert.equal(FC.Save.save(seed, 'checkpoint').ok, true);
  const s = JSON.parse(JSON.stringify(seed));
  s.flags.key_jade = true; // 一钥
  s.nodeId = 'ch6_燃寿硬闯';
  const life0 = s.lifespanYears;
  step(s, '继续'); // 燃寿硬闯 → 寿元-200 → 无古卷 → 燃寿兵解
  assert.equal(s.nodeId, 'ch6_燃寿兵解');
  assert.ok(Math.abs((s.lifespanYears - life0) - (-200)) < 1e-9, '燃寿应寿元 -200');
  step(s, '继续'); // 兵解 scene 离开时结算死亡
  assert.equal(s.dead, '兵解', '无古卷燃寿应兵解');
  assert.match(FC.UI.deathText(s), /兵解/);
  assert.ok(FC.Save.load('auto'), '死亡状态照常落 auto');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '章首检查点应存在');
  assert.equal(cp.nodeId, 'ch6_start', '检查点应为 ch6_start（复活点）');
  assert.equal(cp.day, seed.day, '检查点应为入章进度');
  assert.equal(cp.lifespanYears, 500, '检查点寿元不得被燃寿改写');
  assert.equal(FC.State.isDead(cp), false, '检查点必须是存活进度（兵解不吞）');
  const rr = FC.Save.save(s, 'checkpoint');
  assert.deepEqual(rr, { ok: false, reason: 'dead' }, '死亡状态写检查点应被 Save 层拒绝');
  // —— 豁免对照：重伤续行回化神抉择 ——
  cleanSave();
  const seed2 = FC.State.create('李恒');
  seed2.nodeId = 'ch6_start';
  seed2.cultivation = 18;
  seed2.lifespanYears = 500;
  FC.Save.save(seed2, 'checkpoint');
  const s2 = JSON.parse(JSON.stringify(seed2));
  s2.deathExempt = true;
  s2.flags.key_jade = true;
  s2.nodeId = 'ch6_燃寿硬闯';
  const life2 = s2.lifespanYears;
  step(s2, '继续');
  assert.equal(s2.nodeId, 'ch6_燃寿兵解');
  step(s2, '继续');
  assert.equal(s2.dead, null, '豁免下燃寿兵解应重伤续行');
  assert.equal(s2.injury, 100);
  assert.equal(s2.flags.cheated_death_兵解, true);
  assert.ok(Math.abs((s2.lifespanYears - life2) - (-200)) < 1e-9);
  assert.equal(s2.nodeId, 'ch6_燃寿余波');
  drain(s2);
  assert.equal(s2.nodeId, 'ch6_化神抉择', '燃寿余波应回化神抉择可再图');
});

// ———— 走查 D·一钥燃寿（带古卷则成）———

test('走查 D：一钥燃寿（带婴变古卷）——燃寿-200 精确、向死而生护神魂、化神成（+300、mortal_limit、净+100）', () => {
  const s = freshState();
  reachCh6(s);
  ch6Scout(s);
  ch6Climb(s);
  ch6Enter(s);
  // 一钥（玉钥在手；不取星核、不炼令）
  step(s, '直登化神台（章末突破）');
  assert.equal(s.nodeId, 'ch6_化神抉择');
  const v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('燃寿') >= 0), '一钥应见燃寿');
  assert.ok(!v.choices.some((c) => c.label.indexOf('借枯荣遗泽') >= 0), '一钥不得见借泽');
  assert.ok(!v.choices.some((c) => c.label.indexOf('稳破化神') >= 0), '一钥不得见稳成');
  const life0 = s.lifespanYears, cult0 = s.cultivation;
  step(s, '燃寿硬闯：以二百年寿元为薪，搏一线天');
  assert.equal(s.nodeId, 'ch6_燃寿硬闯');
  step(s, '继续');
  assert.ok(Math.abs((s.lifespanYears - life0) - (-200)) < 1e-9, '燃寿应寿元 -200');
  assert.equal(s.nodeId, 'ch6_化神成', '带婴变古卷燃寿应成');
  assert.equal(s.flags.ch6_path, '燃寿');
  const winText = FC.Engine.view(s, G()).text;
  assert.match(winText, /向死而生/, '古卷线燃寿成应含向死而生');
  step(s, '继续');
  assert.equal(s.cultivation, cult0 + 1);
  assert.equal(FC.REALMS[s.cultivation], '化神');
  assert.ok(Math.abs((s.lifespanYears - life0) - 100) < 1e-9, '燃寿成净 +100（-200+300）');
  assert.equal(s.flags.mortal_limit, true);
  assert.equal(s.nodeId, 'ch6_大限钟声');
});

// ———— 三钥条件分支（路由函数与战斗判定的裸态探针）———

test('遗府外门路由：key_jade 已得直入内庭；ch2_quanben 走自开；无全本破墙；破墙后复入直通——玉钥不重发、伤势不重扣', () => {
  const g = FC.CH6.graph;
  const s1 = FC.State.create('李恒'); s1.flags.key_jade = true;
  assert.equal(g['ch6_遗府外门'].goto(s1), 'ch6_遗府内庭');
  const s2 = FC.State.create('李恒'); s2.flags.ch2_quanben = 1;
  assert.equal(g['ch6_遗府外门'].goto(s2), 'ch6_外门自开');
  const s3 = FC.State.create('李恒');
  assert.equal(g['ch6_遗府外门'].goto(s3), 'ch6_外门硬撼');
  const s4 = FC.State.create('李恒'); s4.flags.ch6_wall_broken = true;
  assert.equal(g['ch6_遗府外门'].goto(s4), 'ch6_遗府内庭');
  // 引擎级复入：玉钥不重发
  const s = freshState();
  reachCh6(s);
  ch6Enter(s);
  step(s, '出府回养（回元婴岁月静修）'); drain(s);
  assert.equal(s.nodeId, 'ch6_元婴岁月');
  step(s, '遣赴坠星原，寻通天遗府（章末入府）');
  assert.equal(s.nodeId, 'ch6_遗府外门');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_遗府内庭', '已得玉钥者复入应直达内庭');
  assert.equal(s.inventory['界纹玉钥'], 1, '玉钥不得重发');
});

test('外门硬撼：无全本破墙 injury+30、破墙旗落定、无玉钥；复入不重扣', () => {
  const s = freshState();
  reachCh6(s);
  s.flags.ch2_quanben = false; // 剥离全本线（残页伏笔未兑现）
  ch6Scout(s);
  step(s, '遣赴坠星原，寻通天遗府（章末入府）');
  assert.equal(s.nodeId, 'ch6_遗府外门');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_外门硬撼', '无全本应走破墙');
  const inj0 = s.injury;
  step(s, '继续');
  assert.equal(s.injury, Math.min(100, inj0 + 30), '硬撼应 injury+30');
  assert.equal(s.flags.ch6_wall_broken, true, '破墙应落定破墙旗');
  assert.ok(!s.flags.key_jade, '无全本不得得玉钥');
  assert.equal(s.inventory['界纹玉钥'] || 0, 0);
  assert.equal(s.nodeId, 'ch6_遗府内庭');
  step(s, '出府回养（回元婴岁月静修）'); drain(s);
  step(s, '遣赴坠星原，寻通天遗府（章末入府）');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch6_遗府内庭', '破墙后复入应直达内庭');
  assert.equal(s.injury, Math.min(100, inj0 + 30), '复入不得重扣伤势');
});

test('星核历练：稳取看境界（17 判胜/16 判挫）、险取看机缘（30 判胜/0 判挫）；受挫 injury+35 挫旗落定可复探；得手不重复', () => {
  // 稳取@17 判胜（开局层即胜）
  cleanSave();
  const sW = FC.State.create('李恒');
  sW.cultivation = 17; sW.nodeId = 'ch6_星核夺宝';
  step(sW, '稳取：以元婴神识缓蚀星傀阵眼，先断灵机');
  assert.equal(sW.nodeId, 'ch6_星核得手');
  step(sW, '继续');
  assert.equal(sW.inventory['星核髓'], 1);
  assert.equal(sW.flags.key_core, true);
  assert.equal(sW.nodeId, 'ch6_遗府内庭');
  // 稳取@16 判挫 → 复探
  cleanSave();
  const sF = FC.State.create('李恒');
  sF.cultivation = 16; sF.nodeId = 'ch6_星核夺宝';
  step(sF, '稳取：以元婴神识缓蚀星傀阵眼，先断灵机');
  assert.equal(sF.nodeId, 'ch6_星核受挫');
  step(sF, '继续');
  assert.equal(sF.injury, 35, '受挫应 injury+35');
  assert.equal(sF.flags.ch6_core_tried, true, '受挫应落定挫旗');
  assert.equal(sF.nodeId, 'ch6_遗府内庭');
  // 险取@luck30 判胜；险取@luck0 判挫（险取不看境界）
  cleanSave();
  const sL = FC.State.create('李恒');
  sL.cultivation = 16; sL.luck = 30; sL.nodeId = 'ch6_星核夺宝';
  step(sL, '险取：搏阵势合拢前的一线，直取星核髓');
  assert.equal(sL.nodeId, 'ch6_星核得手');
  cleanSave();
  const sL2 = FC.State.create('李恒');
  sL2.cultivation = 18; sL2.nodeId = 'ch6_星核夺宝';
  step(sL2, '险取：搏阵势合拢前的一线，直取星核髓');
  assert.equal(sL2.nodeId, 'ch6_星核受挫', '险取不看境界只看机缘');
});

test('炼化通天令：枯荣令-1、通天令+1、key_token 置位；暗路正文与炼化正文互异且各含定死要素', () => {
  cleanSave();
  const s = FC.State.create('李恒');
  s.cultivation = 18; s.inventory['枯荣令'] = 1; s.nodeId = 'ch6_炼化通天令';
  step(s, '继续');
  assert.equal(s.inventory['枯荣令'] || 0, 0);
  assert.equal(s.inventory['通天令'], 1);
  assert.equal(s.flags.key_token, true);
  assert.equal(s.nodeId, 'ch6_遗府内庭');
  const s2 = FC.State.create('李恒');
  s2.flags.inner_demon = true;
  const tDark = FC.CH6.graph['ch6_心魔暗路'].text(s2);
  const tRefine = FC.CH6.graph['ch6_炼化通天令'].text(FC.State.create('李恒'));
  assert.ok(tDark.length > 400 && tRefine.length > 400, '两路正文都应有实文');
  assert.notEqual(tDark, tRefine);
  assert.match(tDark, /魔种|心魔/);
  assert.match(tRefine, /枯荣令|通天/);
});

// ———— 化神抉择：可见性矩阵 ————

test('化神抉择可见性矩阵：三钥唯稳成；两钥+令或老祖遗泽唯借泽；两钥无源与一钥以下唯燃寿；缓一路常在', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.cultivation = 18; s.nodeId = 'ch6_化神抉择'; fn(s); return s; };
  const labels = (s) => FC.Engine.view(s, G()).choices.map((c) => c.label);
  const has = (ls, k) => ls.some((l) => l.indexOf(k) >= 0);
  // 三钥齐
  const l3 = labels(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; }));
  assert.ok(has(l3, '稳破化神') && !has(l3, '借枯荣遗泽') && !has(l3, '燃寿'), '三钥齐唯稳成');
  assert.ok(has(l3, '暂且收步'), '缓一路常在');
  // 两钥+枯荣令（未炼化）
  const l2a = labels(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.inventory['枯荣令'] = 1; }));
  assert.ok(!has(l2a, '稳破化神') && has(l2a, '借枯荣遗泽') && !has(l2a, '燃寿'), '两钥+令唯借泽');
  // 两钥+老祖遗泽（无令）
  const l2b = labels(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; s.flags.kurong_slain = true; }));
  assert.ok(has(l2b, '借枯荣遗泽') && !has(l2b, '燃寿'), '两钥+遗泽唯借泽');
  // 两钥无遗泽源（角落态）：燃寿兜底可见，抉择不空
  const l2c = labels(mk((s) => { s.flags.key_jade = true; s.flags.key_core = true; }));
  assert.ok(has(l2c, '燃寿') && !has(l2c, '借枯荣遗泽'), '两钥无源兜底燃寿');
  // 一钥
  const l1 = labels(mk((s) => { s.flags.key_jade = true; }));
  assert.ok(has(l1, '燃寿') && !has(l1, '借枯荣遗泽') && !has(l1, '稳破化神'), '一钥唯燃寿');
  // 零钥
  const l0 = labels(mk(() => {}));
  assert.ok(has(l0, '燃寿') && has(l0, '暂且收步'), '零钥燃寿仍可走，缓一路常在');
});

// ———— 突破门槛与 hub 行动 ————

test('突破门槛：直登化神台唯 cultivation===18 可见（17 隐、19 隐）；闭关静修 18 层后收口', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.flags.ch6_yifu_heard = true; s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true; fn(s); return s; };
  const labels = (s) => FC.Engine.view(s, G()).choices.map((c) => c.label);
  const s17 = mk((s) => { s.cultivation = 17; s.nodeId = 'ch6_遗府内庭'; });
  assert.ok(!labels(s17).some((l) => l.indexOf('直登化神台') >= 0), '十七层不得见化神台');
  const s18 = mk((s) => { s.cultivation = 18; s.nodeId = 'ch6_遗府内庭'; });
  assert.ok(labels(s18).some((l) => l.indexOf('直登化神台') >= 0), '十八层应见化神台');
  const s19 = mk((s) => { s.cultivation = 19; s.nodeId = 'ch6_遗府内庭'; });
  assert.ok(!labels(s19).some((l) => l.indexOf('直登化神台') >= 0), '化神后不得再登台');
  // 闭关静修：18 层后收口
  const hub18 = FC.State.create('李恒');
  hub18.cultivation = 18; hub18.nodeId = 'ch6_元婴岁月';
  assert.ok(!labels(hub18).some((l) => l.indexOf('层数精进') >= 0), '十八层不得再精进');
  const hub17 = FC.State.create('李恒');
  hub17.cultivation = 17; hub17.nodeId = 'ch6_元婴岁月';
  assert.ok(labels(hub17).some((l) => l.indexOf('层数精进') >= 0), '十七层应可精进');
});

test('燃寿硬闯路由：带古卷去化神成、无卷去燃寿兵解（函数跳转目标皆在图）', () => {
  const g = FC.CH6.graph;
  const sScroll = FC.State.create('李恒'); sScroll.inventory['婴变古卷'] = 1;
  assert.equal(g['ch6_燃寿硬闯'].goto(sScroll), 'ch6_化神成');
  assert.equal(g['ch6_燃寿硬闯'].goto(FC.State.create('李恒')), 'ch6_燃寿兵解');
});

// ———— 化神成三路径正文与定死段落 ————

test('化神成三路径正文互异：稳成（通天之礼）/借泽（枯荣遗泽+50 伤）/燃寿（向死而生）；天地异象定死段三态均在文', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.cultivation = 18; fn(s); return s; };
  const tStable = FC.CH6.graph['ch6_化神成'].text(mk((s) => { s.flags.ch6_path = '稳成'; }));
  const tLegacy = FC.CH6.graph['ch6_化神成'].text(mk((s) => { s.flags.ch6_path = '借泽'; s.injury = 50; }));
  const tBurn = FC.CH6.graph['ch6_化神成'].text(mk((s) => { s.flags.ch6_path = '燃寿'; s.inventory['婴变古卷'] = 1; }));
  for (const [nm, t] of [['稳成', tStable], ['借泽', tLegacy], ['燃寿', tBurn]]) {
    assert.ok(t.length > 700, nm + '正文应有实文');
    assert.match(t, /天地异象/, nm + '应含天地异象定死段');
    assert.match(t, /化神/, nm + '应含化神');
  }
  assert.notEqual(tStable, tLegacy);
  assert.notEqual(tLegacy, tBurn);
  assert.match(tLegacy, /枯荣|遗泽/, '借泽线应含枯荣遗泽');
  assert.match(tBurn, /向死而生/, '燃寿线应含向死而生');
});

test('大限钟声定死段：mortal_limit 态下含钟声九响、只减不增、仙路尽头回扣；寿元显示含 +300 后数值', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.cultivation = 19; s.flags.mortal_limit = true; s.lifespanYears = 800; fn(s); return s; };
  const t = FC.CH6.graph['ch6_大限钟声'].text(mk(() => {}));
  assert.ok(t.length > 500, '钟声正文应有实文');
  assert.match(t, /大限钟声/);
  assert.match(t, /九下|九声/);
  assert.match(t, /只减不增/, '应有大限压迫（只减不增）');
  assert.match(t, /仙路尽头|荒芜/, '应回扣定死基调');
  assert.match(t, /八百|800/, '应显示寿元实数');
});

// ———— 章末承接 ————

test('章末承接：ch6_end terminal、落款、mortal_limit 大限、通天令/枯荣令/心魔/遗物诸态、界膜回扣', () => {
  const mk = (fn) => { const s = FC.State.create('李恒'); s.cultivation = 19; s.flags.mortal_limit = true; fn(s); return s; };
  const tBase = FC.CH6.graph['ch6_end'].text(mk(() => {}));
  assert.match(tBase, /第六章《化神》终/);
  assert.match(tBase, /化神/, '章末应显示化神');
  assert.match(tBase, /只减不增|大限/, '章末应有大限倒计时压迫');
  assert.match(tBase, /界膜|灵气/, '章末应回扣界膜与灵气');
  const tRefined = FC.CH6.graph['ch6_end'].text(mk((s) => { s.flags.key_token = true; s.inventory['通天令'] = 1; }));
  assert.match(tRefined, /通天令/, '炼化线章末应提及通天令');
  const tToken = FC.CH6.graph['ch6_end'].text(mk((s) => { s.inventory['枯荣令'] = 1; }));
  assert.match(tToken, /枯荣令/, '存令线章末应提及枯荣令');
  const tDemon = FC.CH6.graph['ch6_end'].text(mk((s) => { s.flags.inner_demon = true; }));
  assert.match(tDemon, /魔种|心魔/, '心魔线章末应埋终章伏笔');
  assert.notEqual(tBase, tDemon);
  const tItem = FC.CH6.graph['ch6_end'].text(mk((s) => { s.inventory['李师姐遗物'] = 1; }));
  assert.match(tItem, /戥子|师姐/, '遗物应在章末承接');
});

// ———— 渲染回归（悬空分号防线：关键句逐段在正文）———

test('渲染回归：各节点关键句逐段在正文（字符串拼接链完整、无悬空分号截断）', () => {
  const s0 = FC.State.create('李恒');
  assert.match(FC.CH6.graph['ch6_start'].text(s0), /井在一寸一寸地浅下去/, 'ch6_start 关键句');
  const sHub = FC.State.create('李恒');
  sHub.cultivation = 18; sHub.flags.ch6_yifu_heard = true;
  assert.match(FC.CH6.graph['ch6_元婴岁月'].text(sHub), /化神/, 'hub 关前关键句');
  assert.match(FC.CH6.graph['ch6_遗府传闻'].text(s0), /通天遗府/, '传闻关键句');
  assert.match(FC.CH6.graph['ch6_遗府外门'].text(s0), /界纹/, '外门关键句');
  assert.match(FC.CH6.graph['ch6_外门自开'].text(s0), /气起于踵/, '自开关键句');
  assert.match(FC.CH6.graph['ch6_外门硬撼'].text(s0), /界纹/, '硬撼关键句');
  assert.match(FC.CH6.graph['ch6_星核夺宝'].text(s0), /星核/, '星宫关键句');
  assert.match(FC.CH6.graph['ch6_星核得手'].text(s0), /星核髓/, '得手关键句');
  assert.match(FC.CH6.graph['ch6_星核受挫'].text(s0), /星傀|阵眼/, '受挫关键句');
  assert.match(FC.CH6.graph['ch6_借泽闯关'].text(s0), /枯荣|遗泽/, '借泽关键句');
  assert.match(FC.CH6.graph['ch6_燃寿硬闯'].text(s0), /寿元|薪/, '燃寿关键句');
  assert.match(FC.CH6.graph['ch6_燃寿兵解'].text(s0), /兵解|薪尽/, '兵解关键句');
  const sBell = FC.State.create('李恒');
  sBell.cultivation = 19; sBell.flags.mortal_limit = true;
  assert.match(FC.CH6.graph['ch6_大限钟声'].text(sBell), /大限钟声/, '钟声关键句');
  assert.match(FC.CH6.graph['ch6_end'].text(sBell), /第六章《化神》终/, '章末落款');
});

// ———— 字数 ————

test('字数统计：第六章正文（各节点 text 并集）+ 选项文案合计 ≥25000 字', () => {
  const probes = [];
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    fn(s);
    return s;
  };
  probes.push(FC.State.create('李恒'));
  probes.push(crafted((s) => { // 开局·全承接态（元婴二层+老祖线+古卷+全本+家书+遗物）
    s.cultivation = 17; s.flags.kurong_slain = true; s.inventory['婴变古卷'] = 1;
    s.flags.ch2_quanben = 1; s.inventory['张铁的家书'] = 1; s.inventory['李师姐遗物'] = 1;
    s.inventory['枯荣令'] = 1; s.lingshi = 80; s.day = 42000;
  }));
  probes.push(crafted((s) => { s.cultivation = 16; })); // 开局·元婴一态
  probes.push(crafted((s) => { s.cultivation = 17; s.flags.inner_demon = true; })); // 开局·心魔态
  probes.push(crafted((s) => { s.cultivation = 17; })); // 开局·古籍线（无老祖）
  probes.push(crafted((s) => { // hub 关前态
    s.cultivation = 17; s.injury = 20; s.lingshi = 40; s.flags.ch6_yifu_heard = true; s.flags.kurong_slain = true;
  }));
  probes.push(crafted((s) => { s.cultivation = 18; s.flags.ch6_yifu_heard = true; })); // hub 关前·满层态
  probes.push(crafted((s) => { // 内庭·三钥态
    s.cultivation = 18; s.flags.ch6_yifu_heard = true; s.flags.key_jade = true;
    s.flags.key_core = true; s.flags.key_token = true; s.inventory['通天令'] = 1;
  }));
  probes.push(crafted((s) => { s.cultivation = 16; s.flags.ch6_core_tried = true; s.injury = 35; })); // 星宫复探态
  probes.push(crafted((s) => { // 抉择·三钥态
    s.cultivation = 18; s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
  }));
  probes.push(crafted((s) => { // 抉择·两钥+令态
    s.cultivation = 18; s.flags.key_jade = true; s.flags.key_core = true; s.inventory['枯荣令'] = 1;
  }));
  probes.push(crafted((s) => { // 抉择·一钥态
    s.cultivation = 18; s.flags.key_jade = true; s.inventory['婴变古卷'] = 1;
  }));
  probes.push(crafted((s) => { // 化神成·燃寿态
    s.cultivation = 18; s.flags.ch6_path = '燃寿'; s.inventory['婴变古卷'] = 1; s.flags.key_jade = true;
  }));
  probes.push(crafted((s) => { // 化神成·借泽态
    s.cultivation = 18; s.flags.ch6_path = '借泽'; s.flags.kurong_slain = true; s.injury = 50;
  }));
  probes.push(crafted((s) => { // 大限钟声·化神态
    s.cultivation = 19; s.flags.mortal_limit = true; s.lifespanYears = 800; s.day = 46000;
  }));
  probes.push(crafted((s) => { // 章末·全承接态
    s.cultivation = 19; s.flags.mortal_limit = true; s.flags.kurong_slain = true; s.flags.ch6_dark_walk = true;
    s.inventory['李师姐遗物'] = 1; s.inventory['张铁的家书'] = 1; s.karma.pill_poison = 1; s.day = 45000;
  }));
  const graph = FC.CH6.graph; // 只统计第六章正文
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
  assert.ok(sum >= 25000, '第六章字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 46000, '第六章字数失控: ' + sum);
});
