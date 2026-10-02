const state={children:[],activities:[],ledger:[],gallery:[],settings:{},selectedActivity:null,selectedChild:null};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtDate=v=>{if(!v) return ''; const d=new Date(v+'T00:00:00'); return isNaN(d)?v:`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`};
const avatarOf=c=>c.avatar||['assets/avatar_boy1.png','assets/avatar_boy2.png','assets/avatar_girl1.png','assets/avatar_girl2.png'][Math.abs(hashCode(c.id||c.name))%4];
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
  const headPc=isActivity?'assets/activity_pc_head.png':'assets/total_pc_head.png';
  const headM=isActivity?'assets/activity_mobile_head.png':'assets/total_mobile_head.png';
  const heroTitle=isActivity?'美德少年活动积分榜':'美德少年成长积分榜';
  const heroSub=isActivity?'活动积分 · 实时更新':'点滴积累 · 看见成长';
  const contextTitle=isActivity
    ? (act?`${fmtDate(act.date)} · ${act.title}`:'请选择活动')
    : '累计成长积分总榜';

  return `
  <section class="page-shell">
    <div class="banner-wrap ${isActivity?'activity-banner':'total-banner'}">
      <img class="banner-desktop" src="${headPc}" alt="${heroTitle}">
      <img class="banner-mobile" src="${headM}" alt="${heroTitle}">
      <div class="banner-copy">
        ${!isActivity
          ? `<img class="hero-title-image" src="assets/total_title.png?v=20261002e" alt="${heroTitle}"><div class="hero-title-sub">${heroSub}</div>`
          : ''
        }
      </div>
      ${isActivity ? `<div class="activity-title-force"><img src="data:image/webp;base64,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" alt="${heroTitle}"></div>` : ''}
    </div>

    <div class="ranking-bg">
      <div class="ranking-card">
        ${isActivity ? `
          <div class="activity-filter-row">
            <select id="actSel" class="select activity-select">${state.activities.map(a=>`<option value="${a.id}" ${a.id===activityId?'selected':''}>${esc(fmtDate(a.date)+' '+a.title)}</option>`).join('')}</select>
          </div>
        ` : ''}

        ${podiumHtml(rows.slice(0,3))}

        <div class="ranking-search-row">
          <input id="searchInput" class="search ranking-search" placeholder="搜索孩子姓名">
        </div>

        <div class="table-wrap">${tableHtml(rows)}</div>
      </div>

      <div class="ranking-footer">
        <img class="footer-desktop" src="assets/footer_slogan.png?v=20261002c" alt="成长寄语">
        <div class="footer-mobile-crop">
          <img class="footer-mobile" src="assets/mobile_tail.png?v=20261002c" alt="成长寄语">
        </div>
      </div>
    </div>
  </section>`
}
function podiumHtml(rows){const order=[1,0,2],cls=['second','first','third']; return `<div class="podium">${order.map((idx,i)=>{const r=rows[idx]; if(!r)return '<div></div>'; return `<div class="podium-item ${cls[i]}"><div class="medal">${idx+1}</div><img class="avatar" src="${avatarOf(r.child)}" alt=""><strong>${esc(r.child.name)}</strong><div class="p-score">${r.points} 分</div><div class="p-meta">参与 ${r.activities} 场活动</div></div>`}).join('')}</div>`}
function tableHtml(rows){ if(!rows.length) return `<div class="empty"><img src="assets/no_photo.png" alt=""><div>暂时还没有积分记录</div></div>`; return `<table class="rank-table"><thead><tr><th>排名</th><th>姓名</th><th>参与活动</th><th>积分</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-name="${esc(r.child.name)}"><td><span class="rank-num">${String(i+1).padStart(2,'0')}</span></td><td>${esc(r.child.name)}</td><td>参加 ${r.activities} 场</td><td class="score">${r.points} 分</td></tr>`).join('')}</tbody></table>`}
function profilePage(){const child=byId(state.children,state.selectedChild)||state.children[0]; if(!child)return ''; const entries=state.ledger.filter(x=>x.childId===child.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))); const total=entries.reduce((s,e)=>s+(+e.points||0),0); const acts=new Set(entries.map(x=>x.activityId)).size; return `
<section>
  <div class="section-hero"><div class="container"><h1>成长档案</h1><p>记录每个孩子在系列活动中的参与与成长。</p></div></div>
  <div class="content-pad"><div class="container profile-layout">
    <aside class="aside-box"><strong>选择孩子</strong><div class="child-list">${state.children.map(c=>`<button class="child-btn ${c.id===child.id?'active':''}" data-child="${c.id}">${esc(c.name)}</button>`).join('')}</div></aside>
    <section class="main-box"><div class="profile-head"><img class="avatar" src="${avatarOf(child)}" alt=""><div><h2 style="margin:0 0 6px">${esc(child.name)}</h2><div class="meta">个人成长记录</div></div></div>
      <div class="stat-grid"><div class="stat">累计积分<b>${total}</b></div><div class="stat">参与活动<b>${acts}</b></div><div class="stat">积分记录<b>${entries.length}</b></div></div>
      <h3>积分流水</h3><div class="timeline">${entries.length?entries.map(e=>{const a=byId(state.activities,e.activityId); return `<div class="event"><strong>${e.points>=0?'+':''}${e.points} 分 · ${esc(e.reason)}</strong><div>${esc(a?.title||'未命名活动')}</div><div class="meta">${fmtDate(e.date)} · 录入：${esc(e.operator||'管理员')}</div></div>`}).join(''):`<div class="empty"><img src="assets/loading_photo.png" alt=""><div>还没有成长记录</div></div>`}</div>
    </section>
  </div></div>
</section>`}
function introPage(){return `<section><div class="section-hero"><div class="container"><h1>系列活动介绍</h1><p>让孩子在公益、实践、协作与表达中，看见自己一步步的成长。</p></div></div><div class="content-pad"><div class="container intro-grid"><article class="card"><h2>美德少年成长积分榜</h2><p>通过持续开展社会实践、公益行动、亲子协作与成长挑战，把孩子每一次真实参与沉淀为可追溯的成长记录。</p><p>每一笔积分都对应具体活动和成长表现，既可以查看单场活动排名，也可以在长期总榜和个人成长档案中持续积累。</p></article><div class="point-list"><div class="point"><b>🌱 长期积累</b><div class="meta">每场活动积分自动汇总到总榜。</div></div><div class="point"><b>🏅 活动展示</b><div class="meta">每一场活动都能单独查看活动榜。</div></div><div class="point"><b>📒 成长档案</b><div class="meta">查看参与活动与积分流水。</div></div><div class="point"><b>📷 往期精彩</b><div class="meta">记录活动中的精彩成长瞬间。</div></div></div></div></div></section>`}
function galleryPage(){
  const albums=state.gallery.length?state.gallery:[];
  const cards=albums.length?albums.map((g,index)=>{
    const id=g.id||('album-'+index);
    const photos=Array.isArray(g.photos)?g.photos:[];
    const cover=g.cover||(photos[0]&&(photos[0].src||photos[0]))||'assets/photo_placeholder.png';
    return `<a class="photo-card album-card-link" href="#/gallery/${encodeURIComponent(id)}">
      <div class="photo-thumb"><img src="${esc(cover)}" alt="${esc(g.title||'活动相册')}" onerror="this.src='assets/photo_placeholder.png'"></div>
      <div class="photo-body">
        <div class="album-meta-row"><span class="album-date">${g.date?fmtDate(g.date):''}</span><span class="album-count">${photos.length} 张</span></div>
        <h3>${esc(g.title||'活动相册')}</h3>
        <p>${esc(g.desc||'点击进入查看活动精选照片')}</p>
        <span class="album-open">查看相册 →</span>
      </div>
    </a>`;
  }).join(''):`<div class="gallery-empty card"><img src="assets/no_photo.png" alt=""><h3>还没有往期相册</h3><p class="meta">活动结束后，管理员上传精选照片后会自动出现在这里。</p></div>`;

  return `<section>
    <div class="section-hero"><div class="container"><h1>往期精彩</h1><p>活动现场先看喔图直播，活动结束后精选照片会整理到这里。</p></div></div>
    <div class="content-pad"><div class="container"><div class="gallery-grid">${cards}</div></div></div>
  </section>`
}

function galleryDetailPage(albumId){
  const album=state.gallery.find((g,index)=>(g.id||('album-'+index))===albumId);
  if(!album){
    return `<section><div class="section-hero"><div class="container"><h1>相册不存在</h1><p>这个相册可能已经被移动或删除。</p></div></div><div class="content-pad"><div class="container"><a class="btn btn-ghost" href="#/gallery">← 返回往期精彩</a></div></div></section>`;
  }
  const photos=Array.isArray(album.photos)?album.photos:[];
  const photoHtml=photos.length?photos.map((p,index)=>{
    const photo=typeof p==='string'?{src:p}:p;
    const src=photo.src||'assets/photo_placeholder.png';
    const caption=photo.caption||`第 ${index+1} 张`;
    const children=Array.isArray(photo.children)?photo.children:[];
    return `<button class="gallery-photo" type="button"
      data-photo-src="${esc(src)}"
      data-photo-caption="${esc(caption)}"
      data-photo-children="${esc(children.join('、'))}">
      <img src="${esc(src)}" alt="${esc(caption)}" onerror="this.src='assets/photo_placeholder.png'">
      <span class="gallery-photo-overlay">查看大图</span>
      ${children.length?`<span class="photo-tag">${esc(children.join('、'))}</span>`:''}
    </button>`;
  }).join(''):`<div class="album-empty">
      <img src="assets/no_photo.png" alt="">
      <h3>这场活动的精选照片还没上传</h3>
      <p>等管理员把活动照片放进网站后，这里会自动显示。现场照片仍可通过喔图直播查看。</p>
    </div>`;

  return `<section>
    <div class="section-hero"><div class="container">
      <div class="album-back-row"><a class="btn btn-ghost" href="#/gallery">← 返回往期精彩</a></div>
      <h1>${esc(album.title||'活动相册')}</h1>
      <p>${album.date?fmtDate(album.date)+' · ':''}${esc(album.desc||'活动精选照片')}</p>
    </div></div>
    <div class="content-pad"><div class="container">
      <div class="album-photo-grid">${photoHtml}</div>
    </div></div>
    <div class="photo-modal" id="photoModal" aria-hidden="true">
      <button class="photo-modal-close" type="button" aria-label="关闭">×</button>
      <div class="photo-modal-inner">
        <img id="photoModalImg" src="" alt="">
        <div class="photo-modal-info">
          <strong id="photoModalCaption"></strong>
          <div id="photoModalChildren" class="photo-modal-tags"></div>
        </div>
      </div>
    </div>
  </section>`
}
function signupPage(){return `<section><div class="section-hero"><div class="container"><h1>报名入口</h1><p>管理员可随时把新的公众号推文链接、喔图直播链接更新到这里。</p></div></div><div class="content-pad"><div class="container"><div class="card"><div class="notice"><strong>活动通知</strong><p class="meta">${esc(state.settings.announcement||'暂无新的活动通知')}</p></div><div style="height:18px"></div><h2>当前报名入口</h2><div class="link-row">${state.settings.registrationUrl?`<a class="btn btn-primary" target="_blank" rel="noopener" href="${esc(state.settings.registrationUrl)}">打开报名推文</a><button class="btn btn-ghost" data-copy="${esc(state.settings.registrationUrl)}">复制链接</button>`:'<span class="meta">当前暂无报名链接</span>'}</div><hr style="border:0;border-top:1px solid var(--line);margin:26px 0"><h2>喔图直播</h2><div class="link-row">${state.settings.photoLiveUrl?`<a class="btn btn-green" target="_blank" rel="noopener" href="${esc(state.settings.photoLiveUrl)}">打开喔图直播</a><button class="btn btn-ghost" data-copy="${esc(state.settings.photoLiveUrl)}">复制链接</button>`:'<span class="meta">当前暂无喔图直播链接</span>'}</div></div></div></div></section>`}
function bindPage(routeName){
  $$('.nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#/${routeName}`));
  const input=$('#searchInput'); if(input){input.oninput=()=>$$('.rank-table tbody tr').forEach(tr=>tr.style.display=!input.value||tr.dataset.name.includes(input.value)?'':'none')}
  const sel=$('#actSel'); if(sel){sel.onchange=()=>{state.selectedActivity=sel.value; render()}}
  $$('[data-child]').forEach(b=>b.onclick=()=>{state.selectedChild=b.dataset.child; render()})
  $('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);toast('链接已复制')}catch(e){toast('复制失败，请手动复制')}})

  const modal=$('#photoModal');
  if(modal){
    const modalImg=$('#photoModalImg');
    const modalCaption=$('#photoModalCaption');
    const modalChildren=$('#photoModalChildren');
    $('.gallery-photo').forEach(btn=>btn.onclick=()=>{
      modalImg.src=btn.dataset.photoSrc||'assets/photo_placeholder.png';
      modalCaption.textContent=btn.dataset.photoCaption||'活动照片';
      const tags=btn.dataset.photoChildren||'';
      modalChildren.textContent=tags?('照片中的小朋友：'+tags):'';
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
      document.body.style.overflow='hidden';
    });
    const close=()=>{
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
      document.body.style.overflow='';
    };
    const closeBtn=$('.photo-modal-close');
    if(closeBtn) closeBtn.onclick=close;
    modal.onclick=e=>{if(e.target===modal) close();};
    document.onkeydown=e=>{if(e.key==='Escape'&&modal.classList.contains('open')) close();};
  }
}
function render(){
  const raw=(location.hash||'#/home').replace(/^#\//,'');
  const parts=raw.split('/').filter(Boolean);
  const route=parts[0]||'home';
  const param=parts[1]?decodeURIComponent(parts[1]):null;
  const app=$('#app');
  let html='';
  if(route==='gallery' && param) html=galleryDetailPage(param);
  else{
    const pages={home:homePage,total:()=>rankingPage('total'),activity:()=>rankingPage('activity'),profile:profilePage,intro:introPage,gallery:galleryPage,signup:signupPage};
    html=(pages[route]||pages.home)();
  }
  app.innerHTML=html;
  bindPage(route);
  window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',render);
document.addEventListener('DOMContentLoaded', async()=>{ $('#menuBtn').onclick=()=>$('#nav').classList.toggle('open'); await loadData(); render(); });
