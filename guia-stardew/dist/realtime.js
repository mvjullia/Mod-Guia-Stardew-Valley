(function(){
  if(window.embeddedGuide || !/^https?:$/.test(location.protocol))return;
  let stream=null, latest=null, renderedInto=null;
  const panel=document.createElement('div');panel.className='notice';panel.style.margin='12px 5%';
  const status=document.createElement('span');status.textContent='Tempo real: desconectado. ';
  const button=document.createElement('button');button.className='smallbtn';button.textContent='Conectar ao mod';
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Registro de conexão';const logList=document.createElement('ol');details.append(summary,logList);panel.append(status,button,details);
  const configure=document.createElement('button');configure.className='smallbtn';configure.textContent='Configurar mod';configure.hidden=true;panel.append(configure);
  const reveal=document.createElement('button');reveal.className='smallbtn';reveal.textContent='Mostrar token';reveal.hidden=true;panel.append(reveal);
  const secret=document.createElement('input');secret.type='password';secret.readOnly=true;secret.hidden=true;secret.setAttribute('aria-label','Token local');panel.append(secret);
  configure.onclick=async()=>{configure.disabled=true;try{const response=await fetch('/api/mod/configure',{method:'POST'});const result=await response.json();audit(result.message||result.error);status.textContent=(result.message||result.error)+' ';}catch{audit('Falha ao configurar o mod.');}finally{configure.disabled=false;}};
  reveal.onclick=async()=>{if(!secret.hidden){secret.value='';secret.hidden=true;return;}try{const r=await fetch('/api/mod/token');if(!r.ok)throw Error();const data=await r.json();secret.value=data.token;secret.hidden=false;secret.type='text';audit('Token exibido localmente.');}catch{audit('Sessão expirada; conecte novamente.');}};
  function audit(message){const line=document.createElement('li');line.textContent=new Date().toLocaleTimeString('pt-BR')+' · '+message;logList.prepend(line);while(logList.children.length>100)logList.lastChild.remove();console.info('[Guia]',message);}document.querySelector('.top').after(panel);
  const dialog=document.createElement('dialog');dialog.className='dialog';
  const text=document.createElement('p');text.textContent='Cole o token da API local (api/.runtime/token.txt). Ele será usado apenas para abrir uma sessão neste servidor.';
  const input=document.createElement('input');input.type='password';input.autocomplete='off';input.setAttribute('aria-label','Token da API');
  const connect=document.createElement('button');connect.className='smallbtn';connect.textContent='Conectar';
  const close=document.createElement('button');close.className='smallbtn';close.textContent='Fechar';close.onclick=()=>dialog.close();
  dialog.append(text,input,connect,close);document.body.append(dialog);button.onclick=()=>dialog.showModal();
  function show(){const out=document.querySelector('#saveinfo');if(!out||!latest||out===renderedInto)return;renderedInto=out;const json=JSON.stringify(latest);showFarmerSnapshot(latest);}
  function start(){
    audit('Abrindo conexão SSE.');
    stream?.close();stream=new EventSource('/api/events');
    stream.onopen=()=>{audit('Conexão SSE aberta; aguardando dados do mod.');status.textContent='Tempo real conectado · aguardando dados do mod. ';};
    stream.addEventListener('snapshot',event=>{try{latest=GuiaTelemetry.validateSnapshot(JSON.parse(event.data));audit('Atualização recebida da API (evento '+event.lastEventId+').');renderedInto=null;show();audit(document.querySelector('#saveinfo')?'Atualização enviada para a tela da fazenda.':'Atualização guardada; abra Fazendeiro(a) para visualizar.');status.textContent='Ao vivo · atualizado às '+new Date().toLocaleTimeString('pt-BR')+'. ';}catch(error){audit('Dados incompatíveis: '+error.message);status.textContent='A API enviou dados incompatíveis. ';}});
    stream.onerror=()=>{audit('Conexão perdida; o navegador tentará reconectar.');status.textContent='Sem conexão · tentando reconectar. Se a sessão expirou, conecte com o token novamente. ';};
  }
  connect.onclick=async()=>{audit('Solicitando sessão para o token informado.');connect.disabled=true;try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:input.value})});if(!response.ok)throw Error('Conexão recusada. Confira o token e execute a API local.');input.value='';dialog.close();audit('Sessão autorizada.');configure.hidden=false;reveal.hidden=false;start();}catch(error){audit('Falha ao conectar: '+error.message);text.textContent=error.message;}finally{connect.disabled=false;}};
  new MutationObserver(show).observe(document.querySelector('#content'),{childList:true,subtree:true});
})();
