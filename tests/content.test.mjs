import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../js/state.js');
require('../js/effects.js');
require('../js/save.js');
require('../js/engine.js');
require('../js/ui.js');
require('../js/content/realm.js');
require('../js/content/items.js');
require('../js/content/ch1.js');
const FC = globalThis.FC;

// —— 测试脚手架：Node 默认无 localStorage，走内存兜底；每例清空保证隔离 ——
function cleanSave() {
  FC.Save._mem.clear();
}

// —— 小图工厂：validate 单元测试用 ——
function goodGraph() {
  return {
    start: { type: 'scene', text: '开头。', goto: '岔路' },
    岔路: { type: 'choice', text: '岔路。', choices: [
      { label: '走左边', goto: '终' },
      { label: '走右边', goto: '月轮' },
    ] },
    月轮: { type: 'hub', text: '月轮。', actions: [
      { label: '当值', effects: [{ type: 'time', days: 30 }], stay: true },
      { label: '离开', effects: [{ type: 'time', days: 30 }], goto: '斗' },
    ] },
    斗: { type: 'combat', text: '斗。', resolve: { test: (s) => !!s.flags.敢, pass: '终', fail: '殁' }, choices: [
      { label: '亮兵器', effects: [{ type: 'flag', id: '敢', value: true }] },
    ] },
    殁: { type: 'death', cause: 'combat', text: '死了。' },
    终: { type: 'scene', text: '章末。', terminal: true },
  };
}

// ———— FC.Test.validate：规则逐条 ————

test('validate：好图返回 ok 且零错误', () => {
  const r = FC.Test.validate(goodGraph());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('validate：悬空 goto（scene/choice/hub/combat pass/fail）逐条报错', () => {
  const g = goodGraph();
  g.start.goto = '不存在';
  g.岔路.choices[0].goto = '也没这';
  g.月轮.actions[1].goto = '还是没有';
  g.斗.resolve.pass = '虚';
  g.斗.resolve.fail = '空';
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.equal(r.ok, false);
  for (const t of ['不存在', '也没这', '还是没有', '虚', '空']) assert.match(joined, new RegExp(t));
});

test('validate：未知节点类型、缺入口 start', () => {
  const g = goodGraph();
  g.终.type = 'cutscene';
  delete g.start;
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.match(joined, /未知节点类型/);
  assert.match(joined, /缺少入口节点 start/);
});

test('validate：非 death/hub 节点缺 choice 与 goto 报错；terminal 豁免', () => {
  const g = goodGraph();
  g.岔路.choices = []; // choice 无选项
  delete g.终.terminal;
  delete g.终.goto;    // scene 无 goto 也无 terminal
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.match(joined, /\[岔路\]/);
  assert.match(joined, /\[终\]/);
  g.终.terminal = true;
  g.岔路.choices = [{ label: '走', goto: '终' }]; // 恢复可达性后验证豁免
  const r2 = FC.Test.validate(g);
  assert.equal(r2.errors.some((e) => /^\[终\]/.test(e)), false);
});

test('validate：combat 缺 resolve、pass/fail 非字符串、无选项、选项带 goto 都报错', () => {
  const g = goodGraph();
  delete g.斗.resolve;
  g.斗.choices = [];
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.match(joined, /\[斗\].*resolve/);
  assert.match(joined, /\[斗\].*选项/);
  const g2 = goodGraph();
  g2.斗.resolve = { test: () => true, pass: '终', fail: '殁' };
  g2.斗.choices = [{ label: '莽', goto: '终' }];
  const r2 = FC.Test.validate(g2);
  assert.match(r2.errors.join('\n'), /会被引擎忽略/);
  const g3 = goodGraph();
  g3.斗.resolve = { test: () => true, pass: '终', fail: null };
  const r3 = FC.Test.validate(g3);
  assert.match(r3.errors.join('\n'), /fail/);
});

test('validate：death 节点缺 cause 报错', () => {
  const g = goodGraph();
  delete g.殁.cause;
  const r = FC.Test.validate(g);
  assert.match(r.errors.join('\n'), /\[殁\].*cause/);
});

test('validate：hub action 缺 time 效果、缺 goto/stay、缺 label 报错', () => {
  const g = goodGraph();
  g.月轮.actions[0].effects = []; // 无 time
  delete g.月轮.actions[1].goto;  // 无 goto 也非 stay
  g.月轮.actions.push({ label: '', goto: '终' }); // 空 label
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.match(joined, /time/);
  assert.match(joined, /goto|stay/);
  assert.match(joined, /label/);
});

test('validate：choice 项缺 label / 缺 goto 报错', () => {
  const g = goodGraph();
  g.岔路.choices[0].label = '';
  delete g.岔路.choices[1].goto;
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.match(joined, /label/);
  assert.match(joined, /goto/);
});

test('validate：节点正文为空（字符串与函数两种）报错；death 正文不作要求', () => {
  const g = goodGraph();
  g.岔路.text = '   ';
  g.斗.text = () => '';
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  assert.match(joined, /\[岔路\].*正文/);
  assert.match(joined, /\[斗\].*正文/);
  assert.equal(r.errors.some((e) => /^\[殁\]/.test(e)), false);
});

test('validate：效果形状非法（未知类型/未知 res key/非法 days/缺失字段/值不可序列化）报错', () => {
  const g = goodGraph();
  g.岔路.effects = [{ type: 'explode' }];
  g.月轮.actions[0].effects = [{ type: 'res', key: 'mana', delta: 1 }];
  g.斗.choices[0].effects = [{ type: 'time', days: 0 }, { type: 'item', id: '' }];
  g.月轮.actions.push({ label: '又走', goto: '终', effects: [{ type: 'time', days: 30 }, { type: 'karma', id: 'k', value: undefined }] });
  const r = FC.Test.validate(g);
  const joined = r.errors.join('\n');
  for (const t of ['explode', 'mana', 'days', 'item', 'karma']) assert.ok(joined.includes(t), '应含: ' + t);
});

test('validate：函数 goto 引用图中不存在节点报错；引用存在节点不报', () => {
  const g = goodGraph();
  g.岔路.choices[0].goto = (s) => (s.flags.x ? '幽灵节点' : '终');
  const r = FC.Test.validate(g);
  assert.match(r.errors.join('\n'), /幽灵节点/);
  const g2 = goodGraph();
  g2.岔路.choices[0].goto = (s) => (s.flags.x ? '斗' : '终');
  assert.equal(FC.Test.validate(g2).ok, true);
});

test('validate：从 start 出发不可达的节点报错；choice.goto 指向不可达节点报错', () => {
  const g = goodGraph();
  g.孤岛 = { type: 'scene', text: '没人来。', goto: '终' };
  const r = FC.Test.validate(g);
  assert.match(r.errors.join('\n'), /不可达|孤岛/);
});

test('validate：空图、非对象图返回错误不抛异常', () => {
  assert.equal(FC.Test.validate({}).ok, false);
  assert.equal(FC.Test.validate(null).ok, false);
  assert.equal(FC.Test.validate('x').ok, false);
});

// ———— 第一章内容冒烟 ————

test('FC.Content 就绪：graph 与 FC.CH1 一致，入口 start，meta 指向存在的检查点节点', () => {
  cleanSave();
  assert.ok(FC.Content, 'FC.Content 未挂载');
  assert.ok(FC.CH1 && FC.CH1.start, 'FC.CH1 缺 start');
  assert.deepEqual(FC.Content.graph, FC.CH1);
  assert.equal(FC.Content.meta.chapter, 1);
  assert.ok(FC.CH1[FC.Content.meta.checkpointNode], 'checkpointNode 不存在于图中');
  assert.ok(FC.ITEMS && Object.keys(FC.ITEMS).length >= 12, '物品表应至少 12 件');
});

test('FC.Test.validate(FC.Content.graph) 全绿', () => {
  const r = FC.Test.validate(FC.Content.graph);
  assert.deepEqual(r, { ok: true, errors: [] });
});

// —— 变量收集：把图里引用的 karma/flag/item 全收出来 ——
function collectRefs(graph) {
  const karma = new Set(); const flags = new Set(); const items = new Set();
  const scanEffects = (fx) => (fx || []).forEach((e) => {
    if (e.type === 'karma') karma.add(e.id);
    if (e.type === 'flag') flags.add(e.id);
    if (e.type === 'item') items.add(e.id);
  });
  for (const id of Object.keys(graph)) {
    const n = graph[id];
    scanEffects(n.effects);
    for (const c of n.choices || []) scanEffects(c.effects);
    for (const a of n.actions || []) scanEffects(a.effects);
  }
  return { karma: [...karma], flags: [...flags], items: [...items] };
}

test('四种因果 karma 全部在图中落点', () => {
  const refs = collectRefs(FC.Content.graph);
  for (const id of ['took_blame', 'exposed_early', 'silent_witness', 'knows_truth']) {
    assert.ok(refs.karma.includes(id), '缺因果变量: ' + id);
  }
});

test('三条好感 karma 都有变化路径', () => {
  const refs = collectRefs(FC.Content.graph);
  for (const id of ['aff_zhang_tie', 'aff_li_shijie', 'aff_steward']) {
    assert.ok(refs.karma.includes(id), '缺好感变量: ' + id);
  }
});

test('固定四旗标（left_in_town/signed_contract/bought_way/steward_grudge）全部落点', () => {
  const refs = collectRefs(FC.Content.graph);
  for (const id of ['left_in_town', 'signed_contract', 'bought_way', 'steward_grudge']) {
    assert.ok(refs.flags.includes(id), '缺旗标: ' + id);
  }
});

test('图中引用的物品都在物品表里登记', () => {
  const refs = collectRefs(FC.Content.graph);
  for (const id of refs.items) {
    assert.ok(FC.ITEMS[id], '物品未登记: ' + id);
  }
});

// —— 全流程走查（引擎级脚本）——
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
function step(s, label) {
  const r = FC.Engine.choose(s, FC.Content.graph, pick(s, label));
  if (r && r.dead) throw new Error('意外死亡于「' + label + '」：' + s.dead);
  if (!r || r.ok !== true) throw new Error('选择被拒：「' + label + '」 ' + JSON.stringify(r));
  return r;
}
// 走完 hub 三个整月（常规行动各一月，自动穿过路上的单选项 scene），再进秋收直到灵田对质
function hubMonths(s, moves) {
  for (const label of moves) {
    step(s, label);
    drain(s);
  }
  step(s, '灵田秋收（季末，随队下田）');
  drain(s);
}
// 当前节点是"继续"单选项的 scene 时，一路点过去
function drain(s) {
  for (let i = 0; i < 10; i++) {
    const v = FC.Engine.view(s, FC.Content.graph);
    if (v.choices.length === 1 && v.choices[0].label === '继续') step(s, '继续');
    else return;
  }
  throw new Error('drain 超限：疑似死循环于 ' + s.nodeId);
}

test('走查·签苦契路线：hub 三月入账正确 → 顶罪 → 执法堂受罚得赏识 → 残页章末', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // start → 测灵大典 → 受辱
  step(s, '落云宗十年苦契，签！');
  assert.equal(s.flags.signed_contract, true);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  assert.equal(s.nodeId, '外门岁月');
  const day0 = s.day, ls0 = s.lingshi;
  hubMonths(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  assert.equal(s.karma.ch1_month, 3);
  assert.equal(s.day, day0 + 100); // 3×30 + 秋收 10
  assert.equal(s.lingshi, ls0 + 6); // 3×2
  step(s, '认下：“草是我拿的。”');
  assert.equal(s.karma.took_blame, 1);
  step(s, '继续'); // 对峙前夜
  step(s, '继续'); // 执法堂路由
  assert.equal(s.nodeId, '执法堂顶罪');
  step(s, '继续');
  assert.equal(s.flags.enforcer_notice, true);
  assert.equal(s.inventory['回气散'], 2);
  step(s, '继续'); // 章末夜话
  step(s, '原样藏回床板，来日再参'); // 残页抉择 → 第一章终
  assert.equal(s.nodeId, '第一章终');
  assert.equal(s.inventory['引气诀残页'], 1);
  assert.ok(s.day <= 400, 'day 超界: ' + s.day);
  assert.ok(s.lifespanYears < 9, '寿元应随时间减少');
  assert.ok(FC.Save.load('auto'), '应有 auto 存档');
  // Task 9 检查点接线：新开局写章首检查点，进入章末节点（meta.checkpointNode）时更新为章末进度
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '章末检查点应已自动落盘且可 load');
  assert.deepEqual(cp, s, '检查点应为章末完整进度');
  assert.ok(s.karma.aff_zhang_tie >= 3, '顶罪+张铁好感应有累积');
  assert.ok(s.karma.aff_steward >= 1, '点卯前管事好感应有来源');
});

test('走查·花光积蓄补测：糊窗夜练功成 → 指认真凶 → 王管事记恨 → 反咬小罚', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '倾尽积蓄，托刘婆子补测');
  assert.equal(s.flags.bought_way, true);
  assert.equal(s.lingshi, 0); // 全部积蓄 2 灵石押了进去
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 托关系→补测落定→点卯
  assert.equal(s.nodeId, '外门岁月');
  step(s, '坊市跑腿（替药铺送货，得赏钱）'); step(s, '继续'); // 初遇李师姐 → 回 hub
  step(s, '偷偷修炼（柴房夜练，自担风险）');
  step(s, '先花一文糊上油纸，只练半个时辰'); step(s, '继续'); // 功成 → 回 hub
  step(s, '杂役当值（领月钱，管三餐）');
  step(s, '灵田秋收（季末，随队下田）'); drain(s); // → 灵田对质
  assert.equal(s.karma.ch1_month, 3);
  assert.equal(s.cultivation, 2);
  step(s, '当面指认：“那夜我在田埂上见过赵四。”');
  assert.equal(s.karma.exposed_early, 1);
  assert.equal(s.flags.steward_grudge, true);
  step(s, '继续'); step(s, '继续'); // 对峙前夜 → 执法堂反咬
  assert.equal(s.nodeId, '执法堂反咬');
  step(s, '继续'); step(s, '继续'); // 章末夜话 → 床板残页
  step(s, '原样藏回床板，来日再参'); // → 第一章终
  assert.equal(s.nodeId, '第一章终');
  assert.ok(s.karma.aff_li_shijie >= 1, '坊市初遇应有李师姐好感');
  assert.ok(s.karma.aff_steward <= -2, '指认+反咬应重挫管事好感');
});

test('走查·留镇账房路线：访张铁×3 → 沉默 → 执法堂混过；月牌与功法到手', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '先活下来：留镇当账房伙计');
  assert.equal(s.flags.left_in_town, true);
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 账房三月→王管事→点卯
  assert.equal(s.nodeId, '外门岁月');
  assert.ok(s.karma.aff_steward >= 1);
  hubMonths(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）']);
  assert.equal(s.inventory['金刃符'], 1, '第二次访张铁应得金刃符');
  step(s, '垂下眼皮：“小人来的晚，什么也没瞧见。”');
  assert.equal(s.karma.silent_witness, 1);
  step(s, '继续'); step(s, '继续'); // 对峙前夜 → 执法堂混过
  assert.equal(s.nodeId, '执法堂混过');
  step(s, '继续'); step(s, '继续'); // 章末夜话 → 床板残页
  step(s, '凑着火光，连夜参悟'); // → 第一章终
  assert.equal(s.nodeId, '第一章终');
  assert.equal(s.flags.ch1_tried_page, true);
  assert.ok(s.inventory['长春功抄本'] >= 1 && s.inventory['杂役月牌'] >= 1);
});

test('走查·夜探得手：备符夜探 → knows_truth → 执法堂洗清', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '落云宗十年苦契，签！');
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  hubMonths(s, ['访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）', '杂役当值（领月钱，管三餐）']);
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  assert.equal(s.nodeId, '夜探灵田');
  step(s, '捏紧张铁给的金刃符，贴着田垄摸近档房');
  assert.equal(s.nodeId, '夜探真相');
  step(s, '继续'); // 真相效果在离开该 scene 时入账
  assert.equal(s.karma.knows_truth, 1);
  step(s, '继续'); step(s, '继续'); // 对峙前夜 → 执法堂 → 洗清
  assert.equal(s.nodeId, '执法堂洗清');
  step(s, '继续'); step(s, '继续'); // 章末夜话 → 床板残页
  assert.equal(s.flags.wang_suspended, true);
  step(s, '原样藏回床板，来日再参'); // → 第一章终
  assert.equal(s.nodeId, '第一章终');
  const r = FC.Test.validate(FC.Content.graph);
  assert.equal(r.ok, true);
});

test('走查·夜探强闯：无准备莽进 → 死亡（combat 四档结局文）；豁免开则重伤续行', () => {
  cleanSave();
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '落云宗十年苦契，签！');
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  hubMonths(s, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  step(s, '今夜便去。今夜不去，这辈子都得低头。');
  step(s, '举着火折子，直接翻档房的窗户找账册');
  assert.equal(s.nodeId, '夜探败露');
  step(s, '拼死往林子里闯');
  assert.equal(s.nodeId, '灵田喋血'); // 死前 scene：死亡效果在其"继续"上结算
  const r = FC.Engine.choose(s, FC.Content.graph, pick(s, '继续'));
  assert.equal(r.ok, true);
  assert.equal(s.dead, 'combat', '无豁免应真死');
  assert.match(FC.UI.deathText(s), /伤重不治/);
  assert.ok(FC.Save.load('auto'), '死亡状态照常落 auto');
  // 死亡不吞进度（Task 9 接线后）：检查点仍是新开局时的章首存活进度，未被死亡流程改写
  const cp = FC.Save.load('checkpoint');
  assert.ok(cp, '死亡前应有章首检查点');
  assert.equal(cp.nodeId, 'start');
  assert.equal(FC.State.isDead(cp), false, '检查点必须是存活进度');
  // 豁免开：改为重伤垂死，剧情继续走
  const s2 = freshState();
  s2.deathExempt = true;
  step(s2, '继续'); step(s2, '继续'); step(s2, '继续');
  step(s2, '落云宗十年苦契，签！');
  step(s2, '继续'); step(s2, '继续'); step(s2, '继续');
  hubMonths(s2, ['杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）', '杂役当值（领月钱，管三餐）']);
  step(s2, '今夜便去。今夜不去，这辈子都得低头。');
  step(s2, '举着火折子，直接翻档房的窗户找账册');
  step(s2, '拼死往林子里闯');
  step(s2, '继续'); // 喋血 → 死亡效果（豁免：重伤续行）
  assert.equal(s2.dead, null);
  assert.equal(s2.injury, 100);
  assert.equal(s2.flags.cheated_death_combat, true);
  assert.equal(s2.nodeId, '灵田夜逃');
});

test('访张铁门槛：灵石不足 1 时选项可见但不可用，choose 拒绝执行', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '先活下来：留镇当账房伙计');
  drain(s); // 镇中账房 → 王管事采买 → 外门点卯 → 外门岁月
  assert.equal(s.nodeId, '外门岁月');
  s.lingshi = 0;
  const v = FC.Engine.view(s, FC.Content.graph);
  const i = pick(s, '访张铁（打酒，听杂役院的闲话）');
  assert.equal(v.choices[i].enabled, false, '选项应可见但禁用');
  const r = FC.Engine.choose(s, FC.Content.graph, i);
  assert.deepEqual(r, { ok: false, reason: 'disabled' });
  assert.equal(s.nodeId, '外门岁月');
  assert.equal(s.karma.ch1_month || 0, 0, '被拒后时间与因果不入账');
  s.lingshi = 1;
  assert.equal(FC.Engine.view(s, FC.Content.graph).choices[pick(s, '访张铁（打酒，听杂役院的闲话）')].enabled, true);
});

test('hub 月循环门：不足三月只有常规行动，满三月只余秋收', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '落云宗十年苦契，签！');
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  const v0 = FC.Engine.view(s, FC.Content.graph);
  assert.ok(v0.choices.length >= 4, '初始 hub 应有常规行动+秋收前无');
  assert.ok(!v0.choices.some((c) => c.label.indexOf('灵田秋收') >= 0), '未满三月不该出现秋收');
  step(s, '杂役当值（领月钱，管三餐）'); step(s, '杂役当值（领月钱，管三餐）');
  const v1 = FC.Engine.view(s, FC.Content.graph);
  assert.ok(!v1.choices.some((c) => c.label.indexOf('灵田秋收') >= 0), '两月时仍不该有秋收');
  step(s, '杂役当值（领月钱，管三餐）');
  const v2 = FC.Engine.view(s, FC.Content.graph);
  assert.deepEqual(v2.choices.map((c) => c.label).filter((l) => l.indexOf('灵田秋收') >= 0).length, 1, '满三月只剩秋收');
  assert.equal(v2.choices.length, 1);
});

test('偷偷修炼：糊窗谨慎必成（+1 修为仅一次）；摸黑硬练（低机缘）被逮', () => {
  const s = freshState();
  step(s, '继续'); step(s, '继续'); step(s, '继续');
  step(s, '落云宗十年苦契，签！');
  step(s, '继续'); step(s, '继续'); step(s, '继续'); // 签契→同路→点卯
  assert.equal(s.cultivation, 1);
  step(s, '偷偷修炼（柴房夜练，自担风险）');
  step(s, '先花一文糊上油纸，只练半个时辰');
  assert.equal(s.nodeId, '静夜功成');
  step(s, '继续'); // 功成效果在离开该 scene 时入账
  assert.equal(s.cultivation, 2);
  const v = FC.Engine.view(s, FC.Content.graph);
  assert.ok(!v.choices.some((c) => c.label.indexOf('偷偷修炼') >= 0), '成过一次不该再出现');
  // 摸黑硬练：新局不遇李师姐（机缘 0）→ 被逮
  const s2 = freshState();
  step(s2, '继续'); step(s2, '继续'); step(s2, '继续');
  step(s2, '落云宗十年苦契，签！');
  step(s2, '继续'); step(s2, '继续'); step(s2, '继续');
  step(s2, '偷偷修炼（柴房夜练，自担风险）');
  step(s2, '心疼灵石，摸黑硬练');
  assert.equal(s2.nodeId, '被逮正着');
  step(s2, '继续'); // 领罚效果在离开该 scene 时入账
  assert.equal(s2.cultivation, 1);
  assert.ok(s2.flags.ch1_sneak_caught);
  assert.ok(s2.karma.aff_steward <= 0, '被逮应挫管事好感');
});

test('字数统计：全图正文（函数文按多状态求值取并集）合计 8000-12000 字', () => {
  // 多个探测状态覆盖分支文本：开局态 + 各走查路线的终态附近
  const probes = [];
  probes.push(FC.State.create('李恒'));
  const build = (moves) => {
    const s = freshState();
    try { for (const m of moves) step(s, m); } catch (e) { /* 尽力而为 */ }
    return s;
  };
  probes.push(build(['继续', '继续', '继续', '落云宗十年苦契，签！', '继续', '继续', '继续']));
  probes.push(build(['继续', '继续', '继续', '倾尽积蓄，托刘婆子补测', '继续', '继续', '继续']));
  probes.push(build(['继续', '继续', '继续', '先活下来：留镇当账房伙计', '继续', '继续', '继续']));
  probes.push(build(['继续', '继续', '继续', '落云宗十年苦契，签！', '继续', '继续', '继续', '访张铁（打酒，听杂役院的闲话）']));
  probes.push(build(['继续', '继续', '继续', '落云宗十年苦契，签！', '继续', '继续', '继续', '访张铁（打酒，听杂役院的闲话）', '访张铁（打酒，听杂役院的闲话）']));
  const graph = FC.Content.graph;
  let total = 0;
  const perNode = {};
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
    perNode[id] = best;
    total += best;
  }
  // 选项文案计入剧情字数
  let labels = 0;
  for (const id of Object.keys(graph)) {
    const n = graph[id];
    for (const c of n.choices || []) labels += String(c.label || '').length;
    for (const a of n.actions || []) labels += String(a.label || '').length;
  }
  const sum = total + labels;
  assert.ok(sum >= 8000, '字数不足: ' + sum + '（正文 ' + total + ' + 选项 ' + labels + '）');
  assert.ok(sum <= 12000, '字数超出: ' + sum);
});
