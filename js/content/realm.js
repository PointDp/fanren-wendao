var FC=(typeof window!=='undefined'?window:globalThis).FC=(typeof window!=='undefined'?window:globalThis).FC||{};
// 境界表：下标即 state.cultivation 数值（0=凡人，1=炼气一层 …… 12=筑基三层，13=结丹一层 …… 19=化神）；
// 人界篇扩容只追加（索引 0-12 不变，旧存档自然兼容）
FC.REALMS=['凡人','炼气一层','炼气二层','炼气三层','炼气四层','炼气五层','炼气六层','炼气七层','炼气八层','炼气九层','筑基一层','筑基二层','筑基三层','结丹一层','结丹二层','结丹三层','元婴一层','元婴二层','元婴三层','化神'];
// 大境界分界表：键为大境界名，值为该大境界首层在 REALMS 中的下标（供剧情与状态栏判断大境界）
FC.REALM_TIERS={凡人:0,炼气:1,筑基:10,结丹:13,元婴:16,化神:19};
if(typeof module!=='undefined'&&module.exports){module.exports=FC;}
