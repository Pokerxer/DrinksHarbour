'use strict';
// Explicit synthetic opt-in acceptance. Never reads dotenv or application Mongo URI.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),mongoose=require(path.join(root,'server/node_modules/mongoose'));
const baseEnv=Object.fromEntries(['PATH','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(baseEnv,{NODE_ENV:'test',JWT_SECRET:'phase-d-synthetic-acceptance-only',GIFTCARD_QR_SECRET:'phase-d-synthetic-gift-only'});
const fixtures={catalogue:{port:27139},performance:{port:27918,repl:'dhperf'},peer:{port:27029,repl:'peerTest'},phaseA:{port:29129,repl:'phaseA'},direct:{port:29128,repl:'storefrontDirect'}};
const map=[
 ['accounting.allInvoices.mongo.test.js','DRINKSHARBOUR_INVOICES_TEST_MONGO_URI','drinks_invoice_test_'],
 ['accounting.openBalances.mongo.test.js','DRINKSHARBOUR_ACCOUNTING_TEST_MONGO_URI','drinks_accounting_test_'],
 ['batchPayment.source.mongo.test.js','SOURCE_BATCH_TEST_URI','drinks_source_batches_test_'],
 ['bannerMongo.integration.test.js','DRINKSHARBOUR_TEST_MONGO_URI','drinks_rest_test_',null,true],
 ['customerInvoice.mongo.test.js','DRINKSHARBOUR_SAVED_INVOICE_TEST_MONGO_URI','drinks_saved_invoice_test_'],
 ['customerReturns.test.js','CUSTOMER_RETURNS_TEST_URI','drinks_customer_returns_test_'],
 ['creditNote.workspace.mongo.test.js','CREDIT_WORKSPACE_TEST_URI','drinks_credit_workspace_test_'],
 ['invoiceReturns.mongo.test.js','INVOICE_RETURNS_TEST_URI','drinks_saved_invoice_test_'],
 ['payments.workspace.mongo.test.js','PAYMENT_WORKSPACE_TEST_URI','drinks_payments_workspace_test_'],
 ['tenantCustomerMigration.integration.test.js','DRINKSHARBOUR_AUTH_TEST_MONGO_URI','drinks_auth_test_'],
 ['tenantCustomerMongo.integration.test.js','DRINKSHARBOUR_AUTH_TEST_MONGO_URI','drinks_auth_test_'],
 ['salesCatalogue.test.js','DRINKSHARBOUR_CATALOGUE_TEST_MONGO_URI','drinks_catalogue_test_','catalogue'],
 ['serverPerformanceMongo.test.js','DRINKSHARBOUR_PERF_TEST_MONGO_URI','drinks_perf_test_','performance',true],
 ['peerAppraisalLifecycle.test.js','PEER_TEST_MONGO','','peer',true],
 ['salesReservations.mongo.test.js','DRINKSHARBOUR_SALES_RESERVATION_TEST_MONGO_URI','drinks_sales_reservation_test_',null,true],
 ['storefrontMongo.integration.test.js','DRINKSHARBOUR_TEST_MONGO_URI','drinks_rest_test_',null,true],
 ['phaseA.transactions.mongo.test.js','DRINKSHARBOUR_PHASE_A_TEST_MONGO_URI','drinks_phase_a_test_','phaseA',true],
 ['storefrontDirect.mongo.test.js','DRINKSHARBOUR_DIRECT_TEST_MONGO_URI','drinks_direct_test_','direct',true],
 ['posShopSessions.mongo.test.js','POS_TEST_MONGO_URI','drinks_pos_fixture_',null,true],
];
const args=process.argv.slice(2),only=args.find(a=>a.startsWith('--only='))?.slice(7);
if(args.some(a=>a!=='--run'&&!a.startsWith('--only='))||(only&&!map.some(([file])=>file===only)))throw Error('Only --run and --only=<listed filename> are supported');
const selected=map.filter(([file])=>!only||file===only);
if(!args.includes('--run')){for(const [file,variable,prefix,fixture]of selected)process.stdout.write(`${file} ${variable} ${fixtures[fixture]?.port||29127} ${prefix}\n`);return;}
const directory=fs.mkdtempSync('/private/tmp/phase-d-opt-in-'),owned=[],results=[];
process.stdout.write(`Task-owned output ${directory}\n`);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function available(port){return new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
async function stop(){for(const child of [...owned].reverse())if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(10000)]);if(child.exitCode===null)child.kill('SIGKILL');}}
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(stopping)return;stopping=true;await stop();process.exit(130);});
async function start(name){
 const config=fixtures[name];if(!await available(config.port))throw Error(`Refusing occupied unowned port ${config.port}`);
 const data=path.join(directory,name);fs.mkdirSync(data);
 const args=['--bind_ip','127.0.0.1','--port',String(config.port),'--dbpath',data,'--logpath',path.join(data,'mongod.log'),'--wiredTigerCacheSizeGB','0.25'];
 if(config.repl)args.push('--replSet',config.repl);
 const child=spawn('/usr/local/bin/mongod',args,{env:baseEnv,stdio:['ignore','ignore','pipe']});owned.push(child);let error='';child.stderr.on('data',b=>{error+=b;});
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error(`Owned mongod${config.port} exited ${child.exitCode}: ${error}`);
  const connection=mongoose.createConnection(`mongodb://127.0.0.1:${config.port}/phase_d_probe_${process.pid}?directConnection=true`,{serverSelectionTimeoutMS:250,autoIndex:false});
  try{
   await connection.asPromise();
   if(config.repl){try{await connection.db.admin().command({replSetGetStatus:1});}catch(e){if(e.code!==94)throw e;await connection.db.admin().command({replSetInitiate:{_id:config.repl,members:[{_id:0,host:`127.0.0.1:${config.port}`}]}});}}
   await connection.close();return;
  }catch(e){await connection.close().catch(()=>{});if(i===99)throw e;await delay(100);}
 }
}
function run(file,env){return new Promise(resolve=>{
 const log=path.join(directory,file+'.log'),out=fs.createWriteStream(log);
 const child=spawn(process.execPath,['--require',path.join(__dirname,'phase-d-local-guard.cjs'),'--test',path.join(root,'server/__tests__',file)],{cwd:root,env:{...baseEnv,...env},stdio:['ignore','pipe','pipe']});
 let output='',timedOut=false;for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;out.write(b);});
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},300000);
 child.on('error',e=>{output+=String(e);});child.on('exit',(code,signal)=>{
  clearTimeout(timer);out.end();const count=label=>Number(output.match(new RegExp(`^# ${label} (\\d+)$`,'m'))?.[1]||0);
  resolve({file,pid:child.pid,exit:code,signal,timedOut,tests:count('tests'),pass:count('pass'),fail:count('fail'),skip:count('skipped'),safety:[...output.matchAll(/private-dotenv-read-attempts=(\d+) external-transport-attempts=(\d+)/g)].map(m=>`${m[1]}/${m[2]}`).join(','),log});
 });
});}
function ledger(){
 fs.writeFileSync(path.join(directory,'results.md'),`# Fresh opt-in database verification\n\nRunner PID${process.pid}. Only local task-owned fixtures. Root29127 preserved. Safety: private dotenv / external transport counters.\n\n| File | Child PID | Exit | Tests | Pass | Fail | Skip | Safety |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${results.map(r=>`| ${r.file} | ${r.pid||''} | ${r.exit??r.error} | ${r.tests||0} | ${r.pass||0} | ${r.fail||0} | ${r.skip||0} | ${r.safety||''} |`).join('\n')}\n\n${results.map(r=>`${r.file}: ${r.uri||''}; log ${r.log||''}${r.error?' '+r.error:''}`).join('\n\n')}\n`);
}
(async()=>{
 try{
  const probe=mongoose.createConnection('mongodb://127.0.0.1:29127/phase_d_probe?replicaSet=venuePhase0',{serverSelectionTimeoutMS:5000,autoIndex:false});await probe.asPromise();await probe.close();
  for(const name of [...new Set(selected.map(row=>row[3]).filter(Boolean))])await start(name);
  for(let i=0;i<selected.length;i++){
   const [file,variable,prefix,fixture,replica]=selected[i],config=fixtures[fixture]||{port:29127,repl:'venuePhase0'};
   const db=prefix?`${prefix}ds_${process.pid}_${i}`:'';
   const uri=`mongodb://127.0.0.1:${config.port}/${db}${replica?'?replicaSet='+config.repl:''}`;
   process.stdout.write(`RUN ${file} ${uri}\n`);const result=await run(file,{[variable]:uri});results.push({...result,uri});ledger();process.stdout.write(`RESULT ${file} exit=${result.exit} tests=${result.tests} pass=${result.pass} fail=${result.fail} skip=${result.skip} safety=${result.safety}\n`);
  }
 }catch(e){results.push({file:'pilot infrastructure',error:e.message,exit:1});ledger();process.stderr.write(String(e)+'\n');}
 finally{await stop();}
 process.exitCode=results.some(r=>r.exit!==0||r.fail||r.skip||r.timedOut||!r.safety||r.safety.split(',').some(v=>v!=='0/0'))?1:0;
 process.stdout.write(`Evidence ${directory}/results.md\n`);
})();
