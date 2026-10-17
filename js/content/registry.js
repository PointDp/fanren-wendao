var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 内容注册器（人界篇）：加载于所有 chN.js 之后、index.html 主接线之前。
// 职责（Task 2 起，后续章节照抄本模式）：
//   1. 把已存在的章节包 FC.CH2…FC.CH7 的 graph 逐一 Object.assign 合并进 FC.Content.graph；
//   2. 对每章调用 FC.Engine.setCheckpointNode(meta.checkpointNode) 注册章首检查点（ch1 自行注册章末，不在本表）；
//   3. 章际接线：合并新章前，把当前图中仍是"章末终局"（terminal:true 且无 goto）的 scene 用拷贝改写、
//      接上 goto 到本章入口（如 第一章终 → ch2_start）——使合并图从 start 连通可达，玩家可从上一章章末走进新章；
//      以拷贝改写，绝不修改 FC.CH1 等章节原件；
//   4. 维护 FC.Content.chapters（各章 meta 列表，含 ch1），供面板"章节跳转"与验收扩展。
// 幂等：_merged 守卫 + 章节去重 + Set 去重，重复执行 register() 不重复合并/注册/接线。
// 新章接入：chN.js 定义 FC.CHN 后，只需往下方 CONTENT_SOURCES 常量数组加一项 'CHN'。
FC.CONTENT_SOURCES=['CH2','CH3','CH4','CH5','CH6','CH7'];
FC.ContentRegistry={
  _merged:false,
  // 图中"章末终局"节点：scene + terminal:true + 无 goto（未接线的上一章章末）
  _unwiredTerminals(graph){
    const out=[];
    for(const id of Object.keys(graph)){
      const n=graph[id];
      if(n&&n.type==='scene'&&n.terminal===true&&!n.goto)out.push(id);
    }
    return out;
  },
  register(){
    if(!FC.Content){ FC.Content={graph:{},items:FC.ITEMS}; } // 防御：ch1 缺失时兜底建壳（正常加载序不会走到）
    if(FC.ContentRegistry._merged)return; // 幂等守卫：只合并一次
    const graph=FC.Content.graph;
    const chapters=FC.Content.chapters||(FC.Content.chapters=[]);
    if(chapters.length===0&&FC.Content.meta){
      chapters.push({chapter:FC.Content.meta.chapter,title:FC.Content.meta.title,checkpointNode:FC.Content.meta.checkpointNode});
    }
    const cps=[];
    for(const key of FC.CONTENT_SOURCES){
      const pack=FC[key];
      if(!pack||!pack.graph||!pack.meta)continue;
      if(chapters.some(function(c){ return c.chapter===pack.meta.chapter; }))continue; // 已注册（幂等双保险）
      // 章际接线：上一章的章末终局 → 本章入口（拷贝改写，不动章节原件）
      // 判据用 pack.graph[entryId]：入口节点属于本章（合并前图里还没有它），
      // 且接线发生在 Object.assign 之前，本章自己的章末终局（如 ch2_end）不会被误接。
      const entryId=pack.meta.checkpointNode;
      if(entryId&&pack.graph[entryId]){
        for(const id of FC.ContentRegistry._unwiredTerminals(graph)){
          const wired=Object.assign({},graph[id],{goto:entryId});
          delete wired.terminal;
          graph[id]=wired;
        }
      }
      // 合并本章节点与本章 meta
      Object.assign(graph,pack.graph);
      chapters.push({chapter:pack.meta.chapter,title:pack.meta.title,checkpointNode:pack.meta.checkpointNode});
      if(pack.meta.checkpointNode)cps.push(pack.meta.checkpointNode);
    }
    if(cps.length)FC.Engine.setCheckpointNode(cps);
    FC.ContentRegistry._merged=true;
  }
};
FC.ContentRegistry.register();
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
