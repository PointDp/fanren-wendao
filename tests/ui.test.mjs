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

// —— 存档隔离：Node 默认无 localStorage，走内存兜底；用例按需清空 ——
const REAL_LS = globalThis.localStorage;
function cleanSave() {
  FC.Save._mem.clear();
  FC.Save.memoryFallback = false; // 内存兜底提示标记一并复位，保证用例隔离
  if (REAL_LS === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = REAL_LS;
}

// —— 可注入的假环境（不依赖 jsdom）：窄 DOM 面 + 可手控定时器 ——
function makeEl(tag) {
  const el = {
    tag, id: '', className: '', children: [], style: {}, listeners: {}, parentNode: null,
    disabled: false, value: '', type: '', placeholder: '', _ownText: '',
    appendChild(c) { el.children.push(c); c.parentNode = el; return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) { el.children.splice(i, 1); c.parentNode = null; } return c; },
    addEventListener(ev, fn) { (el.listeners[ev] = el.listeners[ev] || []).push(fn); },
    removeEventListener(ev, fn) { const a = el.listeners[ev] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
    _fire(ev, arg) { (el.listeners[ev] || []).slice().forEach(fn => fn(arg || {})); },
  };
  // textContent 语义对齐真实 DOM：读 = 自身文本 + 后代文本；写 = 清空后代
  Object.defineProperty(el, 'textContent', {
    get() { return el._ownText + el.children.map(c => c.textContent).join(''); },
    set(v) { el._ownText = String(v); el.children.length = 0; },
  });
  return el;
}
function makeDoc() {
  const doc = {
    _keyListeners: [],
    createElement(tag) { return makeEl(tag); },
    addEventListener(ev, fn) { if (ev === 'keydown') doc._keyListeners.push(fn); },
    removeEventListener(ev, fn) { const i = doc._keyListeners.indexOf(fn); if (i >= 0) doc._keyListeners.splice(i, 1); },
    fireKey(e) { doc._keyListeners.slice().forEach(fn => fn(e)); },
  };
  return doc;
}
function makeTimers() {
  const seq = []; let nextId = 0;
  return {
    setTimeout(fn, ms) { const id = ++nextId; seq.push({ id, fn, ms, dead: false }); return id; },
    clearTimeout(id) { const t = seq.find(t => t.id === id); if (t) t.dead = true; },
    pending() { return seq.filter(t => !t.dead && typeof t.fn === 'function'); },
    flush(n) { // 逐个触发未取消的计时器（打字机为单链，每 tick 再排下一个）
      for (let k = 0; k < n; k++) {
        const t = seq.find(t => !t.dead && typeof t.fn === 'function');
        if (!t) break;
        t.dead = true; t.fn();
      }
    },
  };
}

// —— 测试图：开局 scene → hub（含 tag / 禁用项 / stay）→ scene；另有死亡小图 ——
function mainGraph() {
  return {
    start: { type: 'scene', text: '青牛镇外，黄尘古道。', goto: '营地' },
    营地: {
      type: 'hub', text: '杂役营地，人声嘈杂。',
      actions: [
        { label: '打坐修炼', tag: '修行', effects: [{ type: 'res', key: 'cultivation', delta: 1 }], stay: true },
        { label: '坊市跑腿', effects: [{ type: 'res', key: 'lingshi', delta: 2 }, { type: 'time', days: 10 }], stay: true },
        { label: '夜探禁地', tag: '危险', enabled: function () { return false; }, stay: true },
        { label: '出镇远行', goto: '官道' },
      ],
    },
    官道: { type: 'scene', text: '官道漫漫，行人稀少。', goto: '营地' },
  };
}
function deathGraph() {
  return {
    start: { type: 'scene', text: '你踏入妖兽领地。', goto: '葬身' },
    葬身: { type: 'death', cause: 'combat', text: '妖兽扑面而来。' },
  };
}

// 挂载工具：不清理存档（跨挂载用例依赖既有档）；需要干净档的用例先自行 cleanSave()
function mounted(opts) {
  opts = opts || {};
  const doc = makeDoc();
  const timers = makeTimers();
  const container = makeEl('div');
  const env = { document: doc, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout };
  if ('graph' in opts) env.graph = opts.graph;
  if (opts.getGraph) env.getGraph = opts.getGraph;
  const handle = FC.UI.mount(container, env);
  return {
    handle, container, doc, timers,
    screen: () => container.children[container.children.length - 1],
  };
}
const walk = (n, fn) => { fn(n); (n.children || []).forEach(c => walk(c, fn)); };
const all = (root, tag) => { const out = []; walk(root, n => { if (n.tag === tag) out.push(n); }); return out; };
const byClass = (root, cls) => { let hit = null; walk(root, n => { if (!hit && n.className === cls) hit = n; }); return hit; };
const btnByText = (root, text) => all(root, 'button').find(b => b.textContent === text);
const choiceBtn = (root, label) => all(root, 'button').find(b => {
  const sp = (b.children || []).find(c => c.className === 'choice-label');
  return sp && sp.textContent === label;
});
const statusText = (root) => { const sb = byClass(root, 'statusbar'); return sb ? sb.textContent : ''; };
const slotRows = (root) => all(root, 'div').filter(d => d.className === 'slot-row');

// —— 纯逻辑：状态栏摘要 ——

test('summary 含境界名/灵石数/寿元年数/天数/伤势/机缘/背包摘要', () => {
  const s = FC.State.create('李恒'); // cultivation=1 炼气一层，lingshi=2，寿元 9，第 1 天
  const t = FC.UI.summary(s);
  assert.ok(t.includes('炼气一层'), t);
  assert.ok(t.includes('灵石 2'), t);
  assert.ok(t.includes('寿元 9.0 年'), t);
  assert.ok(t.includes('第 1 天'), t);
  assert.ok(t.includes('伤势 0'), t);
  assert.ok(t.includes('机缘 0'), t);
  assert.ok(t.includes('背包：空'), t);
  s.lingshi = 12; s.lifespanYears = 8.5; s.day = 40; s.injury = 30; s.luck = 7;
  s.inventory['灵草'] = 2;
  const t2 = FC.UI.summary(s);
  assert.ok(t2.includes('灵石 12'), t2);
  assert.ok(t2.includes('寿元 8.5 年'), t2);
  assert.ok(t2.includes('第 40 天'), t2);
  assert.ok(t2.includes('伤势 30'), t2);
  assert.ok(t2.includes('机缘 7'), t2);
  assert.ok(t2.includes('灵草×2'), t2);
});

// —— 纯逻辑：死因结局文 ——

test('deathText：六档死因各返回非空且互不相同的结局文；未知死因有兜底', () => {
  const causes = ['lifespan', 'combat', 'poison', 'exiled', '兵解', '丹毒'];
  const texts = causes.map(c => { const s = FC.State.create('李恒'); s.dead = c; return FC.UI.deathText(s); });
  texts.forEach((t, i) => assert.ok(typeof t === 'string' && t.length > 0, causes[i]));
  assert.equal(new Set(texts).size, 6);
  const s = FC.State.create('李恒'); s.dead = '神秘死因';
  const t = FC.UI.deathText(s);
  assert.ok(t.length > 0);
  assert.ok(!texts.includes(t));
});

// —— 纯逻辑：存读档槽位计划 ——

test('slotPlan：五槽固定顺序与标签；手动位可存、auto/检查点只读；信息与可读随存档变化', () => {
  cleanSave();
  const s = FC.State.create('李恒');
  let plan = FC.UI.slotPlan(s);
  assert.deepEqual(plan.map(p => p.slot), ['auto', 'checkpoint', 'm1', 'm2', 'm3']);
  assert.deepEqual(plan.map(p => p.label), ['自动档', '检查点', '手动档一', '手动档二', '手动档三']);
  plan.forEach(p => {
    assert.equal(p.canSave, p.slot.charAt(0) === 'm');
    assert.equal(p.canLoad, false);
    assert.equal(p.hasSave, false);
    assert.equal(p.info, '暂无存档');
  });
  FC.Save.save(s, 'm2');
  const other = FC.State.create('张三'); other.day = 9;
  FC.Save.save(other, 'checkpoint');
  plan = FC.UI.slotPlan(s);
  assert.equal(plan[1].canLoad, true); // 检查点可读
  assert.ok(plan[1].info.includes('第 9 天'));
  assert.equal(plan[3].canLoad, true); // m2 可读
  assert.ok(plan[3].info.includes('第 1 天'));
  assert.equal(plan[0].canLoad, false); // auto 仍为空
  const dead = FC.State.create('李恒'); dead.dead = 'lifespan';
  FC.UI.slotPlan(dead).forEach(p => assert.equal(p.canSave, false, p.slot)); // 死亡不提供存入
});

// —— 开局流程 ——

test('开局界面：无 auto 时没有继续游戏按钮；姓名默认"李恒"，新的开始进入主界面', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  assert.equal(btnByText(m.screen(), '继续游戏'), undefined);
  const input = all(m.screen(), 'input').find(i => i.type === 'text');
  assert.equal(input.value, '李恒');
  input.value = '韩立';
  btnByText(m.screen(), '新的开始')._fire('click');
  assert.equal(m.handle.getState().name, '韩立');
  assert.equal(m.handle.getState().nodeId, 'start');
  assert.ok(m.screen().className.includes('screen-main'));
  assert.ok(statusText(m.container).includes('炼气一层'));
});

test('开局界面：空姓名回退默认"李恒"', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  all(m.screen(), 'input').find(i => i.type === 'text').value = '   ';
  btnByText(m.screen(), '新的开始')._fire('click');
  assert.equal(m.handle.getState().name, '李恒');
});

test('开局界面：有 auto 时显示继续游戏，点击恢复对局', () => {
  cleanSave();
  const m0 = mounted({ graph: mainGraph() });
  btnByText(m0.screen(), '新的开始')._fire('click');
  m0.handle.getState().lingshi = 88;
  assert.equal(FC.Save.save(m0.handle.getState(), 'auto').ok, true);
  const m = mounted({ graph: mainGraph() }); // 同一存档环境
  const cont = btnByText(m.screen(), '继续游戏');
  assert.ok(cont);
  cont._fire('click');
  assert.equal(m.handle.getState().lingshi, 88);
  assert.ok(m.screen().className.includes('screen-main'));
});

// —— 主循环与选项渲染 ——

test('主循环：继续推进到 hub；hub 行动按钮生效（资源/时间入账、状态栏刷新、auto 落盘）', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  assert.ok(choiceBtn(m.screen(), '继续')); // scene 的"继续"按钮
  m.timers.flush(999);
  choiceBtn(m.screen(), '继续')._fire('click');
  assert.ok(choiceBtn(m.screen(), '打坐修炼')); // hub 行动按钮
  assert.ok(statusText(m.container).includes('第 1 天'));
  choiceBtn(m.screen(), '坊市跑腿')._fire('click');
  assert.equal(m.handle.getState().lingshi, 4);
  assert.equal(m.handle.getState().day, 11);
  assert.ok(statusText(m.container).includes('第 11 天'));
  assert.ok(statusText(m.container).includes('灵石 4'));
  const auto = FC.Save.load('auto'); // hub 进入即自动落盘
  assert.ok(auto);
  assert.equal(auto.nodeId, '营地');
});

test('选项渲染：tag 徽标随按钮显示；禁用项不可点、点击后状态不变', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  choiceBtn(m.screen(), '继续')._fire('click');
  const sit = choiceBtn(m.screen(), '打坐修炼');
  assert.equal(sit.disabled, false);
  assert.equal(sit.children.find(c => c.className === 'badge').textContent, '修行');
  const danger = choiceBtn(m.screen(), '夜探禁地');
  assert.equal(danger.disabled, true);
  assert.equal(danger.children.find(c => c.className === 'badge').textContent, '危险');
  danger._fire('click'); // 禁用项：UI 不响应（engine 亦拒绝）
  assert.equal(m.handle.getState().day, 1);
  assert.ok(m.screen().className.includes('screen-main'));
});

test('choose 三种返回形状：{ok:false,reason:"disabled"} 时 UI 状态原样不推进', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  choiceBtn(m.screen(), '继续')._fire('click');
  // 引擎侧确认形状：可见序 2 = 禁用项"夜探禁地"（Task 5 约定：index 为 show 过滤后的序）
  const r = FC.Engine.choose(m.handle.getState(), mainGraph(), 2);
  assert.deepEqual(r, { ok: false, reason: 'disabled' });
  // UI 侧：禁用按钮点击后不推进（无新自动档、天数不变）
  const before = FC.Save.load('auto');
  choiceBtn(m.screen(), '夜探禁地')._fire('click');
  assert.equal(m.handle.getState().day, 1);
  assert.deepEqual(FC.Save.load('auto'), before);
});

test('效果/时间流水：choose 后选项区上方显示一行中文摘要；无效果换节点后清除', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  choiceBtn(m.screen(), '继续')._fire('click');
  assert.ok(!byClass(m.screen(), 'logline'), '尚未选择：无流水');
  choiceBtn(m.screen(), '坊市跑腿')._fire('click'); // 灵石 +2、时间流逝 10 天
  const line = byClass(m.screen(), 'logline');
  assert.ok(line, 'choose 后应出现流水行');
  assert.ok(line.textContent.includes('灵石 +2'), line.textContent);
  assert.ok(line.textContent.includes('时间流逝 10 天'), line.textContent);
  // 流水行位于选项区上方（正文之后）
  const kids = m.screen().children;
  assert.ok(kids.indexOf(line) < kids.indexOf(byClass(m.screen(), 'choices')));
  choiceBtn(m.screen(), '打坐修炼')._fire('click'); // stay 动作：流水替换为本次摘要
  const line2 = byClass(m.screen(), 'logline');
  assert.ok(line2.textContent.includes('修为 +1'), line2.textContent);
  assert.ok(!line2.textContent.includes('灵石 +2'), '旧流水应被替换');
  choiceBtn(m.screen(), '出镇远行')._fire('click'); // 无效果动作换节点：流水清除不残留
  assert.ok(!byClass(m.screen(), 'logline'), '旧流水不应残留');
});

// —— 打字机与加速 ——

test('打字机：逐字显示（首字 ~28ms 计划）；点击正文区立即补全并清空计时器', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  const textEl = byClass(m.screen(), 'gametext');
  assert.equal(textEl.textContent, ''); // 尚未显示
  const p0 = m.timers.pending();
  assert.equal(p0.length, 1);
  assert.equal(p0[0].ms, 28);
  m.timers.flush(2);
  assert.equal(textEl.textContent, '青牛');
  m.timers.flush(999);
  assert.equal(textEl.textContent, '青牛镇外，黄尘古道。');
  assert.equal(m.timers.pending().length, 0);
  choiceBtn(m.screen(), '继续')._fire('click'); // 新节点重新逐字
  const t2 = byClass(m.screen(), 'gametext');
  assert.equal(t2.textContent, '');
  t2._fire('click'); // 点击正文区 → 立即补全
  assert.equal(t2.textContent, '杂役营地，人声嘈杂。');
  assert.equal(m.timers.pending().length, 0);
});

test('加速开关：开启后当前与新文本直接全文、无计时器；关闭后恢复逐字', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  assert.equal(m.timers.pending().length, 1);
  btnByText(m.screen(), '⏩ 加速')._fire('click');
  assert.ok(btnByText(m.screen(), '⏩ 加速中'));
  assert.equal(byClass(m.screen(), 'gametext').textContent, '青牛镇外，黄尘古道。');
  assert.equal(m.timers.pending().length, 0);
  choiceBtn(m.screen(), '继续')._fire('click');
  assert.equal(byClass(m.screen(), 'gametext').textContent, '杂役营地，人声嘈杂。'); // 新文本直接全文
  assert.equal(m.timers.pending().length, 0);
  btnByText(m.screen(), '⏩ 加速中')._fire('click'); // 关闭
  assert.ok(btnByText(m.screen(), '⏩ 加速'));
  choiceBtn(m.screen(), '出镇远行')._fire('click');
  assert.equal(byClass(m.screen(), 'gametext').textContent, ''); // 恢复逐字
  assert.equal(m.timers.pending().length, 1);
});

test('FC.UI.rerender()：外部改状态后状态栏刷新，且不重置已显示正文', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  m.timers.flush(999);
  m.handle.getState().lingshi = 99;
  FC.UI.rerender();
  assert.ok(statusText(m.container).includes('灵石 99'));
  assert.equal(byClass(m.screen(), 'gametext').textContent, '青牛镇外，黄尘古道。');
  assert.equal(m.timers.pending().length, 0);
});

// —— 死亡画面与检查点复活 ——

test('死亡画面：走至 death 节点显示结局文；从检查点苏醒可复活', () => {
  cleanSave();
  const m = mounted({ graph: deathGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  assert.equal(FC.Save.save(m.handle.getState(), 'checkpoint').ok, true); // 此前保存的检查点
  choiceBtn(m.screen(), '继续')._fire('click');
  assert.ok(m.screen().className.includes('screen-death'));
  assert.ok(byClass(m.screen(), 'death-text').textContent.length > 0);
  assert.ok(btnByText(m.screen(), '从检查点苏醒'));
  assert.ok(btnByText(m.screen(), '重新开始'));
  btnByText(m.screen(), '从检查点苏醒')._fire('click');
  assert.ok(m.screen().className.includes('screen-main'));
  assert.equal(FC.State.isDead(m.handle.getState()), false);
  assert.equal(m.handle.getState().nodeId, 'start');
});

test('死亡画面：无检查点时提示且停留；重新开始回到开局界面', () => {
  cleanSave();
  const m = mounted({ graph: deathGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  cleanSave(); // Task 9 接线后新开局会写章首检查点；清空以模拟"存档被清/无检查点"场景
  choiceBtn(m.screen(), '继续')._fire('click');
  btnByText(m.screen(), '从检查点苏醒')._fire('click');
  assert.ok(m.screen().className.includes('screen-death'));
  assert.ok(byClass(m.screen(), 'death-msg').textContent.includes('检查点'));
  btnByText(m.screen(), '重新开始')._fire('click');
  assert.ok(m.screen().className.includes('screen-start'));
  assert.equal(m.handle.getState(), null);
});

test('choose 返回 {dead:true}：死亡后仍点选项时进入死亡画面且不崩溃', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  choiceBtn(m.screen(), '继续')._fire('click');
  m.handle.getState().dead = 'combat'; // 模拟外部（如面板快进）致死
  choiceBtn(m.screen(), '出镇远行')._fire('click');
  assert.ok(m.screen().className.includes('screen-death'));
});

test('继续游戏读入死亡 auto 档：直接进入死亡画面', () => {
  cleanSave();
  const m0 = mounted({ graph: deathGraph() });
  btnByText(m0.screen(), '新的开始')._fire('click');
  choiceBtn(m0.screen(), '继续')._fire('click'); // 死亡，死亡状态已自动落盘
  assert.ok(FC.Save.load('auto').dead);
  const m = mounted({ graph: deathGraph() });
  btnByText(m.screen(), '继续游戏')._fire('click');
  assert.ok(m.screen().className.includes('screen-death'));
});

// —— 存读档菜单 ——

test('存读档菜单：五槽位行；auto/检查点无存入按钮；存入有提示且信息行更新；读取恢复状态', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  btnByText(m.screen(), '存档')._fire('click');
  assert.ok(m.screen().className.includes('screen-save'));
  let rows = slotRows(m.screen());
  assert.equal(rows.length, 5);
  assert.equal(all(rows[0], 'button').find(b => b.textContent === '存入'), undefined); // auto 只读
  assert.equal(all(rows[1], 'button').find(b => b.textContent === '存入'), undefined); // 检查点只读
  assert.equal(all(rows[3], 'button').find(b => b.textContent === '读取'), undefined); // m2 空档无读取
  all(rows[2], 'button').find(b => b.textContent === '存入')._fire('click'); // 存入手动档一
  assert.ok(FC.Save.load('m1'));
  assert.ok(byClass(m.screen(), 'save-msg').textContent.includes('已存入手动档一'));
  rows = slotRows(m.screen());
  assert.ok(rows[2].textContent.includes('第 1 天')); // 信息行显示该档摘要
  m.handle.getState().lingshi = 50;
  all(rows[2], 'button').find(b => b.textContent === '读取')._fire('click'); // 读回
  assert.equal(m.handle.getState().lingshi, 2);
  assert.ok(m.screen().className.includes('screen-main'));
  btnByText(m.screen(), '存档')._fire('click'); // 返回菜单再返回主界面
  btnByText(m.screen(), '返回')._fire('click');
  assert.ok(m.screen().className.includes('screen-main'));
});

test('开局界面读档入口：无存档时不显示；有存档时可进入菜单且此时无存入按钮', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  assert.equal(btnByText(m.screen(), '读档'), undefined); // 无任何存档：无读档入口
  const s = FC.State.create('张三'); s.day = 5;
  FC.Save.save(s, 'm1');
  FC.UI.rerender(); // 重绘开局屏后出现入口
  btnByText(m.screen(), '读档')._fire('click');
  assert.ok(m.screen().className.includes('screen-save'));
  const rows = slotRows(m.screen());
  assert.equal(all(rows[2], 'button').find(b => b.textContent === '存入'), undefined); // 无对局不可存
  all(rows[2], 'button').find(b => b.textContent === '读取')._fire('click');
  assert.equal(m.handle.getState().name, '张三');
  assert.ok(m.screen().className.includes('screen-main'));
});

test('内存兜底提示：存档落入内存后标题与存档菜单显示 ⚠ 提示；未降级时不显示', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  assert.ok(!byClass(m.screen(), 'memory-notice'), '本会话尚无存取，不提示'); // 本会话尚无存取，不提示
  btnByText(m.screen(), '新的开始')._fire('click'); // 引擎自动写章首检查点 → 内存兜底
  btnByText(m.screen(), '标题')._fire('click');
  const notice = byClass(m.screen(), 'memory-notice');
  assert.ok(notice, '标题界面应显示内存兜底提示');
  assert.ok(notice.textContent.includes('内存'), notice.textContent);
  assert.ok(notice.textContent.includes('丢失'), notice.textContent);
  btnByText(m.screen(), '新的开始')._fire('click'); // 重新进入对局
  btnByText(m.screen(), '存档')._fire('click');
  assert.ok(byClass(m.screen(), 'memory-notice'), '存档菜单也应显示内存兜底提示');
});

// —— 内容缺失与渲染容错 ——

test('内容缺失容错：graph 为 null 或 getGraph 抛错时显示"内容加载中"不崩溃', () => {
  cleanSave();
  const m = mounted({ graph: null });
  assert.ok(m.screen().textContent.includes('内容加载中'));
  const m2 = mounted({ getGraph() { throw new Error('内容尚未就绪'); } });
  assert.ok(m2.screen().textContent.includes('内容加载中'));
});

test('渲染容错：存档节点缺失时给出错误屏与重新开始出口，不白屏', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  m.handle.getState().nodeId = '不存在的节点';
  FC.UI.rerender();
  assert.ok(m.screen().textContent.includes('渲染出错'));
  btnByText(m.screen(), '重新开始')._fire('click');
  assert.ok(m.screen().className.includes('screen-start'));
});

// —— 开发者面板集成与销毁 ——

test('开发者面板集成：~ 呼出，改灵石立即反映到状态栏', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  m.doc.fireKey({ key: '~', target: { tagName: 'BODY' } });
  const devHost = m.container.children.find(c => c.className === 'dev-host');
  const panel = devHost.children[0];
  assert.equal(panel.style.display, 'block');
  const row = panel.children.find(c => c.id === 'fc-dev-lingshi');
  row.children.find(c => c.tag === 'input').value = '66';
  row.children.find(c => c.tag === 'button' && c.textContent === '设置')._fire('click');
  assert.equal(m.handle.getState().lingshi, 66);
  assert.ok(statusText(m.container).includes('灵石 66'));
});

test('主界面可回到标题界面：对局清空但存档保留（章末终局/中途歇手的出口）', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  choiceBtn(m.screen(), '继续')._fire('click'); // 进入 hub（已落 auto）
  btnByText(m.screen(), '标题')._fire('click');
  assert.ok(m.screen().className.includes('screen-start'));
  assert.equal(m.handle.getState(), null);
  assert.ok(FC.Save.load('auto'), '进度不被清除，可经「继续游戏」恢复');
});

test('destroy：清理打字机计时器与面板 ~ 键监听', () => {
  cleanSave();
  const m = mounted({ graph: mainGraph() });
  btnByText(m.screen(), '新的开始')._fire('click');
  assert.equal(m.timers.pending().length, 1);
  m.handle.destroy();
  assert.equal(m.timers.pending().length, 0);
  m.doc.fireKey({ key: '~', target: { tagName: 'BODY' } });
  const devHost = m.container.children.find(c => c.className === 'dev-host');
  assert.equal(devHost.children[0].style.display, 'none'); // 面板不再响应 ~
});
