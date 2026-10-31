const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('../dist/telemetry.js');
const validate = globalThis.GuiaTelemetry.validateSnapshot;
function createServer({ token, origin = 'http://127.0.0.1:8787', sessionTtl = 12*60*60*1000, albumDir = process.env.ALBUM_DIR || null } = {}) {
  if (!token || token.length < 32) throw Error('Token deve ter pelo menos 32 caracteres.');
  const clients = new Set(), sessions = new Map();
  let latest = null, sequence = 0;
  const audit = (event, details = {}) => console.log(JSON.stringify({time: new Date().toISOString(), component:'api', event, ...details}));
  const sameToken = value => { const a=Buffer.from(value||''), b=Buffer.from(token); return a.length===b.length && crypto.timingSafeEqual(a,b); };
  const authenticated = req => { const id = /(?:^|;\s*)guia_session=([a-f0-9]+)/.exec(req.headers.cookie||'')?.[1]; return (sessions.get(id)||0)>Date.now(); };
  const json = (res, status, body) => {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  async function body(req) {
    let size=0, chunks=[];
    for await (const chunk of req) { size+=chunk.length; if(size>65536) {const e=Error('Payload excede 64 KB');e.status=413;throw e;} chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  function send(res, data) {if (!res.write(`id: ${sequence}\nevent: snapshot\ndata: ${JSON.stringify(data)}\n\n`)) res.destroy();}
  const server = http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    // Rejeita origens e Host inesperados, inclusive DNS rebinding no modo local.
    if(req.headers.host!==new URL(origin).host || (req.headers.origin && req.headers.origin!==origin)) return json(res,403,{error:'Origem não permitida'});
    const url=new URL(req.url,origin);
    try {
      if(req.method==='POST' && url.pathname==='/api/mod/configure') {
        if(!authenticated(req))return json(res,401,{error:'Sessão necessária'});
        if(req.headers.origin!==origin)return json(res,403,{error:'Origem não permitida'});
        const modDir=path.join(process.env['ProgramFiles(x86)']||'', 'Steam','steamapps','common','Stardew Valley','Mods','StardewRealtimeTelemetry');
        const manifest=path.join(modDir,'manifest.json');
        if(!fs.existsSync(manifest))return json(res,404,{error:'Mod não encontrado na pasta padrão da Steam.'});
        const configFile=path.join(modDir,'config.json');
        let config={};
        if(fs.existsSync(configFile)) { try{config=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,''));}catch{return json(res,400,{error:'O config.json existente é inválido; corrija-o antes de continuar.'});} }
        config.EnableHttpUpload=true;config.ApiUrl=origin+'/api/snapshots';config.ApiToken=token;config.UploadIntervalSeconds=2;
        try{fs.writeFileSync(configFile,JSON.stringify(config,null,2),{mode:0o600});}catch(error){audit('configuracao_mod_falhou',{codigo:error.code});return json(res,500,{error:'Não foi possível gravar a configuração do mod. Execute o inicializador como administrador.'});}
        audit('mod_configurado');return json(res,200,{ok:true,message:'Mod configurado. Reinicie o jogo para aplicar.'});
      }
      if(req.method==='GET' && url.pathname==='/api/mod/token') {
        if(!authenticated(req))return json(res,401,{error:'Sessão necessária'});
        audit('token_visualizado');return json(res,200,{token});
      }
      if(req.method==='POST' && url.pathname==='/api/session') {
        const input=await body(req); if(!sameToken(input.token)){audit('sessao_recusada');return json(res,401,{error:'Token inválido'});} audit('sessao_autorizada');
        for(const [id,expiry] of sessions)if(expiry<=Date.now())sessions.delete(id);
        if(sessions.size>=100)return json(res,429,{error:'Limite de sessões'});
        const id=crypto.randomBytes(32).toString('hex');sessions.set(id,Date.now()+sessionTtl);
        res.setHeader('Set-Cookie',`guia_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.floor(sessionTtl/1000)}${origin.startsWith('https:')?'; Secure':''}`);
        return json(res,200,{ok:true});
      }
      if(req.method==='POST' && url.pathname==='/api/snapshots') {
        if(!sameToken((req.headers.authorization||'').replace(/^Bearer /,''))){audit('snapshot_recusado_token');return json(res,401,{error:'Token inválido'});}
        const data=validate(await body(req));
        if(latest && latest.farm.saveId===data.farm.saveId && latest.player.multiplayerId===data.player.multiplayerId && Date.parse(data.exportedAt)<Date.parse(latest.exportedAt))return json(res,409,{error:'Snapshot antigo'});
        latest=data;sequence++;audit('snapshot_recebido',{id:sequence,conexoes:clients.size});for(const client of clients)send(client,data);audit('snapshot_transmitido',{id:sequence,conexoes:clients.size});
        return json(res,202,{ok:true,id:sequence});
      }
      if(req.method==='GET' && url.pathname==='/api/events') {
        if(!authenticated(req))return json(res,401,{error:'Conecte com o token local'});
        if(clients.size>=20)return json(res,429,{error:'Limite de conexões'});
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});
        res.write('retry: 3000\n\n');clients.add(res);audit('sse_conectado',{conexoes:clients.size,temSnapshot:!!latest});
        if(latest)send(res,latest);
        const timer=setInterval(()=>{if(!authenticated(req)){res.end();return;}if(!res.write(': heartbeat\n\n'))res.destroy();},15000);
        res.on('close',()=>{clearInterval(timer);clients.delete(res);audit('sse_desconectado',{conexoes:clients.size});});return;
      }
      if(req.method==='GET' && url.pathname==='/api/health')return json(res,200,{ok:true});
      if(req.method==='GET' && (url.pathname==='/api/albums' || url.pathname.startsWith('/api/albums/photos/'))) {
        if(!authenticated(req))return json(res,401,{error:'Conecte o guia para consultar os álbuns.'});
        if(!albumDir)return json(res,503,{error:'Abra o guia hospedado pelo mod ou configure ALBUM_DIR para consultar os álbuns locais.'});
        if(!latest)return json(res,200,{supported:true,active:false,photos:[]});
        const directory=path.join(path.resolve(albumDir),latest.farm.saveId,latest.player.multiplayerId);
        const index=path.join(directory,'index.json');
        const photos=fs.existsSync(index)?JSON.parse(fs.readFileSync(index,'utf8').replace(/^\uFEFF/,'')):[];
        if(!Array.isArray(photos) || photos.some(photo=>!photo || !/^[a-f0-9]{32}$/.test(photo.id) || !/^[a-f0-9]{32}$/.test(photo.imageId)))
          return json(res,500,{error:'O índice do álbum precisa ser reparado.'});
        if(url.pathname==='/api/albums')return json(res,200,{supported:true,active:true,photos:[...photos].sort((a,b)=>String(b.capturedAt).localeCompare(String(a.capturedAt)))});
        const match=/^\/api\/albums\/photos\/([a-f0-9]{32})\.png$/.exec(url.pathname);
        if(!match || !photos.some(photo=>photo.imageId===match[1]))return json(res,404,{error:'Foto não encontrada.'});
        const file=path.join(directory,match[1]+'.png');if(!fs.existsSync(file))return json(res,404,{error:'Foto não encontrada.'});
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return res.end(fs.readFileSync(file));
      }
      const files={'/':'index.html','/index.html':'index.html','/telemetry.js':'telemetry.js','/realtime.js':'realtime.js','/embedded.js':'embedded.js','/visual.js':'visual.js','/polish.js':'polish.js','/acquisition.js':'acquisition.js','/profile.js':'profile.js','/time-format.js':'time-format.js','/knowledge.js':'knowledge.js','/item-catalog.js':'item-catalog.js','/item-fields.json':'item-fields.json','/items.json':'items.json','/game-ui.js':'game-ui.js','/game-cursor.png':'game-cursor.png','/game-ui-sources.json':'game-ui-sources.json','/menu-hover.wav':'menu-hover.wav','/menu-select.wav':'menu-select.wav','/menu-open.wav':'menu-open.wav','/menu-close.wav':'menu-close.wav'};
      files['/season.js']='season.js';files['/season-guide.json']='season-guide.json';
      files['/albums.js']='albums.js';files['/album-moments.json']='album-moments.json';
      files['/Pixellari.ttf']='Pixellari.ttf';
      if(req.method==='GET' && files[url.pathname]) {
        const mime={'.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.wav':'audio/wav','.ttf':'font/ttf'};
        res.writeHead(200,{'Content-Type':mime[path.extname(files[url.pathname])],'Cache-Control':'no-store'});
        return res.end(fs.readFileSync(path.join(__dirname,'../dist',files[url.pathname])));
      }
      json(res,404,{error:'Não encontrado'});
    } catch(error) { audit('requisicao_invalida',{rota:url.pathname, erro:error.message}); if(!res.headersSent)json(res,error.status||400,{error:'Dados inválidos'});else res.destroy(); }
  });
  server.on('close',()=>{for(const client of clients)client.destroy();});
  server.closeStreams=()=>{for(const client of clients)client.destroy();};
  return server;
}
module.exports={createServer};
if(require.main===module) {
  const runtime=path.join(__dirname,'.runtime');fs.mkdirSync(runtime,{recursive:true});
  const tokenFile=path.join(runtime,'token.txt');
  if(!process.env.API_TOKEN && !fs.existsSync(tokenFile))fs.writeFileSync(tokenFile,crypto.randomBytes(32).toString('hex'),{mode:0o600});
  const token=process.env.API_TOKEN||fs.readFileSync(tokenFile,'utf8').trim();
  const port=Number(process.env.PORT||8787), origin=process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${port}`;
  createServer({token,origin}).listen(port,'127.0.0.1',()=>console.log(`Guia e API SSE: ${origin}. Token local em api/.runtime/token.txt (não compartilhar).`));
}
