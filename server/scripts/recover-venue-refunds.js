#!/usr/bin/env node
'use strict';
const mongoose=require('mongoose');
function flag(name){const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];}
async function main(){
 const uri=process.env.VENUE_REFUND_RECOVERY_MONGO_URI;if(!uri)throw new Error('Explicit VENUE_REFUND_RECOVERY_MONGO_URI is required; no application fallback');
 const apply=process.argv.includes('--apply');if(apply&&!process.argv.includes('--provider-reconciliation-reviewed'))throw new Error('Apply requires explicit provider reconciliation review');
 const caseIds=(flag('--case-ids')||'').split(',').filter(Boolean);
 await mongoose.connect(uri,{autoIndex:false,serverSelectionTimeoutMS:10000});
 console.log(JSON.stringify(await require('../services/venue/refund-recovery').recoverRefunds({tenantId:flag('--tenant-id'),caseIds,apply}),null,2));
}
if(require.main===module)main().catch(error=>{console.error(`Venue refund recovery failed (${typeof error.code==='string'?error.code:'VALIDATION_OR_TARGET_ACCESS'}); target URI withheld.`);process.exitCode=1;}).finally(()=>mongoose.disconnect());
module.exports={main};
