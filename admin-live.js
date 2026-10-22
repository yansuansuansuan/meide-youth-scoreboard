(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let db, children = [], activities = [], currentUser = null;
  const today = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); };
  function showStatus(message, ok=false) { $("status").textContent=message; $("status").classList.toggle("ok",ok); }
  function options(select, items, getLabel) {
    const old=select.value;
    select.replaceChildren(...items.map(item=>new Option(getLabel(item),item.id)));
    if(items.some(x=>x.id===old)) select.value=old;
  }
  function setPanels(loggedIn) {
    $("loginPanel").hidden=loggedIn;
    $("dashboard").hidden=!loggedIn;
    $("logout").hidden=!loggedIn;
  }
  async function isAdmin(user) {
    if(!user) return false;
    const {data,error}=await db.from("meide_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    return !!data;
  }
  async function refreshLists() {
    const [kids,acts]=await Promise.all([
      db.from("meide_children").select("id,name,active").order("created_at",{ascending:true}),
      db.from("meide_activities").select("id,title,date").order("date",{ascending:false})
    ]);
    if(kids.error) throw kids.error;
    if(acts.error) throw acts.error;
    children=kids.data||[];
    activities=acts.data||[];
    filterChildren();
    options($("activitySelect"),activities,a=>a.date+" · "+a.title);
    $("activitySelect").disabled=!activities.length;
  }
  function filterChildren(){
    const term=$("childSearch").value.trim();
    const result=children.filter(c=>c.active!==false && c.name.includes(term));
    options($("childSelect"),result,c=>c.name);
    $("childSelect").disabled=!result.length;
  }
  async function refreshRecords() {
    const {data,error}=await db.from("meide_ledger").select("id,child_id,activity_id,points,reason,operator,date,created_at").order("created_at",{ascending:false}).limit(30);
    if(error) throw error;
    const target=$("recentRecords");
    target.replaceChildren();
    if(!(data||[]).length){const e=document.createElement("p");e.className="hint";e.textContent="目前还没有积分记录。";target.append(e);return;}
    (data||[]).forEach(record=>{
      const line=document.createElement("div");line.className="record";
      const content=document.createElement("div");
      const main=document.createElement("strong");
      const child=children.find(c=>c.id===record.child_id);
      main.textContent=(child?child.name:"已移除的孩子")+" · "+(record.points>0?"+":"")+record.points+" 分";
      const sub=document.createElement("small");
      const activity=activities.find(a=>a.id===record.activity_id);
      sub.textContent=[record.date,activity?activity.title:"未知活动",record.reason,record.operator].join(" · ");
      content.append(main,sub);
      const remove=document.createElement("button");remove.type="button";remove.className="btn btn-ghost small";remove.textContent="撤销";
      remove.addEventListener("click",async()=>{
        if(!confirm("确定撤销这条积分记录？相应分数会从榜单中扣回。")) return;
        remove.disabled=true;
        try {
          const {error}=await db.from("meide_ledger").delete().eq("id",record.id);
          if(error) throw error;
          showStatus("记录已撤销，公开积分已同步更新。",true);
          await refreshRecords();
        } catch(e) {showStatus("撤销失败："+e.message); remove.disabled=false;}
      });
      line.append(content,remove);target.append(line);
    });
  }
  async function authorize(user){
    const allowed=await isAdmin(user);
    if(!allowed){
      await db.auth.signOut();
      currentUser=null;setPanels(false);
      showStatus("此账号不是积分管理员，请联系项目负责人开通权限。");
      return;
    }
    currentUser=user; setPanels(true);
    $("operator").value=user.email||"";
    $("scoreDate").value=today();
    $("activityDate").value=today();
    await refreshLists();
    await refreshRecords();
    showStatus("数据库连接正常。保存积分后，网站刷新即可看到最新榜单。",true);
  }
  async function transact(form,callback){
    const btn=form.querySelector('button[type="submit"]'); btn.disabled=true;
    try{await callback();}catch(e){showStatus("操作未完成："+(e.message||String(e)));}
    finally{btn.disabled=false;}
  }
  function initForms(){
    $("childSearch").addEventListener("input",filterChildren);
    $("loginForm").addEventListener("submit",e=>{e.preventDefault();transact(e.currentTarget,async()=>{
      const {data,error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
      if(error) throw error;
      $("password").value="";
      await authorize(data.user);
    });});
    $("logout").addEventListener("click",async()=>{
      try{await db.auth.signOut();currentUser=null;setPanels(false);showStatus("已安全退出登录。",true);}
      catch(e){showStatus("退出失败："+e.message);}
    });
    $("childForm").addEventListener("submit",e=>{e.preventDefault();transact(e.currentTarget,async()=>{
      const name=$("childName").value.trim();
      if(!name) throw new Error("请输入姓名或昵称");
      if(children.some(c=>c.name===name)) throw new Error("名单中已存在同名记录，请核对后再添加");
      const {error}=await db.from("meide_children").insert({id:"c_"+crypto.randomUUID(),name,active:true});
      if(error) throw error;
      $("childName").value="";
      await refreshLists();
      showStatus("孩子已加入云端名单。",true);
    });});
    $("activityForm").addEventListener("submit",e=>{e.preventDefault();transact(e.currentTarget,async()=>{
      const title=$("activityTitle").value.trim(),date=$("activityDate").value;
      if(!title||!date) throw new Error("请填写活动信息");
      const {error}=await db.from("meide_activities").insert({id:"a_"+crypto.randomUUID(),title,date,status:"ongoing"});
      if(error) throw error;
      $("activityTitle").value="";
      await refreshLists();
      showStatus("活动已创建。",true);
    });});
    $("scoreForm").addEventListener("submit",e=>{e.preventDefault();transact(e.currentTarget,async()=>{
      if(!currentUser) throw new Error("登录已失效，请重新登录");
      const points=Number($("points").value);
      if(!Number.isInteger(points)||points===0||Math.abs(points)>10000) throw new Error("积分必须是 -10000 至 10000 之间的非零整数");
      const child_id=$("childSelect").value,activity_id=$("activitySelect").value;
      if(!child_id||!activity_id) throw new Error("请先添加孩子和活动");
      const reason=$("reason").value.trim(),operator=$("operator").value.trim(),date=$("scoreDate").value;
      if(!reason||!operator||!date) throw new Error("请填写原因、操作人和日期");
      const {error}=await db.from("meide_ledger").insert({
        id:"l_"+crypto.randomUUID(),child_id,activity_id,points,reason,operator,date
      });
      if(error) throw error;
      $("reason").value="";
      await refreshRecords();
      showStatus("积分保存成功。公开榜单的分数已经更新。",true);
    });});
  }
  async function start(){
    initForms();
    setPanels(false);
    if(!window.MeideCloud || !window.MeideCloud.configured()){
      showStatus("尚未绑定专用数据库：请先配置 supabase-config.js。本页面不会把录入内容保存在浏览器中。");
      $("loginPanel").hidden=true;
      return;
    }
    try{
      db=window.MeideCloud.getClient();
      const {data,error}=await db.auth.getUser();
      if(error && error.name!=="AuthSessionMissingError") throw error;
      if(data&&data.user) await authorize(data.user);
      else{setPanels(false);showStatus("已连接数据库，请使用管理员账号登录。",true);}
    }catch(e){showStatus("连接失败："+(e.message||String(e)));setPanels(false);}
  }
  document.addEventListener("DOMContentLoaded",start);
})();
