import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/content/realm.js');
require('../js/effects.js');
require('../js/save.js');
require('../js/devpanel.js');
const FC = globalThis.FC;

// —— 可注入的假环境（不依赖 jsdom）：只实现 devpanel.mount 用到的极窄 DOM 面 ——
function makeEl(tag){
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
function makeDoc(){
  const doc = {
    _keyListeners: [],
    createElement(tag) { return makeEl(tag); },
    addEventListener(ev, fn) { if (ev === 'keydown') doc._keyListeners.push(fn); },
    removeEventListener(ev, fn) { const i = doc._keyListeners.indexOf(fn); if (i >= 0) doc._keyListeners.splice(i, 1); },
    fireKey(e) { doc._keyListeners.slice().forEach(fn => fn(e)); },
  };
  return doc;
}
// 挂载工具：state 为捕获对象，renders 计数 rerender 回调
function mounted(state, opts){
  opts = opts || {};
  const doc = makeDoc();
  const el = makeEl('div');
  let renders = 0;
  const env = { document: doc };
  if (opts.graph) env.getGraph = function () { return opts.graph; };
  const handle = FC.Dev.mount(el, function () { return state; }, function () { renders++; }, env);
  return { handle: handle, doc: doc, el: el, renders: function () { return renders; }, state: function () { return state; } };
}
const byId = (root, id) => root.children.find(c => c.id === id);
const ctl = (row) => row.children.find(c => c.tag === 'input' || c.tag === 'select');
const btn = (row, text) => row.children.find(c => c.tag === 'button' && c.textContent === text);

// —— 数据动作 ——

test('setRes 直接设置五项资源', () => {
  const s = FC.State.create('李恒');
  FC.Dev.setRes(s, 'lingshi', 50); assert.equal(s.lingshi, 50);
  FC.Dev.setRes(s, 'lifespanYears', 100); assert.equal(s.lifespanYears, 100);
  FC.Dev.setRes(s, 'injury', 40); assert.equal(s.injury, 40);
  FC.Dev.setRes(s, 'luck', 66); assert.equal(s.luck, 66);
  FC.Dev.setRes(s, 'cultivation', 5); assert.equal(s.cultivation, 5);
});

test('setRes 越界按规则截断：伤势 0..100、修为境界表下标、灵石/寿元不为负、机缘 0..100', () => {
  const s = FC.State.create('李恒');
  assert.equal(FC.Dev.setRes(s, 'injury', 150).injury, 100);
  assert.equal(FC.Dev.setRes(s, 'injury', -5).injury, 0);
  assert.equal(FC.Dev.setRes(s, 'cultivation', 99).cultivation, 12);
  assert.equal(FC.Dev.setRes(s, 'cultivation', -3).cultivation, 0);
  assert.equal(FC.Dev.setRes(s, 'lingshi', -1).lingshi, 0);
  assert.equal(FC.Dev.setRes(s, 'lifespanYears', -1).lifespanYears, 0);
  assert.equal(FC.Dev.setRes(s, 'luck', 150).luck, 100);
  assert.equal(FC.Dev.setRes(s, 'luck', -5).luck, 0);
});

test('setRes 修为取整（境界表下标）且未知资源抛错', () => {
  const s = FC.State.create('李恒');
  FC.Dev.setRes(s, 'cultivation', 5.4); assert.equal(s.cultivation, 5);
  FC.Dev.setRes(s, 'cultivation', 6.5); assert.equal(s.cultivation, 7);
  assert.throws(() => FC.Dev.setRes(s, 'nope', 1), /未知资源/);
});

test('addItem 复用效果系统：获得/移除并库存截 0，返回中文 log', () => {
  const s = FC.State.create('李恒');
  let log = FC.Dev.addItem(s, '灵草', 2);
  assert.equal(s.inventory['灵草'], 2);
  assert.deepEqual(log, ['获得 灵草 ×2']);
  log = FC.Dev.addItem(s, '灵草', -5);
  assert.equal(s.inventory['灵草'], 0);
  assert.deepEqual(log, ['失去 灵草 ×2']);
});

test('setRealm 换境界并按表加寿：炼气段 +0、筑基起每层 +40', () => {
  const s = FC.State.create('李恒'); // 寿元 9
  FC.Dev.setRealm(s, 10);
  assert.equal(s.cultivation, 10);
  assert.equal(FC.REALMS[10], '筑基一层');
  assert.equal(s.lifespanYears, 49); // 9 + 40（筑基一层）
  FC.Dev.setRealm(s, 12);
  assert.equal(s.lifespanYears, 169); // 再加筑基三层的 120（9+40+120）
  FC.Dev.setRealm(s, 3);
  assert.equal(s.cultivation, 3);
  assert.equal(s.lifespanYears, 169); // 炼气段 +0，不加不减
  FC.Dev.setRealm(s, 0);
  assert.equal(s.cultivation, 0);
  assert.equal(s.lifespanYears, 169);
});

test('setRealm 越界截到合法境界并补足该层加成', () => {
  const s = FC.State.create('李恒');
  FC.Dev.setRealm(s, 99);
  assert.equal(s.cultivation, 12);
  assert.equal(s.lifespanYears, 9 + 120);
  FC.Dev.setRealm(s, -1);
  assert.equal(s.cultivation, 0);
  assert.equal(s.lifespanYears, 9 + 120); // 凡人 +0
});

test('jump 置 nodeId，目标不存在抛错且不改原值', () => {
  const s = FC.State.create('李恒');
  const graph = { start: { type: 'scene' }, hub1: { type: 'hub' } };
  FC.Dev.jump(s, graph, 'hub1');
  assert.equal(s.nodeId, 'hub1');
  assert.throws(() => FC.Dev.jump(s, graph, 'nope'), /未知节点/);
  assert.throws(() => FC.Dev.jump(s, null, 'start'), /未知节点/);
  assert.equal(s.nodeId, 'hub1');
});

test('toggleExempt 翻转并返回新值；setLuck 设置并截断', () => {
  const s = FC.State.create('李恒');
  assert.equal(FC.Dev.toggleExempt(s), true);
  assert.equal(s.deathExempt, true);
  assert.equal(FC.Dev.toggleExempt(s), false);
  assert.equal(s.deathExempt, false);
  FC.Dev.setLuck(s, 80); assert.equal(s.luck, 80);
  FC.Dev.setLuck(s, 999); assert.equal(s.luck, 100);
});

// —— DOM 面板（假环境）——

test('mount：面板默认隐藏，~ 键切换显隐，输入类元素内按键忽略', () => {
  const m = mounted(FC.State.create('李恒'));
  assert.equal(m.handle.panel.style.display, 'none');
  m.doc.fireKey({ key: '~', target: { tagName: 'BODY' } });
  assert.equal(m.handle.panel.style.display, 'block');
  m.doc.fireKey({ key: '~', target: { tagName: 'BODY' } });
  assert.equal(m.handle.panel.style.display, 'none');
  m.doc.fireKey({ key: '~', target: { tagName: 'INPUT' } });
  assert.equal(m.handle.panel.style.display, 'none');
  m.doc.fireKey({ key: '~' }); // 无 target 也应切换
  assert.equal(m.handle.panel.style.display, 'block');
  m.doc.fireKey({ key: '', code: 'Backquote', target: { tagName: 'BODY' } });
  assert.equal(m.handle.panel.style.display, 'none');
});

test('mount：资源设置按钮写入状态并触发重绘，非法数字有提示', () => {
  const m = mounted(FC.State.create('李恒'));
  const rowLs = byId(m.handle.panel, 'fc-dev-lingshi');
  ctl(rowLs).value = '50';
  btn(rowLs, '设置')._fire('click');
  assert.equal(m.state().lingshi, 50);
  assert.ok(m.renders() > 0);
  const rowLf = byId(m.handle.panel, 'fc-dev-lifespan');
  ctl(rowLf).value = '120';
  btn(rowLf, '设置')._fire('click');
  assert.equal(m.state().lifespanYears, 120);
  ctl(rowLs).value = 'abc';
  const before = m.state().lingshi;
  btn(rowLs, '设置')._fire('click');
  assert.equal(m.state().lingshi, before);
  assert.ok(m.handle.status.textContent.includes('请输入有效数字'));
});

test('mount：伤势/机缘滑杆与境界下拉生效', () => {
  const m = mounted(FC.State.create('李恒'));
  const inj = ctl(byId(m.handle.panel, 'fc-dev-injury'));
  inj.value = '250'; inj._fire('change');
  assert.equal(m.state().injury, 100);
  const luck = ctl(byId(m.handle.panel, 'fc-dev-luck'));
  luck.value = '30'; luck._fire('change');
  assert.equal(m.state().luck, 30);
  const realm = ctl(byId(m.handle.panel, 'fc-dev-realm'));
  realm.value = '10'; realm._fire('change');
  assert.equal(m.state().cultivation, 10);
  assert.equal(m.state().lifespanYears, 49); // 9 + 40
  assert.ok(m.handle.status.textContent.includes('筑基一层'));
});

test('mount：物品添加/移除走效果系统', () => {
  const m = mounted(FC.State.create('李恒'));
  const row = byId(m.handle.panel, 'fc-dev-item');
  const inputs = row.children.filter(c => c.tag === 'input');
  inputs[0].value = '灵草'; inputs[1].value = '2';
  btn(row, '添加')._fire('click');
  assert.equal(m.state().inventory['灵草'], 2);
  inputs[1].value = '5';
  btn(row, '移除')._fire('click');
  assert.equal(m.state().inventory['灵草'], 0);
  assert.ok(m.handle.status.textContent.includes('失去 灵草'));
});

test('mount：快进按钮走效果系统（天数推进 + 寿元按天扣减）', () => {
  const m = mounted(FC.State.create('李恒'));
  const row = byId(m.handle.panel, 'fc-dev-time');
  btn(row, '快进 30 天')._fire('click');
  assert.equal(m.state().day, 31);
  assert.ok(Math.abs(m.state().lifespanYears - (9 - 30 / 365)) < 1e-9);
  assert.ok(m.handle.status.textContent.includes('时间流逝 30 天'));
  btn(row, '快进 1 天')._fire('click');
  assert.equal(m.state().day, 32);
});

test('mount：章节跳转校验目标，检查点保存走 Save', () => {
  const graph = { start: { type: 'scene' }, ch2: { type: 'scene' } };
  const m = mounted(FC.State.create('李恒'), { graph: graph });
  const rowJ = byId(m.handle.panel, 'fc-dev-jump');
  ctl(rowJ).value = 'ch2';
  btn(rowJ, '跳转')._fire('click');
  assert.equal(m.state().nodeId, 'ch2');
  ctl(rowJ).value = 'nope';
  btn(rowJ, '跳转')._fire('click');
  assert.equal(m.state().nodeId, 'ch2');
  assert.ok(m.handle.status.textContent.includes('未知节点'));
  btn(byId(m.handle.panel, 'fc-dev-checkpoint'), '存检查点')._fire('click');
  assert.ok(m.handle.status.textContent.includes('检查点已保存'));
  assert.equal(FC.Save.load('checkpoint').name, '李恒');
});

test('mount：未接入剧情图时跳转给出友好提示', () => {
  const m = mounted(FC.State.create('李恒'));
  btn(byId(m.handle.panel, 'fc-dev-jump'), '跳转')._fire('click');
  assert.ok(m.handle.status.textContent.includes('剧情图'));
});

test('mount：豁免开关与打开面板时同步外部状态', () => {
  const s = FC.State.create('李恒');
  const m = mounted(s);
  const box = ctl(byId(m.handle.panel, 'fc-dev-exempt'));
  assert.equal(box.checked, false);
  box._fire('change');
  assert.equal(s.deathExempt, true);
  box._fire('change');
  assert.equal(s.deathExempt, false);
  s.lingshi = 77; s.injury = 55; s.luck = 25; s.deathExempt = true;
  m.handle.toggle(); m.handle.toggle(); // 关再开 → 重新同步
  assert.equal(ctl(byId(m.handle.panel, 'fc-dev-lingshi')).value, '77');
  assert.equal(ctl(byId(m.handle.panel, 'fc-dev-injury')).value, '55');
  assert.equal(ctl(byId(m.handle.panel, 'fc-dev-luck')).value, '25');
  assert.equal(box.checked, true);
});

test('mount：无对局时操作给出友好提示且不崩溃', () => {
  const m = mounted(null);
  btn(byId(m.handle.panel, 'fc-dev-lingshi'), '设置')._fire('click');
  assert.ok(m.handle.status.textContent.includes('尚未开始对局'));
});

test('mount：destroy 移除 ~ 键监听', () => {
  const m = mounted(FC.State.create('李恒'));
  m.handle.destroy();
  m.doc.fireKey({ key: '~', target: { tagName: 'BODY' } });
  assert.equal(m.handle.panel.style.display, 'none');
});
