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
      db.from("meide_children").select("id,name,active,participant_type").order("created_at",{ascending:true}),
      db.from("meide_activities").select("id,title,date").order("date",{ascending:false})
    ]);
    if(kids.error) throw kids.error;
    if(acts.error) throw acts.error;
    children=kids.data||[];
    activities=acts.data||[];
    filterChildren();
    options($("activitySelect"),activities,a=>(a.date||"日期待补")+" · "+a.title);
    $("activitySelect").disabled=!activities.length;
  }
  function filterChildren(){
    const term=$("childSearch").value.trim();
    const result=children.filter(c=>c.active!==false && (c.participant_type||"child")==="child" && c.name.includes(term));
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

  async function refreshSignupRoster() {
    const summary=$("secondSignupSummary"), container=$("secondSignupRows");
    if(!summary||!container)return;
    const {data,error}=await db.from("meide_event_signups")
      .select("name,participant_type,service_hours,attendance_status,signup_status")
      .eq("activity_id","meide-signin-02")
      .order("participant_type",{ascending:true})
      .order("name",{ascending:true});
    if(error){summary.textContent="报名名单暂时无法读取："+error.message;return;}
    const list=data||[];
    const youths=list.filter(x=>x.participant_type==="child");
    const adults=list.filter(x=>x.participant_type==="university_volunteer");
    summary.textContent="共 "+list.length+" 人报名：青少年志愿者 "+youths.length+" 人，大学生志愿者 "+adults.length+" 人。签到状态尚未核实。";
    container.replaceChildren();
    [
      ["青少年志愿者（报名，不等于已到场）",youths],
      ["大学生志愿者（不参与积分排名）",adults]
    ].forEach(([title,people])=>{
      const h=document.createElement("h3");h.textContent=title;container.append(h);
      const wrapper=document.createElement("div");
      wrapper.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px";
      people.forEach(p=>{
        const item=document.createElement("div");item.className="hint";
        item.style.cssText="padding:10px 12px;background:#f8f7f2;border-radius:10px";
        item.textContent=p.name+" · "+Number(p.service_hours||0).toFixed(2)+"小时";
        wrapper.append(item);
      });
      container.append(wrapper);
    });
  }
  async function refreshReview() {
    const {data,error}=await db.from("meide_import_review")
      .select("id,activity_id,source_row,raw_name,score,score_text,review_note")
      .eq("status","pending").order("activity_id",{ascending:true}).order("source_row",{ascending:true});
    if(error) throw error;
    const wrap=$("reviewRecords"); if(!wrap)return;
    wrap.replaceChildren();
    const rows=data||[];
    if(!rows.length){
      const p=document.createElement("p"); p.className="hint";
      p.textContent="签到表已经全部核对完毕。";wrap.append(p);return;
    }
    const count=document.createElement("p");count.className="hint";
    count.textContent="尚有 "+rows.length+" 行待核对（已录入的记录不会重复出现）";
    wrap.append(count);
    rows.forEach(row=>{
      const line=document.createElement("div");
      line.className="workform";
      line.style.cssText="padding:16px 0;border-bottom:1px solid #efe6d1;gap:9px";
      const title=document.createElement("strong");
      title.textContent=(row.activity_id==="meide-signin-01"?"第一场":"第二场")+" · 签到表第 "+row.source_row+" 行";
      const nameLabel=document.createElement("label");nameLabel.textContent="核对姓名";
      const name=document.createElement("input");name.value=row.raw_name||"";name.maxLength=40;nameLabel.append(name);
      const ptsLabel=document.createElement("label");ptsLabel.textContent="核对积分（空白表示原表未填写）";
      const pts=document.createElement("input");pts.type="number";pts.step="0.01";
      pts.min="-10000";pts.max="10000";pts.value=row.score==null?"":String(row.score);ptsLabel.append(pts);
      const note=document.createElement("small");note.className="hint";
      note.textContent="手写原文："+(row.score_text||"无")+"；"+(row.review_note||"请核对");
      const btn=document.createElement("button");btn.type="button";btn.className="btn btn-green";
      btn.textContent="核对并发布到积分榜";
      btn.addEventListener("click",async()=>{
        const verifiedName=name.value.trim();
        if(!verifiedName||/待核|×|？/.test(verifiedName)){showStatus("请先把模糊姓名修改为已核对的准确姓名。");return;}
        const pointText=pts.value.trim();
        const score=pointText===""?null:Number(pointText);
        if(score!==null&&(!Number.isFinite(score)||Math.abs(score)>10000||Math.abs(score-Math.round(score*100)/100)>1e-8)){
          showStatus("分数必须在 ±10000 之间，最多两位小数。");return;
        }
        if(!confirm("确认第 "+row.source_row+" 行姓名为「"+verifiedName+"」、积分为「"+(score===null?"未填写":score)+"」并发布？"))return;
        btn.disabled=true;
        try{
          const {error}=await db.rpc("meide_confirm_import",{p_row_id:row.id,p_name:verifiedName,p_points:score});
          if(error)throw error;
          await Promise.all([refreshLists(),refreshRecords(),refreshReview()]);
          showStatus("核对成功，已更新云端名单与榜单。",true);
        }catch(e){showStatus("核对未保存："+e.message);btn.disabled=false;}
      });
      line.append(title,nameLabel,ptsLabel,note,btn);
      wrap.append(line);
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
    await refreshReview();
    await refreshSignupRoster();
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
      const {error}=await db.from("meide_children").insert({id:"c_"+crypto.randomUUID(),name,active:true,participant_type:$("participantType").value});
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
      if(!Number.isFinite(points)||Math.abs(points)>10000||Math.abs(points-Math.round(points*100)/100)>1e-8) throw new Error("积分应为 -10000 至 10000 之间且最多两位小数");
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
