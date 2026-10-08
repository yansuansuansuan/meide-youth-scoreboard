(()=>{
  const parts=[1,2,3,4].map(i=>`assets/final_art/total_head_${i}.txt`);
  let dataUrlPromise=null;
  const getDataUrl=()=>{
    if(!dataUrlPromise){
      dataUrlPromise=Promise.all(parts.map(p=>fetch(`${p}?v=20261008a`).then(r=>{if(!r.ok) throw new Error(p);return r.text()})))
        .then(chunks=>`data:image/webp;base64,${chunks.join('')}`);
    }
    return dataUrlPromise;
  };
  async function apply(){
    const total=document.querySelector('.total-page');
    if(!total) return;
    const overlay=total.querySelector('.hero-overlay');
    if(window.matchMedia('(min-width:821px)').matches){
      const img=total.querySelector('.banner-desktop');
      if(!img) return;
      try{
        img.src=await getDataUrl();
        img.style.width='100%';
        img.style.height='auto';
        img.style.maxHeight='none';
        img.style.objectFit='contain';
        img.style.objectPosition='center';
        if(overlay) overlay.style.setProperty('display','none','important');
      }catch(e){console.error('总榜头图加载失败',e)}
    }else if(overlay){
      overlay.style.removeProperty('display');
    }
  }
  const mo=new MutationObserver(()=>apply());
  mo.observe(document.documentElement,{childList:true,subtree:true});
  addEventListener('hashchange',apply);
  addEventListener('resize',apply);
  addEventListener('DOMContentLoaded',apply);
  apply();
})();
