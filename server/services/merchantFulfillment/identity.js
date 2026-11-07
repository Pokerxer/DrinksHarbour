'use strict';
const {ConflictError}=require('../../utils/errors');
const versions=Object.freeze([1,2]);
function managed(order){return versions.includes(order?.merchantFulfillmentVersion);}
function managedFilter(){return {merchantFulfillmentVersion:{$in:[...versions]}};}
function legacyFilter(){return {merchantFulfillmentVersion:{$nin:[...versions]}};}
function assertLegacy(order,message='Use the owned merchant fulfillment command'){
 if(managed(order))throw new ConflictError(message);
}
module.exports={managed,managedFilter,legacyFilter,assertLegacy};
