const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
test('local server serves app/WASM, runs captcha endpoint and protects secrets',{timeout:10000},async()=>{
 const port=31379;
 const env={...process.env,PORT:String(port),TWOCAPTCHA_API_KEY:'',ANTICAPTCHA_API_KEY:''};
 const child=spawn(process.execPath,[path.join(__dirname,'../server.js')],{env});
 try {
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exited '+code)))});
  const base='http://127.0.0.1:'+port;
  assert.equal((await fetch(base)).status,200);
  const wasm=await fetch(base+'/bundle.wasm');assert.equal(wasm.status,200);assert.equal(wasm.headers.get('content-type'),'application/wasm');await wasm.arrayBuffer();
  for (const name of ['/.env','/server.js','/api/captcha.js']) assert.equal((await fetch(base+name)).status,404);
  const response=await fetch(base+'/api/captcha',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'create'})});
  assert.equal(response.status,503);assert.match((await response.json()).error,/not configured/);
  assert.equal((await fetch(base+'/api/proxy?url=http://127.0.0.1/secrets')).status,400);
 } finally {child.kill();}
});
