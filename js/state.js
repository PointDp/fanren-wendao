var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 状态模型：资源、境界、寿元与死亡判定（纯数据操作，无 DOM；可 JSON 序列化以便存档）
FC.State={
  // 新建一局：字段与初值见实现计划 Task 2
  create(name){
    return {
      saveVersion:1,
      name:name,
      day:1,            // 第 N 天（开局为第 1 天）
      cultivation:1,    // 修为境界，1=炼气一层（下标对应 FC.REALMS）
      lingshi:2,        // 灵石
      lifespanYears:9,  // 寿元（年，保留小数）
      injury:0,         // 伤势 0..100
      luck:0,           // 机缘
      inventory:{},     // 背包 {物品id:数量}
      karma:{},         // 因果 {因果id:计数}（结构留位给二周目）
      flags:{},         // 旗标 {旗标id:任意值}
      nodeId:'start',
      dead:null,        // null=存活；否则为死因字符串（'lifespan' 等）
      deathExempt:false // 必死局豁免（开发者金手指开关）
    };
  },
  // 伤势取值截断到 0..100（所有写入路径统一走这里）
  clampInjury(v){
    return Math.max(0,Math.min(100,v));
  },
  // 原地推进 days 天：天数累加，寿元按 days/365 扣减（保留小数）；寿元归零触发死亡判定
  advanceDays(state,days){
    state.day+=days;
    state.lifespanYears-=days/365;
    if(state.lifespanYears<=0){
      if(state.deathExempt){
        // 豁免开着：致命的寿元耗尽改为重伤垂死，并记录旗标
        state.injury=FC.State.clampInjury(100);
        state.dead=null;
        state.flags.escaped_death=true;
      }else{
        state.dead='lifespan';
      }
    }
    return state;
  },
  // 死亡判定：dead 非空即已死
  isDead(state){
    return state.dead!=null;
  }
};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
