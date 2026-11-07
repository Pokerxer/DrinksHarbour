'use strict';
const axios=require('axios');
function options(){if(!process.env.PAYSTACK_SECRET_KEY)throw Object.assign(new Error('Provider refund configuration required'),{code:'PROVIDER_NOT_CONFIGURED'});return {timeout:15000,headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'}};}
async function create({reference,amountMinor,currency,caseId}){
 const response=await axios.post('https://api.paystack.co/refund',{transaction:reference,amount:amountMinor,currency,merchant_note:`Venue refund case ${caseId}`},options());
 if(response.data?.status!==true||!response.data.data)throw new Error('Provider outcome unknown');return response.data.data;
}
async function fetch(refundId){if(!/^[\w-]+$/.test(String(refundId)))throw new Error('Invalid refund reference');const response=await axios.get(`https://api.paystack.co/refund/${encodeURIComponent(refundId)}`,options());if(response.data?.status!==true||!response.data.data)throw new Error('Provider refund verification unavailable');return response.data.data;}
module.exports={create,fetch};
