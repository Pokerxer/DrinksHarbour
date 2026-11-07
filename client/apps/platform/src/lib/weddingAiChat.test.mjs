import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWeddingAiQuestion} from './weddingChatPrompt.ts';
import {askWeddingAi} from './weddingAiChat.ts';

test('custom AI questions validate inputs and preserve long list context outside the 2000-character query',()=>{
 const items=Array.from({length:20},(_,i)=>({id:String(i),name:`Bottle ${i} ${'long name '.repeat(7)}`,quantity:'12',size:'750ml',unit:'bottles'}));
 const result=buildWeddingAiQuestion('What should I check with my venue?',items,'Wine and non-alcoholic drinks');
 assert.equal(result.ok,true);assert(result.query.length<2000);assert(result.context.length>2000);
 assert.match(result.context,/Bottle 19/);
 assert.equal(buildWeddingAiQuestion(' ',[],'').ok,false);
 assert.equal(buildWeddingAiQuestion('x'.repeat(1001),[],'').ok,false);
});
test('AI client sends complete bounded context and returns only assistant text, ignoring cart proposals',async()=>{
 const prior=global.fetch;let request;
 global.fetch=async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({success:true,data:{response:'Check bottle sizes.',cartProposal:[{id:'do-not-execute'}]}})};};
 try{
  const reply=await askWeddingAi({query:'Wedding question',context:'x'.repeat(5000)+'LAST_BOTTLE',history:[{role:'user',content:'Earlier question'}],tenantId:'tenant-one'},new AbortController().signal);
  assert.deepEqual(reply,{ok:true,text:'Check bottle sizes.'});
  assert.match(request.url,/\/api\/chatbot\/query$/);
  assert.equal(request.options.body.get('tenantId'),'tenant-one');
  assert.equal(request.options.body.get('query'),'Wedding question');
  const history=JSON.parse(request.options.body.get('conversationHistory'));
  assert(history.every(turn=>turn.content.length<=3500));
  assert(history.map(turn=>turn.content).join('').includes('LAST_BOTTLE'));
  assert(history.some(turn=>turn.content==='Earlier question'));
 }finally{global.fetch=prior;}
});
test('AI rate limits are visible without encouraging an immediate retry',async()=>{
 const prior=global.fetch;
 global.fetch=async()=>({ok:false,status:429,json:async()=>({message:'Please wait a few minutes.'})});
 try{assert.deepEqual(await askWeddingAi({query:'Question',context:'List',history:[]},new AbortController().signal),{ok:false,error:'Please wait a few minutes.',retryable:false});}finally{global.fetch=prior;}
});

test('a temporary catalogue outage exposes an explicit AI retry rather than a successful empty plan',async()=>{
 const prior=global.fetch;
 global.fetch=async()=>({ok:false,status:503,json:async()=>({success:false,message:'The catalogue is temporarily unavailable. Please try again.'})});
 try{
  const reply=await askWeddingAi({query:'Generate',context:'300 guests, NGN 5000000',history:[]},new AbortController().signal);
  assert.equal(reply.ok,false);assert.equal(reply.retryable,true);assert.match(reply.error,/catalogue/);
 }finally{global.fetch=prior;}
});

test('occasion request sends attachment and bounded retained reference with the selected occasion',async()=>{
 const prior=global.fetch;let request;
 global.fetch=async(url,options)=>{request=options.body;return {ok:true,status:200,json:async()=>({success:true,data:{response:'Let us plan.',attachmentContext:'12 Apple Juice'}})};};
 try{
  const file=new File(['12 Apple Juice'],'reception.csv',{type:'text/csv'});
  const reply=await askWeddingAi({query:'My list',context:'Current picks',history:[],occasion:'corporate',attachment:file,reference:'Previous uploaded list'},new AbortController().signal);
  assert.equal(request.get('mode'),'occasion');assert.equal(request.get('occasion'),'corporate');
  assert.equal(request.get('file').name,'reception.csv');assert.match(request.get('conversationHistory'),/Previous uploaded list/);
  assert.equal(reply.attachmentContext,'12 Apple Juice');
 }finally{global.fetch=prior;}
});
test('unsupported and oversized attachments are rejected before an AI request',async()=>{
 const prior=global.fetch;let calls=0;global.fetch=async()=>{calls++;throw Error('must not send');};
 try{
  const input={query:'Review',context:'List',history:[]};
  const bad=await askWeddingAi({...input,attachment:new File(['x'],'bad.exe')},new AbortController().signal);
  assert.equal(bad.ok,false);assert.match(bad.error,/supported|PDF/i);
  const big=await askWeddingAi({...input,attachment:new File([new Uint8Array(8*1024*1024+1)],'large.csv')},new AbortController().signal);
  assert.equal(big.ok,false);assert.match(big.error,/8 MB/);assert.equal(calls,0);
 }finally{global.fetch=prior;}
});

test('long occasion conversations keep opening requirements and recent corrections inside server history limits',async()=>{
 const prior=global.fetch;let body;
 global.fetch=async(url,options)=>{body=options.body;return {ok:true,status:200,json:async()=>({success:true,data:{response:'Plan'}})};};
 try{
  const history=Array.from({length:40},(_,i)=>({role:i%2?'assistant':'user',content:`Turn ${i}: ${'detail '.repeat(200)}`}));
  history[0].content='Original requirements: 80 guests, Abuja, NGN 100000';history[39].content='Latest correction: 60 guests';
  await askWeddingAi({query:'Summarise',context:'x'.repeat(6000),reference:'r'.repeat(5000),history},new AbortController().signal);
  const sent=JSON.parse(body.get('conversationHistory'));
  assert(sent.some(turn=>turn.content.includes('Original requirements')));
  assert(sent.some(turn=>turn.content.includes('Latest correction')));
  assert(sent.length<=20);assert(sent.reduce((sum,turn)=>sum+turn.content.length,0)<=24000);
 }finally{global.fetch=prior;}
});

test('occasion photo uses the vision field and unreadable uploads remain visible failures',async()=>{
 const prior=global.fetch;let body;
 global.fetch=async(url,options)=>{body=options.body;return {ok:true,status:200,json:async()=>({success:true,data:{response:'I could not read the photo.',attachmentUnreadable:true}})};};
 try{
  const reply=await askWeddingAi({query:'My list',context:'Picks',history:[],attachment:new File(['image bytes'],'list.png',{type:'image/png'})},new AbortController().signal);
  assert.equal(body.get('images').name,'list.png');assert.equal(body.get('file'),null);
  assert.equal(reply.ok,false);assert.equal(reply.retryable,false);assert.match(reply.error,/could not read/);
 }finally{global.fetch=prior;}
});

test('a full generated plan and recent customer correction survive the next AI request',async()=>{
 const prior=global.fetch;let body;
 global.fetch=async(url,options)=>{body=options.body;return {ok:true,status:200,json:async()=>({success:true,data:{response:'Understood'}})};};
 try{
  const plan='Proposed drinks list\n'+'Catalogue item and price detail. '.repeat(65)+'\nFINAL_ITEM: 18 Pineapple Juice; subtotal NGN 122700; remaining NGN 27300';
  await askWeddingAi({query:'Change the final item',context:'Current selected bottles',history:[{role:'user',content:'40 guests, NGN 150000'},{role:'assistant',content:plan},{role:'user',content:'Change to 30 guests and alcohol-free only.'}]},new AbortController().signal);
  const sent=JSON.parse(body.get('conversationHistory'));
  assert(sent.some(turn=>turn.content.includes('FINAL_ITEM: 18 Pineapple Juice')),'last list rows must survive follow-up');
  assert(sent.some(turn=>turn.content.includes('30 guests and alcohol-free only')));
 }finally{global.fetch=prior;}
});

test('only matching verified generated quantities become selectable product quantities',async()=>{
 const prior=global.fetch;
 global.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,data:{response:'Proposed list',products:[{id:'juice',name:'Apple Juice',slug:'apple-juice'},{id:'wine',name:'Wine',slug:'wine'},{id:'bad',name:'Bad quantity',slug:'bad'}],generatedList:{items:[{productId:'juice',quantity:12},{productId:'foreign',quantity:50},{productId:'bad',quantity:1.5}]}}})});
 try{
  const reply=await askWeddingAi({query:'Generate',context:'List',history:[]},new AbortController().signal);
  assert.equal(reply.products[0].suggestedQuantity,12);
  assert.equal(reply.products[1].suggestedQuantity,undefined);
  assert.equal(reply.products[2].suggestedQuantity,undefined);
  assert.equal(reply.products.length,3);
 }finally{global.fetch=prior;}
});

test('complete wedding plans expose all product choices beyond the first six',async()=>{
 const prior=global.fetch;const products=Array.from({length:12},(_,i)=>({id:`drink-${i}`,name:`Drink ${i}`,slug:`drink-${i}`}));
 global.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,data:{response:'Wedding plan',products,generatedList:{items:products.map(product=>({productId:product.id,quantity:10}))}}})});
 try{const reply=await askWeddingAi({query:'Plan my wedding',context:'300 guests',history:[]},new AbortController().signal);assert.equal(reply.products.length,12);assert.equal(reply.products[11].suggestedQuantity,10);}finally{global.fetch=prior;}
});

test('a long complete wedding plan retains its middle products when asking a follow-up',async()=>{
 const prior=global.fetch;let sent;
 global.fetch=async(url,options)=>{sent=JSON.parse(options.body.get('conversationHistory'));return {ok:true,status:200,json:async()=>({success:true,data:{response:'Updated plan'}})};};
 try{
  const plan='A'.repeat(3000)+'\nMIDDLE_SELECTION: 24 bottles of wedding wine\n'+'B'.repeat(3000);
  await askWeddingAi({query:'Keep the middle wine selection',context:'Wedding,300 guests, NGN5000000',history:[{role:'user',content:'Original event brief'},{role:'assistant',content:plan}]},new AbortController().signal);
  assert(sent.map(turn=>turn.content).join('').includes('MIDDLE_SELECTION: 24 bottles of wedding wine'));
  assert(sent.every(turn=>turn.content.length<=4000));assert(sent.length<=20);assert(sent.reduce((n,turn)=>n+turn.content.length,0)<=24000);
 }finally{global.fetch=prior;}
});
