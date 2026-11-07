#!/usr/bin/env node
'use strict';
// Explicit operator database + mapping; no .env or automatic publication grant.
const fs=require('node:fs');const mongoose=require('mongoose');
async function main(){
 const path=process.argv.find(a=>a.startsWith('--mapping='))?.slice(10);
 const apply=process.argv.includes('--apply');
 if(!path||!process.env.VENUE_REVIEW_MONGO_URI)throw new Error('Explicit database and mapping required');
 if(apply&&!process.argv.includes('--publication-reviewed'))throw new Error('Publication review acknowledgement required');
 const mapping=JSON.parse(fs.readFileSync(path,'utf8'));
 if(Object.keys(mapping).some(k=>!['tenantId','locationId','expectedVersion','profileVersion','reviewerId'].includes(k)))throw new Error('Unsupported mapping field');
 await mongoose.connect(process.env.VENUE_REVIEW_MONGO_URI,{autoIndex:false,serverSelectionTimeoutMS:10000});
 console.log(JSON.stringify(await require('../services/venue/publication').reviewProfile({...mapping,apply}),null,2));
}
main().catch(error=>{console.error(`Publication review failed: ${error.code||'CONFIGURATION_OR_DATABASE_ERROR'}. Database URI withheld.`);process.exitCode=1;}).finally(()=>mongoose.disconnect());
