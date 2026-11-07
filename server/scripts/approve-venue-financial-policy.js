#!/usr/bin/env node
'use strict';
const fs=require('node:fs/promises');const mongoose=require('mongoose');
function flag(name){const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];}
async function main(){
 const uri=process.env.VENUE_POLICY_MONGO_URI;if(!uri)throw new Error('Explicit VENUE_POLICY_MONGO_URI is required; no application fallback');
 const apply=process.argv.includes('--apply');if(apply&&!process.argv.includes('--policy-approval-reviewed'))throw new Error('Apply requires explicit reviewed approval');
 const input=flag('--input');if(!input)throw new Error('A reviewed policy JSON file is required');
 const config=JSON.parse(await fs.readFile(input,'utf8'));
 await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:10000});
 const service=require('../services/venue/policy-approval');
 if(process.argv.includes('--prepare-indexes')){if(!apply||!process.argv.includes('--index-change-reviewed'))throw new Error('Policy index preparation requires apply and explicit index review');await service.preparePolicyIndexes();}
 const result=await service.reviewPolicy({tenantId:flag('--tenant-id'),locationId:flag('--location-id'),reviewerId:flag('--reviewer-id'),config,apply});
 console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(error=>{console.error(`Venue policy review failed (${typeof error.code==='string'?error.code:'VALIDATION_OR_TARGET_ACCESS'}); target URI withheld.`);process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={main};
