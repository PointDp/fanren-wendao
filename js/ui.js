var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 主 UI：接管整个游戏循环——开局流程（继续游戏/新开局改名/读档）、主视图（正文打字机、状态栏、
// 选择按钮）、加速开关、存读档菜单（3 手动位 + 自动/检查点信息显示）、死亡画面（检查点复活）。
// 与 devpanel 同约定：只用最窄 DOM 面（createElement/appendChild/removeChild/addEventListener/
// className/textContent/value/disabled/style.*），document 与定时器均可经 opts 注入，便于 Node 假环境测试。
// 用法：FC.UI.mount(document.getElementById('app'), {graph 或 getGraph})，返回 {rerender, destroy, getState}；
// 剧情图未就绪（内容脚本缺失/getGraph 抛错）时显示"内容加载中"，不崩溃。
// 纯逻辑另出：FC.UI.summary(state)（状态栏摘要）、FC.UI.deathText(state)（死因结局文）、FC.UI.slotPlan(state)（存档槽位计划）。
FC.UI={
  TYPE_MS:28, // 打字机：每字毫秒
  _handle:null, // 最近一次 mount 的句柄，供 FC.UI.rerender() 使用
  // —— 纯逻辑：状态栏摘要（第 N 天/境界/灵石/寿元/伤势/机缘/背包摘要）——
  summary(state){
    if(!state)return '';
    const realm=(FC.REALMS&&FC.REALMS[state.cultivation])||'凡人';
    const items=Object.keys(state.inventory||{})
      .filter(function(k){ return state.inventory[k]>0; })
      .map(function(k){ return k+'×'+state.inventory[k]; }).join('、');
    const years=typeof state.lifespanYears==='number'?state.lifespanYears:0;
    return '第 '+state.day+' 天 · '+realm
      +' · 灵石 '+(state.lingshi||0)
      +' · 寿元 '+years.toFixed(1)+' 年'
      +' · 伤势 '+Math.round(state.injury||0)
      +' · 机缘 '+Math.round(state.luck||0)
      +' · 背包：'+(items||'空');
  },
  // —— 纯逻辑：死因 → 结局文（v1 简短版；未知死因兜底）——
  _DEATH_TEXTS:{
    lifespan:'寿元耗尽。你盘膝坐下，心跳一声慢过一声，眼前一黑，再没有醒来。凡人问道，终究问道未成。',
    combat:'伤重不治。血流尽了，力气也流尽了，你倒在无人知晓的荒野，成了修道路上又一具无名白骨。',
    poison:'毒发攻心。毒素蚀尽经脉，你浑身青黑，在无尽的灼痛中咽下最后一口气。',
    exiled:'道籍除名。你被废去修为逐出山门，从此流落红尘，郁郁数十年，抱憾而终。'
  },
  deathText(state){
    const cause=state&&state.dead;
    if(cause&&Object.prototype.hasOwnProperty.call(FC.UI._DEATH_TEXTS,cause))return FC.UI._DEATH_TEXTS[cause];
    return '劫数难逃。你的道途到此为止，名字很快便无人记得。';
  },
  // —— 纯逻辑：存读档菜单的槽位计划（UI 只按此渲染行与按钮）——
  // auto=引擎自动档、checkpoint=检查点（引擎在新开局与章末自动写入）：只读展示（信息显示 + 可读取），
  // UI 永不写检查点；m1..m3=手动档：存活时可存可读。死亡状态下不提供任何存入路径（死亡不吞进度）。
  slotPlan(state){
    const alive=!!(state&&!FC.State.isDead(state));
    const labels={auto:'自动档',checkpoint:'检查点',m1:'手动档一',m2:'手动档二',m3:'手动档三'};
    return FC.Save.SLOTS.map(function(slot){
      const saved=FC.Save.load(slot);
      return {
        slot:slot,
        label:labels[slot]||slot,
        hasSave:saved!=null,
        info:saved?FC.UI.summary(saved):'暂无存档',
        canSave:alive&&['m1','m2','m3'].indexOf(slot)>=0,
        canLoad:saved!=null
      };
    });
  },
  mount(container,opts){
    opts=opts||{};
    const doc=opts.document||(typeof document!=='undefined'?document:null);
    if(!doc)throw new Error('FC.UI.mount 需要 document（可在 opts.document 注入）');
    const setT=opts.setTimeout||(typeof setTimeout!=='undefined'?setTimeout:null);
    const clearT=opts.clearTimeout||(typeof clearTimeout!=='undefined'?clearTimeout:null);
    if(!setT||!clearT)throw new Error('FC.UI.mount 需要 setTimeout/clearTimeout（可在 opts 注入）');
    // 剧情图解析：graph 直给或 getGraph() 惰性取；缺失/抛错一律视为未就绪（容错）
    const rawGetGraph=opts.getGraph||(opts.graph?function(){ return opts.graph; }:function(){ return null; });
    function graph(){
      let g=null;
      try{ g=rawGetGraph(); }catch(e){ g=null; }
      return (g&&typeof g==='object')?g:null;
    }
    let state=null;   // 当前对局；null=开局界面
    let menu=false;   // 是否显示存读档菜单
    let menuMsg='';   // 菜单反馈行文案
    let lastLog='';   // 最近一次 choose 的效果/时间流水（中文摘要，显示在选项区上方；空串不显示）
    let fast=false;   // 全局快进：开启后正文直接显示全文
    let fullText='';  // 当前正文全文
    let curKey=null;  // 打字机会话标识（节点+文本），跨重绘续接而非重打
    let reveal=0;     // 已显示字数
    let timer=null;   // 打字机计时器 id
    let textEl=null;  // 正文元素（点击补全）
    let screenEl=null;

    function el(tag,cls,text){
      const e=doc.createElement(tag);
      if(cls)e.className=cls;
      if(text!=null)e.textContent=text;
      return e;
    }
    function btn(label,fn,disabled){
      const b=el('button',null,label);
      if(disabled)b.disabled=true;
      b.addEventListener('click',fn);
      return b;
    }
    // —— 打字机：reveal 游标逐字推进；点击正文区立即补全；快进时直接全文 ——
    function schedule(){
      if(timer!=null){ clearT(timer); timer=null; }
      if(fast||reveal>=fullText.length)return;
      timer=setT(function(){
        timer=null;
        reveal++;
        if(textEl)textEl.textContent=fullText.slice(0,reveal);
        schedule();
      },FC.UI.TYPE_MS);
    }
    function updateText(){
      const key=(state?state.nodeId:'')+'|'+fullText;
      if(key!==curKey){ curKey=key; reveal=fast?fullText.length:0; }
      if(fast)reveal=fullText.length;
      if(textEl)textEl.textContent=fullText.slice(0,reveal);
      schedule();
    }
    function completeTyping(){
      if(timer!=null){ clearT(timer); timer=null; }
      reveal=fullText.length;
      if(textEl)textEl.textContent=fullText;
    }
    // —— 换屏：整屏替换，dev 宿主不在替换之列 ——
    function swap(screen){
      if(screenEl&&screenEl.parentNode===container)container.removeChild(screenEl);
      screenEl=screen;
      container.appendChild(screenEl);
    }
    // —— 存档降级提示：localStorage 不可用（存/取落到内存）时提醒关页即丢 ——
    function memoryNotice(){
      return FC.Save.memoryFallback?'⚠ 存档不可用，本次进度仅保存在内存中，关闭页面后将丢失':'';
    }
    function render(){
      const g=graph();
      let s;
      try{
        if(!g)s=screenNoContent();
        else if(menu)s=screenSave();
        else if(!state)s=screenStart();
        else if(FC.State.isDead(state))s=screenDeath();
        else s=screenMain(g);
      }catch(e){
        s=screenBroken(e); // 存档节点缺失等渲染异常：给出口，不白屏
      }
      swap(s);
    }
    // —— 各屏 ——
    function screenNoContent(){
      const s=el('div','screen screen-start');
      s.appendChild(el('h1','title','凡人问道·文字卷'));
      s.appendChild(el('p','notice','内容加载中……（剧情内容尚未就绪，请稍后刷新页面）'));
      return s;
    }
    function screenBroken(e){
      const s=el('div','screen');
      s.appendChild(el('h2','title','界面渲染出错'));
      s.appendChild(el('p','notice','渲染出错：'+(e&&e.message?e.message:'未知原因')));
      s.appendChild(btn('重新开始',function(){ state=null; menu=false; render(); }));
      return s;
    }
    function screenStart(){
      const s=el('div','screen screen-start');
      s.appendChild(el('h1','title','凡人问道·文字卷'));
      s.appendChild(el('p','subtitle','山村少年，伪灵根，一步一步向长生爬去。'));
      const mem=memoryNotice();
      if(mem)s.appendChild(el('p','memory-notice',mem));
      if(FC.Save.load('auto')){
        s.appendChild(btn('继续游戏',function(){
          const loaded=FC.Save.load('auto');
          if(loaded){ state=loaded; lastLog=''; render(); }
        }));
      }
      const row=el('div','row');
      row.appendChild(el('span','row-label','姓名：'));
      const nameIn=el('input');
      nameIn.type='text';
      nameIn.value='李恒';
      row.appendChild(nameIn);
      s.appendChild(row);
      s.appendChild(btn('新的开始',function(){
        state=FC.Engine.start((nameIn.value||'').trim()||'李恒',graph());
        lastLog='';
        render();
      }));
      // 读档入口：任一槽位有档即可进入菜单（无对局时菜单只读）
      const hasAny=FC.Save.SLOTS.some(function(sl){ return FC.Save.load(sl)!=null; });
      if(hasAny)s.appendChild(btn('读档',function(){ menu=true; menuMsg=''; render(); }));
      return s;
    }
    function screenMain(g){
      const s=el('div','screen screen-main');
      const top=el('div','topbar');
      top.appendChild(btn('存档',function(){ menu=true; menuMsg=''; render(); }));
      // 回到标题：对局不删（auto/检查点保留），供章末终局或中途歇手时退出主循环
      top.appendChild(btn('标题',function(){ state=null; menu=false; menuMsg=''; lastLog=''; render(); }));
      top.appendChild(btn(fast?'⏩ 加速中':'⏩ 加速',function(){
        fast=!fast;
        if(fast)completeTyping(); // 开启即补全当前文本；关闭后新文本恢复逐字
        render();
      }));
      s.appendChild(top);
      s.appendChild(el('div','statusbar',FC.UI.summary(state)));
      textEl=el('div','gametext');
      textEl.addEventListener('click',completeTyping);
      s.appendChild(textEl);
      const view=FC.Engine.view(state,g);
      fullText=view.text||'';
      updateText();
      if(lastLog)s.appendChild(el('div','logline',lastLog)); // 效果/时间流水：一次选择的中文摘要
      const box=el('div','choices');
      // view.choices 即引擎 show 过滤后的可见项，序号与 choose 的过滤后索引一一对应
      view.choices.forEach(function(c,i){
        const b=el('button','choice');
        b.appendChild(el('span','choice-label',c.label));
        if(c.tag)b.appendChild(el('span','badge',c.tag));
        if(!c.enabled)b.disabled=true;
        b.addEventListener('click',function(){
          if(!c.enabled)return; // 禁用项 UI 不响应（engine 也会拒绝：{ok:false,reason:'disabled'}）
          onChoose(i);
        });
        box.appendChild(b);
      });
      s.appendChild(box);
      return s;
    }
    // 统一处理 choose 的三种返回形状：{ok:true,log} / {ok:false,reason} / {dead:true}
    function onChoose(i){
      const g=graph();
      if(!g)return;
      let r=null;
      try{ r=FC.Engine.choose(state,g,i); }
      catch(e){ return; } // 无效序号等引擎级异常：UI 传入的 i 恒合法，不外泄
      if(r&&r.dead){ lastLog=''; render(); return; } // 死亡 → 死亡画面（state.dead 已由引擎置位）
      if(r&&r.ok===true){ lastLog=(r.log||[]).join('　'); render(); return; } // 推进成功 → 流水随新节点显示
      // {ok:false,...}（disabled 等）：状态原样，不推进
    }
    function screenDeath(){
      const s=el('div','screen screen-death');
      s.appendChild(el('h2','death-title','终局'));
      s.appendChild(el('p','death-text',FC.UI.deathText(state)));
      const msg=el('div','death-msg','');
      s.appendChild(btn('从检查点苏醒',function(){
        const cp=FC.Save.load('checkpoint'); // 死亡不吞进度：复活只读检查点，绝不改写
        if(!cp){ msg.textContent='没有找到检查点，无法苏醒。'; return; }
        state=cp;
        lastLog='';
        render();
      }));
      s.appendChild(btn('重新开始',function(){ state=null; lastLog=''; render(); }));
      s.appendChild(msg);
      return s;
    }
    function screenSave(){
      const s=el('div','screen screen-save');
      const top=el('div','topbar');
      top.appendChild(btn('返回',function(){ menu=false; menuMsg=''; render(); }));
      s.appendChild(top);
      s.appendChild(el('h2','save-title','存档 / 读档'));
      s.appendChild(el('p','save-hint','自动档随剧情推进自动保存；检查点在新开局与章末自动保存，死亡时不更新；手动档一至三可随时存入。'));
      const mem=memoryNotice();
      if(mem)s.appendChild(el('p','memory-notice',mem));
      FC.UI.slotPlan(state).forEach(function(p){
        const row=el('div','slot-row');
        row.appendChild(el('span','slot-label',p.label));
        row.appendChild(el('span','slot-info',p.info));
        if(p.canSave)row.appendChild(btn('存入',function(){
          const r=FC.Save.save(state,p.slot); // 必须查 result.ok，不能只判真值
          menuMsg=(r&&r.ok===true)?('已存入'+p.label+'。'):('存档失败：'+((r&&r.reason)||'未知原因'));
          render();
        }));
        if(p.canLoad)row.appendChild(btn('读取',function(){
          const loaded=FC.Save.load(p.slot);
          if(!loaded){ menuMsg='读档失败：'+p.label; render(); return; }
          state=loaded;
          menu=false;
          menuMsg='';
          lastLog='';
          render();
        }));
        s.appendChild(row);
      });
      s.appendChild(el('div','save-msg',menuMsg));
      return s;
    }
    // —— 开发者面板接入（本面板自带 ~ 键开关；缺失/异常不影响主 UI）——
    const devHost=el('div','dev-host');
    container.appendChild(devHost);
    let devHandle=null;
    try{
      devHandle=FC.Dev.mount(devHost,function(){ return state; },function(){ render(); },
        {document:doc,getGraph:function(){ return graph(); }});
    }catch(e){ devHandle=null; }

    function destroy(){
      if(timer!=null){ clearT(timer); timer=null; }
      if(devHandle&&devHandle.destroy)devHandle.destroy();
      if(FC.UI._handle===handle)FC.UI._handle=null;
    }
    const handle={ rerender:render, destroy:destroy, getState:function(){ return state; } };
    FC.UI._handle=handle;
    render();
    return handle;
  },
  // 最近一次挂载的重绘（供外部接线与后续任务调用；未挂载时空操作）
  rerender(){ if(FC.UI._handle)FC.UI._handle.rerender(); }
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
