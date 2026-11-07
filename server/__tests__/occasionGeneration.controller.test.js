const test=require('node:test');const assert=require('node:assert/strict');
require('../models/Tenant');require('../models/Product');require('../models/SubProduct');require('../models/Size');
const service=require('../services/chatbot.service');const controller=require('../controllers/chatbot.controller');
function response(){return {code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
test('public occasion AI is retired and does not invoke paid planning for requests or uploads',async t=>{
 let calls=0;t.mock.method(service,'handleChatbotQuery',async()=>{calls++;throw Error('Public occasion AI must not run');});
 for(const body of [{mode:'occasion',occasion:'weddings',query:'Plan my wedding'},{mode:'occasion',generation:JSON.stringify({categories:['wine'],budget:5000000,guests:300})},{mode:'occasion',generation:'invalid'}]){
  const res=response();await controller.query({body,files:{file:[{originalname:'list.txt',buffer:Buffer.from('Wine x12')}] }},res);
  assert.equal(res.code,410);assert.match(res.body.message,/reviewed by our team/);
 }
 assert.equal(calls,0);
});
