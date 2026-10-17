import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/content/realm.js');
const FC = globalThis.FC;

const REALMS = ['凡人','炼气一层','炼气二层','炼气三层','炼气四层','炼气五层','炼气六层','炼气七层','炼气八层','炼气九层','筑基一层','筑基二层','筑基三层','结丹一层','结丹二层','结丹三层','元婴一层','元婴二层','元婴三层','化神'];

test('境界表 REALMS 内容与顺序固定（下标即修为等级）', () => {
  assert.deepEqual(FC.REALMS, REALMS);
});

test('境界表扩容只追加：索引 0-12 与 v1 一致（旧存档兼容）', () => {
  assert.deepEqual(FC.REALMS.slice(0, 13), [
    '凡人','炼气一层','炼气二层','炼气三层','炼气四层','炼气五层','炼气六层',
    '炼气七层','炼气八层','炼气九层','筑基一层','筑基二层','筑基三层',
  ]);
});

test('create 返回开局初值', () => {
  const s = FC.State.create('李恒');
  assert.deepEqual(s, {
    saveVersion: 1, name: '李恒', day: 1, cultivation: 1, lingshi: 2,
    lifespanYears: 9, injury: 0, luck: 0,
    inventory: {}, karma: {}, flags: {},
    nodeId: 'start', dead: null, deathExempt: false,
  });
  assert.equal(FC.State.isDead(s), false);
});

test('advanceDays 原地推进：day+365 且寿元减 1 年', () => {
  const s = FC.State.create('李恒');
  assert.equal(FC.State.advanceDays(s, 365), s); // 返回同一对象 = 原地修改
  assert.equal(s.day, 366);
  assert.equal(s.lifespanYears, 8);
});

test('advanceDays 寿元扣减保留小数', () => {
  const s = FC.State.create('李恒');
  FC.State.advanceDays(s, 100);
  assert.ok(Math.abs(s.lifespanYears - (9 - 100 / 365)) < 1e-9);
});

test('寿元归零即死：isDead=true 且 dead=lifespan', () => {
  const s = FC.State.create('李恒');
  FC.State.advanceDays(s, 9 * 365);
  assert.equal(s.lifespanYears, 0);
  assert.equal(FC.State.isDead(s), true);
  assert.equal(s.dead, 'lifespan');
});

test('豁免开启：寿元耗尽改为重伤 100 而非死亡', () => {
  const s = FC.State.create('李恒');
  s.deathExempt = true;
  FC.State.advanceDays(s, 9 * 365);
  assert.equal(s.dead, null);
  assert.equal(s.injury, 100);
  assert.equal(s.flags.escaped_death, true);
  assert.equal(FC.State.isDead(s), false);
});

test('injury 取值越界截断到 0..100', () => {
  assert.equal(FC.State.clampInjury(-5), 0);
  assert.equal(FC.State.clampInjury(150), 100);
  assert.equal(FC.State.clampInjury(0), 0);
  assert.equal(FC.State.clampInjury(100), 100);
  assert.equal(FC.State.clampInjury(37.5), 37.5);
});
