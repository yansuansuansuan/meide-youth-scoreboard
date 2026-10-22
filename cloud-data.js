// 公共页面只读取可公开的字段，管理员凭 Supabase Auth 登录后执行写入。
(function () {
  "use strict";
  let client = null;
  function configured() {
    const c = window.MEIDE_SUPABASE_CONFIG || {};
    return Boolean(c.url && c.publishableKey);
  }
  function getClient() {
    if (!configured()) throw new Error("积分数据库尚未配置");
    if (!window.supabase || !window.supabase.createClient) throw new Error("数据库 SDK 未加载");
    if (!client) {
      const c = window.MEIDE_SUPABASE_CONFIG;
      client = window.supabase.createClient(c.url, c.publishableKey);
    }
    return client;
  }
  async function allRows(table, columns) {
    const result = [], size = 1000, db = getClient();
    for (let start = 0; ; start += size) {
      const {data,error} = await db.from(table).select(columns).order("id",{ascending:true}).range(start,start+size-1);
      if (error) throw error;
      const rows = data || [];
      result.push(...rows);
      if (rows.length < size) break;
    }
    return result;
  }
  async function loadPublic() {
    const [children,activities,scores] = await Promise.all([
      allRows("meide_children","id,name,avatar,active"),
      allRows("meide_activities","id,title,date,status"),
      allRows("meide_public_scores","id,child_id,activity_id,points,date")
    ]);
    return {
      children,
      activities: activities.sort((a,b)=>String(b.date).localeCompare(String(a.date))),
      ledger: scores.map(x=>({id:x.id,childId:x.child_id,activityId:x.activity_id,points:x.points,date:x.date}))
    };
  }
  window.MeideCloud = {configured, getClient, loadPublic, allRows};
})();
