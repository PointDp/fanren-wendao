// 第二章《外门大比》+ 内容注册器测试（Task 2）：
//   1. registry 合并幂等：register() 重复调用，graph 节点数与检查点注册数不变
//   2. FC.Test.validate(合并后 graph) 全绿；章际接线（第一章终 → ch2_start）成立且不改写 FC.CH1
//   3. 大比三路径走查（苦功流/人情流/险棋流）各至 ch2_end，因果落点断言
//   4. 救张铁 vs 保名次因果（aff±、cold_blood、放榜名次文案）；李师姐锦囊门槛（aff_li_shijie≥2）
//   5. 落榜三分支：重整限两次、第三次劝退；突破失败路径（硬闯 → injury+40 且 cultivation-1）
//   6. 章末瓶颈：购灵药固本丹 enabled 门槛（灵石≥15）、闭关苦熬 time 365×2；ch2_start 章首检查点
//   7. 字数 ≥15000（各节点 text 并集 + 选项文案）
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
require('../js/content/registry.js');
const FC = globalThis.FC;

function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}
const G = () => FC.Content.graph; // 合并后全图（ch1 + ch2）

// —— 走查脚手架（与 content.test.mjs 同式）——
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
  for (let i = 0; i < 30; i++) {
    const v = FC.Engine.view(s, G());
    if (v.choices.length === 1 && v.choices[0].label === '继续') step(s, '继续');
    else return;
  }
  throw new Error('drain 超限：疑似死循环于 ' + s.nodeId);
}
// 推进直到到达目标节点（每轮至少过一个单选项 scene，防呆上限）
function drainTo(s, nodeId) {
  for (let i = 0; i < 40 && s.nodeId !== nodeId; i++) drain(s);
  if (s.nodeId !== nodeId) throw new Error('未能推进到 ' + nodeId + '，当前 ' + s.nodeId);
}
// 第一章 hub 三月循环（content.test 同式）；「偷偷修炼」须追加糊窗一步才能回 hub
function ch1HubMonths(s, moves) {
  for (const label of moves) {
    step(s, label);
    drain(s);
    if (label.indexOf('偷偷修炼') >= 0) {
      step(s, '先花一文糊上油纸，只练半个时辰'); // 糊窗谨慎必成：cultivation+1、luck+2（ch1 唯一进层来源）
      drain(s);
    }
  }
  step(s, '灵田秋收（季末，随队下田）');
  drain(s); // → 灵田对质
}
// —— 章尾走法（灵田对质 → 床板残页 → 第一章终），由各路线按因果挑用 ——
// 沉默线：silent_witness=1，执法堂混过（injury+5、lingshi-1）
function ch1TailSilent(s) {
  step(s, '垂下眼皮：“小人来的晚，什么也没瞧见。”');
  drain(s); // 对峙前夜 → 执法堂混过 → 章末夜话 → 床板残页
  step(s, '原样藏回床板，来日再参'); // 残页入手
}
// 夜探线：需金刃符（第二次访张铁所得）→ knows_truth=1，执法堂洗清（lingshi+5、luck+10、王管事停职）
function ch1TailNight(s) {
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '捏紧张铁给的金刃符，贴着田垄摸近档房');
  drain(s); // 夜探真相 → 对峙前夜 → 执法堂洗清 → 章末夜话 → 床板残页
  step(s, '原样藏回床板，来日再参');
}

// —— 第一章路线（到达第一章终的既定走法）——
// 签契线：上山同路 aff_zhang_tie+1；hub 起始灵石 2（访张铁每次耗 1 枚）
function ch1Qianqi(s, hubMoves, tail) {
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '落云宗十年苦契，签！');
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  ch1HubMonths(s, hubMoves);
  tail(s);
}
// 镇中线：留镇账房开局 +4 灵石、aff_steward+1；hub 起始灵石 6
function ch1Zhen(s, hubMoves, tail) {
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '先活下来：留镇当账房伙计');
  drain(s); drain(s); drain(s); // 账房→王管事→点卯
  ch1HubMonths(s, hubMoves);
  tail(s);
}

// 进第二章（穿过第一章终的章际接线），断言章首检查点
function enterCh2(s) {
  assert.equal(s.nodeId, '第一章终');
  step(s, '继续'); // 第一章终 → ch2_start
  assert.equal(s.nodeId, 'ch2_start');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '进入 ch2_start 应落章首检查点');
  assert.equal(cp.nodeId, 'ch2_start');
  drain(s); // ch2_start → ch2_榜帖风波 → ch2_备战
  assert.equal(s.nodeId, 'ch2_备战');
}

// ———— registry 与合并图 ————

test('FC.CH2 就绪：meta 定死值正确，ch2_start/ch2_end 存在，节点 id 不与 ch1 冲突', () => {
  assert.ok(FC.CH2 && FC.CH2.graph, 'FC.CH2 未挂载');
  assert.equal(FC.CH2.meta.chapter, 2);
  assert.equal(FC.CH2.meta.title, '外门大比');
  assert.equal(FC.CH2.meta.checkpointNode, 'ch2_start');
  assert.ok(FC.CH2.graph.ch2_start, '缺入口 ch2_start');
  assert.ok(FC.CH2.graph.ch2_end, '缺章末 ch2_end');
  const ch1Keys = new Set(Object.keys(FC.CH1));
  for (const id of Object.keys(FC.CH2.graph)) {
    assert.ok(!ch1Keys.has(id), '节点 id 与第一章冲突: ' + id);
  }
});

test('registry 合并：ch1+ch2 节点全在图中，章际接线成立，FC.CH1 原件未被改写', () => {
  const g = G();
  for (const id of Object.keys(FC.CH1)) assert.ok(g[id], 'ch1 节点丢失: ' + id);
  for (const id of Object.keys(FC.CH2.graph)) assert.ok(g[id], 'ch2 节点丢失: ' + id);
  assert.equal(g['第一章终'].goto, 'ch2_start', '合并图应把第一章终接到 ch2_start');
  assert.equal(FC.CH1['第一章终'].goto, undefined, 'FC.CH1 原件不得被改写');
  assert.equal(FC.CH1['第一章终'].terminal, true, 'FC.CH1 原件保持章末终局标记');
  assert.ok(FC.Engine._checkpointNodes.has('ch2_start'), 'registry 应注册 ch2_start 检查点');
  assert.ok(FC.Engine._checkpointNodes.has('第一章终'), 'ch1 既有检查点注册不变');
});

test('registry 幂等：重复 register() 后节点数与检查点注册数不变，validate 仍全绿', () => {
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

test('新道具四件登记在册，且图中引用的所有物品都有登记', () => {
  for (const id of ['筑基丹', '灵药固本丹', '李师姐的锦囊', '执法堂令牌']) {
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

// ———— 大比三路径走查 ————

test('走查·苦功流：勘误 luck+5 → 炼气四 → 大比入前十 → 授全本+残页对照 → 炼气七 → 购丹 → ch2_end', () => {
  const s = freshState();
  // 留镇线：访张铁×2（aff=2<3，第二回得金刃符）+偷偷修炼糊窗（炼气二）→ 夜探 → 洗清
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）'], ch1TailNight);
  assert.equal(s.karma.knows_truth, 1);
  const luck0 = s.luck;
  enterCh2(s);
  assert.ok((s.karma.aff_zhang_tie || 0) < 3, '苦功流路线应无人情达标（aff=' + (s.karma.aff_zhang_tie || 0) + '）');
  step(s, '参悟残页，勘误长春功');
  assert.equal(s.luck, luck0 + 5, '勘误奖励应为 luck+5');
  assert.equal(s.flags.ch2_kanwu, true);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  assert.equal(s.cultivation, 4, '备战苦功线应到炼气四');
  assert.equal(s.karma.ch2_prep, 3);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s); // 开幕 → 初试 → 复试
  step(s, '按下不表，稳稳过试');
  drain(s); // 终试前（无人情）→ 终试
  assert.equal(s.nodeId, 'ch2_终试');
  assert.equal(s.flags.ch2_renqing, undefined, '未达人情门槛不得触发助力');
  step(s, '缠住他，耗到破绽');
  assert.equal(s.nodeId, 'ch2_斗法胜', '炼气四苦功应在终试取胜');
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '名次就要定了——垂手，别动'); // 保名次
  assert.equal(s.karma.cold_blood, 1);
  drainTo(s, 'ch2_记名岁月');
  assert.equal(s.flags.ch2_quanben, 1, '授全本+残页对照应置 ch2_quanben=1');
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6);
  step(s, '冲击七层关隘'); drain(s); // → ch2_七层关
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); // 七层成
  assert.equal(s.cultivation, 7, '冲关成功应到炼气七');
  drain(s); // 回 hub
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '直面七层瓶颈（章末）');
  assert.equal(s.nodeId, 'ch2_瓶颈');
  assert.ok(s.lingshi >= 15, '走查应攒够购丹钱（当前 ' + s.lingshi + '）');
  const ls0 = s.lingshi;
  step(s, '购灵药固本丹（百草堂，十五灵石）'); drain(s);
  assert.equal(s.lingshi, ls0 - 15);
  assert.equal(s.inventory['灵药固本丹'], 1);
  assert.equal(s.nodeId, 'ch2_end');
  // 章末检查点不被 ch2_end 改写（ch2 注册的是章首锚点）
  assert.equal(FC.Save.load('checkpoint').nodeId, 'ch2_start');
});

test('走查·人情流：aff_zhang_tie≥3 助力 → 终试取胜 → 救张铁（aff+2）→ 炼气七 → ch2_end', () => {
  const s = freshState();
  // 签契线：同路+1，访张铁×2（灵石恰够）+当值一月 → aff=3；沉默收尾
  ch1Qianqi(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  assert.ok((s.karma.aff_zhang_tie || 0) >= 3);
  enterCh2(s);
  step(s, '访张铁（约着练手）');
  assert.equal(s.nodeId, 'ch2_切磋', '首次访张铁应有备战切磋一段');
  drain(s); // 切磋 → 备战
  step(s, '访张铁（约着练手）'); drain(s);
  step(s, '访张铁（约着练手）'); drain(s);
  assert.ok((s.karma.aff_zhang_tie || 0) >= 6);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  step(s, '继续'); // 终试前 → 人情助力
  assert.equal(s.nodeId, 'ch2_人情助力', 'aff≥3 应触发人情助力');
  step(s, '继续'); // 助力 → 终试
  assert.equal(s.flags.ch2_renqing, true);
  const aff0 = s.karma.aff_zhang_tie;
  step(s, '缠住他，耗到破绽');
  assert.equal(s.nodeId, 'ch2_斗法胜');
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '翻进场中，把张铁拖出来');
  assert.equal(s.karma.aff_zhang_tie, aff0 + 2, '救张铁应 aff+2');
  assert.equal(s.flags.ch2_saved_tie, true);
  assert.equal(s.karma.cold_blood, undefined, '救人不应记 cold_blood');
  drainTo(s, 'ch2_记名岁月');
  assert.equal(s.flags.ch2_quanben, 1);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6);
  step(s, '冲击七层关隘'); drain(s);
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '直面七层瓶颈（章末）');
  assert.ok(s.lingshi >= 15, '灵石应攒够: ' + s.lingshi);
  step(s, '购灵药固本丹（百草堂，十五灵石）'); drain(s);
  assert.equal(s.nodeId, 'ch2_end');
});

test('走查·险棋流：knows_truth 揭发 → 执法堂令牌 + enemy_inner=1 → 入前十 → ch2_end', () => {
  const s = freshState();
  // 留镇线：访张铁×2（得金刃符）+当值 → 夜探揭弊线；不苦修，炼气一层也该走得通（揭弊即胜负手）
  ch1Zhen(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '杂役当值（领月钱，管三餐）'], ch1TailNight);
  assert.equal(s.karma.knows_truth, 1);
  enterCh2(s);
  step(s, '参悟残页，勘误长春功'); drain(s);
  step(s, '打探大比规矩与对手'); drain(s);
  step(s, '走访百草堂（看李师姐）'); drain(s);
  assert.equal(s.karma.ch2_prep, 3);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  assert.equal(s.nodeId, 'ch2_复试');
  step(s, '当场揭发：“他袖里藏着聚气丹。”');
  assert.equal(s.nodeId, 'ch2_揭弊');
  drain(s); // 揭弊（令牌与 enemy_inner 在离开该 scene 时入账）→ 终试前 → 终试（无人情）
  assert.equal(s.karma.enemy_inner, 1, '险棋流应得罪内门（enemy_inner=1）');
  assert.equal(s.inventory['执法堂令牌'], 1, '揭弊应得执法堂令牌');
  step(s, '抢攻，搏一个先手'); // jubao 即胜
  assert.equal(s.nodeId, 'ch2_斗法胜');
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '名次就要定了——垂手，别动');
  assert.equal(s.karma.cold_blood, 1, '保名次应记 cold_blood=1');
  drainTo(s, 'ch2_记名岁月');
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6, '苦修至炼气六');
  step(s, '冲击七层关隘'); drain(s);
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s);
  step(s, '直面七层瓶颈（章末）');
  assert.ok(s.lingshi >= 15, '灵石应攒够: ' + s.lingshi);
  step(s, '购灵药固本丹（百草堂，十五灵石）'); drain(s);
  assert.equal(s.nodeId, 'ch2_end');
  assert.equal(s.flags.ch2_quanben, 1);
});

// ———— 关键抉择因果 ————

test('保名次因果：cold_blood=1、aff-1、放榜名次第七；救场名次降为第十', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  enterCh2(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  const aff0 = s.karma.aff_zhang_tie || 0;
  step(s, '抢攻，搏一个先手'); // cultivation 4 → 胜
  assert.equal(s.nodeId, 'ch2_斗法胜');
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '名次就要定了——垂手，别动');
  assert.equal(s.karma.cold_blood, 1);
  assert.equal(s.karma.aff_zhang_tie, aff0 - 1, '保名次应 aff-1');
  assert.equal(s.flags.ch2_kept_rank, true);
  const rankText = FC.Engine.view(s, G()).text; // 放榜
  assert.match(rankText, /第七/);
  assert.doesNotMatch(rankText, /第十/);
  // 救场分支：另起一局，同路到救场抉择后选救人
  const s2 = freshState();
  ch1Qianqi(s2, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  enterCh2(s2);
  step(s2, '苦修《长春功》（进一层）'); drain(s2);
  step(s2, '苦修《长春功》（进一层）'); drain(s2);
  step(s2, '苦修《长春功》（进一层）'); drain(s2);
  step(s2, '大比开幕（三月备战期满）'); drain(s2); drain(s2);
  step(s2, '按下不表，稳稳过试');
  drain(s2);
  step(s2, '抢攻，搏一个先手');
  step(s2, '继续'); // 斗法胜 scene → 救场抉择
  step(s2, '翻进场中，把张铁拖出来');
  const rankText2 = FC.Engine.view(s2, G()).text;
  assert.match(rankText2, /第十/, '救人应使名次降');
  assert.doesNotMatch(rankText2, /第七/);
});

test('李师姐赠别门槛：aff_li_shijie≥2 得锦囊与筑基丹；<2 则无', () => {
  // 达标线：ch1 坊市初遇(+1) + 备战走访×2 = 3
  const s = freshState();
  ch1Qianqi(s, ['坊市跑腿（替药铺送货，得赏钱）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  assert.equal(s.karma.aff_li_shijie, 1);
  enterCh2(s);
  step(s, '走访百草堂（看李师姐）');
  assert.equal(s.nodeId, 'ch2_百草堂', '首次走访应有百草堂一段');
  drain(s);
  step(s, '走访百草堂（看李师姐）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  step(s, '继续'); // 终试前 → 人情助力（aff_li≥3）
  step(s, '继续'); // 助力 → 终试
  assert.equal(s.flags.ch2_renqing, true);
  step(s, '缠住他，耗到破绽');
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '名次就要定了——垂手，别动');
  step(s, '继续'); // 放榜 → 记名
  step(s, '继续'); // 记名 → 师姐赠别
  assert.equal(s.nodeId, 'ch2_师姐赠别', 'aff_li≥2 应触发赠别');
  step(s, '继续'); // 离开赠别 → 授全本（锦囊与筑基丹在离开该 scene 时入账）
  assert.equal(s.nodeId, 'ch2_授全本');
  assert.equal(s.inventory['李师姐的锦囊'], 1);
  assert.equal(s.inventory['筑基丹'], 1);
  // 未达标线：不遇李师姐
  const s2 = freshState();
  ch1Qianqi(s2, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  enterCh2(s2);
  step(s2, '苦修《长春功》（进一层）'); drain(s2);
  step(s2, '苦修《长春功》（进一层）'); drain(s2);
  step(s2, '苦修《长春功》（进一层）'); drain(s2);
  step(s2, '大比开幕（三月备战期满）'); drain(s2); drain(s2);
  step(s2, '按下不表，稳稳过试');
  drain(s2);
  step(s2, '缠住他，耗到破绽');
  step(s2, '继续'); // 斗法胜 scene → 救场抉择
  step(s2, '名次就要定了——垂手，别动');
  step(s2, '继续'); // 放榜 → 记名（aff_li<2 记名直走授全本，不经赠别）
  step(s2, '继续'); // 记名 → 授全本
  assert.equal(s2.nodeId, 'ch2_授全本');
  assert.ok(!s2.inventory['李师姐的锦囊']);
});

// ———— 落榜三分支与突破失败 ————

test('落榜线：无准备必落榜；重整再战限两次，第三次劝退回杂役线至 ch2_end', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  assert.equal(s.cultivation, 1, '不修炼应保持炼气一');
  enterCh2(s);
  step(s, '打探大比规矩与对手'); drain(s);
  step(s, '走访百草堂（看李师姐）'); drain(s);
  step(s, '走访百草堂（看李师姐）'); drain(s);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '抢攻，搏一个先手');
  assert.equal(s.nodeId, 'ch2_斗法败', '炼气一无准备应落榜');
  drain(s); // → 重整
  assert.equal(s.nodeId, 'ch2_重整');
  step(s, '来年大比，再战'); drain(s); drain(s); // 开幕 → 初试 → 复试
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '抢攻，搏一个先手');
  drain(s); // → 重整（第二次）
  assert.equal(s.nodeId, 'ch2_重整');
  assert.equal(s.karma.ch2_tries, 1);
  step(s, '来年大比，再战'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '抢攻，搏一个先手');
  step(s, '继续'); // 斗法败 → 劝退（第三次落榜不再给重整）
  assert.equal(s.nodeId, 'ch2_劝退', '第三次落榜应强制劝退');
  assert.equal(s.karma.ch2_tries, 2, '重整限两次');
  step(s, '继续'); // 劝退 → ch2_end
  assert.equal(s.nodeId, 'ch2_end');
});

test('突破失败路径：硬闯药量不足 → injury+40 且 cultivation-1（退境），可重攀', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  enterCh2(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '缠住他，耗到破绽'); // cultivation 4 → 胜
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '名次就要定了——垂手，别动');
  drainTo(s, 'ch2_记名岁月');
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6);
  s.lingshi = 1; // 灵石只留 1 枚，硬闯（药量不足）
  step(s, '冲击七层关隘'); drain(s);
  const v = FC.Engine.view(s, G());
  const i = pick(s, '先购两剂固本散垫底');
  assert.equal(v.choices[i].enabled, false, '灵石不足 4 时购散应可见但禁用');
  const inj0 = s.injury;
  step(s, '心疼灵石，凭全本硬冲');
  assert.equal(s.nodeId, 'ch2_七层挫', '低机缘硬闯应失败');
  step(s, '继续'); // 失败效果在离开该 scene 时入账
  assert.equal(s.injury, Math.min(100, inj0 + 40), '硬闯失败应 injury+40');
  assert.equal(s.cultivation, 5, '退境应 cultivation-1');
  assert.equal(s.nodeId, 'ch2_记名岁月');
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6, '苦修重攀回六');
  s.lingshi = 10;
  step(s, '冲击七层关隘'); drain(s);
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7);
});

// ———— 章末瓶颈 ————

test('瓶颈选项：购丹 enabled=灵石≥15（不足可见但禁用）；闭关苦熬 time 365×2 且寿元自然流逝', () => {
  const s = freshState();
  ch1Qianqi(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）'], ch1TailSilent);
  enterCh2(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '苦修《长春功》（进一层）'); drain(s);
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '缠住他，耗到破绽'); // cultivation 4 → 胜
  step(s, '继续'); // 斗法胜 scene → 救场抉择
  step(s, '名次就要定了——垂手，别动');
  drainTo(s, 'ch2_记名岁月');
  step(s, '后山苦修（全本行气）'); drain(s);
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6);
  s.lingshi = 10;
  step(s, '冲击七层关隘'); drain(s);
  step(s, '心疼灵石，凭全本硬冲'); // 本路线机缘低（未勘误）→ 硬闯失败
  assert.equal(s.nodeId, 'ch2_七层挫');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 5, '退境后应为炼气五');
  step(s, '后山苦修（全本行气）'); drain(s);
  assert.equal(s.cultivation, 6, '重攀回六');
  step(s, '冲击七层关隘'); drain(s);
  s.lingshi = 10;
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7);
  step(s, '直面七层瓶颈（章末）');
  assert.equal(s.nodeId, 'ch2_瓶颈');
  s.lingshi = 14;
  let v = FC.Engine.view(s, G());
  let i = pick(s, '购灵药固本丹（百草堂，十五灵石）');
  assert.equal(v.choices[i].enabled, false, '灵石 14 时购丹应可见但禁用');
  const r = FC.Engine.choose(s, G(), i);
  assert.deepEqual(r, { ok: false, reason: 'disabled' });
  assert.equal(s.nodeId, 'ch2_瓶颈', '被拒后不得推进');
  s.lingshi = 15;
  assert.equal(FC.Engine.view(s, G()).choices[pick(s, '购灵药固本丹（百草堂，十五灵石）')].enabled, true);
  const day0 = s.day, life0 = s.lifespanYears;
  step(s, '闭关苦熬，以年月磨这堵墙');
  drain(s); // 闭关 → ch2_end
  assert.equal(s.nodeId, 'ch2_end');
  assert.equal(s.day, day0 + 730, '闭关应 time 365×2');
  assert.ok(Math.abs((life0 - s.lifespanYears) - 2) < 1e-9, '寿元应自然流逝 2 年');
  assert.equal(s.cultivation, 7, '闭关不破境');
});

// ———— 字数 ————

test('字数统计：第二章正文（各节点 text 并集）+ 选项文案合计 ≥15000 字', () => {
  // 探测状态覆盖分支文本：开局态、苦功态、险棋态、锦囊态、落榜态、章末诸态
  const probes = [];
  probes.push(FC.State.create('李恒'));
  const crafted = (fn) => {
    const s = FC.State.create('李恒');
    fn(s);
    return s;
  };
  probes.push(crafted((s) => { // 苦功/胜/保名次/记名态
    s.cultivation = 4; s.karma.knows_truth = 1; s.flags.ch2_kanwu = true;
    s.karma.aff_zhang_tie = 2; s.flags.ch2_kept_rank = true; s.flags.ch2_intel = true;
  }));
  probes.push(crafted((s) => { // 险棋/救人态
    s.cultivation = 2; s.karma.knows_truth = 1; s.flags.ch2_jubao = true;
    s.karma.aff_zhang_tie = 5; s.flags.ch2_saved_tie = true;
  }));
  probes.push(crafted((s) => { // 人情/锦囊态
    s.cultivation = 4; s.karma.aff_zhang_tie = 6; s.karma.aff_li_shijie = 3;
    s.flags.ch2_renqing = true; s.flags.ch2_jinnang = true; s.flags.ch2_tie_met = true; s.flags.ch2_li_visit = true;
  }));
  probes.push(crafted((s) => { // 落榜/重整态
    s.cultivation = 2; s.karma.ch2_tries = 1; s.karma.cold_blood = 1;
  }));
  probes.push(crafted((s) => { // 章末态：全本+购丹+令牌
    s.cultivation = 7; s.flags.ch2_quanben = 1; s.flags.ch2_jiming = true; s.flags.ch2_guben = true;
    s.inventory['灵药固本丹'] = 1; s.inventory['执法堂令牌'] = 1; s.inventory['筑基丹'] = 1;
    s.karma.enemy_inner = 1; s.lingshi = 2;
  }));
  probes.push(crafted((s) => { // 章末态：落榜劝退线
    s.cultivation = 3; s.karma.ch2_tries = 2; s.day = 900;
  }));
  const graph = FC.CH2.graph; // 只统计第二章正文（第一章字数归 content.test 管）
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
  assert.ok(sum >= 15000, '第二章字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 26000, '第二章字数失控: ' + sum);
});
