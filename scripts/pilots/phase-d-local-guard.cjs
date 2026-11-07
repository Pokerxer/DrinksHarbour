'use strict';
// Verification-only: deny private inputs and real external transport, never ship with app.
const fs=require('node:fs'),path=require('node:path');
let dotenvReads=0,externalAttempts=0;
function file(value){
 if((typeof value==='string'||value instanceof URL)&&/^\.env(?:\.|$)/.test(path.basename(String(value)))){
  dotenvReads++;throw new Error('PILOT_PRIVATE_DOTENV_READ_FORBIDDEN');
 }
}
for(const method of ['readFileSync','readFile']){
 const original=fs[method];fs[method]=function(value,...args){file(value);return original.call(this,value,...args);};
}
const read=fs.promises.readFile;fs.promises.readFile=function(value,...args){file(value);return read.call(this,value,...args);};
function local(value){
 if(!value)return;
 const host=String(value).replace(/^\[|\]$/g,'');
 if(!['127.0.0.1','localhost','::1'].includes(host)){
  externalAttempts++;throw new Error('PILOT_EXTERNAL_TRANSPORT_FORBIDDEN');
 }
}
for(const protocol of ['node:http','node:https']){
 const module=require(protocol);
 for(const method of ['request','get']){
  const original=module[method];module[method]=function(value,...args){
   const address=typeof value==='string'||value instanceof URL?new URL(value):value;
   local(address?.hostname||address?.host);return original.call(this,value,...args);
  };
 }
}
const fetch=global.fetch;global.fetch=function(value,...args){local(new URL(typeof value==='string'||value instanceof URL?value:value.url).hostname);return fetch.call(this,value,...args);};
const net=require('node:net'),connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
 const value=Array.isArray(args[0])?args[0]:args;
 if(typeof value[0]==='object')local(value[0]?.host||value[0]?.hostname);
 else if(typeof value[0]==='number')local(typeof value[1]==='string'?value[1]:'localhost');
 return connect.apply(this,args);
};
process.on('exit',()=>{
 process.stderr.write(`[phase-d-local] pid=${process.pid} private-dotenv-read-attempts=${dotenvReads} external-transport-attempts=${externalAttempts}\n`);
 if(dotenvReads||externalAttempts)process.exitCode=1;
});
