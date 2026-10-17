var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 效果系统：剧情节点向状态写入后果的 DSL（纯数据操作，无 DOM；原地修改 state，log 为中文摘要供 UI 流水与调试）
FC.Effects={
  // 资源 key → 中文文案；'lifespan' 是 state.lifespanYears 的别名
  RES_LABEL:{cultivation:'修为',lingshi:'灵石',lifespan:'寿元',injury:'伤势',luck:'机缘'},
  // 原地应用一组效果，返回 {state, log:[中文摘要...]}；未知类型抛错（剧情 typo 不静默）
  apply(state,effects){
    const log=[];
    for(const e of effects){
      if(e.type==='res')FC.Effects._res(state,e,log);
      else if(e.type==='item')FC.Effects._item(state,e,log);
      else if(e.type==='karma')FC.Effects._karma(state,e,log);
      else if(e.type==='flag')FC.Effects._flag(state,e,log);
      else if(e.type==='time')FC.Effects._time(state,e,log);
      else if(e.type==='death')FC.Effects._death(state,e,log);
      else throw new Error('未知效果类型: '+e.type);
    }
    return {state:state,log:log};
  },
  // 资源增减；injury 与状态模型同一约束，走 clampInjury 截到 0..100（log 记实际变化量）
  _res(state,e,log){
    const target=e.key==='lifespan'?'lifespanYears':e.key;
    const before=state[target];
    const raw=before+e.delta;
    const after=e.key==='injury'?FC.State.clampInjury(raw):raw;
    state[target]=after;
    const applied=after-before;
    log.push(FC.Effects.RES_LABEL[e.key]+' '+((applied>=0?'+':'')+applied)+(e.key==='lifespan'?' 年':''));
  },
  // 物品增减：新键从 0 起；负数移除，库存不足截到 0（log 记实际数量）
  _item(state,e,log){
    const before=state.inventory[e.id]||0;
    const after=Math.max(0,before+e.count);
    state.inventory[e.id]=after;
    const applied=after-before;
    log.push(applied>=0?'获得 '+e.id+' ×'+applied:'失去 '+e.id+' ×'+(-applied));
  },
  // 因果：首次置 value；之后按数值累加（true 记 1、false 记 0、其他类型记 1 次），供延迟后果
  _karma(state,e,log){
    const prev=state.karma[e.id];
    if(prev===undefined){
      state.karma[e.id]=e.value;
    }else{
      const add=typeof e.value==='number'?e.value:(e.value===true?1:(e.value===false?0:1));
      state.karma[e.id]=(typeof prev==='number'?prev:1)+add;
    }
    log.push('因果 '+e.id+' 累计 '+state.karma[e.id]);
  },
  // 旗标：直接置任意 JSON 可序列化值
  _flag(state,e,log){
    state.flags[e.id]=e.value;
    log.push('旗标 '+e.id+' 置为 '+e.value);
  },
  // 时间流逝：转调 FC.State.advanceDays（含寿元死亡与豁免逻辑）
  _time(state,e,log){
    FC.State.advanceDays(state,e.days);
    log.push('时间流逝 '+e.days+' 天');
  },
  // 死亡：置死因；豁免开启时改为重伤垂死并记旗标，dead 保持 null（死亡不吞进度，存档另有任务）
  _death(state,e,log){
    if(state.deathExempt){
      state.injury=FC.State.clampInjury(100);
      state.flags['cheated_death_'+e.cause]=true;
      log.push('躲过死劫（'+e.cause+'），重伤垂死');
    }else{
      state.dead=e.cause;
      log.push('死亡（'+e.cause+'）');
    }
  }
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
