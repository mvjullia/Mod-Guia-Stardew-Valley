(function(){
 const fragment=new URLSearchParams(location.hash.slice(1));const token=fragment.get('connect');
 if(!token && !window.embeddedGuide && sessionStorage.getItem('embeddedGuide')!=='1')return;
 window.embeddedGuide=true;sessionStorage.setItem('embeddedGuide','1');
 history.replaceState(null,'',location.pathname);
 document.querySelector('#login')?.classList.add('hidden');
 (token ? fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}) : Promise.resolve({ok:true})).then(r=>{if(!r.ok)throw Error('Falha na sessão local');
 const stream=new EventSource('/api/events');let latest=null,lastTarget=null;
 const notice=document.createElement('div');notice.className='notice';notice.style.margin='12px 5%';const state=document.createElement('span');state.textContent='Conectando ao mod...';const details=document.createElement('details');const title=document.createElement('summary');title.textContent='Registro de conexão';const list=document.createElement('ol');details.append(title,list);notice.append(state,details);document.querySelector('.top').after(notice);const log=message=>{const item=document.createElement('li');item.textContent=new Date().toLocaleTimeString('pt-BR')+' · '+message;list.prepend(item);while(list.children.length>100)list.lastChild.remove();console.info('[Guia]',message);};log('Sessão iniciada; abrindo conexão com o mod.');
 const show=()=>{const target=document.querySelector('#saveinfo');if(!target||!latest||target===lastTarget)return;lastTarget=target;showFarmerSnapshot(latest);};
 new MutationObserver(show).observe(document.querySelector('#content'),{childList:true,subtree:true});
 stream.onopen=()=>{state.textContent='Conectado ao mod · aguardando fazenda.';log('Navegador conectado ao mod.');};
 stream.addEventListener('snapshot',e=>{try{latest=GuiaTelemetry.validateSnapshot(JSON.parse(e.data));window.guiaData=latest;window.dispatchEvent(new CustomEvent("guia:update",{detail:latest}));lastTarget=null;show();state.textContent='Ao vivo · atualizado às '+new Date().toLocaleTimeString('pt-BR');log('Atualização recebida e aplicada à fazenda.');}catch(error){state.textContent='Dados recebidos são incompatíveis.';log('Erro ao validar atualização: '+error.message);}});
 stream.onerror=()=>{state.textContent='Conexão interrompida · tentando reconectar.';log('Conexão interrompida; tentando reconectar.');};
 }).catch(()=>alert('Não foi possível conectar ao mod. Reabra o guia pelo jogo.'));
})();
