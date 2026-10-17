var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 存档系统：localStorage 优先，缺失或抛错时降级进程内内存 Map（file:// 与隐私模式兜底）
// 槽位 'auto'|'checkpoint'|'m1'|'m2'|'m3'，键名前缀 'fcw.save.'
// 关键不变量：死亡流程不改写 checkpoint（死亡不吞进度）——state.dead 非空时拒绝存 checkpoint
FC.Save={
  // 合法槽位表：auto=自动档，checkpoint=死亡检查点，m1..m3=手动档
  SLOTS:['auto','checkpoint','m1','m2','m3'],
  // localStorage 键前缀
  PREFIX:'fcw.save.',
  // 存档版本：v1 仅此一版；load 时版本不符返回 null，不做迁移
  VERSION:1,
  // 内存兜底：localStorage 不可用期间写入的档（进程生命周期内有效）
  _mem:new Map(),
  // 内存兜底标记：本会话内任一次存/取落到内存（localStorage 缺失或抛错）即置 true，
  // 供 UI 在标题/存档界面显示"进度仅存内存、关页即丢"提示；不影响 save/load/list 的返回值
  memoryFallback:false,
  // 取 localStorage：属性访问本身也可能抛错（浏览器安全策略），统一包 try/catch
  _ls(){
    try{ return globalThis.localStorage||null; }catch(e){ return null; }
  },
  // 槽位白名单校验
  _validSlot(slot){
    return FC.Save.SLOTS.indexOf(slot)>=0;
  },
  // 存档：state 为纯数据，JSON.stringify 原样写入
  // 成功返回 {ok:true, storage:'localStorage'|'memory'}；
  // 死亡状态下存 checkpoint 返回 {ok:false, reason:'dead'}；非法槽位返回 {ok:false, reason:'slot'}
  save(state,slot){
    if(!FC.Save._validSlot(slot))return{ok:false,reason:'slot'};
    if(slot==='checkpoint'&&state.dead!=null)return{ok:false,reason:'dead'};
    const json=JSON.stringify(state);
    const ls=FC.Save._ls();
    if(ls){
      try{ ls.setItem(FC.Save.PREFIX+slot,json); return{ok:true,storage:'localStorage'}; }
      catch(e){ /* 写入失败（隐私模式/配额满）：降级内存 */ }
    }
    FC.Save._mem.set(slot,json);
    FC.Save.memoryFallback=true;
    return{ok:true,storage:'memory'};
  },
  // 读档：localStorage 优先，取不到或抛错再看内存兜底；损坏档与版本不符一律 null
  load(slot){
    if(!FC.Save._validSlot(slot))return null;
    let json=null;
    const ls=FC.Save._ls();
    if(ls){
      try{ json=ls.getItem(FC.Save.PREFIX+slot); }catch(e){ json=null; }
    }
    if(json==null&&FC.Save._mem.has(slot)){ json=FC.Save._mem.get(slot); FC.Save.memoryFallback=true; }
    if(json==null)return null;
    let data;
    try{ data=JSON.parse(json); }catch(e){ return null; }
    if(!data||data.saveVersion!==FC.Save.VERSION)return null;
    return data;
  },
  // 槽位概览：存在且可读（版本匹配）即 true，供 UI 渲染存档菜单
  list(){
    const out={};
    for(const slot of FC.Save.SLOTS)out[slot]=FC.Save.load(slot)!=null;
    return out;
  }
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
