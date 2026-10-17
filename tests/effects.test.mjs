import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/effects.js');
const FC = globalThis.FC;

const fresh = () => FC.State.create('李恒');

test('apply 返回 {state, log} 且原地修改 state', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [{ type: 'res', key: 'lingshi', delta: 5 }]);
  assert.equal(r.state, s); // 同一对象 = 原地修改
  assert.equal(s.lingshi, 7); // 开局 2 + 5
  assert.deepEqual(r.log, ['灵石 +5']);
});

test('res 修为/灵石/机缘 直接加减，log 中文摘要', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [
    { type: 'res', key: 'cultivation', delta: 1 },
    { type: 'res', key: 'lingshi', delta: -1 },
    { type: 'res', key: 'luck', delta: 2 },
  ]);
  assert.equal(s.cultivation, 2);
  assert.equal(s.lingshi, 1);
  assert.equal(s.luck, 2);
  assert.deepEqual(r.log, ['修为 +1', '灵石 -1', '机缘 +2']);
});

test("res 'lifespan' 别名读写 lifespanYears，log 带单位", () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [{ type: 'res', key: 'lifespan', delta: -2 }]);
  assert.equal(s.lifespanYears, 7); // 开局 9 - 2
  assert.deepEqual(r.log, ['寿元 -2 年']);
});

test('res injury 走 clampInjury 截到 0..100，log 记实际变化', () => {
  const s = fresh();
  s.injury = 95;
  const r = FC.Effects.apply(s, [{ type: 'res', key: 'injury', delta: 20 }]);
  assert.equal(s.injury, 100);
  assert.deepEqual(r.log, ['伤势 +5']); // 实际只 +5，log 不撒谎
  const s2 = fresh();
  FC.Effects.apply(s2, [{ type: 'res', key: 'injury', delta: -30 }]);
  assert.equal(s2.injury, 0);
});

test('res lingshi 不为负：扣到负数截 0，log 记实际生效值（与 item 一致）', () => {
  const s = fresh(); // 开局灵石 2
  const r = FC.Effects.apply(s, [{ type: 'res', key: 'lingshi', delta: -3 }]);
  assert.equal(s.lingshi, 0);
  assert.deepEqual(r.log, ['灵石 -2']); // 实际只 -2，log 不撒谎
  FC.Effects.apply(s, [{ type: 'res', key: 'lingshi', delta: -1 }]);
  assert.equal(s.lingshi, 0);
  const s3 = fresh();
  FC.Effects.apply(s3, [{ type: 'res', key: 'lingshi', delta: 5 }]);
  assert.equal(s3.lingshi, 7); // 正向不受影响
});

test('item 新键从 0 起累加，log 为 获得 ×N', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [{ type: 'item', id: '回气散', count: 1 }]);
  assert.equal(s.inventory['回气散'], 1);
  assert.deepEqual(r.log, ['获得 回气散 ×1']);
  FC.Effects.apply(s, [{ type: 'item', id: '回气散', count: 2 }]);
  assert.equal(s.inventory['回气散'], 3);
});

test('item 负数移除；库存不足截到 0，log 记实际数量', () => {
  const s = fresh();
  s.inventory['回气散'] = 1;
  const r = FC.Effects.apply(s, [{ type: 'item', id: '回气散', count: -3 }]);
  assert.equal(s.inventory['回气散'], 0);
  assert.deepEqual(r.log, ['失去 回气散 ×1']); // 实际只移除 1
});

test('karma 数值：首次置 value，之后按数值累加', () => {
  const s = fresh();
  FC.Effects.apply(s, [{ type: 'karma', id: '恩情', value: 1 }]);
  assert.equal(s.karma['恩情'], 1);
  FC.Effects.apply(s, [{ type: 'karma', id: '恩情', value: 2 }]);
  assert.equal(s.karma['恩情'], 3);
  FC.Effects.apply(s, [{ type: 'karma', id: '恩情', value: -1 }]);
  assert.equal(s.karma['恩情'], 2);
});

test('karma 布尔：首次置原值，之后 true 记 1、false 记 0', () => {
  const s = fresh();
  FC.Effects.apply(s, [{ type: 'karma', id: '善举', value: true }]);
  assert.equal(s.karma['善举'], true);
  FC.Effects.apply(s, [{ type: 'karma', id: '善举', value: true }]);
  assert.equal(s.karma['善举'], 2);
  FC.Effects.apply(s, [{ type: 'karma', id: '善举', value: false }]);
  assert.equal(s.karma['善举'], 2);
});

test('karma 非数值 value 多次出现时按次数累加为计数', () => {
  const s = fresh();
  FC.Effects.apply(s, [{ type: 'karma', id: '血债', value: 'kill' }]);
  assert.equal(s.karma['血债'], 'kill');
  FC.Effects.apply(s, [{ type: 'karma', id: '血债', value: 'kill' }]);
  assert.equal(s.karma['血债'], 2);
});

test('karma 同一批效果中同一 id 也累加', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [
    { type: 'karma', id: '恩情', value: 1 },
    { type: 'karma', id: '恩情', value: 1 },
  ]);
  assert.equal(s.karma['恩情'], 2);
  assert.deepEqual(r.log, ['因果 恩情 累计 1', '因果 恩情 累计 2']);
});

test('flag 置任意 JSON 可序列化值', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [{ type: 'flag', id: '拜师', value: '王婶' }]);
  assert.equal(s.flags['拜师'], '王婶');
  assert.deepEqual(r.log, ['旗标 拜师 置为 王婶']);
});

test('time 转调 advanceDays：天数与寿元推进', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [{ type: 'time', days: 3 }]);
  assert.equal(s.day, 4);
  assert.ok(Math.abs(s.lifespanYears - (9 - 3 / 365)) < 1e-9);
  assert.deepEqual(r.log, ['时间流逝 3 天']);
});

test('time 推进至寿元耗尽即死亡（复用 Task 2 死亡判定）', () => {
  const s = fresh();
  FC.Effects.apply(s, [{ type: 'time', days: 9 * 365 }]);
  assert.equal(s.dead, 'lifespan');
  assert.equal(FC.State.isDead(s), true);
});

test('death 置 dead 为死因', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [{ type: 'death', cause: 'beast' }]);
  assert.equal(s.dead, 'beast');
  assert.equal(FC.State.isDead(s), true);
  assert.ok(r.log[0].includes('死亡'));
  assert.ok(r.log[0].includes('beast'));
});

test('death 豁免：改为重伤 100 并记旗标，dead 保持 null', () => {
  const s = fresh();
  s.deathExempt = true;
  const r = FC.Effects.apply(s, [{ type: 'death', cause: 'beast' }]);
  assert.equal(s.dead, null);
  assert.equal(s.injury, 100);
  assert.equal(s.flags['cheated_death_beast'], true);
  assert.equal(FC.State.isDead(s), false);
  assert.ok(r.log[0].includes('躲过死劫'));
  assert.ok(r.log[0].includes('beast'));
});

test('未知效果类型抛错（剧情 typo 不静默）', () => {
  const s = fresh();
  assert.throws(
    () => FC.Effects.apply(s, [{ type: 'resx', key: 'lingshi', delta: 1 }]),
    /未知效果类型/
  );
});

test('混合效果后 state 仍可 JSON 序列化且字段完好', () => {
  const s = fresh();
  FC.Effects.apply(s, [
    { type: 'res', key: 'lingshi', delta: 5 },
    { type: 'res', key: 'lifespan', delta: -1.5 },
    { type: 'item', id: '回气散', count: 2 },
    { type: 'karma', id: '恩情', value: 1 },
    { type: 'flag', id: '拜师', value: '王婶' },
    { type: 'time', days: 10 },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.equal(s.day, 11);
  assert.ok(Math.abs(s.lifespanYears - (7.5 - 10 / 365)) < 1e-9);
});

test('空效果数组返回空 log，state 不变', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, []);
  assert.deepEqual(r.log, []);
  assert.deepEqual(s, fresh());
});

test('每个效果产生一条非空中文摘要', () => {
  const s = fresh();
  const r = FC.Effects.apply(s, [
    { type: 'res', key: 'injury', delta: 10 },
    { type: 'item', id: '回气散', count: -1 }, // 无库存 → 截到 0
    { type: 'karma', id: '恩情', value: 1 },
    { type: 'flag', id: '拜师', value: '王婶' },
    { type: 'death', cause: 'beast' },
  ]);
  assert.equal(r.log.length, 5);
  for (const line of r.log) assert.ok(typeof line === 'string' && line.length > 0);
});
