(function(root){
 const style=document.createElement('style');
 style.textContent=`
 @font-face{font-family:Pixellari;src:url('/Pixellari.ttf') format('truetype');font-style:normal;font-weight:400;font-display:swap}
 .page-title,.sectionhead h2{font-family:Pixellari,monospace;font-size:26px;font-weight:700;line-height:1.3;color:#553822}.page-title{margin:0 0 18px}
 .top{position:sticky;top:0;z-index:5;background:#fff7e5;border-bottom:4px ridge #c3965b;box-shadow:0 3px 8px #49362115}
 .content{max-width:1400px;padding-top:28px}
 .farmer-profile,#saveinfo.farmer-profile{--outfit-hue:38;display:grid;grid-template-columns:minmax(160px,240px) 1fr;gap:24px;padding:28px;background:linear-gradient(135deg,hsl(var(--outfit-hue) 55% 88%),hsl(var(--outfit-hue) 46% 96%));border:6px ridge hsl(var(--outfit-hue) 33% 48%);align-items:start}
 .profile-art{display:flex;flex-direction:column;align-items:center;gap:18px}.profile-card-title{align-self:stretch;text-align:left;margin:0}.profile-art>.profile-field{width:100%}
 .profile-portrait{margin:0;display:flex;flex-direction:column;align-items:center;gap:9px;min-width:0}.profile-portrait figcaption{color:#58382c;font-weight:900;font-size:15px;text-align:center;overflow-wrap:anywhere;max-width:190px}
 .profile-art .farmer-avatar,.profile-art .pet-avatar{image-rendering:pixelated;object-fit:contain;border:5px ridge hsl(var(--outfit-hue) 45% 48%);border-radius:0;background-color:#9ad9ef;background-image:linear-gradient(#fffdf1 0 0),linear-gradient(#fffdf1 0 0),linear-gradient(#e7f7f8 0 0),linear-gradient(#e7f7f8 0 0),linear-gradient(#8bcde8,#cceef7);background-size:34% 5%,22% 9%,28% 5%,16% 9%,100% 100%;background-position:15% 22%,20% 19%,83% 46%,78% 43%,center;background-repeat:no-repeat}
 .profile-art .farmer-avatar{width:160px!important;height:240px!important;padding:12px;box-sizing:content-box}
 .profile-art .pet-avatar{width:80px;height:80px;padding:8px}
 .pet-gallery{display:flex;justify-content:center;flex-wrap:wrap;gap:12px}
 .profile-information{display:grid;gap:18px}.profile-field{display:grid;gap:8px;min-width:0}
 .profile-info,.profile-date{display:flex;align-items:center;gap:14px;padding:14px 16px;border:3px ridge #b88b57;background:#fce9bc}.profile-art .profile-info .profile-field-value{font-weight:900}
 .profile-field-title,.skills-title,.profile-card-title{font-family:Nunito,sans-serif;font-size:18px;font-weight:900;line-height:1.2;color:#553822}.profile-field-value{font-size:15px;line-height:1.4;color:#624634;overflow-wrap:anywhere}.profile-date .profile-field-value{font-weight:900}
 .farm-name{font:700 clamp(20px,2vw,28px)/1.4 Pixellari,monospace;color:#553822;margin:0 0 4px;overflow-wrap:anywhere;text-align:right}.profile-money{justify-content:flex-start}.profile-money img{width:32px;height:32px;object-fit:contain;image-rendering:pixelated}.profile-money .profile-field-value{font-size:18px;font-weight:900}
 .profile-date img{width:42px;height:42px;image-rendering:pixelated;padding:0;border:0;background:transparent;object-fit:contain;box-sizing:content-box}
 .skills-title{margin:4px 0 -6px}.skill-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px}
 .skill-card{display:flex;gap:14px;align-items:center;padding:13px;background:#fce9bc;border:3px ridge #b88043;min-width:0}
 .skill-card img{width:42px;height:42px;image-rendering:pixelated;object-fit:contain;padding:0;border:0;background:transparent;box-sizing:content-box;flex:none}
 .nav .farmer-head{width:36px;height:36px;image-rendering:pixelated;object-fit:contain;border:0;background:transparent;padding:0;margin:0}
 .nav .menu-game-icon{width:32px;height:32px;image-rendering:pixelated;object-fit:contain;border:0;background:transparent;padding:0;margin:0}
 .skill-card strong{display:block;font-size:16px;line-height:1.3}.skill-card span{display:block;margin-top:4px;font-size:14px;line-height:1.3}
 @media(max-width:700px){.farmer-profile,#saveinfo.farmer-profile{grid-template-columns:1fr}.profile-art{flex-direction:row;justify-content:center;flex-wrap:wrap}.profile-card-title,.profile-art>.profile-field{flex-basis:100%}.top{padding:10px}.game-clock{font-size:12px}}
 `;document.head.append(style);
 const theme=document.createElement('style');theme.textContent=`
 body{background:#efb575}
 .top .day-status,.top .game-clock{position:relative}.top .day-status::after,.top .game-clock::after{content:'';position:absolute;right:-6px;top:15%;height:70%;width:1px;background:linear-gradient(transparent,#cfae79 20%,#cfae79 80%,transparent);pointer-events:none}@media(max-width:1000px){.top .game-clock::after{display:none}}
 :is(.bundle-room,.bundle-panel,.npc-card,.resident-frame,.resident-name,.gift,.sprite-frame,.item,.panel,.card,.notice,.dialog,.profile-info,.profile-date,.skill-card,.farmer-profile,.toolbar input,.toolbar button,.smallbtn){border-style:solid;border-width:3px;border-color:#a76227;border-radius:2px;box-shadow:inset 0 0 0 2px #f9d38e,0 2px 0 #754019}
 .bundle-room,.bundle-panel,.farmer-profile,#saveinfo.farmer-profile,.dialog.item-modal{border-width:5px;box-shadow:inset 0 0 0 2px #ffdc99,0 0 0 2px #78431f,0 4px 0 #633717}
 .item.done{border-color:#4e793f}.gift-list .gift{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px;padding:14px;box-sizing:border-box;text-align:center;color:#65412c;font-weight:900}.gift .sprite-frame{width:64px;height:64px;padding:5px}.gift .sprite-frame .game-icon{width:48px;height:48px}.gift>span:not(.sprite-frame){width:100%;text-align:center;overflow-wrap:anywhere}
 .friendship-grid{grid-template-columns:minmax(0,1fr);gap:16px}.friendship-grid .npc-card{display:grid;grid-template-columns:minmax(160px,200px) minmax(0,1fr);gap:20px;align-items:stretch;padding:16px}.resident-summary{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 10px;border:3px solid #a76227;background:#fce9bc;box-shadow:inset 0 0 0 2px #f9d38e,0 2px 0 #754019}.resident-summary .resident-name{margin:0}.friendship-grid .gift-list{width:auto;min-width:0;margin:0;justify-content:flex-start;align-content:center;align-items:stretch;gap:12px}.friendship-grid .gift-list .gift{margin:0;flex:0 1 120px}
 @media(max-width:650px){.friendship-grid .npc-card{grid-template-columns:minmax(0,1fr)}.friendship-grid .gift-list{justify-content:center}.resident-summary{width:100%}}
 .profile-art .farmer-avatar,.profile-art .pet-avatar{box-shadow:inset 0 0 0 2px #ffe3ab,0 2px 0 #70401e}
 .nav button:focus-visible,.gift:focus-visible,.item button:focus-visible{outline:3px solid #244d89;outline-offset:4px}
 `;document.head.append(theme);
 const seasonFiles={spring:'Spring',summer:'Summer',fall:'Fall',winter:'Winter'};
 const labels={spring:'Primavera',summer:'Verão',fall:'Outono',winter:'Inverno'};
 const add=(p,tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text||'';if(cls)el.className=cls;p.append(el);return el;};
 const sprite=(p,src,alt,cls)=>{const img=add(p,'img','',cls);img.src=src;img.alt=alt;return img;};
 function outfitTheme(target,portrait){
  if(typeof portrait!=='string'||!portrait.startsWith('data:image/png;base64,'))return;
  const image=new Image();image.onload=()=>{try{
   if(!target.isConnected||target.dataset.outfitPortrait!==portrait)return;
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx||!canvas.width||!canvas.height)return;
   ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;const buckets=new Map();
   for(let y=Math.floor(canvas.height*.35);y<Math.ceil(canvas.height*.66);y++)for(let x=Math.floor(canvas.width*.2);x<Math.ceil(canvas.width*.8);x++){
    const i=(y*canvas.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(pixels[i+3]<128)continue;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;if(delta<25||max<55||max>245)continue;
    let hue=max===r?((g-b)/delta)%6:max===g?(b-r)/delta+2:(r-g)/delta+4;hue=(hue*60+360)%360;
    if(hue<45&&r>g&&g>b&&r-b>30)continue;
    const bucket=Math.round(hue/15)%24;buckets.set(bucket,(buckets.get(bucket)||0)+1);
   }
   let best=null,count=0;for(const [hue,n] of buckets)if(n>count){best=hue;count=n;}if(best!==null)target.style.setProperty('--outfit-hue',String(best*15));
  }catch{/* Keep the default palette if the portrait cannot be sampled. */}};image.src=portrait;
 }
 function field(parent,title,value){const group=add(parent,'div','','profile-field');add(group,'strong',title,'profile-field-title');const panel=add(group,'div','','profile-info');add(panel,'span',value,'profile-field-value');return group;}
 root.showFarmerSnapshot=function(d){
  const target=document.querySelector('#saveinfo');if(!target)return;target.className='farmer-profile';target.replaceChildren();target.style.removeProperty('--outfit-hue');target.dataset.outfitPortrait=d.portrait||'';
  const art=add(target,'div','','profile-art');if(d.portrait){const figure=add(art,'figure','','profile-portrait');sprite(figure,d.portrait,d.player.name,'farmer-avatar');add(figure,'figcaption',d.player.name);}const relationship=d.player.relationship;const partner=typeof relationship?.partnerName==='string'&&relationship.partnerName.trim()?relationship.partnerName.trim():null;let civil='Indisponível';if(relationship?.status==='single')civil=d.player.isMale?'Solteiro':'Solteira';else if(relationship?.status==='married')civil=(d.player.isMale?'Casado':'Casada')+(partner?' com '+partner:'');else if(relationship?.status==='roommate')civil=partner?'Mora com '+partner:'Mora com alguém';field(art,'Estado Civil',civil);const pets=Array.isArray(d.visuals?.pets)?d.visuals.pets:(d.visuals?.pet?[d.visuals.pet]:[]);if(pets.length){const gallery=add(art,'div','','pet-gallery');for(const pet of pets){const figure=add(gallery,'figure','','profile-portrait');sprite(figure,pet.icon,pet.name,'pet-avatar');add(figure,'figcaption',pet.name);}}
  const info=add(target,'div','','profile-information');add(info,'h1','Fazenda '+d.farm.name,'farm-name');
  const dateGroup=add(info,'div','','profile-field');add(dateGroup,'strong','Data','profile-field-title');const date=add(dateGroup,'div','','profile-date');sprite(date,'https://stardewvalleywiki.com/Special:Redirect/file/'+seasonFiles[d.farm.season]+'.png','');add(date,'span',d.farm.day+' de '+labels[d.farm.season]+' · Ano '+d.farm.year,'profile-field-value');
  const money=(title,amount)=>{const group=add(info,'div','','profile-field');add(group,'strong',title,'profile-field-title');const panel=add(group,'div','','profile-info profile-money');sprite(panel,'https://stardewvalleywiki.com/Special:Redirect/file/Gold.png','');add(panel,'span',Number.isSafeInteger(amount)&&amount>=0?new Intl.NumberFormat('pt-BR').format(amount)+' ouros':'Indisponível','profile-field-value');};money('Sua Carteira',d.player.money);money('Ganhos da Fazenda',d.farm.totalEarnings);
  add(info,'h2','Habilidades','skills-title');const grid=add(info,'div','','skill-grid');for(const [id,label,file] of [['farming','Cultivo','Farming'],['fishing','Pescaria','Fishing'],['foraging','Coleta','Foraging'],['mining','Mineração','Mining'],['combat','Combate','Combat']]){const card=add(grid,'div','','skill-card');sprite(card,'https://stardewvalleywiki.com/Special:Redirect/file/'+file+'_Skill_Icon.png','');const text=add(card,'div');add(text,'strong',label);add(text,'span','Nível '+d.player.skills[id]);}
  outfitTheme(target,d.portrait);
 };
 const originalNav=root.nav;root.nav=function(){originalNav();const d=root.guiaData;if(d){const button=document.querySelector('#nav button');const label=d.player.isMale?'Fazendeiro':'Fazendeira';button.querySelector('span').textContent=label;button.setAttribute('aria-label',label);}};
 root.addEventListener('guia:update',e=>{const button=document.querySelector('#nav button');if(button){const text=e.detail.player.isMale?'Fazendeiro':'Fazendeira';button.querySelector('span').textContent=text;button.setAttribute('aria-label',text);}});
})(globalThis);
