(function(){
 const dividers=document.createElement('style');dividers.textContent=`.nav{gap:13px}.nav button+button{position:relative}.nav button+button::before{content:'';position:absolute;top:-7px;left:50%;width:calc(100% - 44px);height:1px;transform:translateX(-50%);background:linear-gradient(90deg,transparent,#d7bc8c 18%,#d7bc8c 82%,transparent);pointer-events:none}@media(max-width:800px){.nav button+button::before{width:28px}}`;document.head.append(dividers);
 const style=document.createElement('style');style.textContent=`.nav button{display:flex;align-items:center;justify-content:flex-start;gap:14px;min-height:64px}.nav button i{display:flex;align-items:center;justify-content:center;width:44px;flex-shrink:0}.nav button i img{margin:0}.nav button span{display:block;line-height:1.25}.top{height:auto;min-height:72px;gap:16px;flex-wrap:wrap}.seasons{margin-left:auto;display:flex;gap:5px;align-items:center}.season{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 8px;border-radius:8px;min-width:44px}.season.active{background:#d9ecca;outline:2px solid #729765}.season progress{width:45px;height:6px;accent-color:#659050}.season span{font-size:11px}.item,.gift{align-items:center;justify-content:center;gap:12px}.game-icon,.portrait{margin-right:0}.item button{text-align:left}.pet-avatar{width:96px;height:96px;image-rendering:pixelated;background:#e8efd6;border-radius:12px}.farmer-avatar{object-fit:contain}.item-modal{width:min(500px,92vw);max-width:500px;height:auto}.item-modal img{width:48px;height:48px}.item-details{display:flex;align-items:center;gap:18px}.item-details h2{margin:0}.item-fields{display:grid;gap:10px}.item-fields p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;padding:12px;background:#f6efd9;border-radius:8px}`;document.head.append(style);

 function update(d){
  let strip=document.querySelector('.seasons');if(!strip){strip=document.createElement('div');strip.className='seasons';strip.setAttribute('aria-label','Estações do ano');document.querySelector('.top').append(strip);}
  if(strip._season!==d.farm.season){strip.replaceChildren();strip._season=d.farm.season;
   for(const [id,emoji,label] of [['spring','🌸','Primavera'],['summer','☀️','Verão'],['fall','🍂','Outono'],['winter','❄️','Inverno']]){
    const card=document.createElement('div');card.className='season'+(id===d.farm.season?' active':'');const icon=document.createElement('span');icon.textContent=emoji;icon.setAttribute('aria-hidden','true');const title=document.createElement('span');title.textContent=label;card.append(icon,title);
    if(id===d.farm.season){const progress=document.createElement('progress');progress.max=28;progress.setAttribute('aria-label','Progresso da estação');strip._progress=progress;card.append(progress);}strip.append(card);
   }
  }
  const time=d.farm.time||600,minutes=Math.floor(time/100)*60+time%100;strip._progress.value=Math.min(28,Math.max(0,d.farm.day-1+(minutes-360)/1200));strip._progress.title=Math.round(strip._progress.value/28*100)+'% da estação concluída';
  const out=document.querySelector('#saveinfo');if(out&&d.visuals?.pet&&!out.querySelector('.pet-avatar')){const img=document.createElement('img');img.className='pet-avatar';img.src=d.visuals.pet.icon;img.alt='Pet '+d.visuals.pet.name;out.prepend(img);}
 }

 window.addEventListener('guia:update',e=>update(e.detail));
})();
