'use strict';
const path=require('node:path');
const occasions=['weddings','corporate','house-parties','gifting','bulk'];
const categories=['toast','wine','beer','spirits','alcohol-free'];
const invalid=message=>Object.assign(new Error(message),{statusCode:400});
const text=(value,max,label)=>{if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw invalid(`Check ${label}.`);return value.trim();};
function validateRequest(input,hasFile=false){
 if(!input||typeof input!=='object')throw invalid('Enter your request details.');
 const submissionKey=text(input.submissionKey,36,'submission reference');
 if(!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(submissionKey))throw invalid('Refresh the form and try again.');
 if(!occasions.includes(input.occasion))throw invalid('Choose an occasion.');
 const name=text(input.name,80,'your name'),city=text(input.city,80,'delivery city');
 if(name.length<2||city.length<2)throw invalid('Enter your name and delivery city.');
 const channel=input.channel;if(!['email','whatsapp'].includes(channel))throw invalid('Choose email or WhatsApp for your reply.');
 const email=channel==='email'?text(input.email,254,'email address').toLowerCase():'';
 let whatsapp=channel==='whatsapp'?text(input.whatsapp,25,'WhatsApp number'):'';
 if(channel==='email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n<>,;:"\\]/.test(email)))throw invalid('Enter a valid email address.');
 if(whatsapp){if(!/^\+?[\d\s()-]+$/.test(whatsapp))throw invalid('Enter a valid WhatsApp number.');whatsapp=whatsapp.replace(/\D/g,'');if(/^0\d{10}$/.test(whatsapp))whatsapp=`234${whatsapp.slice(1)}`;if(!/^[1-9]\d{7,14}$/.test(whatsapp))throw invalid('Enter a WhatsApp number with country code.');}
 if(channel==='whatsapp'&&!whatsapp)throw invalid('Enter your WhatsApp number.');
 if(input.consent!==true)throw invalid('Allow our team to contact you about this request.');
 const date=text(input.date,10,'event date'),guests=text(String(input.guests??''),8,'guest count'),budget=text(String(input.budget??''),16,'budget'),notes=text(input.notes,2000,'requirements');
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())))throw invalid('Choose a valid future event date.');
 if(guests&&(!/^\d+$/.test(guests)||Number(guests)<1||Number(guests)>100000))throw invalid('Enter a whole guest count from 1 to 100,000.');
 if(budget&&(!/^\d+(\.\d{1,2})?$/.test(budget)||Number(budget)<=0||!Number.isSafeInteger(Math.round(Number(budget)*100))))throw invalid('Enter a positive drinks budget in naira.');
 const preferences=input.preferences??[];
 if(!Array.isArray(preferences)||preferences.length>5||preferences.some(value=>!categories.includes(value)))throw invalid('Check your category preferences.');
 if(!Array.isArray(input.items??[])||(input.items??[]).length>20)throw invalid('Include up to 20 catalogue bottles.');
 const items=(input.items??[]).map(item=>{if(!item||typeof item.productId!=='string'||!/^[a-f\d]{24}$/i.test(item.productId)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>9999)throw invalid('Check your catalogue quantities.');return {productId:item.productId,name:text(item.name,200,'bottle name'),quantity:item.quantity};});
 if(!notes&&!items.length&&!preferences.length&&!hasFile)throw invalid('Describe what you need, choose drinks or attach your list.');
 return {submissionKey,occasion:input.occasion,name,channel,email,whatsapp,city,date,guests:guests?Number(guests):undefined,budget:budget?Number(budget):undefined,notes,preferences:[...new Set(preferences)],items,consentAt:new Date()};
}
function validateAttachment(file){
 if(!file)return undefined;
 const name=path.basename(String(file.originalname||'').replace(/\\/g,'/')).replace(/[\u0000-\u001f\u007f]/g,'').slice(0,150);
 const ext=name.split('.').pop().toLowerCase(),buffer=file.buffer;
 const types={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',csv:'text/csv',txt:'text/plain',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
 if(!types[ext]||!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>(['jpg','jpeg','png','webp'].includes(ext)?5:8)*1024*1024)throw invalid('Choose a supported document up to 8 MB or photo up to 5 MB.');
 const magic=buffer.subarray(0,12),hex=magic.toString('hex');
 if((ext==='pdf'&&!magic.toString().startsWith('%PDF-'))||(['docx','xlsx'].includes(ext)&&!hex.startsWith('504b'))||(ext==='xls'&&!hex.startsWith('d0cf11e0'))||(['jpg','jpeg'].includes(ext)&&!hex.startsWith('ffd8ff'))||(ext==='png'&&!hex.startsWith('89504e470d0a1a0a'))||(ext==='webp'&&!(magic.toString().startsWith('RIFF')&&magic.toString().slice(8)==='WEBP'))||(['txt','csv'].includes(ext)&&buffer.includes(0)))throw invalid('The file contents do not match a supported list or photo.');
 return {name,contentType:types[ext],size:buffer.length,data:buffer};
}
module.exports={validateRequest,validateAttachment,invalid};
