'use strict';
const {id}=require('./eligibility');
const {fail}=require('./errors');
const {ownedBooking}=require('./advances');
const {runVenueOperation}=require('./operations');
async function accept(args){
 if(args.acceptedTerms!==true)fail('TERMS_ACCEPTANCE_REQUIRED','Accept the disclosed booking financial terms',400);
 const original=await ownedBooking(args);
 return runVenueOperation({tenantId:id(original.tenant),locationId:id(original.location),actor:{userId:args.customerId,role:'customer'},operation:'booking.financial_consent',key:args.idempotencyKey,targetType:'Booking',payload:{reference:args.reference,expectedVersion:args.expectedVersion,policyVersion:args.policyVersion},execute:async({mongoSession})=>{
  const booking=await ownedBooking(args,mongoSession);
  if(booking.requestVersion!==args.expectedVersion||booking.financialPolicy?.version!==args.policyVersion||booking.status!=='confirmed'||booking.serviceSession)fail('STATE_CHANGED','Review the current accepted booking and financial terms');
  booking.financialTermsVersion=args.policyVersion;booking.financialTermsAcceptedAt=new Date();booking.requestVersion++;
  await booking.save({session:mongoSession});
  return require('./reservations').requestDTO(booking);
 }});
}
module.exports={accept};
