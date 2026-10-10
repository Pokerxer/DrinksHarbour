'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const assert = require('node:assert/strict');
const { load } = require('./client');
function wait(child, type) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('Worker timeout'));},60000);
    const onMessage=row=>{if(row.type===type){cleanup();resolve(row);}};
    const onExit=code=>{cleanup();reject(new Error(`Worker exited ${code}`));};
    function cleanup(){clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);}
    child.on('message',onMessage);child.once('exit',onExit);
  });
}
async function control(child,type){const pending=wait(child,type);child.send({type});return pending;}
async function main(){
  const runs=[],hashes=new Map();
  for(let round=1;round<=3;round++) for(const variant of round%2?['baseline','shared','metadata']:['metadata','shared','baseline']){
    const fd=fs.openSync(`/tmp/drinks-redis-load-${round}-${variant}.log`,'w');
    const child=fork(path.join(__dirname,'redis-worker.js'),[variant],{stdio:['ignore',fd,fd,'ipc']});fs.closeSync(fd);
    try{
      const {port}=await wait(child,'ready');
      for(const scenario of ['hot','mixed']) for(const concurrency of [50]){
        await load(port,scenario,concurrency,100);await control(child,'reset');
        const result=await load(port,scenario,concurrency,600);
        const {counts}=await control(child,'metrics');
        const signature=JSON.stringify(result.hashes),key=`${scenario}:${concurrency}`;
        if(hashes.has(key))assert.equal(signature,hashes.get(key));else hashes.set(key,signature);
        delete result.hashes;
        runs.push({round,variant,scenario,concurrency,...result,databaseCommands:counts});
        fs.writeFileSync('/tmp/drinksharbour-redis-load.json',JSON.stringify({node:process.version,runs},null,2));
        console.log(`round ${round} ${variant} ${scenario} c=${concurrency} ${result.meanMs.toFixed(1)}ms ${result.rps.toFixed(1)}rps; 600 HTTP 200`);
      }
    }finally{
      if(child.connected)child.send({type:'stop'});
      await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));
    }
  }
  console.log('18 workloads, 10800 measured requests, all payload hashes equivalent.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
