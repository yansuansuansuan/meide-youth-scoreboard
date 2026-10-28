// 美德少年公开积分层。CloudBase 是唯一正式数据源。
// 优先请求 CloudBase 的只读 HTTP 接口，网络暂时不可达时使用 GitHub Pages
// 定时同步的 CloudBase 公开副本。旧 Supabase 数据仅保留历史备份，不参与展示。
(function () {
  "use strict";
  const API = "https://meidejifenbang-d4gk1txdi4a1d2342.service.tcloudbase.com/public-api";
  const MIRROR = "data/cloudbase-public.json";
  // Temporary safety switch: PG trial is isolated after running out of free points.
  // Do not probe PG from visitors until an economical live backend is deployed.
  const CLOUD_READS_PAUSED = true;
  let cachedMirror = null;
  let mirrorCachedAt = 0;
  let lastLive = null;

  function configured() { return true; }
  function getClient() {
    throw new Error("公开榜单使用 CloudBase 只读 HTTP API，不需要数据库 SDK");
  }
  function sortActivities(activities) {
    return [...activities].sort((a,b) => {
      if (a.date && b.date) return String(b.date).localeCompare(String(a.date));
      if (a.date) return -1;
      if (b.date) return 1;
      return String(b.id).localeCompare(String(a.id));
    });
  }
  function normalize(raw, source) {
    if (!raw || !Array.isArray(raw.children) ||
        !Array.isArray(raw.activities) || !Array.isArray(raw.records)) {
      throw new Error("CloudBase 公开数据格式无效");
    }
    if (raw.totals) {
      for (const [key, count] of [
        ["children",raw.children.length],["activities",raw.activities.length],
        ["records",raw.records.length]
      ]) {
        if (Number(raw.totals[key]) !== count) throw new Error("CloudBase 数据数量不一致："+key);
      }
    }
    const childIds = new Map();
    const children = raw.children.map(c => {
      const internalId = c.childId || c.id;
      const publicId = c.legacyId || internalId;
      if (!internalId || !publicId || !c.name) throw new Error("儿童标识或姓名缺失");
      childIds.set(String(internalId),String(publicId));
      return {
        id:String(publicId), name:String(c.name), avatar:null,
        active:true, participant_type:"child"
      };
    });
    const activityIds = new Map();
    const activities = raw.activities.map(a => {
      const internalId = a.activityId || a.id;
      const publicId = a.legacyId || internalId;
      if (!internalId || !publicId || !a.name || !a.date) throw new Error("活动字段缺失");
      activityIds.set(String(internalId),String(publicId));
      return {
        id:String(publicId), title:String(a.name), date:String(a.date),
        status:a.status==="closed"?"finished":a.status
      };
    });
    const ledger = raw.records.map(r => {
      const childId = childIds.get(String(r.childId));
      const activityId = activityIds.get(String(r.activityId));
      if (!childId || !activityId || !r.recordId || !Number.isFinite(Number(r.delta))) {
        throw new Error("CloudBase 积分流水关联无效，拒绝展示不完整榜单");
      }
      return {
        id:String(r.legacyId || r.recordId),childId,activityId,
        points:Number(r.delta),date:String(r.activityDate||"")
      };
    });
    return {
      children, activities:sortActivities(activities), ledger,
      source, updatedAt:raw.lastUpdatedAt || null
    };
  }

  async function loadSnapshot() {
    if (cachedMirror && Date.now()-mirrorCachedAt < 12000) return cachedMirror;
    const response = await fetch(MIRROR+"?updated="+Date.now(),{cache:"no-store"});
    if (!response.ok) throw new Error("CloudBase 同站备份无法读取："+response.status);
    const raw = await response.json();
    const parsed = normalize(raw,"cloudbase-mirror");
    cachedMirror = parsed;
    mirrorCachedAt = Date.now();
    return parsed;
  }

  async function getPages(resource,signal) {
    const rows=[];
    for (let page=1;page<=1000;page++) {
      const query="?page="+page+"&pageSize=200";
      const response=await fetch(API+"/"+resource+query,{
        signal,cache:"no-store",headers:{"Accept":"application/json"}
      });
      if (!response.ok) throw new Error("CloudBase 接口请求失败："+resource+" "+response.status);
      const data=await response.json();
      if (data.code!==0 || !Array.isArray(data.data) ||
          !Number.isInteger(data.total) || typeof data.hasMore!=="boolean") {
        throw new Error("CloudBase 分页格式异常："+resource);
      }
      rows.push(...data.data);
      if (!data.hasMore) {
        if (rows.length!==data.total) throw new Error("CloudBase 分页数量不一致："+resource);
        return {rows,lastUpdatedAt:data.lastUpdatedAt};
      }
      if (!data.data.length || rows.length>=data.total) throw new Error("CloudBase 分页中断："+resource);
    }
    throw new Error("CloudBase 分页超出安全上限");
  }

  async function loadLive(timeoutMs=4500) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const [children,activities,records]=await Promise.all([
        getPages("children",controller.signal),
        getPages("activities",controller.signal),
        getPages("records",controller.signal)
      ]);
      // 跨集合并发读取时，写入可能恰好发生在中途。关联不一致会拒绝
      // 此次实时结果，回退到最后一次有效结果，而不是产生错误排行榜。
      const updatedAt=Math.max(
        Number(children.lastUpdatedAt)||0,
        Number(activities.lastUpdatedAt)||0,
        Number(records.lastUpdatedAt)||0
      );
      const result=normalize({
        children:children.rows,activities:activities.rows,records:records.rows,
        lastUpdatedAt:updatedAt
      },"cloudbase-live");
      lastLive=result;
      return result;
    } finally {clearTimeout(timer);}
  }

  async function loadPublic(options={}) {
    if (CLOUD_READS_PAUSED) return loadSnapshot();
    if (options.preferLive===false) return loadSnapshot();
    try {
      return await loadLive(options.timeoutMs||4500);
    } catch(error) {
      console.info("CloudBase 实时接口暂不可用，读取同站点同步数据",error?.message||error);
      try {
        const mirror=await loadSnapshot();
        const m=Number(mirror.updatedAt)||0;
        const l=Number(lastLive?.updatedAt)||0;
        return lastLive && l>m ? lastLive : mirror;
      } catch(mirrorError) {
        if (lastLive) return lastLive;
        throw mirrorError;
      }
    }
  }
  window.MeideCloud={configured,getClient,loadPublic,loadSnapshot,loadLive,liveUpdatesEnabled:!CLOUD_READS_PAUSED};
})();
