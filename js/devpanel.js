var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 开发者金手指面板：数据动作 + 自包含 DOM 面板（与主 UI 解耦，只接管自己的容器 el）。
// 数据动作全部复用既有 API，不重复实现规则：injury 走 State.clampInjury、物品走 Effects.apply（item）、
// 快进走 Effects.apply（time → State.advanceDays，死亡/豁免规则照常生效）、检查点走 Save.save。
// mount(el, getState, rerender, env)：~ / ` 键切换面板显隐（默认隐藏）；动作后自动同步控件并回调 rerender。
// env 为可选依赖注入 {document, getGraph}：document 供测试注入假环境（缺省取真实 document），
// getGraph 返回当前剧情图供"跳转"使用（Task 7 接入；未提供时点跳转给出友好提示）。
FC.Dev={
  // 跳境界寿元加成表（下标 = FC.REALMS 下标，表长与 FC.REALMS 对齐）：炼气段 +0；
  // 筑基 10..12 累计 40/80/120（既有）；结丹 13..15 每层 +80、元婴 16..18 每层 +150、化神 19 +300
  // （跳下不扣回；直接跳转只加目标层该档，叠加语义照旧，评审已裁定可接受）
  _REALM_BONUS:[0,0,0,0,0,0,0,0,0,0,40,80,120,80,80,80,150,150,150,300],
  // 机缘允许域（与面板滑杆同域）：0..100
  _LUCK_MAX:100,
  // 直接设置资源（绝对值而非增量）；越界按 Task 2 规则截断；未知 key 抛错（typo 不静默）
  setRes(state,key,val){
    if(key==='injury'){ state.injury=FC.State.clampInjury(val); return state; }
    if(key==='cultivation'){ state.cultivation=Math.max(0,Math.min(FC.REALMS.length-1,Math.round(val))); return state; }
    if(key==='lingshi'){ state.lingshi=Math.max(0,val); return state; }
    if(key==='lifespanYears'){ state.lifespanYears=Math.max(0,val); return state; }
    if(key==='luck'){ state.luck=Math.max(0,Math.min(FC.Dev._LUCK_MAX,val)); return state; }
    throw new Error('未知资源: '+key);
  },
  // 背包物品：复用效果系统 item 规则（库存不足截 0），返回中文 log 摘要供面板状态行显示
  addItem(state,id,count){
    return FC.Effects.apply(state,[{type:'item',id:id,count:count}]).log;
  },
  // 跳境界：cultivation 置为该层（越界截断到境界表），并按表累加该层寿命加成（炼气段 +0，跳下不扣回）
  setRealm(state,i){
    FC.Dev.setRes(state,'cultivation',i);
    state.lifespanYears+=FC.Dev._REALM_BONUS[state.cultivation]||0;
    return state;
  },
  // 跳章节：置 nodeId；目标不存在抛错（与引擎同一错误样式）
  jump(state,graph,nodeId){
    if(!graph||!graph[nodeId])throw new Error('未知节点: '+nodeId);
    state.nodeId=nodeId;
    return state;
  },
  // 必死局豁免：翻转并返回新值（供面板状态行显示开/关）
  toggleExempt(state){
    state.deathExempt=!state.deathExempt;
    return state.deathExempt;
  },
  // 机缘：setRes 的快捷入口（滑杆用）
  setLuck(state,v){
    return FC.Dev.setRes(state,'luck',v);
  },
  // 存档失败原因 → 中文（dead→已死亡、slot→无效档位；其余原样兜底，空值给未知原因）
  reasonText(reason){
    if(reason==='dead')return '已死亡';
    if(reason==='slot')return '无效档位';
    return reason?String(reason):'未知原因';
  },
  // —— DOM 面板 ——（只用最窄 DOM 面：createElement/appendChild/addEventListener/style.*/textContent/
  // 普通属性赋值，便于假环境实现；绝不使用 innerHTML/querySelector）
  mount(el,getState,rerender,env){
    env=env||{};
    const doc=env.document||(typeof document!=='undefined'?document:null);
    if(!doc)throw new Error('FC.Dev.mount 需要 document（可在 env.document 注入）');
    rerender=rerender||function(){};
    const getGraph=env.getGraph;
    const panel=doc.createElement('div');
    // 样式逐条属性赋值（不用 cssText，便于假环境断言）
    panel.style.position='fixed';panel.style.top='8px';panel.style.right='8px';panel.style.zIndex='9999';
    panel.style.background='rgba(24,24,24,.95)';panel.style.color='#eee';panel.style.border='1px solid #777';
    panel.style.padding='10px 12px';panel.style.fontSize='13px';panel.style.lineHeight='1.8';
    panel.style.maxWidth='300px';panel.style.maxHeight='90vh';panel.style.overflow='auto';
    panel.style.display='none';
    const title=doc.createElement('div');
    title.textContent='开发者面板（按 ~ 收起）';
    title.style.fontWeight='bold';title.style.marginBottom='4px';
    panel.appendChild(title);
    const statusEl=doc.createElement('div');
    statusEl.style.color='#9cd6ff';statusEl.style.marginBottom='6px';statusEl.style.minHeight='1.8em';
    panel.appendChild(statusEl);
    function setStatus(t){ statusEl.textContent=t; }
    function row(id){ const r=doc.createElement('div'); r.id=id; r.style.margin='3px 0'; panel.appendChild(r); return r; }
    function label(r,t){ const s=doc.createElement('span'); s.textContent=t+'：'; s.style.marginRight='4px'; r.appendChild(s); return s; }
    function input(r,type,min,max,step){
      const i=doc.createElement('input'); i.type=type;
      if(min!=null)i.min=String(min); if(max!=null)i.max=String(max); if(step!=null)i.step=String(step);
      i.style.width='96px'; r.appendChild(i); return i;
    }
    function num(v){ const n=parseFloat(v); return isFinite(n)?n:null; }
    // 统一包裹动作：无对局给提示、异常转状态行、动作后同步控件并重绘主界面
    function act(fn){
      return function(){
        const s=getState();
        if(!s){ setStatus('尚未开始对局'); return; }
        try{ fn(s); }catch(e){ setStatus('操作失败：'+e.message); }
        sync(); rerender();
      };
    }
    function button(r,t,fn){ const b=doc.createElement('button'); b.textContent=t; b.addEventListener('click',act(fn)); r.appendChild(b); return b; }
    // 境界（下拉，换层并按表加寿）
    const realmRow=row('fc-dev-realm'); label(realmRow,'境界');
    const realmSel=doc.createElement('select'); realmRow.appendChild(realmSel);
    for(let i=0;i<FC.REALMS.length;i++){
      const o=doc.createElement('option'); o.value=String(i); o.textContent=i+'·'+FC.REALMS[i]; realmSel.appendChild(o);
    }
    realmSel.addEventListener('change',act(function(s){
      FC.Dev.setRealm(s,parseInt(realmSel.value,10));
      setStatus('境界已切换：'+FC.REALMS[s.cultivation]);
    }));
    // 灵石
    const lsRow=row('fc-dev-lingshi'); label(lsRow,'灵石');
    const lsIn=input(lsRow,'number',0);
    button(lsRow,'设置',function(s){
      const v=num(lsIn.value); if(v==null){ setStatus('请输入有效数字'); return; }
      FC.Dev.setRes(s,'lingshi',v); setStatus('灵石已设置为 '+s.lingshi);
    });
    // 寿元
    const lfRow=row('fc-dev-lifespan'); label(lfRow,'寿元（年）');
    const lfIn=input(lfRow,'number',0,null,'any');
    button(lfRow,'设置',function(s){
      const v=num(lfIn.value); if(v==null){ setStatus('请输入有效数字'); return; }
      FC.Dev.setRes(s,'lifespanYears',v); setStatus('寿元已设置为 '+s.lifespanYears+' 年');
    });
    // 伤势（滑杆，松手生效；拖到 0 即回满）
    const injRow=row('fc-dev-injury'); label(injRow,'伤势');
    const injIn=input(injRow,'range',0,100,1); injIn.style.width='120px';
    injIn.addEventListener('change',act(function(s){
      const v=num(injIn.value); if(v==null){ setStatus('请输入有效数字'); return; }
      FC.Dev.setRes(s,'injury',v); setStatus('伤势已设置为 '+s.injury);
    }));
    // 机缘（滑杆）
    const luckRow=row('fc-dev-luck'); label(luckRow,'机缘');
    const luckIn=input(luckRow,'range',0,FC.Dev._LUCK_MAX,1); luckIn.style.width='120px';
    luckIn.addEventListener('change',act(function(s){
      const v=num(luckIn.value); if(v==null){ setStatus('请输入有效数字'); return; }
      FC.Dev.setLuck(s,v); setStatus('机缘已设置为 '+s.luck);
    }));
    // 一键操作（资源区旁）：回满=伤势清零（复用 setRes → clampInjury）、清空=背包置空；
    // 均经 button→act 统一错误处理，动作后同步控件并重绘主界面
    const quickRow=row('fc-dev-quick'); label(quickRow,'快捷');
    button(quickRow,'一键回满',function(s){
      FC.Dev.setRes(s,'injury',0);
      setStatus('伤势已清零');
    });
    button(quickRow,'一键清空',function(s){
      s.inventory={};
      setStatus('背包已清空');
    });
    // 背包物品（添加为正数、移除按数量扣，库存不足自动截 0）
    const itemRow=row('fc-dev-item'); label(itemRow,'物品');
    const itemIdIn=input(itemRow,'text'); itemIdIn.placeholder='物品 id';
    const itemCntIn=input(itemRow,'number',null,null,'any'); itemCntIn.value='1';
    button(itemRow,'添加',function(s){
      if(!itemIdIn.value){ setStatus('请输入物品 id'); return; }
      const c=num(itemCntIn.value); if(c==null){ setStatus('请输入有效数字'); return; }
      setStatus(FC.Dev.addItem(s,itemIdIn.value,c).join('；'));
    });
    button(itemRow,'移除',function(s){
      if(!itemIdIn.value){ setStatus('请输入物品 id'); return; }
      const c=num(itemCntIn.value); if(c==null){ setStatus('请输入有效数字'); return; }
      setStatus(FC.Dev.addItem(s,itemIdIn.value,-Math.abs(c)).join('；'));
    });
    // 快进（走效果系统 time：天数、寿元扣减、死亡与豁免规则全部复用）
    const timeRow=row('fc-dev-time'); label(timeRow,'快进');
    [[1,'快进 1 天'],[7,'快进 7 天'],[30,'快进 30 天'],[90,'快进 90 天']].forEach(function(p){
      button(timeRow,p[1],function(s){
        const r=FC.Effects.apply(s,[{type:'time',days:p[0]}]);
        setStatus(r.log.join('；')||('时间流逝 '+p[0]+' 天'));
      });
    });
    // 章节跳转（校验目标存在，未知节点在状态行提示）
    const jumpRow=row('fc-dev-jump'); label(jumpRow,'跳转');
    const jumpIn=input(jumpRow,'text'); jumpIn.placeholder='节点 id';
    button(jumpRow,'跳转',function(s){
      if(!getGraph)throw new Error('面板未接入剧情图（env.getGraph）');
      FC.Dev.jump(s,getGraph(),jumpIn.value);
      setStatus('已跳转：'+s.nodeId);
    });
    // 必死局豁免
    const exRow=row('fc-dev-exempt');
    const exBox=doc.createElement('input'); exBox.type='checkbox'; exRow.appendChild(exBox);
    const exLabel=doc.createElement('span'); exLabel.textContent=' 必死局豁免（致命改为重伤）'; exRow.appendChild(exLabel);
    exBox.addEventListener('change',act(function(s){
      const on=FC.Dev.toggleExempt(s);
      setStatus('必死局豁免：'+(on?'开':'关'));
    }));
    // 检查点（死亡不吞进度：Save 自带 dead 拒存校验，结果必须查 ok）
    const cpRow=row('fc-dev-checkpoint'); label(cpRow,'存档');
    button(cpRow,'存检查点',function(s){
      const r=FC.Save.save(s,'checkpoint');
      if(r&&r.ok===true)setStatus('检查点已保存');
      else setStatus('检查点保存失败：'+(r?FC.Dev.reasonText(r.reason):'无返回'));
    });
    // 控件 ← 状态：打开面板与每次动作后刷新，避免显示陈旧值；文本输入（物品/节点 id）不回写
    function sync(){
      const s=getState(); if(!s)return;
      realmSel.value=String(s.cultivation);
      lsIn.value=String(s.lingshi);
      lfIn.value=String(s.lifespanYears);
      injIn.value=String(Math.round(s.injury));
      luckIn.value=String(Math.round(s.luck));
      exBox.checked=!!s.deathExempt;
    }
    function toggle(){
      const open=panel.style.display==='none';
      panel.style.display=open?'block':'none';
      if(open)sync();
    }
    // ~ / ` 键切换；输入类元素聚焦时忽略（面板内文本框可正常打字）
    function onKey(e){
      if(e.repeat)return;
      if(!(e.key==='~'||e.key==='`'||e.code==='Backquote'))return;
      const tag=e.target&&e.target.tagName;
      if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
      toggle();
    }
    doc.addEventListener('keydown',onKey);
    el.appendChild(panel);
    sync();
    return {panel:panel,status:statusEl,toggle:toggle,destroy:function(){ doc.removeEventListener('keydown',onKey); }};
  }
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
