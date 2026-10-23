// 美德少年公开积分数据层：同站点快照优先，Supabase 可连通时自动恢复实时数据。
// 管理员仍通过 Supabase Auth 和 RLS 写入；这个文件只读取可以公开的积分。
(function () {
  "use strict";
  let client = null;
  let cachedSnapshot = null;
  let cachedAt = 0;
  function configured() {
    const c = window.MEIDE_SUPABASE_CONFIG || {};
    return Boolean(c.url && c.publishableKey);
  }
  function getClient() {
    if (!configured()) throw new Error("积分数据库尚未配置");
    if (!window.supabase || !window.supabase.createClient) throw new Error("管理员 SDK 未加载");
    if (!client) {
      const c = window.MEIDE_SUPABASE_CONFIG;
      client = window.supabase.createClient(c.url, c.publishableKey);
    }
    return client;
  }
  function sortActivities(activities) {
    return [...activities].sort((a,b)=>{
      if(a.date && b.date) return String(b.date).localeCompare(String(a.date));
      if(a.date) return -1;
      if(b.date) return 1;
      return String(b.id).localeCompare(String(a.id));
    });
  }
  async function loadSnapshot() {
    if(cachedSnapshot && Date.now()-cachedAt < 15000) return cachedSnapshot;
    // 快照跟网页同属 GitHub Pages，避免依赖第三方 CDN 和数据库域名。
    const response = await fetch("data/public-scoreboard.json?updated="+Date.now(),{cache:"no-store"});
    if(!response.ok) throw new Error("公开积分备份暂不可用（"+response.status+"）");
    const data = await response.json();
    if(!Array.isArray(data.children)||!Array.isArray(data.activities)||!Array.isArray(data.ledger)){
      throw new Error("公开积分备份格式错误");
    }
    cachedSnapshot = {
      children:data.children,
      activities:sortActivities(data.activities),
      ledger:data.ledger,
      source:"snapshot",
      updatedAt:data.generatedAt||null
    };
    cachedAt=Date.now();
    return cachedSnapshot;
  }
  async function loadLive(timeoutMs=4500) {
    if(!configured()) throw new Error("数据库未配置");
    const {url,publishableKey}=window.MEIDE_SUPABASE_CONFIG;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),timeoutMs);
    async function rows(table,fields) {
      const result=[],pageSize=1000;
      for(let offset=0; offset<100000; offset+=pageSize){
        const path="/rest/v1/"+encodeURIComponent(table)
          +"?select="+encodeURIComponent(fields)
          +"&order=id.asc&limit="+pageSize+"&offset="+offset;
        const res=await fetch(url.replace(/\/$/,"")+path,{
          headers:{"apikey":publishableKey,"Accept":"application/json"},
          cache:"no-store",signal:controller.signal
        });
        if(!res.ok) throw new Error("数据库读取失败："+res.status);
        const batch=await res.json();
        if(!Array.isArray(batch)) throw new Error("数据库返回格式异常");
        result.push(...batch);
        if(batch.length<pageSize) break;
      }
      return result;
    }
    try {
      const [children,activities,scores]=await Promise.all([
        rows("meide_children","id,name,avatar,active,participant_type"),
        rows("meide_activities","id,title,date,status"),
        rows("meide_public_scores","id,child_id,activity_id,points,date")
      ]);
      return {
        children,
        activities:sortActivities(activities),
        ledger:scores.map(s=>({
          id:s.id,childId:s.child_id,activityId:s.activity_id,
          points:s.points,date:s.date
        })),
        source:"live",
        updatedAt:null
      };
    } finally {clearTimeout(timer);}
  }
  async function loadPublic(options={}) {
    if(options.preferLive){
      try{return await loadLive(options.timeoutMs||4500);}
      catch(error){
        console.info("无法连接实时积分，使用已同步的站内备份",error?.message||error);
        return loadSnapshot();
      }
    }
    // 首屏只读本站文件，避免国内移动浏览器一直等待跨境请求。
    try{return await loadSnapshot();}
    catch(error){
      console.warn("站内积分备份读取失败，尝试连接云端",error);
      return loadLive(6000);
    }
  }
  window.MeideCloud={configured,getClient,loadPublic,loadSnapshot,loadLive};
})();
