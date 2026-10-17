import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/effects.js');
require('../js/save.js');
require('../js/engine.js');
const FC = globalThis.FC;

// —— 测试脚手架：Node 默认无 localStorage，引擎自动档走内存兜底；每例清空保证隔离 ——
const REAL_LS = globalThis.localStorage;
function cleanSave() {
  FC.Save._mem.clear();
  if (REAL_LS === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = REAL_LS;
}

// —— 主测试图（5 节点）：scene 链 / choice show 过滤 / goto 函数分支 / hub stay+time / combat pass-fail / death ——
function mainGraph() {
  return {
    start: { type: 'scene', text: '李恒背着破包袱，随流民上了青牛山。', goto: '岔路' },
    岔路: {
      type: 'choice', text: '山道分岔，灰袍执事负手而立。',
      choices: [
        { label: '趁夜溜走', show: () => false, goto: '结局' }, // 永不出现
        { label: '正门拜山', tag: '谨慎', goto: (s) => (s.flags.狂徒 ? '斗' : '院子') }, // goto 函数分支
        { label: '先立狂言再拜', effects: [{ type: 'flag', id: '狂徒', value: true }], goto: '院子' },
      ],
    },
    院子: {
      type: 'hub', text: '杂役院里人来人往。',
      actions: [
        { label: '当值一个时辰', effects: [{ type: 'time', days: 30 }, { type: 'res', key: 'lingshi', delta: 2 }], stay: true },
        { label: '回山道转转', goto: '岔路' },
        { label: '下山历练', goto: '斗' },
      ],
    },
    斗: {
      type: 'combat', text: '一头灰狼自林中扑出。', effects: [{ type: 'flag', id: '遇袭', value: true }],
      resolve: { test: (s) => !!s.flags.亮兵器, pass: '院子', fail: '结局' },
      choices: [
        { label: '亮出柴刀', effects: [{ type: 'flag', id: '亮兵器', value: true }] },
        { label: '赤手硬撼', effects: [{ type: 'res', key: 'injury', delta: 20 }] },
      ],
    },
    结局: { type: 'death', cause: '狼口', text: (s) => '你倒在血泊里，此刻是第 ' + s.day + ' 天。' },
  };
}

test('start 初始化 state 并落到入口节点，非 hub 入口不自动存档', () => {
  cleanSave();
  const s = FC.Engine.start('韩立', mainGraph());
  assert.equal(s.name, '韩立');
  assert.equal(s.nodeId, 'start');
  assert.equal(s.day, 1);
  assert.equal(FC.Save.load('auto'), null); // 入口是 scene，不落盘
});

test('start 入口为 hub 时进入即自动存 auto', () => {
  cleanSave();
  const g = { start: { type: 'hub', text: '坊市。', actions: [{ label: '逛逛', goto: 'start' }] } };
  const s = FC.Engine.start('韩立', g);
  assert.deepEqual(FC.Save.load('auto'), s);
});

test('scene 链推进：继续项逐节点前进；终局场景无选项；view 纯读取', () => {
  cleanSave();
  const g = {
    start: { type: 'scene', text: '第一幕。', goto: '第二幕' },
    第二幕: { type: 'scene', text: (s) => '第 ' + s.day + ' 天，第二幕。', goto: '落幕' },
    落幕: { type: 'scene', text: '全章终。' }, // 无 goto：终局场景
  };
  const s = FC.Engine.start('韩立', g);
  const snapshot = JSON.parse(JSON.stringify(s));
  let v = FC.Engine.view(s, g);
  assert.equal(v.text, '第一幕。');
  assert.deepEqual(v.choices, [{ label: '继续', tag: '', enabled: true }]);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), snapshot); // view 不改 state
  FC.Engine.choose(s, g, 0);
  assert.equal(s.nodeId, '第二幕');
  v = FC.Engine.view(s, g);
  assert.equal(v.text, '第 1 天，第二幕。'); // text 函数按当前 state 求值
  FC.Engine.choose(s, g, 0);
  assert.equal(s.nodeId, '落幕');
  v = FC.Engine.view(s, g);
  assert.deepEqual(v.choices, []); // 终局场景：无选项
});

test('view：show 为 false 的选项不出现，tag 缺省补空串', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  const v = FC.Engine.view(s, g);
  assert.deepEqual(v.choices, [
    { label: '正门拜山', tag: '谨慎', enabled: true },
    { label: '先立狂言再拜', tag: '', enabled: true },
  ]);
});

test('choose 按可见项序号取选项（show 过滤后的序）', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  const r = FC.Engine.choose(s, g, 0); // 可见第 0 项 = 正门拜山（若按原始数组会命中"趁夜溜走"直达死亡）
  assert.equal(r.ok, true);
  assert.equal(s.nodeId, '院子'); // goto 函数 false 分支
  assert.equal(FC.State.isDead(s), false);
});

test('goto 为函数时按 state 分支跳转', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  FC.Engine.choose(s, g, 1); // 先立狂言：置狂徒 → 院子
  assert.equal(s.flags.狂徒, true);
  FC.Engine.choose(s, g, 1); // 回山道 → 岔路
  FC.Engine.choose(s, g, 0); // 正门拜山：goto 函数 true 分支
  assert.equal(s.nodeId, '斗');
});

test('hub stay 循环：执行后回到本 hub，time 效果入账，每次进入自动存 auto', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  FC.Engine.choose(s, g, 0); // 正门拜山 → 院子（进入 hub，已存 auto）
  const r = FC.Engine.choose(s, g, 0); // 当值：stay
  assert.deepEqual(r.log, ['时间流逝 30 天', '灵石 +2']);
  assert.equal(s.nodeId, '院子');
  assert.equal(s.day, 31);
  assert.equal(s.lingshi, 4);
  assert.deepEqual(FC.Save.load('auto'), s);
  FC.Engine.choose(s, g, 0); // 再当值：循环
  assert.equal(s.day, 61);
  assert.equal(s.lingshi, 6);
  assert.deepEqual(FC.Save.load('auto'), s);
});

test('hub goto 行动离开 hub，落盘 auto', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  FC.Engine.choose(s, g, 0); // → 院子
  FC.Engine.choose(s, g, 2); // 下山历练 → 斗
  assert.equal(s.nodeId, '斗');
  assert.deepEqual(FC.Save.load('auto'), s);
});

test('combat：决策项效果先生效，再按 resolve.test 分 pass/fail', () => {
  cleanSave();
  // pass 分支：亮出柴刀（决策项置旗标），test 通过 → 院子
  let g = mainGraph();
  let s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  FC.Engine.choose(s, g, 1); // 先立狂言 → 院子
  FC.Engine.choose(s, g, 2); // 下山历练 → 斗
  const r = FC.Engine.choose(s, g, 0); // 亮出柴刀
  assert.deepEqual(r.log, ['旗标 遇袭 置为 true', '旗标 亮兵器 置为 true']); // 节点效果先于选项效果
  assert.equal(s.flags.亮兵器, true);
  assert.equal(s.flags.遇袭, true);
  assert.equal(s.nodeId, '院子'); // pass
  assert.deepEqual(FC.Save.load('auto'), s);
  // fail 分支：赤手硬撼 → 伤势 +20，test 不过 → 结局（死亡）
  g = mainGraph();
  s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0);
  FC.Engine.choose(s, g, 1);
  FC.Engine.choose(s, g, 2);
  FC.Engine.choose(s, g, 1); // 赤手硬撼
  assert.equal(s.injury, 20);
  assert.equal(s.dead, '狼口');
  assert.equal(s.nodeId, '结局');
});

test('节点 effects 先于选项 effects 执行', () => {
  cleanSave();
  const g = {
    start: {
      type: 'choice', text: '机会当前。',
      effects: [{ type: 'flag', id: '序', value: '节点' }],
      choices: [{ label: '出手', effects: [{ type: 'flag', id: '序', value: '选项' }], goto: '终' }],
    },
    终: { type: 'scene', text: '事毕。' },
  };
  const s = FC.Engine.start('韩立', g);
  const r = FC.Engine.choose(s, g, 0);
  assert.equal(s.flags.序, '选项'); // 后执行者覆盖 → 证明节点效果先执行
  assert.deepEqual(r.log, ['旗标 序 置为 节点', '旗标 序 置为 选项']);
  assert.deepEqual(FC.Save.load('auto'), s);
});

test('死亡后 choose 拒绝继续并返回 {dead:true}；引擎不改写检查点', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('李恒', g);
  // Task 9 接线：新开局即写章首检查点；自此刻起到死亡，引擎不得再改写它
  const checkpoint = FC.Save.load('checkpoint');
  assert.ok(checkpoint, '新开局应已写章首检查点');
  assert.equal(checkpoint.nodeId, 'start');
  FC.Engine.choose(s, g, 0); // → 岔路
  FC.Engine.choose(s, g, 1); // 先立狂言 → 院子
  FC.Engine.choose(s, g, 2); // 下山历练 → 斗
  FC.Engine.choose(s, g, 1); // 赤手硬撼 → fail → 结局
  assert.equal(s.dead, '狼口');
  assert.deepEqual(FC.Save.load('auto'), s); // 死亡状态照常落 auto（引擎不碰 checkpoint）
  const day = s.day;
  const r = FC.Engine.choose(s, g, 0);
  assert.deepEqual(r, { dead: true }); // 拒绝继续
  assert.equal(s.nodeId, '结局');
  assert.equal(s.day, day); // 拒绝时状态原地不动
  const v = FC.Engine.view(s, g);
  assert.deepEqual(v.choices, []); // 终局无选项
  assert.equal(v.text, '你倒在血泊里，此刻是第 ' + day + ' 天。');
  assert.deepEqual(FC.Save.load('checkpoint'), checkpoint); // 检查点原封不动
});

test('快进模式下 choose 仍照常执行效果与时间（引擎不存在跳过路径）', () => {
  cleanSave();
  const g = {
    start: {
      type: 'choice', text: '闭关。',
      choices: [{ label: '苦修三十日', effects: [{ type: 'time', days: 30 }, { type: 'res', key: 'lingshi', delta: 2 }], goto: '出关' }],
    },
    出关: { type: 'scene', text: '出关。', goto: 'start' },
  };
  globalThis.FC_UI_FASTFORWARD = true; // 模拟 UI 快进开关：引擎不得读取任何此类标记
  try {
    assert.equal(FC.Engine.choose.length, 3); // 接口无快进参数
    const s = FC.Engine.start('韩立', g);
    const r = FC.Engine.choose(s, g, 0);
    assert.equal(r.ok, true);
    assert.equal(s.day, 31); // 时间照常推进
    assert.equal(s.lingshi, 4); // 效果照常入账（开局 2+2）
    assert.deepEqual(FC.Save.load('auto'), s);
  } finally {
    delete globalThis.FC_UI_FASTFORWARD;
  }
});

test('异常路径：无效序号、未知跳转目标、未知节点、未知类型、scene 缺 goto 一律抛错', () => {
  cleanSave();
  const g = mainGraph();
  const s = FC.Engine.start('韩立', g);
  FC.Engine.choose(s, g, 0); // → 岔路
  assert.throws(() => FC.Engine.choose(s, g, 99), /无效选项序号/);
  assert.throws(() => FC.Engine.choose(s, g, -1), /无效选项序号/);
  assert.throws(() => FC.Engine.choose(s, g, 1.5), /无效选项序号/);
  const bad = { start: { type: 'scene', text: '断桥。', goto: '不存在' } };
  const s2 = FC.Engine.start('韩立', bad);
  assert.throws(() => FC.Engine.choose(s2, bad, 0), /未知节点/);
  const s3 = FC.Engine.start('韩立', mainGraph());
  s3.nodeId = '幽灵';
  assert.throws(() => FC.Engine.view(s3, mainGraph()), /未知节点/);
  assert.throws(() => FC.Engine.choose(s3, mainGraph(), 0), /未知节点/);
  assert.throws(() => FC.Engine.start('韩立', {}), /未知节点/);
  const weird = { start: { type: 'mistery', text: '怪节点。' } };
  assert.throws(() => FC.Engine.start('韩立', weird), /未知节点类型/); // 入口类型校验
});
