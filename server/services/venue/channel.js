'use strict';
const crypto=require('node:crypto');const {fail}=require('./errors');
function verifyChannel({channel,slug,locationSlug,issued,body,signature,secret=process.env.VENUE_CHANNEL_SECRET,now=Date.now()}){
 if(!secret||!['direct','platform'].includes(channel)||!/^\d+$/.test(issued||'')||Math.abs(now-Number(issued)*1000)>300000||typeof signature!=='string'||!/^[a-f0-9]{64}$/.test(signature))fail('INVALID_CHANNEL','Venue channel verification failed',403);
 const expected=crypto.createHmac('sha256',secret).update([channel,slug,locationSlug,issued,body].join('\n')).digest();
 if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex')))fail('INVALID_CHANNEL','Venue channel verification failed',403);
 return channel==='direct'?'direct':'discovery';
}
module.exports={verifyChannel};
