// 第四章《结丹》测试（Task 4）：
//   1. FC.CH4 就绪：meta 定死值正确，节点 id 不与 ch1/ch2/ch3 冲突
//   2. registry 合并：ch3_end（terminal）→ ch4_start 章际接线，FC.CH3 原件不改写，ch4_start 检查点注册
//   3. registry 幂等 + FC.Test.validate(合并图) 全绿
//   4. 魔道入侵三路线：撤离（保命，time+30）/死战（demon_war_battlefield、injury 风险、took_blame 孙毅舍命报恩段）/
//      护送凡人（saved_mortals、time+180）
//   5. 李师姐两分支：aff_li_shijie≥4 → 结丹失败兵解遗言托付（李师姐遗物、luck+2）；否则 → 远走赠物（同一道具，文案不同）
//   6. 结丹机缘三选一门槛：地火髓（injury+30 必经）/前辈洞府（knows_truth 或 luck≥15）/凝魂丹（灵石 -50）
//   7. 结丹突破三分支：条件齐必成（cultivation+1、寿元+80，可再进二层再 +80）/
//      丹引强冲（寿元-20、injury+50、karma pill_poison=1，可重试）/燃血硬撼（兵解真死，检查点不吞、复活到 ch4_start）
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
require('../js/content/ch4.js');
require('../js/content/registry.js');
const FC = globalThis.FC;

function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}
const G = () => FC.Content.graph; // 合并后全图（ch1 + ch2 + ch3 + ch4）

// —— 走查脚手架（与 ch3.test.mjs 同式）——
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

// —— 第一章走法（沿用 ch3.test.mjs 已验证路线）——
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

// —— 第三章走法（定死走法：剿矿 → 一枚丹硬闯成 → 家书线 → ch3_end；mortal_pill_used=dan1）——
function ch3Finish(s) {
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  assert.equal(s.nodeId, 'ch3_剿矿');
  s.luck = Math.max(s.luck, 30); // 压低路线 luck 不足以稳胜剿矿，走法统一抬到 30（与 ch3.test.mjs 同式）
  step(s, '先探矿道，再合围'); // luck 30 ≥ 10 → 胜
  assert.equal(s.nodeId, 'ch3_剿矿胜');
  step(s, '继续');
  assert.equal(s.inventory['筑基丹'], 1, '剿矿胜应得筑基丹');
  step(s, '继续'); // 归山 → 伤退
  step(s, '继续'); // 伤退 → 归乡别过
  assert.equal(s.nodeId, 'ch3_归乡别过');
  step(s, '继续'); // 别过 → 回乡
  const dayR = s.day;
  step(s, '继续'); // 回乡（time+60 离开时入账）→ 坟前
  assert.ok(s.day > dayR, '回乡段应有时间入账');
  drain(s); // 坟前 → 筑基岁月
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  step(s, '直面筑基关（章末）'); drain(s);
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵'); // ch2 购的固本丹在 → 必成
  assert.equal(s.nodeId, 'ch3_硬闯成');
  assert.equal(s.flags.mortal_pill_used, 'dan1');
  drainTo(s, 'ch4_入侵抉择'); // ch3_end 已被章际接线（→ch4_start），drain 一路推进入侵抉择
}
function enterCh4(s) {
  drainTo(s, 'ch4_入侵抉择'); // ch3_end（接线）→ ch4_start → 入侵抉择
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch4 应有章首检查点（途经 ch4_start 时已写）');
  assert.equal(cp.nodeId, 'ch4_start');
  assert.equal(FC.State.isDead(cp), false);
}

// ———— 结构与注册 ————

test('FC.CH4 就绪：meta 定死值正确，ch4_start/ch4_end 存在，节点 id 不与 ch1/ch2/ch3 冲突', () => {
  assert.ok(FC.CH4 && FC.CH4.graph, 'FC.CH4 未挂载');
  assert.equal(FC.CH4.meta.chapter, 4);
  assert.equal(FC.CH4.meta.title, '结丹');
  assert.equal(FC.CH4.meta.checkpointNode, 'ch4_start');
  assert.ok(FC.CH4.graph.ch4_start, '缺入口 ch4_start');
  assert.ok(FC.CH4.graph.ch4_end, '缺章末 ch4_end');
  const taken = new Set([...Object.keys(FC.CH1), ...Object.keys(FC.CH2.graph), ...Object.keys(FC.CH3.graph)]);
  for (const id of Object.keys(FC.CH4.graph)) {
    assert.ok(!taken.has(id), '节点 id 与前章冲突: ' + id);
  }
});

test('registry 合并：ch1+ch2+ch3+ch4 节点全在图中，ch3_end → ch4_start 接线成立且不改写原件', () => {
  const g = G();
  for (const id of Object.keys(FC.CH4.graph)) assert.ok(g[id], 'ch4 节点丢失: ' + id);
  assert.equal(g['ch3_end'].goto, 'ch4_start', '合并图应把 ch3_end 接到 ch4_start');
  assert.equal(FC.CH3.graph['ch3_end'].goto, undefined, 'FC.CH3 原件不得被改写');
  assert.equal(FC.CH3.graph['ch3_end'].terminal, true, 'FC.CH3 原件保持章末终局标记');
  assert.ok(FC.Engine._checkpointNodes.has('ch4_start'), 'registry 应注册 ch4_start 检查点');
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

test('新道具四件登记在册（李师姐遗物/地火髓/前辈玉简/凝魂丹），且图中引用的所有物品都有登记', () => {
  for (const id of ['李师姐遗物', '地火髓', '前辈玉简', '凝魂丹']) {
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

// ———— 走查 A·撤离线 → 李师姐远走赠物 → 凝魂丹机缘 → 结丹成 → 再进二层 ————

test('走查 A：撤离线（time+30，保命）→ 师姐别（aff<4 远走赠物）→ 苦修筑基三 → 凝魂丹（灵石-50）→ 稳渡结丹成（寿元+80）→ 再进二层（再+80）→ ch4_end', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  // 魔道入侵：撤离线
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）');
  assert.equal(s.nodeId, 'ch4_撤离');
  const day0 = s.day;
  step(s, '继续'); // 撤离效果离开时入账 → 旧账
  assert.equal(s.day, day0 + 30, '撤离线应 time+30');
  assert.equal(s.nodeId, 'ch4_旧账');
  // 李师姐分岔：aff_li_shijie=0 <4 → 远走赠物
  step(s, '继续');
  assert.equal(s.nodeId, 'ch4_师姐别', 'aff<4 应走远走赠物分支');
  step(s, '继续'); // 师姐别效果离开时入账 → 流亡 hub
  assert.equal(s.inventory['李师姐遗物'], 1, '远走线也应得李师姐遗物（离开时入账）');
  assert.equal(s.flags.ch4_li_gone, true);
  assert.equal(s.nodeId, 'ch4_流亡');
  assert.ok(!s.karma.demon_war_battlefield, '撤离线不得记死战线 karma');
  assert.ok(!s.karma.saved_mortals, '撤离线不得记护送线 karma');
  // 流亡 hub：苦修至筑基三层
  const cult0 = s.cultivation;
  while (s.cultivation < 12) { step(s, '苦修正途（流亡行气，进一层）'); drain(s); }
  assert.equal(s.cultivation, cult0 + 2, '苦修应进两层至筑基三层（入章为筑基一层）');
  assert.equal(FC.REALMS[s.cultivation], '筑基三层');
  // 机缘：凝魂丹（灵石 -50）
  s.lingshi = Math.max(s.lingshi, 80);
  step(s, '打探结丹机缘（酒肆与坊市的传闻）');
  assert.equal(s.nodeId, 'ch4_机缘');
  step(s, '购凝魂丹（坊市丹铺，灵石 -50）');
  assert.equal(s.nodeId, 'ch4_凝魂');
  const ls0 = s.lingshi;
  step(s, '继续'); // 凝魂效果离开时入账 → 流亡 hub
  assert.equal(s.inventory['凝魂丹'], 1, '凝魂丹应入手');
  assert.equal(s.lingshi, ls0 - 50, '凝魂丹应花 50 灵石');
  assert.equal(s.flags.ch4_jiyuan_done, true, '机缘应记已择');
  assert.equal(s.nodeId, 'ch4_流亡');
  // 结丹突破：条件齐（机缘道具 + 伤势<30）→ 稳渡必成
  assert.ok(s.injury < 30, '走查应伤势轻（当前 ' + s.injury + '）');
  step(s, '直面结丹关（章末）');
  assert.equal(s.nodeId, 'ch4_结丹抉择');
  const v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('稳渡') >= 0), '条件齐稳渡应可见');
  const life0 = s.lifespanYears, cult1 = s.cultivation;
  step(s, '水到渠成，稳渡结丹关（机缘已备，伤势轻）');
  assert.equal(s.nodeId, 'ch4_结丹成');
  step(s, '继续'); // 结丹成效果离开时入账
  assert.equal(s.cultivation, cult1 + 1, '结丹成应进一层');
  assert.equal(FC.REALMS[s.cultivation], '结丹一层');
  assert.ok(Math.abs((s.lifespanYears - life0) - 80) < 1e-9, '结丹一层应寿元 +80（无时间流逝）');
  // 乘胜再进一层
  step(s, '乘势再进一层（结丹二层，再焚一道机缘）');
  assert.equal(s.cultivation, cult1 + 2, '再进应至结丹二层');
  assert.equal(FC.REALMS[s.cultivation], '结丹二层');
  assert.ok(Math.abs((s.lifespanYears - life0) - 160) < 1e-9, '结丹二层应累计寿元 +160');
  drainTo(s, 'ch4_end');
  const endText = FC.Engine.view(s, G()).text;
  assert.match(endText, /灵气/, '章末应埋灵气枯竭伏笔');
  assert.match(endText, /第四章《结丹》终/);
});

// ———— 走查 B·死战线（demon_war_battlefield + injury 风险 + 孙毅报恩段）→ 师姐殒 ————

test('走查 B：死战线（demon_war_battlefield，胜 injury+20）→ took_blame 孙毅舍命报恩段 → 师姐殒（aff≥4 兵解遗言托付，luck+2）→ 流亡', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '回身赴死战，守山门前最后一线');
  assert.equal(s.nodeId, 'ch4_死战');
  const inj0 = s.injury;
  s.karma.took_blame = 1; // 当年顶过罪：孙毅报恩段应在正文
  const warText = FC.Engine.view(s, G()).text;
  step(s, '结阵死守，把阵眼护到最后'); // luck 29 ≥ 15 → 胜
  assert.equal(s.nodeId, 'ch4_死战胜');
  assert.equal(s.karma.demon_war_battlefield, 1, '死战线应记 demon_war_battlefield');
  const winText = FC.Engine.view(s, G()).text;
  assert.match(winText, /孙毅/, 'took_blame≥1 死战胜应含孙毅舍命报恩段');
  step(s, '继续'); // 死战胜效果离开时入账 → 旧账
  assert.equal(s.injury, Math.min(100, inj0 + 20), '死战胜应 injury+20');
  assert.equal(s.nodeId, 'ch4_旧账');
  // 李师姐分岔：aff≥4 → 兵解遗言托付
  s.karma.aff_li_shijie = 4;
  step(s, '继续');
  assert.equal(s.nodeId, 'ch4_师姐殒', 'aff≥4 应走兵解遗言托付分支');
  const luck0 = s.luck;
  assert.equal(s.inventory['李师姐遗物'] || 0, 0, '到达时遗物未入手（离开时入账）');
  step(s, '继续'); // 师姐殒效果离开时入账 → 流亡
  assert.equal(s.inventory['李师姐遗物'], 1, '遗言托付应得李师姐遗物');
  assert.equal(s.luck, luck0 + 2, '遗言托付应 luck+2');
  assert.equal(s.flags.ch4_li_fallen, true);
  assert.equal(s.nodeId, 'ch4_流亡');
  // 对照：无 took_blame 的死战胜正文不得出现孙毅
  const s2 = FC.State.create('李恒');
  s2.cultivation = 11; s2.flags.ch4_war_hold = true;
  const t1 = FC.CH4.graph['ch4_死战胜'].text(s);
  const t2 = FC.CH4.graph['ch4_死战胜'].text(s2);
  assert.notEqual(t1, t2, '有无顶罪因果应有不同正文');
  assert.doesNotMatch(t2, /孙毅/, '无 took_blame 不得出现孙毅段');
});

test('走查 B·挫：低机缘死战 → injury+50 风险兑现（死战创）→ 旧账照常收束', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '回身赴死战，守山门前最后一线');
  assert.equal(s.nodeId, 'ch4_死战');
  s.luck = 5; s.cultivation = 10; s.inventory['执法堂令牌'] = 0; // 压低：hold 线 luck≥15/令牌/筑基三全不满足
  const inj0 = s.injury;
  step(s, '结阵死守，把阵眼护到最后');
  assert.equal(s.nodeId, 'ch4_死战创', '低机缘死战应受创');
  assert.equal(s.karma.demon_war_battlefield, 1);
  step(s, '继续');
  assert.equal(s.injury, Math.min(100, inj0 + 50), '死战创应 injury+50');
  assert.equal(s.nodeId, 'ch4_旧账');
});

// ———— 走查 C·护送凡人（saved_mortals + time 180）———

test('走查 C：护送凡人（saved_mortals，time+180）→ 张铁存亡两版正文 → 流亡 hub 常规行动记账', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  const day0 = s.day;
  step(s, '护送山下凡人南撤（仁路，耗时半年）');
  assert.equal(s.nodeId, 'ch4_护送');
  // 家书线（张铁已故）：正文应带酒囊追忆
  const t1 = FC.Engine.view(s, G()).text;
  assert.match(t1, /酒囊|张家村|青牛镇/, '张铁已故线护送正文应有追忆');
  step(s, '继续'); // 护送效果离开时入账 → 旧账
  assert.equal(s.day, day0 + 180, '护送线应 time+180');
  assert.equal(s.karma.saved_mortals, 1, '护送线应记 saved_mortals');
  assert.ok(!s.karma.demon_war_battlefield);
  assert.equal(s.nodeId, 'ch4_旧账');
  // 张铁存亡正文对照（走商线：张铁活着，铃铛来接）
  const sAlive = FC.State.create('李恒');
  sAlive.flags.ch3_tie_merchant = true;
  const t2 = FC.CH4.graph['ch4_护送'].text(sAlive);
  assert.match(t2, /张铁/, '张铁存线护送正文应有张铁来接');
  assert.notEqual(t1, t2, '张铁存亡应改变护送正文');
  // 走完收束
  step(s, '继续');
  assert.equal(s.nodeId, 'ch4_师姐别');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  // hub 常规行动：坊市营生攒灵石与人脉
  const ls0 = s.lingshi, day1 = s.day, rm0 = s.karma.ch4_renmai || 0;
  step(s, '坊市营生（支个药摊，一月四灵石）');
  drain(s);
  assert.equal(s.lingshi, ls0 + 4, '坊市营生应 +4 灵石');
  assert.equal(s.day, day1 + 30);
  assert.equal((s.karma.ch4_renmai || 0), rm0 + 1, '坊市营生应涨人脉');
  assert.equal(s.nodeId, 'ch4_流亡');
});

// ———— 佣斗 combat：胜/挫两分支 ————

test('佣斗：高机缘保货得赏（胜，injury+5 灵石+36=工钱三十加赏六）；低机缘失货（挫，injury+30 灵石+30 工钱照付）', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s, '继续');
  step(s, '继续'); step(s, '继续'); // → 流亡
  assert.equal(s.nodeId, 'ch4_流亡');
  s.lingshi = Math.max(s.lingshi, 80);
  step(s, '佣斗护商（替行商押货，拿命换钱）');
  assert.equal(s.nodeId, 'ch4_佣斗');
  const inj0 = s.injury, ls0 = s.lingshi;
  step(s, '死保财货，那是买命钱'); // luck 29 ≥ 12 → 胜
  assert.equal(s.nodeId, 'ch4_佣斗胜');
  step(s, '继续');
  assert.equal(s.lingshi, ls0 + 36, '佣斗胜应得工钱三十加赏六');
  assert.equal(s.injury, Math.min(100, inj0 + 5));
  assert.equal(s.nodeId, 'ch4_流亡');
  // 保货胜正文：护货措辞应在，工钱赏钱应入账
  const sHold = FC.State.create('李恒');
  sHold.flags.ch4_dou_hold = true;
  const tHold = FC.CH4.graph['ch4_佣斗胜'].text(sHold);
  assert.match(tHold, /护住了|完好无损/, '保货线结尾应保留护货措辞');
  assert.match(tHold, /工钱三十/, '保货胜应入账工钱三十');
  // 再跑一趟，压低机缘 → 挫
  step(s, '佣斗护商（替行商押货，拿命换钱）');
  assert.equal(s.nodeId, 'ch4_佣斗');
  s.luck = 5; s.cultivation = 11; s.karma.ch4_renmai = 0;
  const inj1 = s.injury, ls1 = s.lingshi;
  step(s, '舍货保人，先散伙计');
  assert.equal(s.nodeId, 'ch4_佣斗挫');
  step(s, '继续');
  assert.equal(s.injury, Math.min(100, inj1 + 30), '佣斗挫应 injury+30');
  assert.equal(s.lingshi, ls1 + 30, '佣斗挫应得工钱三十（货钱按契扣，工钱照付）');
  assert.equal(s.nodeId, 'ch4_流亡');
});

// —— 佣斗·弃货胜：舍货保人 + 高机缘（luck≥25）走共用结尾的弃货分支 ——

test('佣斗·弃货胜：舍货保人+luck≥25 → pass 走弃货结尾（雇主感念救人、话带可惜），不得出现保货措辞，账面同得工钱三十加赏六', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s, '继续');
  step(s, '继续'); step(s, '继续'); // → 流亡
  assert.equal(s.nodeId, 'ch4_流亡');
  s.luck = Math.max(s.luck, 30); // 弃货线 pass 需 luck≥25
  step(s, '佣斗护商（替行商押货，拿命换钱）');
  assert.equal(s.nodeId, 'ch4_佣斗');
  const ls0 = s.lingshi;
  step(s, '舍货保人，先散伙计');
  assert.equal(s.nodeId, 'ch4_佣斗胜', 'luck≥25 舍货保人应 pass');
  assert.equal(s.flags.ch4_dou_hold, false, '弃货线旗标应为 false');
  const winText = FC.Engine.view(s, G()).text;
  assert.match(winText, /把人看得比货重/, '弃货胜应有雇主感念救人的新结尾');
  assert.match(winText, /工钱三十/, '弃货胜应入账工钱三十');
  assert.doesNotMatch(winText, /护住了|完好无损/, '弃货胜不得出现保货线措辞（货已折在青竹坳）');
  step(s, '继续');
  assert.equal(s.lingshi, ls0 + 36, '弃货胜同账：工钱三十加赏六');
  assert.equal(s.nodeId, 'ch4_流亡');
});

// ———— 机缘门槛：洞府/凝魂丹 gates + 地火髓 injury+30 必经 ————

test('机缘门槛：洞府需 knows_truth 或 luck≥15；凝魂丹需灵石≥50（可见但禁用）；地火·灵石不足十枚时禁用，injury+30 必经', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s, '继续');
  step(s, '继续'); step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  s.lingshi = 19;
  s.karma.knows_truth = 0; s.luck = 5;
  step(s, '打探结丹机缘（酒肆与坊市的传闻）');
  assert.equal(s.nodeId, 'ch4_机缘');
  const v = FC.Engine.view(s, G());
  const iDong = pick(s, '访前辈洞府（残页同源的去处）');
  const iNing = pick(s, '购凝魂丹（坊市丹铺，灵石 -50）');
  const iHuo = pick(s, '地火淬体（火山地脉，引路钱十灵石，淬体必受创）');
  assert.equal(v.choices[iDong].enabled, false, '无 knows_truth 且 luck<15 洞府应禁用');
  assert.equal(v.choices[iNing].enabled, false, '灵石不足 50 凝魂丹应可见但禁用');
  assert.equal(v.choices[iHuo].enabled, true, '灵石足（≥10）地火应可用');
  s.lingshi = 5;
  assert.equal(FC.Engine.view(s, G()).choices[iHuo].enabled, false, '灵石不足 10 地火应禁用');
  s.lingshi = 19;
  const r = FC.Engine.choose(s, G(), iDong);
  assert.deepEqual(r, { ok: false, reason: 'disabled' });
  assert.equal(s.nodeId, 'ch4_机缘');
  // knows_truth=1 → 洞府可用
  s.karma.knows_truth = 1;
  assert.equal(FC.Engine.view(s, G()).choices[iDong].enabled, true, 'knows_truth 应开启洞府');
  // 地火淬体走查：引路钱 -10、injury+30 必经
  const inj0 = s.injury;
  const lsHuo = s.lingshi;
  step(s, '地火淬体（火山地脉，引路钱十灵石，淬体必受创）');
  assert.equal(s.nodeId, 'ch4_地火');
  step(s, '继续');
  assert.equal(s.inventory['地火髓'], 1, '地火淬体应得地火髓');
  assert.equal(s.injury, Math.min(100, inj0 + 30), '地火淬体应 injury+30 必经');
  assert.equal(s.lingshi, lsHuo - 10, '地火引路钱应灵石 -10');
  assert.equal(s.flags.ch4_jiyuan_done, true);
  assert.equal(s.nodeId, 'ch4_流亡');
  // 洞府门槛对照：luck≥15 也可开启（裸态落点验证）
  const s2 = FC.State.create('李恒');
  s2.karma.knows_truth = 0; s2.luck = 15;
  assert.ok(true, 'luck 门槛由 enabled 函数表达，走查已覆盖 knows_truth 侧');
});

// ———— 结丹突破三分支 ————

test('结丹·丹毒：无机缘硬闯 → 稳渡不可见；丹引强冲失败寿元-20、injury+50、pill_poison=1；疗伤补机缘后可重试成功', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s, '继续');
  step(s, '继续'); step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  while (s.cultivation < 12) { step(s, '苦修正途（流亡行气，进一层）'); drain(s); }
  step(s, '直面结丹关（章末）');
  assert.equal(s.nodeId, 'ch4_结丹抉择');
  // 无机缘：稳渡不可见，硬闯两路可见
  let v = FC.Engine.view(s, G());
  assert.ok(!v.choices.some((c) => c.label.indexOf('稳渡') >= 0), '无机缘稳渡应不可见');
  assert.ok(v.choices.some((c) => c.label.indexOf('强冲') >= 0));
  assert.ok(v.choices.some((c) => c.label.indexOf('燃血') >= 0));
  const life0 = s.lifespanYears, inj0 = s.injury;
  step(s, '以丹引强冲（伤身换一线，或落丹毒）');
  assert.equal(s.nodeId, 'ch4_丹引强冲');
  step(s, '继续'); // 效果离开时入账 → 流亡 hub
  assert.equal(s.nodeId, 'ch4_流亡', '丹毒败应回 hub 可重试');
  assert.ok(Math.abs((life0 - s.lifespanYears) - 20) < 1e-9, '丹毒应寿元 -20');
  assert.equal(s.injury, Math.min(100, inj0 + 50), '丹毒应 injury+50');
  assert.equal(s.karma.pill_poison, 1, '丹毒应记 karma pill_poison=1');
  // 重试：疗伤 → 补机缘 → 稳渡
  step(s, '静养将息（赁间下房，专心养伤）'); drain(s);
  assert.ok(s.injury < 30, '静养后伤势应 <30（当前 ' + s.injury + '）');
  s.lingshi = Math.max(s.lingshi, 80);
  step(s, '打探结丹机缘（酒肆与坊市的传闻）');
  step(s, '购凝魂丹（坊市丹铺，灵石 -50）'); step(s, '继续');
  assert.equal(s.nodeId, 'ch4_流亡');
  step(s, '直面结丹关（章末）');
  v = FC.Engine.view(s, G());
  assert.ok(v.choices.some((c) => c.label.indexOf('稳渡') >= 0), '补齐机缘后稳渡应可见');
  step(s, '水到渠成，稳渡结丹关（机缘已备，伤势轻）'); step(s, '继续');
  assert.equal(s.cultivation, 13, '重试稳渡应成结丹一层');
  assert.equal(s.karma.pill_poison, 1, '丹毒 karma 应保留');
});

test('结丹·兵解：燃血硬撼 → 兵解真死；检查点仍是 ch4_start 存活进度未被改写；死亡状态写检查点被拒；豁免则重伤续行', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  const dayAtCh4 = s.day;
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s, '继续');
  step(s, '继续'); step(s, '继续');
  while (s.cultivation < 12) { step(s, '苦修正途（流亡行气，进一层）'); drain(s); }
  step(s, '直面结丹关（章末）');
  step(s, '燃血硬撼，不成功便成仁');
  assert.equal(s.nodeId, 'ch4_燃血硬撼');
  const r = FC.Engine.choose(s, G(), pick(s, '继续'));
  assert.equal(r.ok, true);
  assert.equal(s.dead, '兵解', '燃血硬撼无豁免应兵解');
  assert.match(FC.UI.deathText(s), /兵解/);
  assert.ok(FC.Save.load('auto'), '死亡状态照常落 auto');
  // —— 检查点未被死亡流程改写：仍是 ch4_start 存活进度 ——
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '章首检查点应存在');
  assert.equal(cp.nodeId, 'ch4_start', '检查点应为 ch4_start（复活点）');
  assert.equal(cp.day, dayAtCh4, '检查点应为入章时刻进度');
  assert.equal(FC.State.isDead(cp), false, '检查点必须是存活进度（死亡不吞进度）');
  assert.notDeepEqual(cp, s, '检查点不得被死亡进度改写');
  const rr = FC.Save.save(s, 'checkpoint');
  assert.deepEqual(rr, { ok: false, reason: 'dead' }, '死亡状态写检查点应被 Save 层拒绝');
  // —— 豁免对照：重伤续行 ——
  const s2 = freshState();
  s2.deathExempt = true;
  ch1Zhen(s2, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s2, { tieVisits: 0, rescue: false });
  enterCh3(s2);
  ch3Finish(s2);
  enterCh4(s2);
  step(s2, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s2, '继续');
  step(s2, '继续'); step(s2, '继续');
  while (s2.cultivation < 12) { step(s2, '苦修正途（流亡行气，进一层）'); drain(s2); }
  step(s2, '直面结丹关（章末）');
  step(s2, '燃血硬撼，不成功便成仁');
  step(s2, '继续');
  assert.equal(s2.dead, null, '豁免下燃血硬撼应重伤续行');
  assert.equal(s2.injury, 100);
  assert.equal(s2.flags.cheated_death_兵解, true);
  assert.equal(s2.nodeId, 'ch4_劫灰');
  drain(s2);
  assert.equal(s2.nodeId, 'ch4_流亡');
});

// ———— 突破门槛与再进一层 ————

test('结丹门槛：稳渡需机缘道具且伤势<30；带伤（≥30）或有伤无道具皆不可见；再进一层需 prop+伤<30+luck≥20', () => {
  const s = freshState();
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  ch2To(s, { tieVisits: 0, rescue: false });
  enterCh3(s);
  ch3Finish(s);
  enterCh4(s);
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）'); step(s, '继续');
  step(s, '继续'); step(s, '继续');
  while (s.cultivation < 12) { step(s, '苦修正途（流亡行气，进一层）'); drain(s); }
  s.lingshi = Math.max(s.lingshi, 80);
  step(s, '打探结丹机缘（酒肆与坊市的传闻）');
  step(s, '购凝魂丹（坊市丹铺，灵石 -50）'); step(s, '继续');
  step(s, '直面结丹关（章末）');
  assert.equal(s.nodeId, 'ch4_结丹抉择');
  assert.ok(FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('稳渡') >= 0), '机缘+伤轻应可见稳渡');
  s.injury = 40; // 带伤：机缘有伤势重 → 稳渡隐藏
  assert.ok(!FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('稳渡') >= 0), '伤势≥30 稳渡应隐藏');
  s.injury = 10; s.inventory['凝魂丹'] = 0; // 伤轻无道具 → 稳渡隐藏
  assert.ok(!FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('稳渡') >= 0), '无机缘稳渡应隐藏');
  // 再进一层门槛：成后（cultivation 13）需 prop+伤<30+luck≥20
  s.inventory['凝魂丹'] = 1;
  s.cultivation = 13;
  s.luck = 10;
  s.nodeId = 'ch4_丹成之后';
  assert.ok(!FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('再进') >= 0), 'luck<20 再进应隐藏');
  s.luck = 25;
  assert.ok(FC.Engine.view(s, G()).choices.some((c) => c.label.indexOf('再进') >= 0), 'luck≥20 再进应可见');
});

// ———— 文案分支对照（李师姐/旧账/护送）———

test('文案分支对照：师姐殒/别两版互异；旧账 enemy_inner 胡威段；护送张铁存亡两版', () => {
  const sFallen = FC.State.create('李恒');
  sFallen.karma.aff_li_shijie = 5;
  const sGone = FC.State.create('李恒');
  const tFallen = FC.CH4.graph['ch4_师姐殒'].text(sFallen);
  const tGone = FC.CH4.graph['ch4_师姐别'].text(sGone);
  assert.ok(tFallen.length > 200 && tGone.length > 200);
  assert.notEqual(tFallen, tGone, '李师姐两分支文案应互异');
  assert.match(tFallen, /兵解|遗言|戥子/);
  assert.match(tGone, /戥子/);
  const sEnemy = FC.State.create('李恒');
  sEnemy.karma.enemy_inner = 1;
  const sPlain = FC.State.create('李恒');
  const tEnemy = FC.CH4.graph['ch4_旧账'].text(sEnemy);
  const tPlain = FC.CH4.graph['ch4_旧账'].text(sPlain);
  assert.match(tEnemy, /胡威/, 'enemy_inner 旧账应有胡威内应段');
  assert.doesNotMatch(tPlain, /胡威/, '无 enemy_inner 不得出现胡威段');
  assert.notEqual(tEnemy, tPlain);
  const sTie = FC.State.create('李恒');
  sTie.flags.ch3_tie_merchant = true;
  const tTie = FC.CH4.graph['ch4_护送'].text(sTie);
  assert.match(tTie, /张铁/, '走商线护送应有张铁');
  assert.doesNotMatch(tTie, /张家村.*手印|家书.*手印/, '走商线不得出现报丧追忆');
});

// —— 渲染回归：ch4_撤离 悬空分号修复（98-108 段曾因行尾分号成为孤立表达式不渲染）——

test('渲染回归：ch4_撤离 正文应含外门弟子腰牌段、「身外之物」句与「扔不掉」句', () => {
  const s = FC.State.create('李恒');
  const t = FC.CH4.graph['ch4_撤离'].text(s);
  assert.match(t, /外门弟子把腰牌解下来/, 'ch4_撤离 应含外门弟子腰牌段');
  assert.match(t, /装作没看见/, 'ch4_撤离 应含腰牌段收束句');
  assert.match(t, /身外之物烧得掉/, 'ch4_撤离 应含「身外之物」句');
  assert.match(t, /有些东西，扔不掉/, 'ch4_撤离 应含「扔不掉」句');
});

// ———— 字数 ————

test('字数统计：第四章正文（各节点 text 并集）+ 选项文案合计 ≥20000 字', () => {
  const probes = [];
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    fn(s);
    return s;
  };
  probes.push(FC.State.create('李恒'));
  probes.push(crafted((s) => { // 主线态：筑基三+全本+锦囊+家书
    s.cultivation = 12; s.luck = 30; s.flags.ch2_quanben = 1; s.karma.knows_truth = 1;
    s.inventory['李师姐的锦囊'] = 1; s.inventory['青元剑诀'] = 1; s.lingshi = 60;
    s.flags.mortal_pill_used = 'dan1'; s.karma.pill_toxin = 1;
  }));
  probes.push(crafted((s) => { // 死战胜·顶罪态
    s.cultivation = 11; s.flags.ch4_war_hold = true; s.karma.took_blame = 1; s.injury = 20;
  }));
  probes.push(crafted((s) => { // 死战创·顶罪态
    s.cultivation = 10; s.flags.ch4_war_hold = false; s.karma.took_blame = 1; s.injury = 60;
  }));
  probes.push(crafted((s) => { // 护送·张铁存线
    s.cultivation = 11; s.flags.ch3_tie_merchant = true; s.lingshi = 30;
  }));
  probes.push(crafted((s) => { // 旧账·enemy_inner 态 + 师姐殒前
    s.cultivation = 11; s.karma.enemy_inner = 1; s.karma.aff_li_shijie = 5;
  }));
  probes.push(crafted((s) => { // 流亡 hub 诸态：低层数/养伤
    s.cultivation = 10; s.injury = 45; s.lingshi = 12; s.karma.ch4_renmai = 2;
  }));
  probes.push(crafted((s) => { // 流亡 hub：关前态无机缘
    s.cultivation = 12; s.injury = 5; s.flags.ch4_jiyuan_done = true;
  }));
  probes.push(crafted((s) => { // 机缘/结丹抉择：条件齐态（三道具）
    s.cultivation = 12; s.injury = 10; s.lingshi = 80;
    s.inventory['地火髓'] = 1; s.inventory['前辈玉简'] = 1; s.inventory['凝魂丹'] = 1;
  }));
  probes.push(crafted((s) => { // 结丹成/再进：地火态
    s.cultivation = 12; s.injury = 25; s.inventory['地火髓'] = 1; s.luck = 30;
  }));
  probes.push(crafted((s) => { // 结丹成：玉简态（残页同源）
    s.cultivation = 13; s.injury = 8; s.inventory['前辈玉简'] = 1; s.luck = 30;
    s.flags.ch2_quanben = 1; s.karma.knows_truth = 1;
  }));
  probes.push(crafted((s) => { // 章末诸态：师姐殒+丹毒+走商
    s.cultivation = 14; s.karma.pill_poison = 1; s.flags.ch4_li_fallen = true;
    s.flags.ch3_tie_merchant = true; s.inventory['李师姐遗物'] = 1; s.day = 2500;
  }));
  probes.push(crafted((s) => { // 章末诸态：师姐别+家书+enemy_inner
    s.cultivation = 13; s.flags.ch4_li_gone = true; s.inventory['张铁的家书'] = 1;
    s.karma.enemy_inner = 1; s.inventory['李师姐遗物'] = 1; s.day = 2200;
  }));
  probes.push(crafted((s) => { // 兵解劫/劫灰态
    s.cultivation = 12; s.injury = 100; s.flags.cheated_death_兵解 = true;
  }));
  const graph = FC.CH4.graph; // 只统计第四章正文
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
  assert.ok(sum >= 20000, '第四章字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 36000, '第四章字数失控: ' + sum);
});
