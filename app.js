(function(){
  'use strict';

  var state = {
    children: [],
    activities: [],
    ledger: [],
    gallery: [],
    settings: {},
    selectedActivity: null,
    selectedChild: null
  };

  var demoFallback = {
    children:[
      {id:'c001',name:'林乐乐',avatar:'',active:true},
      {id:'c002',name:'陈星星',avatar:'',active:true},
      {id:'c003',name:'周可可',avatar:'',active:true},
      {id:'c004',name:'王小满',avatar:'',active:true},
      {id:'c005',name:'刘安安',avatar:'',active:true}
    ],
    activities:[
      {id:'a001',title:'关爱困境儿童公益社会实践',date:'2026-10-07',status:'finished'},
      {id:'a002',title:'亲子成长社会实践挑战',date:'2026-09-20',status:'finished'}
    ],
    ledger:[
      {id:'l001',childId:'c001',activityId:'a001',points:35,reason:'完成公益实践任务',operator:'示例管理员',date:'2026-10-07'},
      {id:'l002',childId:'c002',activityId:'a001',points:28,reason:'完成公益实践任务',operator:'示例管理员',date:'2026-10-07'},
      {id:'l003',childId:'c003',activityId:'a001',points:31,reason:'完成公益实践任务',operator:'示例管理员',date:'2026-10-07'},
      {id:'l004',childId:'c001',activityId:'a002',points:18,reason:'亲子协作任务',operator:'示例管理员',date:'2026-09-20'},
      {id:'l005',childId:'c004',activityId:'a002',points:26,reason:'亲子协作任务',operator:'示例管理员',date:'2026-09-20'},
      {id:'l006',childId:'c005',activityId:'a002',points:20,reason:'亲子协作任务',operator:'示例管理员',date:'2026-09-20'}
    ],
    gallery:[],
    settings:{projectTitle:'美德少年成长积分榜',tagline:'每一次参与，都在记录成长',registrationUrl:'',photoLiveUrl:'',announcement:'当前为演示数据，正式数据将由管理员维护。'}
  };

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function fmtDate(v){
    if(!v) return '';
    var d = new Date(v + (String(v).length === 10 ? 'T00:00:00' : ''));
    if(isNaN(d.getTime())) return v;
    return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
  }
  function avatarOf(child){
    return child && child.avatar ? child.avatar : './assets/default-avatar.svg';
  }
  function byId(list,id){ return list.find(function(x){return x.id===id;}); }

  async function loadJson(path){
    var res = await fetch(path + '?v=' + Date.now(), {cache:'no-store'});
    if(!res.ok) throw new Error(path);
    return await res.json();
  }

  async function loadData(){
    try{
      var data = await Promise.all([
        loadJson('./data/children.json'),
        loadJson('./data/activities.json'),
        loadJson('./data/ledger.json'),
        loadJson('./data/gallery.json'),
        loadJson('./data/settings.json')
      ]);
      state.children = data[0];
      state.activities = data[1];
      state.ledger = data[2];
      state.gallery = data[3];
      state.settings = data[4];
    }catch(err){
      console.warn('使用演示回退数据',err);
      state.children = demoFallback.children;
      state.activities = demoFallback.activities;
      state.ledger = demoFallback.ledger;
      state.gallery = demoFallback.gallery;
      state.settings = demoFallback.settings;
    }
    state.selectedActivity = state.activities[0] ? state.activities[0].id : null;
    state.selectedChild = state.children[0] ? state.children[0].id : null;
  }

  function totals(activityId){
    var rows = {};
    state.children.filter(function(c){return c.active !== false;}).forEach(function(c){
      rows[c.id] = {child:c,points:0,activityIds:new Set(),records:0};
    });
    state.ledger.forEach(function(e){
      if(activityId && e.activityId !== activityId) return;
      if(!rows[e.childId]) return;
      rows[e.childId].points += Number(e.points)||0;
      rows[e.childId].records += 1;
      if(e.activityId) rows[e.childId].activityIds.add(e.activityId);
    });
    return Object.keys(rows).map(function(k){
      var r=rows[k];
      return {child:r.child,points:r.points,activities:r.activityIds.size,records:r.records};
    }).sort(function(a,b){
      if(b.points!==a.points) return b.points-a.points;
      return a.child.name.localeCompare(b.child.name,'zh-CN');
    });
  }

  function podiumHtml(rows){
    var order=[1,0,2];
    var labels=['second','first','third'];
    return '<div class="podium">' + order.map(function(index,i){
      var row=rows[index];
      if(!row) return '<div></div>';
      return '<div class="podium-card '+labels[i]+'">' +
        '<span class="rank-badge">'+(index+1)+'</span>' +
        '<img class="avatar" src="'+esc(avatarOf(row.child))+'" alt="">' +
        '<strong>'+esc(row.child.name)+'</strong>' +
        '<div class="points">'+row.points+' 分</div>' +
        '<div class="muted small">参与 '+row.activities+' 场活动</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function tableHtml(rows){
    if(!rows.length) return '<div class="rank-empty"><img class="empty-art" src="./assets/empty.svg" alt=""><p>暂时还没有积分记录</p></div>';
    return '<table class="rank-table"><thead><tr><th>排名</th><th>姓名</th><th>参与活动</th><th>积分</th></tr></thead><tbody>' +
      rows.map(function(r,i){
        return '<tr data-name="'+esc(r.child.name)+'">' +
          '<td><span class="rank-num">'+String(i+1).padStart(2,'0')+'</span></td>' +
          '<td>'+esc(r.child.name)+'</td>' +
          '<td>参加 '+r.activities+' 场</td>' +
          '<td class="score-cell">'+r.points+' 分</td>' +
        '</tr>';
      }).join('') +
    '</tbody></table>';
  }

  function renderHome(){
    var title=state.settings.projectTitle||'美德少年成长积分榜';
    var tagline=state.settings.tagline||'每一次参与，都在记录成长';
    return '<section class="hero page">' +
      '<div class="hero-inner">' +
        '<img class="hero-mascot" src="./assets/mascot.svg" alt="芽芽">' +
        '<div class="hero-kicker">🌱 美德少年成长计划</div>' +
        '<h1>'+esc(title)+'</h1>' +
        '<p class="hero-subtitle">'+esc(tagline)+'</p>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="#/total">查看总榜 →</a>' +
          '<a class="btn btn-secondary" href="#/activity">活动榜单 →</a>' +
        '</div>' +
        '<div class="home-grid">' +
          '<a class="feature-card" href="#/intro"><div class="feature-icon">📖</div><h3>系列活动介绍</h3><p>了解美德少年社会实践挑战的长期成长体系。</p></a>' +
          '<a class="feature-card" href="#/gallery"><div class="feature-icon">📷</div><h3>往期精彩</h3><p>查看活动照片与成长瞬间，活动结束后持续更新。</p></a>' +
          '<a class="feature-card" href="#/signup"><div class="feature-icon">🚩</div><h3>报名入口</h3><p>查看当前活动报名推文与喔图直播入口。</p></a>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function rankingPage(kind){
    var activityId = kind==='activity' ? state.selectedActivity : null;
    var rows=totals(activityId);
    var activity=byId(state.activities,activityId);
    var title=kind==='activity'?'美德少年活动积分榜':'美德少年成长积分榜';
    var subtitle=kind==='activity' && activity ? fmtDate(activity.date)+' · '+activity.title : '点滴积累 · 看见成长';
    var selector='';
    if(kind==='activity'){
      selector='<select id="activity-select" class="select-box" aria-label="选择活动">' +
        state.activities.map(function(a){
          return '<option value="'+esc(a.id)+'" '+(a.id===activityId?'selected':'')+'>'+esc(fmtDate(a.date)+' '+a.title)+'</option>';
        }).join('') + '</select>';
    }
    return '<section class="page">' +
      '<div class="section-hero festive"><div class="container"><span class="badge badge-red">'+(kind==='activity'?'活动榜':'总榜')+'</span><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></div></div>' +
      '<div class="ranking-wrap"><div class="rank-panel">' +
        '<div class="rank-toolbar"><div>'+selector+'</div><input id="rank-search" class="search-box" placeholder="搜索孩子姓名" aria-label="搜索孩子姓名"></div>' +
        podiumHtml(rows.slice(0,3)) +
        '<div id="rank-table-wrap">'+tableHtml(rows)+'</div>' +
      '</div><div class="rank-footer-art"></div></div>' +
    '</section>';
  }

  function renderProfile(){
    var child=byId(state.children,state.selectedChild) || state.children[0];
    if(!child) return '<section class="content-page"><div class="container"><div class="paper-card">暂无孩子资料</div></div></section>';
    var entries=state.ledger.filter(function(e){return e.childId===child.id;}).sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
    var total=entries.reduce(function(s,e){return s+(Number(e.points)||0);},0);
    var activityCount=new Set(entries.map(function(e){return e.activityId;})).size;
    var list=state.children.filter(function(c){return c.active!==false;}).map(function(c){
      return '<button class="child-btn '+(c.id===child.id?'active':'')+'" data-child="'+esc(c.id)+'">'+esc(c.name)+'</button>';
    }).join('');
    var timeline=entries.length?entries.map(function(e){
      var a=byId(state.activities,e.activityId);
      return '<div class="timeline-item"><strong>'+esc((e.points>=0?'+':'')+e.points+' 分 · '+(e.reason||'成长积分'))+'</strong><div>'+esc(a?a.title:'未命名活动')+'</div><div class="meta">'+esc(fmtDate(e.date))+' · 录入：'+esc(e.operator||'管理员')+'</div></div>';
    }).join(''):'<div class="rank-empty">暂无成长记录</div>';
    return '<section class="page">' +
      '<div class="section-hero"><div class="container"><h1>成长档案</h1><p>每一次参与、每一笔积分，都留下一条可追溯的成长记录。</p></div></div>' +
      '<div class="container profile-layout">' +
        '<aside class="profile-sidebar"><strong>选择孩子</strong><div class="child-list">'+list+'</div></aside>' +
        '<div class="profile-main">' +
          '<div class="profile-head"><img class="avatar" src="'+esc(avatarOf(child))+'" alt=""><div><h2 style="margin:0 0 6px">'+esc(child.name)+'</h2><span class="badge">成长档案</span></div></div>' +
          '<div class="stat-grid"><div class="stat-card">累计积分<b>'+total+'</b></div><div class="stat-card">参与活动<b>'+activityCount+'</b></div><div class="stat-card">积分记录<b>'+entries.length+'</b></div></div>' +
          '<h3>积分流水</h3><div class="timeline">'+timeline+'</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function renderIntro(){
    return '<section class="page"><div class="section-hero"><div class="container"><h1>系列活动介绍</h1><p>让孩子在真实的社会实践里看见自己、帮助别人，也留下可持续积累的成长记录。</p></div></div>' +
      '<div class="content-page"><div class="container intro-grid">' +
        '<article class="paper-card"><h2>美德少年成长计划</h2><p>项目通过持续开展社会实践、公益行动、亲子协作与成长挑战，将一次次参与转化为看得见的成长积分和个人成长档案。</p><p>积分并不是为了给孩子贴标签，而是用于记录参与、坚持、合作与责任感。每一笔积分都对应具体活动与原因，并保留流水。</p><div class="notice-card"><strong>当前网站为第一版</strong><p class="muted">第一版先使用 GitHub 维护公开展示数据，不在公开仓库保存家长手机号、学校、年龄等敏感资料。</p></div></article>' +
        '<div class="intro-points"><div class="info-chip"><b>🌱 长期积累</b><br><span class="muted">不同活动的成长积分汇入总榜。</span></div><div class="info-chip"><b>🧭 真实实践</b><br><span class="muted">积分与具体活动、任务和行为记录关联。</span></div><div class="info-chip"><b>📒 可追溯流水</b><br><span class="muted">加分不直接改总分，而是新增一条积分记录。</span></div><div class="info-chip"><b>📷 成长瞬间</b><br><span class="muted">活动后精选照片进入往期精彩。</span></div></div>' +
      '</div></div></section>';
  }

  function renderGallery(){
    var cards='';
    if(state.gallery.length){
      cards=state.gallery.map(function(g){
        var cover=g.cover||'./assets/photo-placeholder.svg';
        return '<article class="album-card"><div class="album-cover"><img src="'+esc(cover)+'" onerror="this.src=\'./assets/photo-placeholder.svg\'" alt=""></div><div class="album-body"><h3>'+esc(g.title)+'</h3><p>'+esc(fmtDate(g.date))+' · '+((g.photos||[]).length)+' 张精选照片</p></div></article>';
      }).join('');
    }else{
      cards='<article class="album-card"><div class="album-cover"><img src="./assets/photo-placeholder.svg" alt=""></div><div class="album-body"><h3>活动相册正在整理</h3><p>活动结束后会在这里更新精选照片。</p></div></article>';
    }
    return '<section class="page"><div class="section-hero"><div class="container"><h1>往期精彩</h1><p>活动现场先通过喔图直播查看，活动结束后再在这里沉淀精选照片。</p></div></div><div class="content-page"><div class="container"><div class="gallery-grid">'+cards+'</div></div></div></section>';
  }

  function renderSignup(){
    var reg=state.settings.registrationUrl||'';
    var live=state.settings.photoLiveUrl||'';
    return '<section class="page"><div class="section-hero"><div class="container"><h1>报名与活动入口</h1><p>管理员会根据当前活动随时更新入口。</p></div></div><div class="content-page"><div class="container"><div class="paper-card">' +
      '<div class="notice-card"><strong>当前活动</strong><p class="muted">'+esc(state.settings.announcement||'暂无新的活动通知')+'</p></div>' +
      '<div style="height:18px"></div>' +
      '<h2>报名入口</h2><div class="link-panel">'+(reg?'<a class="btn btn-primary" target="_blank" rel="noopener" href="'+esc(reg)+'">打开报名推文</a><button class="btn btn-ghost copy-link" data-copy="'+esc(reg)+'">复制链接</button>':'<span class="muted">暂未开放报名</span>')+'</div>' +
      '<hr style="border:0;border-top:1px solid var(--line);margin:28px 0">' +
      '<h2>喔图直播</h2><div class="link-panel">'+(live?'<a class="btn btn-green" target="_blank" rel="noopener" href="'+esc(live)+'">查看本场照片直播</a><button class="btn btn-ghost copy-link" data-copy="'+esc(live)+'">复制链接</button>':'<span class="muted">当前没有正在进行的照片直播</span>')+'</div>' +
    '</div></div></div></section>';
  }

  function route(){
    var path=(location.hash||'#/home').replace(/^#/,'');
    $all('.main-nav a').forEach(function(a){a.classList.toggle('active',a.getAttribute('href')===('#'+path));});
    var html='';
    if(path==='/total') html=rankingPage('total');
    else if(path==='/activity') html=rankingPage('activity');
    else if(path==='/profile') html=renderProfile();
    else if(path==='/intro') html=renderIntro();
    else if(path==='/gallery') html=renderGallery();
    else if(path==='/signup') html=renderSignup();
    else html=renderHome();
    $('#app').innerHTML=html;
    bindPageEvents(path);
    window.scrollTo({top:0,behavior:'instant'});
    $('#main-nav').classList.remove('open');
  }

  function bindPageEvents(path){
    var act=$('#activity-select');
    if(act){
      act.addEventListener('change',function(){state.selectedActivity=act.value;route();});
    }
    var search=$('#rank-search');
    if(search){
      search.addEventListener('input',function(){
        var q=search.value.trim();
        $all('.rank-table tbody tr').forEach(function(tr){
          tr.style.display=(!q||tr.getAttribute('data-name').indexOf(q)>-1)?'':'none';
        });
      });
    }
    $all('[data-child]').forEach(function(btn){
      btn.addEventListener('click',function(){state.selectedChild=btn.getAttribute('data-child');route();});
    });
    $all('.copy-link').forEach(function(btn){
      btn.addEventListener('click',async function(){
        try{await navigator.clipboard.writeText(btn.getAttribute('data-copy'));showToast('链接已复制');}
        catch(e){showToast('请长按或手动复制链接');}
      });
    });
  }

  function showToast(msg){
    var el=$('.toast');
    if(!el){el=document.createElement('div');el.className='toast';document.body.appendChild(el);}
    el.textContent=msg;el.classList.add('show');
    setTimeout(function(){el.classList.remove('show');},1600);
  }

  document.addEventListener('DOMContentLoaded',async function(){
    $('#nav-toggle').addEventListener('click',function(){$('#main-nav').classList.toggle('open');});
    await loadData();
    route();
    window.addEventListener('hashchange',route);
  });
})();