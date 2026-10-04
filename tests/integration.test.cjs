const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');
function loadEngine() {
 const storage=new Map();
 let source=fs.readFileSync(path.join(root,'bundle.js'),'utf8');
 source=source.replace(/window\.app = Gn = new zn, Gn\.hud\.updateLeaderboard\(\[\{[\s\S]*?\}\]\)/,'window.__test = {Player:E, Settings:v, Stage:xe, Lobby:Gt, Access:Rn, Client:bt}');
 const context={console:{log(){},error(){},warn(){}},setTimeout,clearTimeout,setInterval,clearInterval,performance,TextDecoder,TextEncoder,URL,WebAssembly,navigator:{userAgent:'Node'},location:{href:'http://localhost/',origin:'http://localhost/'},document:{addEventListener(){},querySelectorAll(){return[]},querySelector(){return null}},addEventListener(){},localStorage:{getItem(k){return storage.get(k)||null},setItem(k,v){storage.set(k,String(v))}}};
 context.window=context;context.self=context;vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(root,'wasmLoader.js'),'utf8'),context);
 vm.runInContext(source,context);
 return {context,storage,...context.__test};
}
test('existing saved server cannot override the requested Delta server',()=>{
 const e=loadEngine();const app={player:new e.Player()};
 assert.equal(app.player.serverUrl,'wss://eu.senpa.io:2001');
 e.storage.set('eon_playerInputs',JSON.stringify({lastServer:'wss://old.invalid:7101'}));
 e.Lobby.prototype.loadGlobalState.call({app,logger:console});
 assert.equal(app.player.serverUrl,'wss://eu.senpa.io:2001');
});
test('local activation is keyless and makes no remote requests',async()=>{
 const e=loadEngine(); e.context.fetch=()=>{throw Error('Unexpected remote licensing')};
 await new e.Access().authenticate({});
});
test('migrated settings persist across Settings instances',()=>{
 const e=loadEngine(); const settings=new e.Settings();
 settings.set('cellOpacity',45);settings.set('nickSize',2.1);settings.set('arrowRingsEnabled',true);
 const next=new e.Settings();
 assert.equal(next.get('cellOpacity'),45);assert.equal(next.get('nickSize'),2.1);assert.equal(next.get('arrowRingsEnabled'),true);
});
test('cell renderer handles absent chat, uses opacity, name size and active arrow',()=>{
 const e=loadEngine();const settings=new e.Settings().getAll();
 settings.cellOpacity=45;settings.nickSize=2;settings.arrowRingsEnabled=true;settings.showMyMass=false;
 const operations=[];const ctx=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...a)=>operations.push([k,...a]),set:(o,k,v)=>{o[k]=v;operations.push([k,v]);return true}});
 const primary={type:'Primary',player:{}},secondary={type:'Secondary',player:{}};
 const stage={settings,ctx,pi2:Math.PI*2,camera:{zoom:1},skinCache:{get(){return null}},texts:{nick(...a){operations.push(['nick',...a]);return null}},app:{player:{chat:null},dualConnectionHandler:{clients:[primary,secondary],current:primary}}};
 e.Stage.prototype.drawCell.call(stage,{x:10,y:10,r:100,id:1,playerId:4,clientOrigin:primary,flags:{},colorHex:'#fff',globalAlpha:1,nickname:'Test',mass:100});
 assert.ok(operations.some(x=>x[0]==='globalAlpha'&&x[1]===0.45));
 assert.ok(operations.some(x=>x[0]==='nick'&&x[4]===200));
 assert.ok(operations.some(x=>x[0]==='moveTo'));
});
test('original canvas recording module is unchanged',()=>{
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'replaysys.js'))).digest('hex');
 assert.equal(hash,fs.readFileSync(path.join(__dirname,'replay.sha256'),'utf8').trim());
});
const handler=require('../api/captcha.js');
async function call(body,origin='https://jax.example') {
 let status=200,result;
 await handler({method:'POST',headers:{host:'jax.example',origin,'x-forwarded-for':'127.0.0.1'},body}, {setHeader(){},status(n){status=n;return this},json(o){result=o;return this}});
 return {status,result};
}
test('captcha rejects unconfigured and cross-origin requests; signs tasks and hides secrets',async()=>{
 const prev={...process.env};const originalFetch=global.fetch;
 try {
  delete process.env.TWOCAPTCHA_API_KEY;delete process.env.ANTICAPTCHA_API_KEY;delete process.env.CAPTCHA_PROVIDER;
  assert.equal((await call({action:'create'})).status,503);
  assert.equal((await call({action:'create'},'https://elsewhere.example')).status,403);
  process.env.TWOCAPTCHA_API_KEY='test-only-secret';
  const calls=[];
  global.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,json:async()=>url.endsWith('/createTask')?{errorId:0,taskId:1234}:{errorId:0,status:'ready',solution:{token:'valid-test-token'}}}};
  const created=await call({action:'create',websiteURL:'https://attacker.example'});
  assert.equal(created.status,200);assert.ok(created.result.ticket);
  assert.equal(calls[0].body.task.websiteURL,'https://senpa.io/');
  assert.ok(!JSON.stringify(created).includes('test-only-secret'));
  assert.equal((await call({action:'poll',ticket:created.result.ticket})).result.token,'valid-test-token');
  const tampered=created.result.ticket.slice(0,-3)+'xxx';
  assert.equal((await call({action:'poll',ticket:tampered})).status,400);
  process.env.CAPTCHA_PROVIDER='anticaptcha';process.env.ANTICAPTCHA_API_KEY='test-only-secondary';
  const second=await call({action:'create'});assert.equal(second.status,200);
  assert.equal(calls.at(-1).url,'https://api.anti-captcha.com/createTask');
  global.fetch=async()=>({ok:true,json:async()=>({errorId:1,errorCode:'ERROR_ZERO_BALANCE'})});
  assert.equal((await call({action:'create'})).result.error,'Captcha provider: ERROR_ZERO_BALANCE');
 } finally { global.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in prev))delete process.env[key];Object.assign(process.env,prev); }
});

test('ONYX transport integration is wired without bundling a login credential',()=>{
 const source=fs.readFileSync(path.join(root,'bundle.js'),'utf8');
 const bridge=fs.readFileSync(path.join(root,'jax-onyx-bridge.js'),'utf8');
 assert.match(source,/wss:\/\/eu\.senpa\.io:2001/);
 assert.match(source,/wss:\/\/chat\.delt\.io\/delta7\?protocol=v1/);
 assert.match(source,/JaxAuth\.getToken/);
 assert.match(bridge,/protocols = 'main'/);
 assert.doesNotMatch(bridge,/eyJ[a-zA-Z0-9_-]{10,}\./);
});
