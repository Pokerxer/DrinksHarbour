'use strict';
const {AppError}=require('../utils/errors');
async function assertUniqueIndexes(Model,patterns,code){
 let indexes;
 try{indexes=await Model.collection.indexes();}catch(error){if(error.code!==26)throw error;indexes=[];}
 const present=pattern=>indexes.some(index=>index.unique===true&&!index.sparse&&!index.partialFilterExpression&&index.expireAfterSeconds===undefined&&Object.keys(index.key).length===Object.keys(pattern).length&&Object.entries(pattern).every(([key,value])=>index.key[key]===value));
 if(!patterns.every(present))throw Object.assign(new AppError('Market namespace indexes require reviewed preparation',503),{code});
}
module.exports={assertUniqueIndexes};
