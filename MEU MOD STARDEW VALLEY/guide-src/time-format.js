(function(root){
 function format(text){return text.replace(/\b(\d{1,2})h(?::(\d{2}))?(?![\p{L}\d])/gu,(match,h,m)=>{const hour=Number(h);if(hour>26)return match;const normalized=hour%24;return (normalized%12||12)+':'+(m||'00')+' '+(normalized<12?'AM':'PM');}).replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi,(_,h,m,meridiem)=>h+':'+(m||'00')+' '+meridiem.toUpperCase());}
 if(typeof module!=='undefined'&&module.exports)module.exports={format};if(typeof document==='undefined')return;
 const body=document.querySelector('#dialogbody');const normalize=()=>{for(const p of body.querySelectorAll('.item-fields p')){const text=p.textContent||'';if(!/^(Como conseguir|Como obter|Obtenção|Source|Time|Horário|Hora)/i.test(text)||/dura[cç][aã]o|processamento/i.test(text))continue;const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes){const formatted=format(node.nodeValue);if(formatted!==node.nodeValue)node.nodeValue=formatted;}}};new MutationObserver(normalize).observe(body,{childList:true,subtree:true,characterData:true});
 root.formatGameTimes=format;
})(globalThis);
