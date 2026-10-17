import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/save.js');
const FC = globalThis.FC;

// —— 测试脚手架：可注入的假 localStorage（零依赖，jsdom 不可用也不允许安装）——
// throwOnWrite=true 时 setItem 抛异常（模拟隐私模式/配额错误）；throwOnRead=true 时 getItem 抛异常
function fakeStorage(throwOnWrite, throwOnRead) {
  const map = new Map();
  return {
    getItem(k) { if (throwOnRead) throw new Error('Storage 读取失败'); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (throwOnWrite) throw new Error('Storage 不可用'); map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}
// Node 默认无 localStorage（未开 --experimental-webstorage）；记录初值以便用例后还原
const REAL_LS = globalThis.localStorage;
// 用例前后清理：白盒清空内存兜底 + 还原 localStorage，保证用例间隔离
function cleanup() {
  FC.Save._mem.clear();
  if (REAL_LS === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = REAL_LS;
}
// 在指定 storage 环境下执行断言，结束后无条件还原
function withEnv(ls, fn) {
  globalThis.localStorage = ls;
  FC.Save._mem.clear();
  try { fn(); } finally { cleanup(); }
}

test('save/load 往返等值：localStorage 可用时写入并原样读回', () => {
  withEnv(fakeStorage(false), () => {
    const s = FC.State.create('李恒');
    s.lingshi = 99; s.injury = 37.5;
    s.inventory['丹药'] = 3; s.karma['恩'] = 1; s.flags['见过的仙人'] = '剑仙';
    const r = FC.Save.save(s, 'm1');
    assert.deepEqual(r, { ok: true, storage: 'localStorage' });
    assert.deepEqual(FC.Save.load('m1'), s);
  });
});

test('auto 与 checkpoint 槽位同样可往返（存活状态）', () => {
  withEnv(fakeStorage(false), () => {
    const s = FC.State.create('韩立');
    assert.deepEqual(FC.Save.save(s, 'auto'), { ok: true, storage: 'localStorage' });
    assert.deepEqual(FC.Save.save(s, 'checkpoint'), { ok: true, storage: 'localStorage' });
    assert.deepEqual(FC.Save.load('auto'), s);
    assert.deepEqual(FC.Save.load('checkpoint'), s);
  });
});

test('list 反映占用：初始全空，存 m2 后仅 m2 为 true', () => {
  withEnv(fakeStorage(false), () => {
    assert.deepEqual(FC.Save.list(), { auto: false, checkpoint: false, m1: false, m2: false, m3: false });
    FC.Save.save(FC.State.create('韩立'), 'm2');
    assert.deepEqual(FC.Save.list(), { auto: false, checkpoint: false, m1: false, m2: true, m3: false });
  });
});

test('非法槽位拒绝：save 返回 {ok:false,reason:"slot"} 且 load 返回 null', () => {
  withEnv(fakeStorage(false), () => {
    const s = FC.State.create('韩立');
    assert.deepEqual(FC.Save.save(s, 'nope'), { ok: false, reason: 'slot' });
    assert.deepEqual(FC.Save.save(s, ''), { ok: false, reason: 'slot' });
    assert.equal(FC.Save.load('nope'), null);
  });
});

test('死亡状态下 save 到 checkpoint 被拒绝，旧检查点不被改写', () => {
  withEnv(fakeStorage(false), () => {
    const alive = FC.State.create('韩立');
    FC.Save.save(alive, 'checkpoint'); // 先存一个存活检查点
    const dead = FC.State.create('李恒');
    dead.day = 99; dead.dead = 'lifespan';
    const r = FC.Save.save(dead, 'checkpoint');
    assert.deepEqual(r, { ok: false, reason: 'dead' });
    assert.deepEqual(FC.Save.load('checkpoint'), alive); // 旧检查点原样保留
  });
});

test('死亡状态仍可存手动槽（守卫只针对 checkpoint）', () => {
  withEnv(fakeStorage(false), () => {
    const dead = FC.State.create('李恒');
    dead.dead = '剑下亡魂';
    assert.deepEqual(FC.Save.save(dead, 'm1'), { ok: true, storage: 'localStorage' });
    assert.deepEqual(FC.Save.load('m1'), dead);
  });
});

test('saveVersion 不符或损坏档：load 返回 null（不做迁移）', () => {
  withEnv(fakeStorage(false), () => {
    const ls = globalThis.localStorage;
    ls.setItem('fcw.save.m1', JSON.stringify({ saveVersion: 2, name: '未来版本' }));
    ls.setItem('fcw.save.m2', '{损坏的JSON');
    ls.setItem('fcw.save.m3', JSON.stringify({ name: '没有版本号' }));
    assert.equal(FC.Save.load('m1'), null);
    assert.equal(FC.Save.load('m2'), null);
    assert.equal(FC.Save.load('m3'), null);
    assert.deepEqual(FC.Save.list(), { auto: false, checkpoint: false, m1: false, m2: false, m3: false });
  });
});

test('localStorage 缺失时降级内存且可读回', () => {
  withEnv(undefined, () => {
    const s = FC.State.create('韩立');
    const r = FC.Save.save(s, 'm1');
    assert.deepEqual(r, { ok: true, storage: 'memory' });
    assert.deepEqual(FC.Save.load('m1'), s);
    assert.equal(FC.Save.list().m1, true);
  });
});

test('localStorage 写入抛异常时降级内存且可读回', () => {
  withEnv(fakeStorage(true), () => {
    const s = FC.State.create('韩立');
    const r = FC.Save.save(s, 'm3');
    assert.deepEqual(r, { ok: true, storage: 'memory' });
    assert.deepEqual(FC.Save.load('m3'), s);
    assert.equal(FC.Save.list().m3, true);
  });
});

test('localStorage 读取抛异常时也能从内存兜底读回', () => {
  withEnv(fakeStorage(true, true), () => {
    const s = FC.State.create('韩立');
    FC.Save.save(s, 'm2'); // 写入抛错 → 内存
    assert.deepEqual(FC.Save.load('m2'), s); // 读取也抛错 → 兜底内存
  });
});
