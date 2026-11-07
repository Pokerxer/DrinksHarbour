const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
require('../models/Tenant');require('../models/Product');require('../models/SubProduct');require('../models/Size');
const auth=require('../middleware/auth.middleware'),controller=require('../controllers/occasionRequest.controller');
test('occasion files, contacts, AI and reply actions reject public/tenant callers before accessing request records',async t=>{
 let accesses=0;
 t.mock.method(auth,'protect',(req,res,next)=>{if(!req.headers['x-test-role'])return res.status(401).json({message:'Sign in'});req.user={role:req.headers['x-test-role']};next();});
 for(const method of ['list','detail','file','save','generate','send','recordWhatsApp','publishChat'])t.mock.method(controller,method,(req,res)=>{accesses++;res.json({success:true});});
 const app=express();app.use(express.json());delete require.cache[require.resolve('../routes/occasionRequest.routes')];app.use('/requests',require('../routes/occasionRequest.routes'));app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>server.close());const url=`http://127.0.0.1:${server.address().port}/requests`;
 const paths=[['GET',''],['GET','/507f1f77bcf86cd799439011'],['GET','/507f1f77bcf86cd799439011/file'],['PATCH','/507f1f77bcf86cd799439011/draft'],['POST','/507f1f77bcf86cd799439011/generate'],['POST','/507f1f77bcf86cd799439011/send'],['POST','/507f1f77bcf86cd799439011/record-whatsapp'],['POST','/507f1f77bcf86cd799439011/publish']];
 for(const role of ['', 'customer','tenant_owner','tenant_admin','tenant_staff'])for(const [method,path]of paths){const response=await fetch(url+path,{method,headers:role?{'x-test-role':role}:{}});assert.equal(response.status,role?403:401,`${role||'public'} ${method}${path}`);}
 assert.equal(accesses,0);
 for(const role of ['admin','super_admin']){const response=await fetch(url, {headers:{'x-test-role':role}});assert.equal(response.status,200);}assert.equal(accesses,2);
});
