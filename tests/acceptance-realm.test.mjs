// 人界篇整体验收（Task 8，最终验收）：
//   1. registry 终验：7 章全部合并、合并图节点零丢失零重复（各章包两两不相交且并集=合并图）、
//      FC.Content.chapters 7 章、检查点累积注册 7 锚点（各章章首 + ch1 的「第一章终」）、
//      重复 register() 幂等、FC.Test.validate 全绿、图中物品引用全部登记
//   2. 全篇最短通关走查：ch1→ch7 终局，终态 cultivation===19（化神）、day 有界、
//      途经 7 个章节检查点逐个验收（存活、与当前进度一致、载入即可继续渲染=可复活）
//   3. 旧存档兼容：cultivation=1 的手工 state 直接置入 ch2 入口节点可继续游玩；
//      FC.REALMS 前 13 项（v1 全表）语义不变
//   4. `~` 面板 setRealm 跳 19：不越界（99/-3 截断）、化神 +300 寿元档精确；面板 DOM（假环境）
//      境界下拉 20 档生效；章节跳转 7 章入口（FC.Content.chapters）全通
//   5. 三结局各触发一次（state 构造最短条件）：台路/撼路 → ending_ascend、坐化 → ending_legacy
//      （均 terminal、不走死亡流程）；老死走寿元归零死亡流程（dead='lifespan'、检查点不被改写）
//
// day 预算说明（与计划 Task 8「day ≤3000」的偏差裁定）：
//   计划写 ≤3000 时第五章「闭关百年」合同尚未定型。已交付内容中，ch5 心魔劫以 ch5_century_done
//   为门槛（ch5.js：直面元婴关 show 需该旗），全图唯一来源是「闭关百年」time 36500 天——
//   ch5.test.mjs 已精确断言 day+36500，属 240/240 基线的一部分，不可绕开。
//   故最短通关 day 必然 >36500（实测 38835）。验收上界取 ≤50000（百年闭关 + 各章岁月的余量），
//   下界取 >36500（必须含那一次闭关）；3000 一值在报告中记为计划值过时，非游戏缺陷。
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

// —— 走查脚手架（与 ch7.test.mjs 同式）——
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
// 章节检查点验收（进入检查点节点时）：引擎应已写 'checkpoint'，且与当前进度一致、存活、载入即可渲染（可复活）
function assertCpAt(s, id, tag) {
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, tag + '：检查点应已写入');
  assert.equal(cp.nodeId, id, tag + '：检查点应停在 ' + id);
  assert.equal(FC.State.isDead(cp), false, tag + '：检查点必须为存活进度（死亡不吞进度）');
  assert.deepEqual(cp, s, tag + '：检查点应为当前完整进度');
  const v = FC.Engine.view(cp, G()); // 复活验收：从检查点苏醒后可继续渲染（UI 从 checkpoint load 的等价动作）
  assert.ok(typeof v.text === 'string' && v.text.length > 0, tag + '：检查点载入后应可渲染正文');
}
// 检查点未被后续进度改写（章内推进后仍停在章首锚点）：只验指向与存活，不与当前进度比对
function assertCpUntouched(id, tag) {
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, tag + '：检查点应存在');
  assert.equal(cp.nodeId, id, tag + '：检查点应仍停在 ' + id + '（不被章内推进改写）');
  assert.equal(FC.State.isDead(cp), false, tag + '：检查点必须为存活进度');
}

// —— 第一章走法（留镇线 + 夜探线，ch7.test.mjs 已验证路线）——
function ch1HubMonths(s, moves) {
  for (const label of moves) {
    step(s, label);
    drain(s);
    if (label.indexOf('偷偷修炼') >= 0) {
      step(s, '先花一文糊上油纸，只练半个时辰'); // 谨慎必成：cultivation+1（ch1 唯一进层来源）
      drain(s);
    }
  }
  step(s, '灵田秋收（季末，随队下田）');
  drain(s);
}
function ch1Route(s) {
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 序章三段
  step(s, '先活下来：留镇当账房伙计'); // +4 灵石，保底路线
  drain(s); drain(s); drain(s); // 账房→王管事→点卯
  ch1HubMonths(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '偷偷修炼（柴房夜练，自担风险）']);
  assert.equal(s.cultivation, 2, '第一章应以炼气二层收束');
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '捏紧张铁给的金刃符，贴着田垄摸近档房'); // 有备必成 → knows_truth
  drain(s); // 夜探真相 → 对峙前夜 → 执法堂洗清 → 章末夜话 → 床板残页
  step(s, '原样藏回床板，来日再参'); // → 第一章终
  assert.equal(s.nodeId, '第一章终');
}

// —— 第二章走法（苦功流，至 ch2_end 为止；章际跨越由走查主流程显式驱动）——
function ch2Route(s) {
  drain(s); // ch2_start → 榜帖风波 → 备战 hub
  assert.equal(s.nodeId, 'ch2_备战');
  while (s.cultivation < 4) { step(s, '苦修《长春功》（进一层）'); drain(s); }
  while ((s.karma.ch2_prep || 0) < 3) { step(s, '打探大比规矩与对手'); drain(s); }
  step(s, '大比开幕（三月备战期满）'); drain(s); drain(s);
  step(s, '按下不表，稳稳过试');
  drain(s);
  step(s, '缠住他，耗到破绽'); // 炼气四必胜
  assert.equal(s.nodeId, 'ch2_斗法胜');
  step(s, '继续'); // → 救场抉择
  step(s, '名次就要定了——垂手，别动');
  drainTo(s, 'ch2_记名岁月');
  while (s.cultivation < 6) { step(s, '后山苦修（全本行气）'); drain(s); }
  step(s, '冲击七层关隘'); drain(s);
  s.lingshi = Math.max(s.lingshi, 40);
  step(s, '先购两剂固本散垫底');
  step(s, '继续'); drain(s);
  assert.equal(s.cultivation, 7, '第二章应以炼气七收束');
  for (let i = 0; i < 2; i++) { step(s, '记名当值（档房与坊市，月俸三灵石）'); drain(s); }
  step(s, '直面七层瓶颈（章末）');
  s.lingshi = Math.max(s.lingshi, 40);
  step(s, '购灵药固本丹（百草堂，十五灵石）');
  assert.equal(s.nodeId, 'ch2_购丹');
  step(s, '继续'); // 购丹叙事 → ch2_end（合并图中已接线，落点即本章末）
  assert.equal(s.nodeId, 'ch2_end');
}

// —— 第三章走法（剿矿正道 + 硬闯筑基，至章末 ch3_end）——
function ch3Route(s) {
  step(s, '替宗门剿西矿矿盗（危险正道，得宗门贡献）'); drain(s);
  assert.equal(s.nodeId, 'ch3_剿矿');
  s.luck = Math.max(s.luck, 30); // 谨慎试探必成的门槛
  step(s, '先探矿道，再合围');
  assert.equal(s.nodeId, 'ch3_剿矿胜');
  step(s, '继续');
  step(s, '继续'); step(s, '继续'); step(s, '继续'); step(s, '继续');
  drain(s);
  assert.equal(s.nodeId, 'ch3_筑基岁月');
  step(s, '直面筑基关（章末）'); drain(s);
  step(s, '一枚丹硬闯：药力不足，拿命去填');
  step(s, '把心一横，气沉脚底——气起于踵'); // 残页口径必成
  assert.equal(s.nodeId, 'ch3_硬闯成');
  step(s, '继续'); // 离开硬闯成时入账：cultivation +3 → 筑基一层（效果挂硬闯成节点，choose 离开时结算）
  assert.equal(s.cultivation, 10, '第三章应以筑基一层收束（+3 效果于离开节点时入账）');
  // 内门→传书→锦囊/家书→魔气→ch3_end 全程单「继续」，显式步进到章末落点
  //（不能 drainTo：接线后的 ch3_end 带 goto，drain 会一口气穿过它直达 ch4 入侵抉择）
  for (let i = 0; i < 12 && s.nodeId !== 'ch3_end'; i++) step(s, '继续');
  assert.equal(s.nodeId, 'ch3_end', '应显式步进至章末 ch3_end');
}

// —— 第四章走法（撤离线 → 凝魂丹稳渡 → 结丹二，至 ch5 散修岁月）——
function ch4Route(s) {
  step(s, '随溃流撤下山去（保命，与宗门库藏失散）');
  assert.equal(s.nodeId, 'ch4_撤离');
  step(s, '继续'); step(s, '继续'); step(s, '继续');
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
  drainTo(s, 'ch4_end');
}

// —— 第五章走法（攀层 → 夺宝得古卷 → 闭关百年 → 心魔了结 → 稳渡 → 元婴二 → 对决胜）——
function ch5Route(s) {
  while (s.cultivation < 15) { step(s, '闭关静修（行气淬炼，结丹层数精进）'); drain(s); }
  assert.equal(s.cultivation, 15);
  step(s, '佣斗夺宝（赏格与机缘，都在刀口上）');
  step(s, '继续');
  assert.equal(s.inventory['婴变古卷'], 1, '佣斗夺宝应得婴变古卷');
  step(s, '闭关百年（一键百年，出关物是人非）'); // 36500 天：ch5 心魔劫的定死门槛（见文件头说明）
  step(s, '继续');
  assert.equal(s.flags.ch5_century_done, true);
  step(s, '直面元婴关（章末）');
  assert.equal(s.nodeId, 'ch5_心魔劫');
  step(s, '执法堂旧案：入梦重回档房那一夜');
  step(s, '继续');
  step(s, '执念已了，直面元婴关（章末突破）');
  step(s, '以《婴变古卷》为引，水到渠成闯元婴关');
  step(s, '继续');
  assert.equal(FC.REALMS[s.cultivation], '元婴一层');
  step(s, '乘势再进一层（元婴二层，寿元再添）');
  step(s, '出关迎敌（章末对决）');
  step(s, '正面迎战：婴变初啼，以战止战');
  step(s, '继续');
  assert.equal(s.nodeId, 'ch5_end');
  assert.equal(s.flags.kurong_slain, true);
  assert.equal(s.inventory['枯荣令'], 1);
}

// —— 第六章走法（打探 → 攀层 → 入府 → 三钥 → 化神）——
function ch6Route(s) {
  step(s, '打探通天遗府的来历（坊市旧闻与古籍）');
  step(s, '继续');
  assert.equal(s.flags.ch6_yifu_heard, true);
  while (s.cultivation < 18) { step(s, '闭关静修（行气淬炼，元婴层数精进）'); drain(s); }
  assert.equal(s.cultivation, 18);
  step(s, '遣赴坠星原，寻通天遗府（章末入府）');
  step(s, '继续'); // ch2_quanben 残页兑现 → 外门自开
  step(s, '继续');
  assert.equal(s.inventory['界纹玉钥'], 1);
  assert.equal(s.flags.key_jade, true);
  step(s, '探星宫，历练夺宝（星核之藏）');
  step(s, '稳取：以元婴神识缓蚀星傀阵眼，先断灵机');
  step(s, '继续');
  assert.equal(s.flags.key_core, true);
  step(s, '以枯荣令为引，炼化通天令');
  step(s, '继续');
  assert.equal(s.flags.key_token, true);
  step(s, '直登化神台（章末突破）');
  step(s, '三钥齐备，以通天之礼稳破化神');
  step(s, '继续');
  assert.equal(s.cultivation, 19, '化神成应至 19');
  assert.equal(s.flags.mortal_limit, true, '化神成应置 mortal_limit（终章入口条件）');
  step(s, '继续'); // 大限钟声 → ch6_end
  drainTo(s, 'ch6_end');
}

// ———— 1. registry 终验 ————

test('验收·registry 终验：7 章全合并、节点零丢失零重复、章节表 7 章、检查点 7 锚点、幂等、validate 全绿、物品全登记', () => {
  const g = G();
  // —— 7 章包全部挂载，节点并入合并图 ——
  const packs = [FC.CH1, FC.CH2.graph, FC.CH3.graph, FC.CH4.graph, FC.CH5.graph, FC.CH6.graph, FC.CH7.graph];
  for (const [pi, pack] of packs.entries()) {
    assert.ok(pack && typeof pack === 'object', '章节包 #' + (pi + 1) + ' 未挂载');
    for (const id of Object.keys(pack)) assert.ok(g[id], 'ch' + (pi + 1) + ' 节点丢失: ' + id);
  }
  // —— 节点无重复 id：各章包两两不相交，且合并图大小 = 各章包大小之和（无覆盖合并）——
  const seen = new Set();
  let sum = 0;
  for (const [pi, pack] of packs.entries()) {
    for (const id of Object.keys(pack)) {
      assert.ok(!seen.has(id), '节点 id 重复（ch' + (pi + 1) + ' 与更早章节）: ' + id);
      seen.add(id);
    }
    sum += Object.keys(pack).length;
  }
  assert.equal(Object.keys(g).length, sum, '合并图节点数应等于各章包之和（无覆盖）');
  // —— 章节表：7 章、章号 1..7、标题与检查点锚点齐备 ——
  assert.equal(FC.CONTENT_SOURCES.join(','), 'CH2,CH3,CH4,CH5,CH6,CH7', 'CONTENT_SOURCES 应含 CH2~CH7');
  const chapters = FC.Content.chapters;
  assert.equal(chapters.length, 7, 'FC.Content.chapters 应为 7 章');
  const expectedCp = ['第一章终', 'ch2_start', 'ch3_start', 'ch4_start', 'ch5_start', 'ch6_start', 'ch7_start'];
  chapters.forEach((c, i) => {
    assert.equal(c.chapter, i + 1, '章节表第 ' + (i + 1) + ' 项章号应连续');
    assert.ok(c.title, '章节表第 ' + (i + 1) + ' 项缺标题');
    assert.equal(c.checkpointNode, expectedCp[i], '章节表第 ' + (i + 1) + ' 项检查点锚点应为 ' + expectedCp[i]);
  });
  // —— 检查点多节点累积注册：7 锚点齐（各章章首 + ch1 的「第一章终」）——
  for (const id of expectedCp) {
    assert.ok(FC.Engine._checkpointNodes.has(id), '检查点未注册: ' + id);
  }
  assert.equal(FC.Engine._checkpointNodes.size, 7, '检查点注册应恰为 7 个锚点');
  // —— 幂等终验：重复 register() 不增节点、不增检查点，validate 全绿 ——
  const before = Object.keys(g).length;
  const cpBefore = FC.Engine._checkpointNodes.size;
  FC.ContentRegistry.register();
  FC.ContentRegistry.register();
  assert.equal(Object.keys(G()).length, before, '重复注册不得新增节点');
  assert.equal(FC.Engine._checkpointNodes.size, cpBefore, '重复注册不得新增检查点');
  assert.deepEqual(FC.Test.validate(G()), { ok: true, errors: [] }, '合并图 validate 应全绿');
  // —— 物品引用全部登记（7 章 & 并集口径，强于各章测试的单章扫描）——
  const refs = new Set();
  const scan = (fx) => (fx || []).forEach((e) => { if (e.type === 'item') refs.add(e.id); });
  for (const id of Object.keys(g)) {
    const n = g[id];
    scan(n.effects);
    for (const c of n.choices || []) scan(c.effects);
    for (const a of n.actions || []) scan(a.effects);
  }
  for (const id of refs) assert.ok(FC.ITEMS[id], '图中引用未登记物品: ' + id);
  assert.ok(refs.size >= 20, '全篇物品引用应成规模，实际 ' + refs.size);
});

// ———— 2. 全篇最短通关走查 ————

test('验收·全篇最短通关走查：ch1→ch7 终局，终态化神（19）、day 有界、7 章检查点逐个存活可复活', () => {
  const s = freshState('韩立');
  assertCpAt(s, 'start', '开局');
  const dayAt = {};
  // —— 第一章 ——
  ch1Route(s);
  dayAt.ch1 = s.day;
  assertCpAt(s, '第一章终', '第一章终');
  step(s, '继续'); // 章际接线 → ch2_start
  assert.equal(s.nodeId, 'ch2_start');
  assertCpAt(s, 'ch2_start', '第二章入口');
  // —— 第二章 ——
  ch2Route(s);
  dayAt.ch2 = s.day;
  assertCpUntouched('ch2_start', 'ch2_end 处检查点'); // ch2 注册的是章首，章末不改写
  step(s, '继续'); // ch2_end（接线）→ ch3_start
  assert.equal(s.nodeId, 'ch3_start');
  assertCpAt(s, 'ch3_start', '第三章入口');
  // —— 第三章 ——
  drainTo(s, 'ch3_机缘抉择');
  ch3Route(s);
  dayAt.ch3 = s.day;
  step(s, '继续'); // ch3_end（章际接线 goto ch4_start）→ 恰停于第四章检查点锚点
  assert.equal(s.nodeId, 'ch4_start');
  assertCpAt(s, 'ch4_start', '第四章入口');
  step(s, '继续'); // ch4_start（接线入口，单「继续」）→ ch4_入侵抉择
  // —— 第四章 ——
  ch4Route(s);
  dayAt.ch4 = s.day;
  step(s, '继续'); // ch4_end（接线）→ ch5_start
  assert.equal(s.nodeId, 'ch5_start');
  assertCpAt(s, 'ch5_start', '第五章入口');
  // —— 第五章 ——
  drainTo(s, 'ch5_散修岁月');
  ch5Route(s);
  dayAt.ch5 = s.day;
  assert.ok(dayAt.ch5 - dayAt.ch4 >= 36500, '第五章必含一次闭关百年（36500 天）');
  step(s, '继续'); // ch5_end（接线）→ ch6_start
  assert.equal(s.nodeId, 'ch6_start');
  assertCpAt(s, 'ch6_start', '第六章入口');
  // —— 第六章 ——
  drainTo(s, 'ch6_元婴岁月');
  ch6Route(s);
  dayAt.ch6 = s.day;
  step(s, '继续'); // ch6_end（接线）→ ch7_start
  assert.equal(s.nodeId, 'ch7_start');
  assertCpAt(s, 'ch7_start', '终章入口');
  // —— 终章：最短至终局（坐化传道，hub 起 2 步）——
  drain(s);
  assert.equal(s.nodeId, 'ch7_hub');
  dayAt.ch7 = s.day;
  step(s, '坐化传道（散尽功力，了此残躯）');
  step(s, '坐化。把这一身功力，散给天下的灵根少年');
  // —— 终态断言 ——
  assert.equal(s.nodeId, 'ending_legacy', '全篇走查应至终局节点');
  assert.equal(s.cultivation, 19, '终态修为应为 19');
  assert.equal(FC.REALMS[s.cultivation], '化神', '终态大境界应为化神');
  assert.equal(s.flags.mortal_limit, true);
  assert.equal(FC.State.isDead(s), false, '坐化终局不走死亡流程');
  assert.equal(FC.Engine.view(s, G()).choices.length, 0, '终局应为 terminal（无选项）');
  // day 预算：必含 36500 天闭关百年（计划值 ≤3000 早于该合同，见文件头说明）；上界 50000 为余量
  assert.ok(s.day > 36500, '总 day 应含一次闭关百年，实际 ' + s.day);
  assert.ok(s.day <= 50000, '总 day 应在上界内（最短通关实测 ~3.9 万天），实际 ' + s.day);
  // 终局不改写检查点：仍停在 ch7_start（复活点）
  assert.equal(FC.Save.load('checkpoint').nodeId, 'ch7_start', '终局不得改写章首检查点');
  // 走查分章 day 账目（供报告）：每章均正增长
  assert.ok(dayAt.ch1 > 1 && dayAt.ch2 > dayAt.ch1 && dayAt.ch3 > dayAt.ch2 && dayAt.ch4 > dayAt.ch3 && dayAt.ch5 > dayAt.ch4 && dayAt.ch6 > dayAt.ch5 && dayAt.ch7 >= dayAt.ch6,
    '各章 day 应单调不减: ' + JSON.stringify(dayAt));
});

// ———— 3. 旧存档兼容 ————

test('验收·旧存档兼容：cultivation=1 手工 state 直入 ch2_start 可继续游玩；REALMS 前 13 项语义不变', () => {
  // —— REALM 语义：扩容只追加，v1 全表（0=凡人 … 12=筑基三层）原样 ——
  assert.equal(FC.REALMS.length, 20, '境界表应扩至 20 级');
  assert.deepEqual(FC.REALMS.slice(0, 13),
    ['凡人', '炼气一层', '炼气二层', '炼气三层', '炼气四层', '炼气五层', '炼气六层', '炼气七层', '炼气八层', '炼气九层', '筑基一层', '筑基二层', '筑基三层'],
    '前 13 项（v1 全表）语义不得改变');
  assert.equal(FC.REALMS[19], '化神');
  assert.deepEqual(FC.REALM_TIERS, { 凡人: 0, 炼气: 1, 筑基: 10, 结丹: 13, 元婴: 16, 化神: 19 });
  // —— 旧存档形态：cultivation=1（炼气一层）、中期 day、无新章旗标 ——
  cleanSave();
  const old = FC.State.create('李恒');
  assert.equal(old.cultivation, 1);
  assert.equal(FC.REALMS[old.cultivation], '炼气一层');
  old.nodeId = 'ch2_start'; // 直接置入第二章入口（模拟旧档续玩，不经 ch1）
  old.lingshi = 5;
  old.day = 400;
  old.lifespanYears = 8;
  // 开局正文按旧档境界渲染（低分支），并可正常推进
  const v0 = FC.Engine.view(old, G());
  assert.match(v0.text, /炼气一层/, 'ch2 开局应按炼气一层渲染旧档');
  step(old, '继续'); // ch2_start → 榜帖风波（自动落 auto）
  assert.equal(old.nodeId, 'ch2_榜帖风波');
  assert.ok(FC.Save.load('auto'), '旧档续玩应照常落自动档');
  drain(old);
  assert.equal(old.nodeId, 'ch2_备战');
  // hub 行动照常：苦修进层 → 炼气二层（REALMS 下标语义不变）
  step(old, '苦修《长春功》（进一层）');
  drain(old);
  assert.equal(old.cultivation, 2);
  assert.equal(FC.REALMS[old.cultivation], '炼气二层');
  assert.equal(old.nodeId, 'ch2_备战');
});

// ———— 4. `~` 面板 setRealm 跳 19 ————

// 假环境（与 devpanel.test.mjs 同式）：只实现面板用到的极窄 DOM 面
function makeEl(tag) {
  const el = {
    tag: tag, id: '', children: [], style: {}, listeners: {},
    textContent: '', value: '', checked: false, type: '', min: '', max: '', step: '',
    appendChild(c) { el.children.push(c); return c; },
    addEventListener(ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) { const a = el.listeners[ev] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    _fire(ev, arg) { (el.listeners[ev] || []).slice().forEach(fn => fn(arg || {})); },
  };
  return el;
}
function makeDoc() {
  const doc = {
    createElement(tag) { return makeEl(tag); },
    addEventListener() {}, removeEventListener() {},
  };
  return doc;
}

test('验收·~ 面板 setRealm 跳 19：不越界、化神 +300 寿元档精确；面板境界下拉 20 档生效；章节跳转 7 章入口全通', () => {
  // —— 数据动作：跳 19 恰为化神档 +300，不越界 ——
  cleanSave();
  const s = freshState('李恒');
  FC.Dev.setRealm(s, 19);
  assert.equal(s.cultivation, 19, 'setRealm(19) 应恰至 19');
  assert.equal(FC.REALMS[s.cultivation], '化神');
  assert.ok(Math.abs(s.lifespanYears - (9 + 300)) < 1e-9, '跳 19 应按化神档 +300 寿元，实际 ' + s.lifespanYears);
  // 越界截断（独立 state，免加成叠加干扰账目）：99 → 19（仍 +300 档）、-3 → 0（凡人 +0、跳下不扣回）
  const s2 = FC.State.create('王铁柱');
  FC.Dev.setRealm(s2, 99);
  assert.equal(s2.cultivation, 19, '越界上探应截到 19（不越界）');
  assert.ok(Math.abs(s2.lifespanYears - (9 + 300)) < 1e-9, '越界截到 19 应补足该层 +300 档');
  FC.Dev.setRealm(s2, -3);
  assert.equal(s2.cultivation, 0, '越界下探应截到 0');
  assert.ok(Math.abs(s2.lifespanYears - (9 + 300)) < 1e-9, '跳下不扣回（评审裁定语义）');
  // 加成表与境界表对齐，化神档 +300
  assert.equal(FC.Dev._REALM_BONUS.length, FC.REALMS.length, '寿元加成表应与境界表等长');
  assert.equal(FC.Dev._REALM_BONUS[19], 300);
  // —— 面板 DOM（假环境）：境界下拉 20 档，选 19 生效并提示化神 ——
  const doc = makeDoc();
  const el = makeEl('div');
  let renders = 0;
  const sp = FC.State.create('赵四');
  const handle = FC.Dev.mount(el, function () { return sp; }, function () { renders++; },
    { document: doc, getGraph: function () { return G(); } });
  const realmRow = handle.panel.children.find((c) => c.id === 'fc-dev-realm');
  const realmSel = realmRow.children.find((c) => c.tag === 'select');
  assert.equal(realmSel.children.length, 20, '境界下拉应有 20 档（0=凡人 … 19=化神）');
  assert.equal(realmSel.children[19].textContent, '19·化神');
  realmSel.value = '19';
  realmSel._fire('change');
  assert.equal(sp.cultivation, 19, '面板选 19 应生效');
  assert.ok(Math.abs(sp.lifespanYears - (9 + 300)) < 1e-9, '面板跳 19 应 +300 寿元，实际 ' + sp.lifespanYears);
  assert.ok(handle.status.textContent.includes('化神'), '状态行应提示化神');
  // —— 章节跳转：FC.Content.chapters 的 7 个锚点逐一可跳（面板数据动作）——
  for (const c of FC.Content.chapters) {
    const probe = FC.State.create('李恒');
    FC.Dev.jump(probe, G(), c.checkpointNode);
    assert.equal(probe.nodeId, c.checkpointNode, '应可跳转章节锚点: ' + c.checkpointNode);
    assert.ok(FC.Engine.view(probe, G()).text.length > 0, '跳转后应可渲染: ' + c.checkpointNode);
  }
  // —— 面板 UI 跳转：输入 ch7_start 生效；未知节点给中文提示且原地不动 ——
  const jumpRow = handle.panel.children.find((c) => c.id === 'fc-dev-jump');
  const jumpIn = jumpRow.children.find((c) => c.tag === 'input');
  const jumpBtn = jumpRow.children.find((c) => c.tag === 'button');
  jumpIn.value = 'ch7_start';
  jumpBtn._fire('click');
  assert.equal(sp.nodeId, 'ch7_start', '面板跳转 ch7_start 应生效');
  jumpIn.value = 'nope_node';
  jumpBtn._fire('click');
  assert.equal(sp.nodeId, 'ch7_start', '未知节点不得推进');
  assert.ok(handle.status.textContent.includes('未知节点'), '未知节点应中文提示');
});

// ———— 5. 三结局各触发一次（state 构造最短条件）———

// 终章态构造：化神 + 大限 + 足额寿元（避免付薪支线干扰最短触发）
function craftCh7(fn) {
  cleanSave();
  const s = FC.State.create('李恒');
  s.cultivation = 19;
  s.flags.mortal_limit = true;
  s.lifespanYears = 1100;
  fn(s);
  return s;
}

test('验收·结局一/二：台路与撼路均触发 ending_ascend（terminal、落定破界方式、不走死亡流程）', () => {
  // —— 台路：三宝三钥齐 → 登台破界 ——
  const s1 = craftCh7((s) => {
    s.flags.key_jade = true; s.flags.key_core = true; s.flags.key_token = true;
    s.inventory['飞升台图录'] = 1; s.inventory['界膜钉'] = 1;
    s.nodeId = 'ch7_飞升台';
  });
  step(s1, '登台破界（人界篇终）');
  assert.equal(s1.nodeId, 'ending_ascend', '集齐三宝三钥应触发飞升结局');
  assert.equal(s1.flags.ch7_ascend_way, '台', '台路应落定破界方式');
  assert.equal(FC.Engine.view(s1, G()).choices.length, 0, 'ending_ascend 应为 terminal');
  assert.equal(FC.State.isDead(s1), false, '飞升结局不走死亡流程');
  // —— 撼路：首撼白痕在档 → 复撼必破 ——
  const s2 = craftCh7((s) => {
    s.karma.ch7_mem_struck = 1; // 首撼已留白痕
    s.injury = 0;               // 门槛：伤势归零
    s.nodeId = 'ch7_膜隙';
  });
  step(s2, '硬撼界膜（倾尽全力，搏一线天）');
  assert.equal(s2.nodeId, 'ch7_撼膜');
  step(s2, '继续'); // 撼膜 → 白痕之上再撼（karma 累计至 2 → 破界）
  assert.equal(s2.nodeId, 'ch7_撼膜破界');
  step(s2, '继续');
  assert.equal(s2.nodeId, 'ending_ascend', '复撼必破应同至飞升结局');
  assert.equal(s2.flags.ch7_ascend_way, '撼', '撼路应落定破界方式');
  assert.equal(FC.Engine.view(s2, G()).choices.length, 0, 'ending_ascend 应为 terminal');
  assert.equal(FC.State.isDead(s2), false);
});

test('验收·结局三：坐化触发 ending_legacy（terminal、存活态）；老死走寿元归零死亡流程且检查点不被改写', () => {
  // —— 坐化：hub 起两步 ——
  const s3 = craftCh7((s) => { s.nodeId = 'ch7_hub'; });
  step(s3, '坐化传道（散尽功力，了此残躯）');
  assert.equal(s3.nodeId, 'ch7_坐化抉择');
  step(s3, '坐化。把这一身功力，散给天下的灵根少年');
  assert.equal(s3.nodeId, 'ending_legacy', '确认坐化应至传道结局');
  assert.equal(FC.Engine.view(s3, G()).choices.length, 0, 'ending_legacy 应为 terminal');
  assert.equal(FC.State.isDead(s3), false, '坐化终局不走死亡流程');
  // —— 老死：寿元归零 → dead='lifespan' 死亡流程 ——
  const s4 = craftCh7((s) => { s.nodeId = 'ch7_hub'; s.lifespanYears = 0.01; });
  const cpBefore = FC.Save.load('checkpoint') || (FC.Save.save(JSON.parse(JSON.stringify(s4)), 'checkpoint'), FC.Save.load('checkpoint'));
  step(s4, '西行观膜（西极天垠，界膜薄弱点）'); // time 30 天 → 寿元击穿归零
  assert.equal(s4.dead, 'lifespan', '寿元归零应老死（lifespan 死亡流程）');
  assert.equal(FC.State.isDead(s4), true);
  assert.match(FC.UI.deathText(s4), /寿元耗尽/, '老死应走寿终档结局文');
  assert.ok(FC.Save.load('auto'), '死亡进度照常落 auto（死亡不吞进度）');
  // 检查点不被死亡流程改写：仍是死亡前的存活进度
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '检查点应存在');
  assert.equal(FC.State.isDead(cp), false, '检查点必须为存活进度');
  assert.ok(Math.abs(cp.lifespanYears - cpBefore.lifespanYears) < 1e-9, '检查点寿元不得被死亡流程改写');
  // 死亡状态下写检查点被 Save 层拒绝
  assert.deepEqual(FC.Save.save(s4, 'checkpoint'), { ok: false, reason: 'dead' });
});
