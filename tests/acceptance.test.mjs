import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// —— 验收测试（Task 9）：端到端脚本级走查 + 检查点接线验收 ——
// 模拟一局完整游戏（引擎级，无 DOM）：新开局 → 签苦契路线 → hub 三循环 → 失窃案装傻 → 章末。
// 断言（按实现计划 Task 9 Step 1 原文）：全程无异常；结束时 day 合理（≤400）、
// lifespanYears 已随时间减少、checkpoint 存档存在且可 load、karma.silent_witness≥1。
// 另验收（评审接办事项）：新开局即写章首检查点；"灵田喋血"致死分支死亡不吞进度、
// 可从检查点复活并继续走完本章；死亡状态下任何路径都不写检查点。

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
const FC = globalThis.FC;

// —— 测试脚手架：Node 默认无 localStorage，走内存兜底；每例清空保证隔离 ——
const REAL_LS = globalThis.localStorage;
function cleanSave() {
  FC.Save._mem.clear();
  if (REAL_LS === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = REAL_LS;
}
function freshState(name) {
  cleanSave();
  return FC.Engine.start(name || '李恒', FC.Content.graph);
}
// 依可见项 label 找序号（与引擎 show 过滤后的序一致）
function pick(s, label) {
  const v = FC.Engine.view(s, FC.Content.graph);
  const i = v.choices.findIndex((c) => c.label === label);
  if (i < 0) throw new Error('找不到选项「' + label + '」，当前 ' + s.nodeId + ' 可见项: ' + v.choices.map((c) => c.label).join('/'));
  return i;
}
// 一步：必须成功推进（全程无异常的载体断言），死亡即抛
function step(s, label) {
  const r = FC.Engine.choose(s, FC.Content.graph, pick(s, label));
  if (r && r.dead) throw new Error('意外死亡于「' + label + '」：' + s.dead);
  if (!r || r.ok !== true) throw new Error('选择被拒：「' + label + '」 ' + JSON.stringify(r));
  return r;
}
// 单选项"继续"的 scene 一路点过去
function drain(s) {
  for (let i = 0; i < 10; i++) {
    const v = FC.Engine.view(s, FC.Content.graph);
    if (v.choices.length === 1 && v.choices[0].label === '继续') step(s, '继续');
    else return;
  }
  throw new Error('drain 超限：疑似死循环于 ' + s.nodeId);
}
// 开局序章：start → 测灵大典 → 伪灵根受辱 → 入门抉择
function prologue(s) {
  step(s, '继续'); step(s, '继续'); step(s, '继续');
}
// hub 三整月常规行动 + 灵田秋收，走到灵田对质
function hubMonths(s, moves) {
  for (const label of moves) { step(s, label); drain(s); }
  step(s, '灵田秋收（季末，随队下田）');
  drain(s);
}
// 签苦契上山，走到外门岁月 hub
function signedRoute(s) {
  prologue(s);
  step(s, '落云宗十年苦契，签！');
  assert.equal(s.flags.signed_contract, true);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  assert.equal(s.nodeId, '外门岁月');
}
// 章末段：对峙前夜 → 执法堂路由 → 章末夜话 → 床板残页 → 第一章终
function finale(s, pageChoice) {
  step(s, '继续'); // 对峙前夜
  step(s, '继续'); // 执法堂（按 karma 路由）
  step(s, '继续'); // 章末夜话
  step(s, '继续'); // 床板残页
  step(s, pageChoice); // 残页抉择 → 第一章终
  assert.equal(s.nodeId, '第一章终');
}

// ———— 检查点接线：新开局 → 章首检查点 ————

test('验收·新开局：章首检查点立即写入且与初始进度一致（存活、第 1 天、入口 start）', () => {
  const s = freshState('韩立');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '新开局应已写章首检查点');
  assert.equal(cp.nodeId, 'start');
  assert.equal(cp.day, 1);
  assert.equal(cp.name, '韩立');
  assert.equal(FC.State.isDead(cp), false);
  assert.deepEqual(cp, s, '检查点应为完整初始进度');
});

// ———— brief Step 1 原文验收：端到端全流程 ————

test('验收·端到端：签苦契→hub三循环→失窃案装傻→章末，全程无异常；day≤400、寿元减少、章末检查点可load、silent_witness≥1', () => {
  const s = freshState('韩立');
  signedRoute(s);
  hubMonths(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  assert.equal(s.karma.ch1_month, 3);
  step(s, '垂下眼皮：“小人来的晚，什么也没瞧见。”'); // 失窃案装傻
  assert.equal(s.karma.silent_witness, 1);
  finale(s, '原样藏回床板，来日再参');
  // —— 结束时验收断言（brief Step 1）——
  assert.ok(s.day <= 400, 'day 应 ≤400，实际 ' + s.day);
  assert.ok(s.day >= 100, 'hub 三月+秋收的时间应已流逝，实际 ' + s.day);
  assert.ok(s.lifespanYears < 9, 'lifespanYears 应已随时间减少，实际 ' + s.lifespanYears);
  assert.ok(s.karma.silent_witness >= 1, 'silent_witness 应 ≥1');
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, 'checkpoint 存档应存在且可 load');
  assert.deepEqual(cp, s, '章末检查点应为当前完整进度');
  assert.ok(FC.Save.load('auto'), 'auto 存档应随剧情推进存在');
});

// ———— 死亡复活走查：灵田喋血致死分支 ————

test('验收·死亡不吞进度：灵田喋血真死后检查点仍是章首存活进度，死亡状态写检查点被拒', () => {
  const s = freshState('李恒');
  signedRoute(s);
  hubMonths(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '举着火折子，直接翻档房的窗户找账册');
  assert.equal(s.nodeId, '夜探败露');
  step(s, '拼死往林子里闯');
  assert.equal(s.nodeId, '灵田喋血'); // 死前 scene：死亡在其"继续"上结算
  step(s, '继续');
  assert.equal(s.dead, 'combat', '无豁免应真死');
  assert.ok(FC.State.isDead(s));
  assert.ok(FC.Save.load('auto'), '死亡状态照常落 auto（进度不吞）');
  // —— 检查点未被死亡流程改写：仍是章首存活进度 ——
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '章首检查点应存在');
  assert.equal(cp.nodeId, 'start');
  assert.equal(cp.day, 1);
  assert.equal(FC.State.isDead(cp), false, '检查点必须是存活进度（死亡不吞进度）');
  // —— 死亡状态下任何写检查点的路径都不存在：Save 层直接拒绝 ——
  const r = FC.Save.save(s, 'checkpoint');
  assert.deepEqual(r, { ok: false, reason: 'dead' });
  assert.deepEqual(FC.Save.load('checkpoint'), cp, '拒绝后检查点原样保留');
});

test('验收·检查点复活：从章首检查点苏醒后可继续走完全章并再次落章末检查点', () => {
  // 先制造一局死亡（同上路线），再取检查点复活
  const s = freshState('李恒');
  signedRoute(s);
  hubMonths(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '举着火折子，直接翻档房的窗户找账册');
  step(s, '拼死往林子里闯');
  step(s, '继续');
  assert.equal(s.dead, 'combat');
  // —— UI「从检查点苏醒」的等价动作：load('checkpoint') 并接管 ——
  const revived = FC.Save.load('checkpoint');
  assert.ok(revived, '复活必须能读到检查点');
  assert.equal(FC.State.isDead(revived), false);
  assert.equal(revived.nodeId, 'start');
  assert.equal(revived.day, 1);
  // —— 复活点可继续游戏：走完全章（签苦契→hub→装傻→章末）——
  signedRoute(revived);
  hubMonths(revived, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  step(revived, '垂下眼皮：“小人来的晚，什么也没瞧见。”');
  finale(revived, '原样藏回床板，来日再参');
  assert.equal(revived.karma.silent_witness, 1);
  assert.ok(revived.day <= 400, '复活后重走全章 day 仍应 ≤400，实际 ' + revived.day);
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp && cp.nodeId === '第一章终', '复活后的新一周目应在章末再次落检查点');
});

// ———— 检查点机制单元：注册节点进入即写；death 节点绝不写 ————

test('验收·检查点机制：setCheckpointNode 注册的节点进入时写检查点；death 节点进入不写', () => {
  const kept = FC.Content.meta.checkpointNode;
  try {
    // —— 注册章末节点：进入即写 ——
    FC.Engine.setCheckpointNode('终章');
    cleanSave();
    const g = {
      start: { type: 'scene', text: '开场。', goto: '终章' },
      终章: { type: 'scene', text: '章末。', terminal: true },
    };
    const s = FC.Engine.start('韩立', g);
    assert.equal(FC.Save.load('checkpoint').nodeId, 'start', '新开局写章首检查点');
    FC.Engine.choose(s, g, 0);
    const cp = FC.Save.load('checkpoint');
    assert.equal(cp.nodeId, '终章', '进入注册的章末节点应写检查点');
    assert.deepEqual(cp, s);
    // —— death 节点即使是注册的检查点节点也绝不写（死亡不吞进度）——
    FC.Engine.setCheckpointNode('殁');
    cleanSave();
    const g2 = {
      start: { type: 'scene', text: '入绝地。', goto: '殁' },
      殁: { type: 'death', cause: 'combat', text: '殁。' },
    };
    const s2 = FC.Engine.start('李恒', g2);
    assert.equal(FC.Save.load('checkpoint').nodeId, 'start');
    FC.Engine.choose(s2, g2, 0);
    assert.equal(s2.dead, 'combat');
    assert.equal(FC.Save.load('checkpoint').nodeId, 'start', 'death 节点不得写检查点');
  } finally {
    FC.Engine.setCheckpointNode(kept); // 重注册 kept：检查点注册为 Set 累积语义，重复注册是无害 no-op（原注册并未被移除，并非"还原"）
  }
});
