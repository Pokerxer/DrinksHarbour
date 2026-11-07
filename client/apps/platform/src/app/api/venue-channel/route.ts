import {NextRequest,NextResponse} from 'next/server';import {createHmac} from 'node:crypto';
export async function POST(req:NextRequest){
 const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(process.env.VENUE_EXPERIENCE_ENABLED!=='true')return reply({message:'Requests are not available'},404);
 const secret=process.env.VENUE_CHANNEL_SECRET;if(!secret)return reply({message:'Venue requests are awaiting service setup. Please contact support.'},503);
 const raw=await req.text();if(Buffer.byteLength(raw)>16384)return reply({message:'Request is too large'},413);
 let data:{slug?:string;locationSlug?:string;input?:unknown};try{data=JSON.parse(raw);}catch{return reply({message:'Invalid request'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return reply({message:'Invalid request'},400);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug||'')||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.locationSlug||'')||!data.input||typeof data.input!=='object')return reply({message:'Choose a venue location'},400);
 const hostname=(req.headers.get('host')||req.nextUrl.host).split(':')[0].toLowerCase();
 const match=hostname.match(/^([a-z0-9-]+)\.drinksharbour\.com$/)||process.env.NODE_ENV!=='production'&&hostname.match(/^([a-z0-9-]+)\.localhost$/);
 let channel='platform';
 if(match&&!['www','api','admin','platform'].includes(match[1])){if(match[1]!==data.slug)return reply({message:'Venue does not match this website'},404);channel='direct';}
 else if(!['drinksharbour.com','www.drinksharbour.com','localhost','127.0.0.1'].includes(hostname)&&!/^drinks-harbour[a-z0-9-]*\.vercel\.app$/.test(hostname))return reply({message:'Unknown venue website'},404);
 const issued=String(Math.floor(Date.now()/1000));const signature=createHmac('sha256',secret).update([channel,data.slug,data.locationSlug,issued,JSON.stringify(data.input)].join('\n')).digest('hex');
 return reply({channel,issued,signature});
}
