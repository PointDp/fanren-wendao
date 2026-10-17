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
// 图完整性校验器（Task 8 增补）：返回 {ok:true,errors:[]}，错误逐条收集而非首错即抛，便于一次看全。
// 规则（与实现计划 Task 8 Step 1 一致）：
//   1. 图为非空对象且含入口 'start'；节点类型必须属于五种之一
//   2. 所有 goto 目标存在——scene.goto / choice[].goto / hub actions[].goto / combat resolve.pass/fail；
//      函数 goto 以源码中出现的引号内节点 id 为可能目标逐一校验，并按初始状态试探求值一次
//   3. 非 death/hub 节点至少 1 个 choice 或 goto（scene 可显式 terminal:true 标记章末终局场景）
//   4. 所有 choice.goto 目标可达；从 'start' 出发无不可达节点
//   5. 所有 death 节点有 cause（死亡叙事由 FC.UI.deathText 按 cause 出文案，节点 text 不渲染）
//   6. hub 每个 action 有 time 效果或显式 days（月循环的每个行动必须消耗时间）
//   7. 附带护栏：正文非空（death 除外）、choice 项 label/goto 必备、combat 必须有 resolve 与选项且
//      选项 goto 会被引擎忽略（写了即报错）、效果 DSL 形状与取值域、karma/flag 值须可 JSON 序列化
FC.Test={
  validate(graph){
    const errors=[];
    function err(id,msg){ errors.push('['+id+'] '+msg); }
    if(!graph||typeof graph!=='object'||Array.isArray(graph)){
      errors.push('图必须是非空对象');return{ok:false,errors:errors};
    }
    const ids=Object.keys(graph);
    if(ids.length===0){ errors.push('图为空');return{ok:false,errors:errors}; }
    if(!graph.start)errors.push('缺少入口节点 start');
    // —— 类型合法性 ——
    for(const id of ids){
      const n=graph[id];
      if(!n||typeof n!=='object'||Array.isArray(n)){ err(id,'节点不是对象');continue; }
      if(!FC.Engine._types[n.type])err(id,'未知节点类型: '+(n&&n.type));
    }
    // —— 函数 goto 的可能目标：源码里以引号形式出现的字符串字面量（逐一对图校验）——
    function fnTargets(fn){
      const src=String(fn); const out=[];
      const re=/['"]([^'"\n]+?)['"]/g; let m;
      while((m=re.exec(src))){ if(m[1].trim())out.push(m[1]); }
      return out;
    }
    // —— 单个跳转目标检查：存在性 + （函数）初始状态试探 ——
    function checkTarget(fromId,label,t){
      if(typeof t==='function'){
        for(const tid of fnTargets(t)){ if(!graph[tid])err(fromId,label+' 函数跳转目标不存在: '+tid); }
        try{
          const probe=FC.State.create('校验');
          const r=t(probe);
          if(typeof r!=='string'||!graph[r])err(fromId,label+' 函数在初始状态下未返回合法节点: '+r);
        }catch(e){ err(fromId,label+' 函数求值失败: '+e.message); }
      }else if(typeof t==='string'){
        if(!graph[t])err(fromId,label+' 跳转目标不存在: '+t);
      }else if(t!=null){
        err(fromId,label+' 跳转目标既非字符串也非函数');
      }
      return typeof t==='string'?[t]:(typeof t==='function'?fnTargets(t):[]);
    }
    // —— 效果 DSL 形状检查 ——
    const RES_KEYS=['cultivation','lingshi','lifespan','injury','luck'];
    function jsonable(v){
      if(v===undefined)return false;
      try{ JSON.stringify(v);return true; }catch(e){ return false; }
    }
    function checkEffects(fromId,fx){
      (fx||[]).forEach((e,i)=>{
        if(!e||typeof e.type!=='string'){ err(fromId,'效果#'+i+' 缺 type');return; }
        if(e.type==='res'){
          if(RES_KEYS.indexOf(e.key)<0)err(fromId,'效果#'+i+' 未知资源 key: '+e.key);
          else if(typeof e.delta!=='number'||!isFinite(e.delta))err(fromId,'效果#'+i+' res.delta 须为有限数字');
        }else if(e.type==='item'){
          if(typeof e.id!=='string'||!e.id)err(fromId,'效果#'+i+' item.id 须为非空字符串');
          if(typeof e.count!=='number'||!isFinite(e.count))err(fromId,'效果#'+i+' item.count 须为数字');
        }else if(e.type==='karma'){
          if(typeof e.id!=='string'||!e.id)err(fromId,'效果#'+i+' karma.id 须为非空字符串');
          if(!jsonable(e.value))err(fromId,'效果#'+i+' karma 值不可 JSON 序列化');
        }else if(e.type==='flag'){
          if(typeof e.id!=='string'||!e.id)err(fromId,'效果#'+i+' flag.id 须为非空字符串');
          if(!jsonable(e.value))err(fromId,'效果#'+i+' flag 值不可 JSON 序列化');
        }else if(e.type==='time'){
          if(typeof e.days!=='number'||!isFinite(e.days)||e.days<=0)err(fromId,'效果#'+i+' time.days 须为正数');
        }else if(e.type==='death'){
          if(typeof e.cause!=='string'||!e.cause)err(fromId,'效果#'+i+' death.cause 须为非空字符串');
        }else{
          err(fromId,'效果#'+i+' 未知效果类型: '+e.type);
        }
      });
    }
    // —— 正文非空（death 除外：其 text 不渲染，叙事由 deathText 与死前 scene 承担）——
    function checkText(id,n){
      if(n.type==='death')return;
      if(typeof n.text==='function'){
        try{
          const t=n.text(FC.State.create('校验'));
          if(typeof t!=='string'||!t.trim())err(id,'节点正文为空（函数文初始求值为空）');
        }catch(e){ err(id,'正文函数求值失败: '+e.message); }
      }else if(typeof n.text!=='string'||!n.text.trim()){
        err(id,'节点正文为空');
      }
    }
    // —— 边收集（可达性用）与逐节点结构检查 ——
    const edges=[];
    function pushEdge(fromId,ts){ for(const t of ts)edges.push([fromId,t]); }
    for(const id of ids){
      const n=graph[id];
      if(!n||typeof n!=='object'||!FC.Engine._types[n.type])continue;
      checkText(id,n);
      checkEffects(id,n.effects);
      if(n.type==='scene'){
        const ts=checkTarget(id,'scene.goto',n.goto);
        pushEdge(id,ts);
        if(!n.goto&&n.terminal!==true)err(id,'scene 缺少 goto（若为有意终局请置 terminal:true）');
      }else if(n.type==='choice'){
        if(!Array.isArray(n.choices)||n.choices.length===0){ err(id,'choice 节点至少 1 个选项');continue; }
        n.choices.forEach((c,i)=>{
          if(!c||typeof c.label!=='string'||!c.label.trim())err(id,'选项#'+i+' label 须为非空字符串');
          const ts=checkTarget(id,'选项#'+i+'.goto',c?c.goto:null);
          if(!c||c.goto==null)err(id,'选项#'+i+' 缺 goto');
          pushEdge(id,ts);
          checkEffects(id,c.effects);
        });
      }else if(n.type==='hub'){
        if(!Array.isArray(n.actions)||n.actions.length===0){ err(id,'hub 节点至少 1 个 action');continue; }
        n.actions.forEach((a,i)=>{
          if(!a||typeof a.label!=='string'||!a.label.trim()){ err(id,'action#'+i+' label 须为非空字符串');return; }
          const ts=checkTarget(id,'action#'+i+'.goto',a.goto);
          if(!a.goto&&a.stay!==true)err(id,'action#'+i+' 缺 goto（或 stay:true）');
          const hasTime=(a.effects||[]).some((e)=>e&&e.type==='time'&&typeof e.days==='number'&&e.days>0);
          if(!hasTime&&!(typeof a.days==='number'&&a.days>0))err(id,'action#'+i+' 缺 time 效果或显式 days（月循环行动必须消耗时间）');
          pushEdge(id,ts);
          checkEffects(id,a.effects);
        });
      }else if(n.type==='combat'){
        if(!n.resolve||typeof n.resolve.test!=='function'){
          err(id,'combat 节点缺少 resolve.test');
        }else{
          if(typeof n.resolve.pass!=='string'){ err(id,'combat resolve.pass 须为字符串（引擎不解析函数）'); }
          else if(!graph[n.resolve.pass])err(id,'combat resolve.pass 目标不存在: '+n.resolve.pass);
          if(typeof n.resolve.fail!=='string'){ err(id,'combat resolve.fail 须为字符串（引擎不解析函数）'); }
          else if(!graph[n.resolve.fail])err(id,'combat resolve.fail 目标不存在: '+n.resolve.fail);
          pushEdge(id,[n.resolve.pass,n.resolve.fail].filter((t)=>typeof t==='string'));
        }
        if(!Array.isArray(n.choices)||n.choices.length===0)err(id,'combat 节点至少 1 个决策选项（否则玩家无按钮可点）');
        else n.choices.forEach((c,i)=>{
          if(!c||typeof c.label!=='string'||!c.label.trim())err(id,'决策选项#'+i+' label 须为非空字符串');
          if(c&&c.goto)err(id,'combat 选项#'+i+' 的 goto 会被引擎忽略，请改用 flags+resolve 分流');
          checkEffects(id,c.effects);
        });
      }else if(n.type==='death'){
        if(typeof n.cause!=='string'||!n.cause)err(id,'death 节点缺 cause');
      }
    }
    // —— 可达性：从 start 出发 BFS ——
    if(graph.start){
      const reached=new Set(['start']);
      const queue=['start'];
      while(queue.length){
        const cur=queue.shift();
        for(const pair of edges){
          if(pair[0]===cur&&!reached.has(pair[1])){
            reached.add(pair[1]);queue.push(pair[1]);
          }
        }
      }
      for(const id of ids){
        if(!reached.has(id))err(id,'从 start 出发不可达');
      }
      // 所有 choice.goto 目标可达（brief 规格单列一条）
      for(const id of ids){
        const n=graph[id];
        if(!n||n.type!=='choice'||!Array.isArray(n.choices))continue;
        n.choices.forEach((c,i)=>{
          if(!c)return;
          const ts=typeof c.goto==='function'?fnTargets(c.goto):[c.goto];
          for(const t of ts){
            if(typeof t==='string'&&!reached.has(t))err(id,'选项#'+i+'.goto 目标不可达: '+t);
          }
        });
      }
    }
    return{ok:errors.length===0,errors:errors};
  }
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
