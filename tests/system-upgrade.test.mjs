// 系统扩容《筑基之上》（人界篇系统包）测试：
//   1. FC.REALMS 追加至 20 项（索引 0-12 不变，旧存档兼容）
//   2. FC.REALM_TIERS 大境界分界表
//   3. FC.Engine.setCheckpointNode 支持字符串或数组、多次调用累积去重；_enter 命中任一注册节点（存活时）写检查点
//   4. FC.UI.deathText 六档死因（寿终/战死/中毒/冻毙/兵解/丹毒）+ 未知兜底
//   5. FC.Dev.setRealm 寿元加成表扩至 20 级（13-15 每层 +80、16-18 每层 +150、19 +300）
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
const FC = globalThis.FC;

// —— 存档隔离：Node 默认无 localStorage，走内存兜底 ——
function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false;
}

// ———— 境界表扩容 ————

test('REALMS 扩至 20 项：13-15=结丹一~三层，16-18=元婴一~三层，19=化神', () => {
  assert.equal(FC.REALMS.length, 20);
  assert.equal(FC.REALMS[12], '筑基三层');
  assert.equal(FC.REALMS[13], '结丹一层');
  assert.equal(FC.REALMS[14], '结丹二层');
  assert.equal(FC.REALMS[15], '结丹三层');
  assert.equal(FC.REALMS[16], '元婴一层');
  assert.equal(FC.REALMS[17], '元婴二层');
  assert.equal(FC.REALMS[18], '元婴三层');
  assert.equal(FC.REALMS[19], '化神');
});

test('旧存档兼容：索引 0-12 原样，旧档 cultivation 数值语义不变', () => {
  assert.deepEqual(FC.REALMS.slice(0, 13), [
    '凡人', '炼气一层', '炼气二层', '炼气三层', '炼气四层', '炼气五层',
    '炼气六层', '炼气七层', '炼气八层', '炼气九层', '筑基一层', '筑基二层', '筑基三层',
  ]);
  const s = FC.State.create('李恒'); // 旧档开局 cultivation:1
  assert.equal(FC.REALMS[s.cultivation], '炼气一层');
  assert.equal(FC.REALMS[1], '炼气一层');
  assert.equal(FC.REALMS[2], '炼气二层');
});

test('REALM_TIERS 大境界分界表固定', () => {
  assert.deepEqual(FC.REALM_TIERS, { 凡人: 0, 炼气: 1, 筑基: 10, 结丹: 13, 元婴: 16, 化神: 19 });
});

// ———— 检查点多节点 ————

test('setCheckpointNode 注册数组：进入任一注册节点（存活时）写检查点，未注册节点不写', () => {
  cleanSave();
  FC.Engine.setCheckpointNode(['甲一', '甲二']);
  const g = {
    start: { type: 'scene', text: '起。', goto: '甲一' },
    甲一: { type: 'scene', text: '一。', goto: '甲二' },
    甲二: { type: 'scene', text: '二。', goto: '甲三' },
    甲三: { type: 'scene', text: '三。', terminal: true },
  };
  const s = FC.Engine.start('李恒', g);
  assert.equal(FC.Save.load('checkpoint').nodeId, 'start', '新开局照旧写章首检查点');
  FC.Engine.choose(s, g, 0);
  assert.equal(FC.Save.load('checkpoint').nodeId, '甲一', '进入注册节点甲一应写检查点');
  FC.Engine.choose(s, g, 0);
  assert.equal(FC.Save.load('checkpoint').nodeId, '甲二', '进入注册节点甲二应写检查点');
  FC.Engine.choose(s, g, 0); // 甲三 未注册
  assert.equal(FC.Save.load('checkpoint').nodeId, '甲二', '未注册节点不得改写检查点');
});

test('setCheckpointNode 重复注册不重复累积；单值调用兼容（ch1 既有用法）', () => {
  cleanSave();
  FC.Engine.setCheckpointNode(['乙一', '乙二']);
  const size = FC.Engine._checkpointNodes.size;
  FC.Engine.setCheckpointNode(['乙一', '乙二', '乙三']); // 乙一/乙二 重复
  FC.Engine.setCheckpointNode('乙二'); // 单值重复
  assert.ok(FC.Engine._checkpointNodes instanceof Set, '注册表应为 Set');
  assert.equal(FC.Engine._checkpointNodes.size, size + 1, '重复注册不得重复累积（仅新增乙三）');
  assert.ok(FC.Engine._checkpointNodes.has('乙三'));
  // 既有单值注册行为不变：进入该节点写检查点
  cleanSave();
  FC.Engine.setCheckpointNode('丙终');
  const g = {
    start: { type: 'scene', text: '起。', goto: '丙终' },
    丙终: { type: 'scene', text: '终。', terminal: true },
  };
  const s = FC.Engine.start('李恒', g);
  FC.Engine.choose(s, g, 0);
  assert.equal(FC.Save.load('checkpoint').nodeId, '丙终');
});

// ———— 死亡文案六档 ————

test('deathText：六档死因（寿终/战死/中毒/冻毙/兵解/丹毒）非空互异；未知死因走兜底', () => {
  // exiled 即 v1 既有"逐出后冻毙街头"档，对应六档中的"冻毙"
  const causes = ['lifespan', 'combat', 'poison', 'exiled', '兵解', '丹毒'];
  const texts = causes.map(c => { const s = FC.State.create('李恒'); s.dead = c; return FC.UI.deathText(s); });
  texts.forEach((t, i) => assert.ok(typeof t === 'string' && t.length > 0, '死因 ' + causes[i] + ' 文案为空'));
  assert.equal(new Set(texts).size, 6, '六档文案须互不相同');
  const s = FC.State.create('李恒'); s.dead = '神秘死因';
  const t = FC.UI.deathText(s);
  assert.ok(t.length > 0, '未知死因应有兜底文案');
  assert.ok(!texts.includes(t), '兜底档不应与六档重复');
  assert.ok(FC.UI.deathText(null).length > 0, '空 state 应走兜底');
});

// ———— 面板寿元加成表扩容 ————

test('setRealm 寿元加成：13-15 每层 +80、16-18 每层 +150、19 +300；0-12 照旧', () => {
  const s = FC.State.create('李恒'); // 寿元 9
  FC.Dev.setRealm(s, 15);
  assert.equal(s.cultivation, 15);
  assert.equal(s.lifespanYears, 9 + 80, '结丹三层 +80');
  const s2 = FC.State.create('李恒');
  FC.Dev.setRealm(s2, 19);
  assert.equal(s2.cultivation, 19);
  assert.equal(s2.lifespanYears, 9 + 300, '化神 +300');
  const s3 = FC.State.create('李恒');
  FC.Dev.setRealm(s3, 13);
  assert.equal(s3.lifespanYears, 9 + 80, '结丹一层 +80');
  const s4 = FC.State.create('李恒');
  FC.Dev.setRealm(s4, 16);
  assert.equal(s4.lifespanYears, 9 + 150, '元婴一层 +150');
  const s5 = FC.State.create('李恒');
  FC.Dev.setRealm(s5, 12);
  assert.equal(s5.lifespanYears, 9 + 120, '筑基三层照旧 +120');
});
