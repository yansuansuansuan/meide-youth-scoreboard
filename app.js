const state={children:[],activities:[],ledger:[],gallery:[],settings:{},selectedActivity:null,selectedChild:null,profileDraft:'',profileSearched:false,profileError:''};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtDate=v=>{if(!v) return ''; const d=new Date(v+'T00:00:00'); return isNaN(d)?v:`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`};
const AVATARS=Array.from({length:20},(_,i)=>`assets/avatar_${String(i+1).padStart(2,'0')}.jpg`);
const avatarOf=c=>c.avatar||AVATARS[Math.abs(hashCode(c.id||c.name))%AVATARS.length];
const hashCode=s=>[...String(s)].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0);
const byId=(arr,id)=>arr.find(x=>x.id===id);
function toast(msg){const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600)}
async function loadData(){
  // 实际积分以云端数据库为准，不回退到旧的 JSON。
  if(!window.MeideCloud?.configured())throw new Error('积分服务尚未配置');
  const [live,gallery,settings]=await Promise.all([
    window.MeideCloud.loadPublic(),
    fetch('data/gallery.json').then(r=>{if(!r.ok)throw Error('活动相册加载失败');return r.json()}),
    fetch('data/settings.json').then(r=>{if(!r.ok)throw Error('网站配置加载失败');return r.json()})
  ]);
  state.children=live.children; state.activities=live.activities; state.ledger=live.ledger;
  state.gallery=gallery; state.settings=settings;
  state.dataSource=live.source||'live'; state.lastSyncedAt=live.updatedAt||null;
  if(!state.activities.some(a=>a.id===state.selectedActivity))state.selectedActivity=state.activities[0]?.id||null;
  if(!state.children.some(c=>c.id===state.selectedChild && c.active!==false && (c.participant_type||'child')==='child'))state.selectedChild=null;
}

const displayScore=x=>String(Number(Number(x).toFixed(2)));
function totals(activityId=null){
  const rows=state.children.filter(c=>c.active!==false && (c.participant_type||"child")==="child").map(c=>({child:c,points:0,activities:new Set(),count:0}));
  const map=new Map(rows.map(r=>[r.child.id,r]));
  state.ledger.forEach(l=>{
    if(activityId && l.activityId!==activityId)return;
    const r=map.get(l.childId); if(!r)return;
    r.points+=Number(l.points)||0; r.activities.add(l.activityId); r.count++;
  });
  // 榜单只收录累计积分大于 0 的符合资格的儿童；0 分仍保留为后台原始记录。
  return rows.filter(r=>r.count>0 && r.points>0).map(r=>({...r,points:Number(r.points.toFixed(2)),activities:r.activities.size}))
    .sort((a,b)=>b.points-a.points||a.child.name.localeCompare(b.child.name,'zh-CN'));
}
function rankAt(rows,i){return rows.findIndex(r=>r.points===rows[i].points)+1;}

function homePage(){return `
<section class="home-hero">
  <div class="banner-wrap ranking-hero home-banner">
    <img class="banner-desktop" src="assets/home_head.jpg" alt="美德少年成长计划">
    <img class="banner-mobile" src="assets/home_head.jpg" alt="美德少年成长计划">
  </div>
  <div class="home-inner">
    <div class="home-cards">
      <a class="home-card" href="#/total"><img src="assets/card_total.jpg" alt="查看总榜"></a>
      <a class="home-card" href="#/activity"><img src="assets/card_activity.jpg" alt="查看活动榜"></a>
      <a class="home-card" href="#/signup"><img src="assets/card_signup.jpg" alt="报名入口"></a>
      <a class="home-card" href="#/intro"><img src="assets/card_intro.jpg" alt="系列活动介绍"></a>
      <a class="home-card" href="#/gallery"><img src="assets/card_gallery.jpg" alt="往期精彩"></a>
      <a class="home-card" href="#/profile"><img src="assets/card_profile.jpg" alt="成长档案"></a>
    </div>
  </div>
</section>`}
function rankingPage(kind='total'){
  const isActivity=kind==='activity';
  const activityId=isActivity?state.selectedActivity:null;
  const rows=totals(activityId);
  const act=byId(state.activities,activityId);
  const headBg=isActivity?'assets/activity_head.jpg':'assets/total_head.jpg';
  const activityLabel=act?`${fmtDate(act.date)||'日期待补'} · ${act.title}`:'请选择活动';
  return `
  <div class="${isActivity?'activity-bgpage':'total-bgpage'}">
  <section class="page-shell ${isActivity?'activity-page':'total-page'}">
    <div class="banner-wrap ranking-hero ${isActivity?'activity-hero':'total-hero'}">
      <img class="banner-desktop" src="${headBg}" alt="${isActivity?'活动榜':'总榜'}头图">
      <img class="banner-mobile" src="${headBg}" alt="${isActivity?'活动榜':'总榜'}头图">
    </div>
    <div class="ranking-bg">
      <div class="ranking-card">
        <div class="ranking-toolbar-top ${isActivity?'activity':''}">
          ${isActivity?`<select id="actSel" class="select activity-select">${state.activities.map(a=>`<option value="${a.id}" ${a.id===activityId?'selected':''}>${esc((fmtDate(a.date)||'日期待补')+' '+a.title)}</option>`).join('')}</select>`:''}
          ${isActivity?`<div class="activity-meta-line">${esc(activityLabel)}</div>`:`<div class="activity-meta-line total-meta-line">汇总全部已确认活动积分，与活动榜自动同步</div>`}
        </div>
        ${podiumHtml(rows.slice(0,3))}
        <div class="search-row"><input id="searchInput" class="search long-search" placeholder="搜索孩子姓名"></div>
        <div class="table-wrap">${tableHtml(rows)}</div>
      </div>
    </div>
  </section>
  </div>`}
function podiumHtml(rows){const order=[1,0,2],cls=['second','first','third']; return `<div class="podium">${order.map((idx,i)=>{const r=rows[idx]; if(!r)return '<div></div>'; return `<div class="podium-item ${cls[i]}"><div class="medal">${rankAt(rows,idx)}</div><img class="avatar" src="${avatarOf(r.child)}" alt=""><strong>${esc(r.child.name)}</strong><div class="p-score">${displayScore(r.points)} 分</div><div class="p-meta">参与 ${r.activities} 场活动</div></div>`}).join('')}</div>`}
function tableHtml(rows){
  if(!rows.length)return '<div class="empty">暂无已确认的积分记录</div>';
  return `<table class="rank-table"><thead><tr><th>排名</th><th>姓名</th><th>参与活动</th><th>积分</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-name="${esc(r.child.name)}"><td><span class="rank-num">${String(rankAt(rows,i)).padStart(2,'0')}</span></td><td>${esc(r.child.name)}</td><td>参加 ${r.activities} 场</td><td class="score">${displayScore(r.points)} 分</td></tr>`).join('')}</tbody></table>`;
}

function profilePage(){
  // 不展示姓名名单。必须输入完整姓名才能打开对应档案。
  const eligibleChildren=state.children.filter(c=>c.active!==false && (c.participant_type||"child")==="child");
  const child=eligibleChildren.find(c=>c.id===state.selectedChild) || null;
  const message=!state.profileSearched
    ? '请输入孩子的完整姓名，搜索后查看成长档案。'
    : (state.profileError || '请输入孩子的完整姓名。');
  let detail='<div class="profile-search-empty" role="status">'+esc(message)+'</div>';
  if(child){
    const entries=state.ledger.filter(x=>x.childId===child.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const total=entries.reduce((sum,e)=>sum+(Number(e.points)||0),0);
    const acts=new Set(entries.map(x=>x.activityId)).size;
    detail=`<div class="main-box">
      <div class="profile-head"><img class="avatar" src="${avatarOf(child)}" alt=""><div><h2 style="margin:0 0 6px">${esc(child.name)}</h2><div class="meta">个人成长记录</div></div></div>
      <div class="stat-grid">
        <div class="stat">累计积分<b>${displayScore(total)}</b></div>
        <div class="stat">参与活动<b>${acts}</b></div>
        <div class="stat">积分记录<b>${entries.length}</b></div>
      </div>
      <h3>积分流水</h3>
      <div class="timeline">${entries.length?entries.map(e=>{
        const a=byId(state.activities,e.activityId);
        return `<div class="event">
          <strong>${e.points>=0?'+':''}${displayScore(e.points)} 分 · ${esc(e.reason||'活动积分记录')}</strong>
          <div>${esc(a?.title||'未命名活动')}</div>
          <div class="meta">${esc(fmtDate(e.date))}${e.operator?' · 录入：'+esc(e.operator):''}</div>
        </div>`;
      }).join(''):'<div class="empty">还没有成长记录</div>'}</div>
    </div>`;
  }
  return `<section>
    <div class="banner-wrap ranking-hero profile-hero">
      <img class="banner-desktop" src="assets/profile_head.jpg" alt="成长档案头图">
      <img class="banner-mobile" src="assets/profile_head.jpg" alt="成长档案头图">
    </div>
    <div class="content-pad"><div class="container profile-search-layout">
      <form id="profileSearchForm" class="profile-search-form" role="search" autocomplete="off">
        <label class="profile-search-label" for="profileNameInput">查找成长档案</label>
        <div class="profile-search-control">
          <input id="profileNameInput" type="search" class="search" name="name" maxlength="40"
            placeholder="请输入孩子的完整姓名" value="${esc(state.profileDraft||'')}"
            enterkeyhint="search" autocapitalize="off" spellcheck="false" required>
          <button type="submit" class="profile-search-submit" aria-label="搜索成长档案" title="搜索">⌕</button>
        </div>
      </form>
      <div id="profileResult">${detail}</div>
    </div></div>
  </section>`;
}

function introPage(){return `<section><div class="banner-wrap ranking-hero"><img class="banner-desktop" src="assets/intro_head.jpg" alt="系列活动介绍"><img class="banner-mobile" src="assets/intro_head.jpg" alt="系列活动介绍"></div></section><div class="content-pad"><div class="container intro-grid"><article class="card"><h2>什么是美德少年成长积分榜？</h2><p>这是一个用于记录系列活动参与情况的成长展示平台。每位孩子参加活动、完成任务、展现合作与责任，都会以“积分流水”的方式沉淀下来，最终自动汇总到总榜和活动榜中。</p></article><div class="point-list"><div class="point"><b>🌱 长期积累</b><div class="meta">每场活动积分自动汇总到总榜。</div></div><div class="point"><b>🏅 活动展示</b><div class="meta">每一场活动都能单独生成活动榜。</div></div><div class="point"><b>📒 成长档案</b><div class="meta">查看单个孩子的参与与积分流水。</div></div><div class="point"><b>📷 往期精彩</b><div class="meta">活动结束后上传精选照片长期保留。</div></div></div></div></div></section>`}
function galleryPage(){
 const realPhotos=state.gallery.filter(g=>g&&g.cover&&!g.cover.includes('placeholder'));
 return `<div class="gallery-page"><section><div class="banner-wrap ranking-hero"><img class="banner-desktop" src="assets/gallery_head.jpg" alt="往期精彩"><img class="banner-mobile" src="assets/gallery_head.jpg" alt="往期精彩"></div></section><div class="content-pad"><div class="container">${realPhotos.length?`<div class="gallery-grid">${realPhotos.map(g=>`<article class="photo-card"><div class="photo-thumb"><img src="${esc(g.cover)}" alt=""></div><div class="photo-body"><h3>${esc(g.title||'活动照片')}</h3><p>${g.date?fmtDate(g.date)+' · ':''}${esc(g.desc||'')}</p></div></article>`).join('')}</div>`:'<div class="card" style="text-align:center;padding:42px 18px">暂无已发布的活动照片</div>'}</div></div></div>`;
}

function signupPage(){return `<div class="signup-page"><section><div class="banner-wrap ranking-hero"><img class="banner-desktop" src="assets/signup_head.jpg" alt="报名入口"><img class="banner-mobile" src="assets/signup_head.jpg" alt="报名入口"></div></section><div class="content-pad"><div class="container"><div class="card"><div class="notice"><strong>活动通知</strong><p class="meta">${esc(state.settings.announcement||'暂无新的活动通知')}</p></div><div style="height:18px"></div><h2>当前报名入口</h2><div class="link-row">${state.settings.registrationUrl?`<a class="btn btn-primary" target="_blank" rel="noopener" href="${esc(state.settings.registrationUrl)}">打开报名推文</a><button class="btn btn-ghost" data-copy="${esc(state.settings.registrationUrl)}">复制链接</button>`:'<span class="meta">当前暂无报名链接</span>'}</div><hr style="border:0;border-top:1px solid var(--line);margin:26px 0"><h2>喔图直播</h2><div class="link-row">${state.settings.photoLiveUrl?`<a class="btn btn-green" target="_blank" rel="noopener" href="${esc(state.settings.photoLiveUrl)}">打开喔图直播</a><button class="btn btn-ghost" data-copy="${esc(state.settings.photoLiveUrl)}">复制链接</button>`:'<span class="meta">当前暂无喔图直播链接</span>'}</div></div></div></div></section></div>`}
function bindPage(routeName){
  $$('.nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#/${routeName}`));
  const input=$('#searchInput'); if(input){input.oninput=()=>$$('.rank-table tbody tr').forEach(tr=>tr.style.display=!input.value||tr.dataset.name.includes(input.value)?'':'none')}
  const sel=$('#actSel'); if(sel){sel.onchange=()=>{state.selectedActivity=sel.value; render()}}
  const profileInput=$('#profileNameInput');
  const profileForm=$('#profileSearchForm');
  if(profileInput && profileForm){
    profileInput.addEventListener('input',()=>{
      state.profileDraft=profileInput.value;
      state.selectedChild=null; state.profileSearched=false; state.profileError='';
      const result=$('#profileResult');
      if(result) result.innerHTML='<div class="profile-search-empty" role="status">请输入完整姓名并点击搜索，查看对应的成长档案。</div>';
    });
    profileForm.addEventListener('submit',event=>{
      event.preventDefault();
      const name=profileInput.value.trim();
      state.profileDraft=name;
      state.profileSearched=true;
      state.selectedChild=null;
      state.profileError='';
      const matches=state.children.filter(c=>c.active!==false
        && (c.participant_type||'child')==='child' && c.name.trim()===name);
      if(matches.length===1){
        state.selectedChild=matches[0].id;
      }else if(matches.length>1){
        state.profileError='找到同名档案，请联系管理员核对。';
      }else{
        state.profileError='没有找到对应的成长档案，请核对姓名后重试。';
      }
      render();
    });
  }
  $$('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast('链接已复制')}catch(e){toast('复制失败，请手动复制')}})
}
function render(){const route=(location.hash||'#/home').replace(/^#\//,''); const app=$('#app'); const pages={home:homePage,total:()=>rankingPage('total'),activity:()=>rankingPage('activity'),profile:profilePage,intro:introPage,gallery:galleryPage,signup:signupPage}; app.innerHTML=(pages[route]||pages.home)(); bindPage(route); window.scrollTo({top:0,behavior:'instant'})}
let lastRoute=(location.hash||'#/home').replace(/^#\//,'');
window.addEventListener('hashchange',()=>{
  const route=(location.hash||'#/home').replace(/^#\//,'');
  if(route==='profile' && lastRoute!=='profile'){
    state.selectedChild=null;state.profileDraft='';state.profileSearched=false;state.profileError='';
  }
  lastRoute=route;
  render();
});
async function refreshCloudIfChanged(){
  if(!window.MeideCloud?.configured() || document.visibilityState!=='visible') return;
  const route=(location.hash||'#/home').replace(/^#\//,'');
  if(!['total','activity','profile'].includes(route)) return;
  try {
    const data=await window.MeideCloud.loadPublic({preferLive:true,timeoutMs:4500});
    const previous=JSON.stringify([state.children,state.activities,state.ledger,state.dataSource,state.lastSyncedAt]);
    if(JSON.stringify([data.children,data.activities,data.ledger,data.source,data.updatedAt])===previous) return;
    const y=window.scrollY, query=$('#searchInput')?.value||'';
    state.children=data.children;
    state.activities=data.activities;
    state.ledger=data.ledger;
    state.dataSource=data.source||"live";
    state.lastSyncedAt=data.updatedAt||null;
    if(!state.activities.some(a=>a.id===state.selectedActivity))state.selectedActivity=state.activities[0]?.id||null;
    if(!state.children.some(a=>a.id===state.selectedChild && a.active!==false && (a.participant_type||'child')==='child'))state.selectedChild=null;
    if(state.selectedChild && state.profileSearched){
      const selected=state.children.find(c=>c.id===state.selectedChild);
      if(!selected || selected.name!==state.profileDraft)state.selectedChild=null;
    }
    render();
    const search=$('#searchInput');
    if(search&&query){search.value=query;search.dispatchEvent(new Event('input'));}
    window.scrollTo(0,y);
  }catch(e){console.warn('云端积分刷新失败',e);}
}
document.addEventListener('DOMContentLoaded', async()=>{
  $('#menuBtn').onclick=()=>$('#nav').classList.toggle('open');
  try{await loadData();render();}
  catch(e){
    console.error('美德少年数据加载失败',e);
    $('#app').innerHTML='<div class="container" style="padding:44px 20px;text-align:center"><h2>数据暂时无法加载</h2><p>请稍后刷新重试，积分数据并未丢失。</p><button class="btn btn-primary" onclick="location.reload()">重新加载</button></div>';
  }
  if(window.MeideCloud?.configured() && window.MeideCloud.liveUpdatesEnabled) {
    // CloudBase HTTP 只读接口；无须旧 Supabase 的 SDK、订阅或登录态。
    // 在总榜、活动榜及成长档案每 15 秒自动校验一次最新积分。
    void refreshCloudIfChanged();
    setInterval(refreshCloudIfChanged,15000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshCloudIfChanged();});
    window.addEventListener('hashchange',()=>{void refreshCloudIfChanged();});
  }
});
