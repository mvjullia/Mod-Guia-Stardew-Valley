const {test}=require('node:test');const assert=require('node:assert/strict');const {createServer}=require('../api/server.cjs');
test('API autenticada entrega snapshot por SSE e reenvia estado na reconexão',async()=>{
 const token='x'.repeat(64),port=18787,origin='http://127.0.0.1:'+port;
 const server=createServer({token,origin});await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 const request=(url,options={})=>fetch(origin+url,{...options,signal:AbortSignal.timeout(5000)});
 const data={schemaVersion:1,exportedAt:'2026-10-30T23:00:00Z',farm:{saveId:'123',name:'Estrela',year:1,season:'spring',day:15},player:{multiplayerId:'456',steamId:null,name:'Maria',isMale:false,skills:{farming:5,fishing:4,foraging:3,mining:2,combat:1}},mastery:null,communityCenter:null};
 try{
 assert.equal((await request('/api/events')).status,401);
 assert.equal((await request('/api/session',{method:'POST',headers:{Origin:'https://example.com'},body:JSON.stringify({token})})).status,403);
 assert.equal((await request('/api/snapshots',{method:'POST',body:JSON.stringify(data)})).status,401);
 const session=await request('/api/session',{method:'POST',body:JSON.stringify({token})});assert.equal(session.status,200);const cookie=session.headers.get('set-cookie').split(';')[0];
 const stream=await request('/api/events',{headers:{Cookie:cookie}});assert.match(stream.headers.get('content-type'),/text\/event-stream/);const reader=stream.body.getReader();await reader.read();
 const headers={Authorization:'Bearer '+token};
 assert.equal((await request('/api/snapshots',{method:'POST',headers,body:'{}'})).status,400);
 assert.equal((await request('/api/snapshots',{method:'POST',headers,body:JSON.stringify(data)})).status,202);
 const event=new TextDecoder().decode((await reader.read()).value);assert.match(event,/event: snapshot/);assert.match(event,/Maria/);await reader.cancel();
 const replay=await request('/api/events',{headers:{Cookie:cookie}});const replayReader=replay.body.getReader();const replayEvent=new TextDecoder().decode((await replayReader.read()).value);assert.match(replayEvent,/Maria/);await replayReader.cancel();
 const stale=structuredClone(data);stale.exportedAt='2026-10-29T23:00:00Z';assert.equal((await request('/api/snapshots',{method:'POST',headers,body:JSON.stringify(stale)})).status,409);
 assert.equal((await request('/')).status,200);
 for(const file of ['item-catalog.js','item-fields.json','items.json','polish.js','acquisition.js','profile.js','time-format.js','game-ui.js','game-cursor.png','menu-hover.wav','menu-select.wav','menu-open.wav','menu-close.wav','game-ui-sources.json','season.js','season-guide.json','albums.js','album-moments.json','Pixellari.ttf','community-center.png','community-center-mask.png']) {
   const asset=await request('/'+file);assert.equal(asset.status,200,file);
   const type=file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':file.endsWith('.wav')?'audio/wav':file.endsWith('.ttf')?'font/ttf':'text/javascript';
   assert.ok(asset.headers.get('content-type').startsWith(type),file);
   if(file==='items.json'){const catalog=await asset.json();assert.equal(catalog.schemaVersion,2);assert.ok(catalog.items.length>0);}
 }
 }finally{server.closeStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
