(function(){
  'use strict';
  var baseLedger=[], children=[], activities=[], pending=[];
  function $(s){return document.querySelector(s)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function today(){var d=new Date();return d.toISOString().slice(0,10)}
  function childName(id){var x=children.find(function(c){return c.id===id});return x?x.name:id}
  function activityName(id){var x=activities.find(function(a){return a.id===id});return x?x.title:id}
  async function load(){
    var r=await Promise.all([
      fetch('./data/children.json?'+Date.now()).then(function(x){return x.json()}),
      fetch('./data/activities.json?'+Date.now()).then(function(x){return x.json()}),
      fetch('./data/ledger.json?'+Date.now()).then(function(x){return x.json()})
    ]);
    children=r[0];activities=r[1];baseLedger=r[2];
    $('#child-select').innerHTML=children.filter(function(c){return c.active!==false}).map(function(c){return '<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>'}).join('');
    $('#activity-select-admin').innerHTML=activities.map(function(a){return '<option value="'+esc(a.id)+'">'+esc(a.date+' '+a.title)+'</option>'}).join('');
    $('#date-input').value=today();
    pending=JSON.parse(sessionStorage.getItem('meide_pending_ledger')||'[]');
    render();
  }
  function save(){sessionStorage.setItem('meide_pending_ledger',JSON.stringify(pending));render()}
  function render(){
    var wrap=$('#pending-list');
    if(!pending.length){wrap.innerHTML='<div class="pending-empty"><img src="./assets/empty.svg" alt=""><div>本次还没有新增积分流水</div></div>';return}
    wrap.innerHTML=pending.map(function(e,i){
      return '<div class="pending-item"><b class="p-name">'+esc(childName(e.childId))+'</b><span class="p-activity muted small">'+esc(activityName(e.activityId))+'</span><span class="p-score plus">'+(e.points>=0?'+':'')+e.points+' 分</span><span class="p-reason small">'+esc(e.reason)+' · '+esc(e.operator)+'</span><button data-del="'+i+'">删除</button></div>'
    }).join('');
    document.querySelectorAll('[data-del]').forEach(function(b){b.addEventListener('click',function(){pending.splice(Number(b.dataset.del),1);save()})})
  }
  function toast(msg){var t=document.querySelector('.toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},1600)}
  function uid(){return 'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
  function add(){
    var points=Number($('#points-input').value);
    if(!Number.isFinite(points)||points===0){toast('请输入有效积分');return}
    var reason=$('#reason-input').value.trim();
    var operator=$('#operator-input').value.trim();
    if(!reason){toast('请填写加分原因');return}
    if(!operator){toast('请填写操作人');return}
    pending.push({
      id:uid(),
      childId:$('#child-select').value,
      activityId:$('#activity-select-admin').value,
      points:points,
      reason:reason,
      operator:operator,
      date:$('#date-input').value||today(),
      createdAt:new Date().toISOString()
    });
    $('#reason-input').value='';
    save();
    toast('已加入本次流水');
  }
  function download(){
    var merged=baseLedger.concat(pending);
    var blob=new Blob([JSON.stringify(merged,null,2)+'\n'],{type:'application/json;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download='ledger.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    toast('ledger.json 已生成');
  }
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('[data-points]').forEach(function(b){b.addEventListener('click',function(){$('#points-input').value=b.dataset.points})});
    $('#add-ledger').addEventListener('click',add);
    $('#download-ledger').addEventListener('click',download);
    $('#clear-session').addEventListener('click',function(){if(confirm('确定清空本次尚未提交的流水吗？')){pending=[];save()}});
    load().catch(function(){toast('数据加载失败，请刷新重试')});
  });
})();