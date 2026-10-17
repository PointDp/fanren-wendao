var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 剧情引擎：节点图执行器（纯逻辑，无 DOM）。图 graph={节点id:节点}，入口节点 id 固定 'start'。
// 五种节点（字段固定）：
//   {type:'scene', text, effects?, goto:'id'|((state)=>'id')}                          —— 正文推进，choose 时视为"继续"
//   {type:'choice', text, effects?, choices:[{label, tag?, show?, enabled?, effects?, goto}]}
//   {type:'hub', text, actions:[{label, show?, enabled?, effects?含time, goto|stay:true}]} —— stay=true 执行后回到本 hub；进入 hub 自动存 'auto'
//   {type:'combat', text, effects?, resolve:{test:(state)=>bool, pass:'id', fail:'id'}, choices:[决策项写 flags/items，不直接定胜负]}
//   {type:'death', cause, text}                                                        —— 终局；进入即结算死亡（尊重豁免）；复活由 UI 从 'checkpoint' load
// 执行序（choose）：当前节点 effects → 选中项 effects → goto 跳转 → 统一落盘 'auto'。
// 门槛：show 为 false 的选项不出现；enabled 为 false 的选项可见但不可选（view 的 enabled 字段即来源于此）。
// 死亡不吞进度：引擎只写 'auto' 槽，从不写 'checkpoint'；效果与时间不受任何快进模式影响（引擎无跳过路径）。
FC.Engine={
  // 合法节点类型表（固定五种，未知类型抛错——剧情 typo 不静默）
  _types:{scene:1,choice:1,hub:1,combat:1,death:1},
  // 校验并取节点：id 不存在或类型非法即抛错
  _check(graph,id){
    const node=graph[id];
    if(!node)throw new Error('未知节点: '+id);
    if(!FC.Engine._types[node.type])throw new Error('未知节点类型: '+node.type);
    return node;
  },
  // 取文本：函数则按当前 state 求值，字符串原样，缺省空串
  _text(node,state){
    return typeof node.text==='function'?node.text(state):(node.text||'');
  },
  // 选项可见性：show(state) 为 false 的项不出现（缺省视为可见）
  _visible(item,state){
    return item.show?!!item.show(state):true;
  },
  // 选项可用性：可见但不可用时 view 标 enabled=false、choose 拒绝执行（缺省视为可用）
  _enabled(item,state){
    return item.enabled?!!item.enabled(state):true;
  },
  // 当前节点的可见项列表：hub 读 actions，choice/combat 读 choices，按 show 过滤
  _items(node,state){
    const list=node.type==='hub'?(node.actions||[]):(node.choices||[]);
    return list.filter(it=>FC.Engine._visible(it,state));
  },
  // 解析跳转：'id' 或 (state)=>'id'
  _target(goto,state){
    return typeof goto==='function'?goto(state):goto;
  },
  // 自动存档：统一落 'auto'（须检查 save 返回的 ok，不能只判真值）
  _autosave(state){
    const r=FC.Save.save(state,'auto');
    if(!r||r.ok!==true)throw new Error('自动存档失败: '+(r?r.reason:'无返回'));
  },
  // 进入节点：置 nodeId；hub 进入即自动存档；death 进入即结算死亡（复用效果系统，尊重豁免）；返回补充 log
  _enter(state,graph,id){
    const node=FC.Engine._check(graph,id);
    state.nodeId=id;
    if(node.type==='hub'){
      FC.Engine._autosave(state);
    }else if(node.type==='death'){
      return FC.Effects.apply(state,[{type:'death',cause:node.cause}]).log;
    }
    return [];
  },
  // 渲染视图：纯读取，不改 state。show 为 false 的项不出现，tag 缺省 ''；death 与终局场景（无 goto）无选项
  view(state,graph){
    const node=FC.Engine._check(graph,state.nodeId);
    let choices;
    if(node.type==='death'){
      choices=[];
    }else if(node.type==='scene'){
      choices=node.goto?[{label:'继续',tag:'',enabled:true}]:[];
    }else{
      choices=FC.Engine._items(node,state).map(it=>({label:it.label,tag:it.tag||'',enabled:FC.Engine._enabled(it,state)}));
    }
    return {text:FC.Engine._text(node,state),choices:choices};
  },
  // 执行选择：当前节点 effects → 选中项 effects → goto 跳转 → 统一落盘 'auto'。
  // index 按 view 给出的可见项序（show 过滤后的序）；死亡后拒绝继续（返回 {dead:true}）；
  // 战斗胜负不由选项直接决定：决策项只写 flags/items，随后按 resolve.test(state) 分流 pass/fail。
  choose(state,graph,index){
    const node=FC.Engine._check(graph,state.nodeId);
    if(FC.State.isDead(state)||node.type==='death')return{dead:true};
    let item=null;
    if(node.type!=='scene'){
      const items=FC.Engine._items(node,state);
      if(!Number.isInteger(index)||index<0||index>=items.length)throw new Error('无效选项序号: '+index);
      item=items[index];
      if(!FC.Engine._enabled(item,state))return{ok:false,reason:'disabled'};
    }
    const log=[];
    if(node.effects&&node.effects.length)log.push(...FC.Effects.apply(state,node.effects).log);
    if(item&&item.effects&&item.effects.length)log.push(...FC.Effects.apply(state,item.effects).log);
    let target;
    if(node.type==='combat'){
      if(!node.resolve)throw new Error('combat 节点缺少 resolve: '+state.nodeId);
      target=node.resolve.test(state)?node.resolve.pass:node.resolve.fail;
    }else if(node.type==='scene'){
      if(!node.goto)throw new Error('scene 节点缺少 goto: '+state.nodeId);
      target=FC.Engine._target(node.goto,state);
    }else if(node.type==='hub'){
      target=item.stay===true?state.nodeId:FC.Engine._target(item.goto,state);
    }else{
      target=FC.Engine._target(item.goto,state);
    }
    log.push(...FC.Engine._enter(state,graph,target));
    // 统一落盘 'auto'；目标若为 hub，进入时已落盘，不重复写
    if(graph[state.nodeId].type!=='hub')FC.Engine._autosave(state);
    return {ok:true,log:log};
  },
  // 新开局：初始化 state 并落到入口节点 'start'（入口为 hub 时自动存档）
  start(name,graph){
    const state=FC.State.create(name);
    FC.Engine._enter(state,graph,'start');
    return state;
  },
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
