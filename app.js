const state={children:[],activities:[],ledger:[],gallery:[],settings:{},selectedActivity:null,selectedChild:null};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtDate=v=>{if(!v) return ''; const d=new Date(v+'T00:00:00'); return isNaN(d)?v:`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`};
const AVATARS=Array.from({length:20},(_,i)=>`assets/avatar_${String(i+1).padStart(2,'0')}.jpg`);
const avatarOf=c=>c.avatar||AVATARS[Math.abs(hashCode(c.id||c.name))%AVATARS.length];
const hashCode=s=>[...String(s)].reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0,0);
const byId=(arr,id)=>arr.find(x=>x.id===id);
function toast(msg){const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1600)}
async function loadData(){
  const files=['children','activities','ledger','gallery','settings'];
  const vals=await Promise.all(files.map(f=>fetch(`data/${f}.json?${Date.now()}`).then(r=>r.json())));
  state.children=vals[0]; state.activities=vals[1]; state.ledger=vals[2]; state.gallery=vals[3]; state.settings=vals[4];
  state.selectedActivity=state.activities[0]?.id || null;
  state.selectedChild=state.children[0]?.id || null;
}
function totals(activityId=null){
  const rows=state.children.filter(c=>c.active!==false).map(c=>({child:c,points:0,activities:new Set(),count:0}));
  const map=new Map(rows.map(r=>[r.child.id,r]));
  state.ledger.forEach(l=>{if(activityId && l.activityId!==activityId) return; const r=map.get(l.childId); if(!r) return; r.points+=Number(l.points)||0; r.activities.add(l.activityId); r.count++;});
  return rows.map(r=>({...r,activities:r.activities.size})).sort((a,b)=>b.points-a.points||a.child.name.localeCompare(b.child.name,'zh-CN'));
}
function homePage(){return `
<section class="home-hero">
  <div class="home-inner">
    <img src="assets/mascot.png" class="hero-mascot" alt="芽芽">
    <div class="kicker">🌱 美德少年成长计划</div>
    <h1 class="home-title">${esc(state.settings.projectTitle||'美德少年成长积分榜')}</h1>
    <p class="home-sub">${esc(state.settings.tagline||'每一次参与，都在记录成长')}</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#/total">查看总榜</a>
      <a class="btn btn-secondary" href="#/activity">查看活动榜</a>
      <a class="btn btn-green" href="#/signup">报名入口</a>
    </div>
    <div class="feature-grid">
      <a class="feature-card" href="#/intro"><img src="assets/intro_icon.png" alt=""><h3>系列活动介绍</h3><p>了解项目定位、成长机制与活动价值。</p></a>
      <a class="feature-card" href="#/gallery"><img src="assets/gallery_icon.png" alt=""><h3>往期精彩</h3><p>查看活动后整理上传的照片与成长瞬间。</p></a>
      <a class="feature-card" href="#/profile"><img src="assets/profile_icon.png" alt=""><h3>成长档案</h3><p>积分流水、参与活动、个人成长记录一目了然。</p></a>
    </div>
  </div>
</section>`}
function rankingPage(kind='total'){
  const isActivity=kind==='activity';
  const activityId=isActivity?state.selectedActivity:null;
  const rows=totals(activityId);
  const act=byId(state.activities,activityId);
  const headBg=isActivity?'assets/activity_head.jpg':'assets/total_head.jpg';
  const activityLabel=act?`${fmtDate(act.date)} · ${act.title}`:'请选择活动';
  return `
  <section class="page-shell ${isActivity?'activity-page':'total-page'}">
    <div class="banner-wrap ranking-hero ${isActivity?'activity-hero':'total-hero'}">
      <img class="banner-desktop" src="${headBg}" alt="${isActivity?'活动榜':'总榜'}头图">
      <img class="banner-mobile" src="${headBg}" alt="${isActivity?'活动榜':'总榜'}头图">
    </div>
    <div class="ranking-bg">
      <div class="ranking-card">
        <div class="ranking-toolbar-top ${isActivity?'activity':''}">
          ${isActivity?`<select id="actSel" class="select activity-select">${state.activities.map(a=>`<option value="${a.id}" ${a.id===activityId?'selected':''}>${esc(fmtDate(a.date)+' '+a.title)}</option>`).join('')}</select>`:''}
          ${isActivity?`<div class="activity-meta-line">${esc(activityLabel)}</div>`:`<div class="activity-meta-line total-meta-line">汇总全部活动积分流水</div>`}
        </div>
        ${podiumHtml(rows.slice(0,3))}
        <div class="search-row"><input id="searchInput" class="search long-search" placeholder="搜索孩子姓名"></div>
        <div class="table-wrap">${tableHtml(rows)}</div>
      </div>
      <div class="ranking-footer">
        <img class="footer-desktop" src="${isActivity?'assets/activity_footer.png':'assets/total_footer.png'}" alt="尾图">
        <img class="footer-mobile" src="${isActivity?'assets/activity_footer.png':'assets/total_footer.png'}" alt="尾图">
      </div>
    </div>
  </section>`}
function podiumHtml(rows){const order=[1,0,2],cls=['second','first','third']; return `<div class="podium">${order.map((idx,i)=>{const r=rows[idx]; if(!r)return '<div></div>'; return `<div class="podium-item ${cls[i]}"><div class="medal">${idx+1}</div><img class="avatar" src="${avatarOf(r.child)}" alt=""><strong>${esc(r.child.name)}</strong><div class="p-score">${r.points} 分</div><div class="p-meta">参与 ${r.activities} 场活动</div></div>`}).join('')}</div>`}
function tableHtml(rows){ if(!rows.length) return `<div class="empty"><img src="assets/no_photo.png" alt=""><div>暂时还没有积分记录</div></div>`; return `<table class="rank-table"><thead><tr><th>排名</th><th>姓名</th><th>参与活动</th><th>积分</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-name="${esc(r.child.name)}"><td><span class="rank-num">${String(i+1).padStart(2,'0')}</span></td><td>${esc(r.child.name)}</td><td>参加 ${r.activities} 场</td><td class="score">${r.points} 分</td></tr>`).join('')}</tbody></table>`}
function profilePage(){const child=byId(state.children,state.selectedChild)||state.children[0]; if(!child)return ''; const entries=state.ledger.filter(x=>x.childId===child.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))); const total=entries.reduce((s,e)=>s+(+e.points||0),0); const acts=new Set(entries.map(x=>x.activityId)).size; return `
<section>
  <div class="banner-wrap ranking-hero profile-hero">
    <img class="banner-desktop" src="assets/profile_head.jpg" alt="成长档案头图">
    <img class="banner-mobile" src="assets/profile_head.jpg" alt="成长档案头图">
  </div>
  <div class="content-pad"><div class="container profile-layout">
    <aside class="aside-box"><strong>选择孩子</strong><div class="child-list">${state.children.map(c=>`<button class="child-btn ${c.id===child.id?'active':''}" data-child="${c.id}">${esc(c.name)}</button>`).join('')}</div></aside>
    <section class="main-box"><div class="profile-head"><img class="avatar" src="${avatarOf(child)}" alt=""><div><h2 style="margin:0 0 6px">${esc(child.name)}</h2><div class="meta">个人成长记录</div></div></div>
      <div class="stat-grid"><div class="stat">累计积分<b>${total}</b></div><div class="stat">参与活动<b>${acts}</b></div><div class="stat">积分记录<b>${entries.length}</b></div></div>
      <h3>积分流水</h3><div class="timeline">${entries.length?entries.map(e=>{const a=byId(state.activities,e.activityId); return `<div class="event"><strong>${e.points>=0?'+':''}${e.points} 分 · ${esc(e.reason)}</strong><div>${esc(a?.title||'未命名活动')}</div><div class="meta">${fmtDate(e.date)} · 录入：${esc(e.operator||'管理员')}</div></div>`}).join(''):`<div class="empty"><img src="assets/loading_photo.png" alt=""><div>还没有成长记录</div></div>`}</div>
    </section>
  </div></div>
</section>`}
function introPage(){return `<section><div class="section-hero"><div class="container"><h1>系列活动介绍</h1><p>让孩子在公益、实践、协作与表达中，看见自己一步步的成长。</p></div></div><div class="content-pad"><div class="container intro-grid"><article class="card"><h2>什么是美德少年成长积分榜？</h2><p>这是一个用于记录系列活动参与情况的成长展示平台。每位孩子参加活动、完成任务、展现合作与责任，都会以“积分流水”的方式沉淀下来，最终自动汇总到总榜和活动榜中。</p><p>第一版平台以“公开展示 + 管理员统一维护”为主：公众可查看榜单和成长档案，管理员负责活动结束后录入积分、上传精选照片、更新报名入口。</p><div class="notice"><strong>当前建议使用方式</strong><p class="meta">活动现场照片直播可以继续使用喔图；网站主要负责长期沉淀积分、活动介绍、往期精彩和成长记录。</p></div></article><div class="point-list"><div class="point"><b>🌱 长期积累</b><div class="meta">每场活动积分自动汇总到总榜。</div></div><div class="point"><b>🏅 活动展示</b><div class="meta">每一场活动都能单独生成活动榜。</div></div><div class="point"><b>📒 成长档案</b><div class="meta">查看单个孩子的参与与积分流水。</div></div><div class="point"><b>📷 往期精彩</b><div class="meta">活动结束后上传精选照片长期保留。</div></div></div></div></div></section>`}
function galleryPage(){return `<section><div class="section-hero"><div class="container"><h1>往期精彩</h1><p>活动现场先看喔图直播，活动结束后精选照片会整理到这里。</p></div></div><div class="content-pad"><div class="container"><div class="gallery-grid">${(state.gallery.length?state.gallery:[{title:'活动相册待更新',date:'',cover:'assets/photo_placeholder.png',desc:'管理员上传精选照片后，会在这里自动显示。'}]).map(g=>`<article class="photo-card"><div class="photo-thumb"><img src="${g.cover||'assets/photo_placeholder.png'}" alt=""></div><div class="photo-body"><h3>${esc(g.title)}</h3><p>${g.date?fmtDate(g.date)+' · ':''}${esc(g.desc||'活动精选照片')}</p></div></article>`).join('')}</div></div></div></section>`}
function signupPage(){return `<section><div class="section-hero"><div class="container"><h1>报名入口</h1><p>管理员可随时把新的公众号推文链接、喔图直播链接更新到这里。</p></div></div><div class="content-pad"><div class="container"><div class="card"><div class="notice"><strong>活动通知</strong><p class="meta">${esc(state.settings.announcement||'暂无新的活动通知')}</p></div><div style="height:18px"></div><h2>当前报名入口</h2><div class="link-row">${state.settings.registrationUrl?`<a class="btn btn-primary" target="_blank" rel="noopener" href="${esc(state.settings.registrationUrl)}">打开报名推文</a><button class="btn btn-ghost" data-copy="${esc(state.settings.registrationUrl)}">复制链接</button>`:'<span class="meta">当前暂无报名链接</span>'}</div><hr style="border:0;border-top:1px solid var(--line);margin:26px 0"><h2>喔图直播</h2><div class="link-row">${state.settings.photoLiveUrl?`<a class="btn btn-green" target="_blank" rel="noopener" href="${esc(state.settings.photoLiveUrl)}">打开喔图直播</a><button class="btn btn-ghost" data-copy="${esc(state.settings.photoLiveUrl)}">复制链接</button>`:'<span class="meta">当前暂无喔图直播链接</span>'}</div></div></div></div></section>`}
function bindPage(routeName){
  $$('.nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#/${routeName}`));
  const input=$('#searchInput'); if(input){input.oninput=()=>$$('.rank-table tbody tr').forEach(tr=>tr.style.display=!input.value||tr.dataset.name.includes(input.value)?'':'none')}
  const sel=$('#actSel'); if(sel){sel.onchange=()=>{state.selectedActivity=sel.value; render()}}
  $$('[data-child]').forEach(b=>b.onclick=()=>{state.selectedChild=b.dataset.child; render()})
  $$('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast('链接已复制')}catch(e){toast('复制失败，请手动复制')}})
}
function render(){const route=(location.hash||'#/home').replace(/^#\//,''); const app=$('#app'); const pages={home:homePage,total:()=>rankingPage('total'),activity:()=>rankingPage('activity'),profile:profilePage,intro:introPage,gallery:galleryPage,signup:signupPage}; app.innerHTML=(pages[route]||pages.home)(); bindPage(route); window.scrollTo({top:0,behavior:'instant'})}
window.addEventListener('hashchange',render);
document.addEventListener('DOMContentLoaded', async()=>{ $('#menuBtn').onclick=()=>$('#nav').classList.toggle('open'); await loadData(); render(); });
