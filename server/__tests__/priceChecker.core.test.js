const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBarcode, validateSettings, validateKiosk } = require('../services/priceChecker/validation');
const { resolvePrice, stockState } = require('../services/priceChecker/pricing');
const { publicProduct } = require('../services/priceChecker/serialization');
const { issueSession, verifySession } = require('../services/priceChecker/session');
const base = { size: { sellingPrice: 1000, currency: 'NGN', costPrice: 600 }, subProduct: { _id: 's', baseSellingPrice: 2000, salePrice: 10 }, currency: 'NGN' };
test('barcodes preserve leading zeros and case and reject query objects/short input', () => {
  assert.equal(normalizeBarcode(' 001Abc '), '001Abc');
  for (const value of ['1234', '', {$ne: ''}, 12345, '12345\n678']) assert.throws(() => normalizeBarcode(value));
});
test('settings are bounded and reject scripts, invalid colors and unknown keys', () => {
  assert.equal(validateSettings({ resetSeconds: 8 }).resetSeconds, 8);
  for (const data of [{resetSeconds: 2},{resetSeconds:31},{displayStockQuantity:'false'},{logo:'javascript:alert(1)'},{background:'#oops'},{tenant:'other'}]) assert.throws(() => validateSettings(data));
});
test('management cannot set tenant, secrets, marketplace mode or malformed ids', () => {
  for (const data of [{tenant:'other'}, {version:0}, {mode:'MARKETPLACE'}, {location:{$ne:''}}, {slug:'Bad Slug'}]) assert.throws(() => validateKiosk(data, true));
});
test('exact size retail wins and website sale/markup never changes it', () => {
  assert.equal(resolvePrice(base).price, 1000);
  assert.equal(resolvePrice({...base, subProduct:{...base.subProduct, product:{platformMarkup:60}, flashSale:{isActive:true,discountPercentage:99}}}).price,1000);
});
test('pricelist modifiers follow base setters; original is the real pre-discount price', () => {
  const result = resolvePrice({...base, pricelist:{currency:'NGN', rules:[{priceType:'fixed',fixedPrice:1200,sequence:0},{priceType:'discount',discountPercentage:10,sequence:1}]}});
  assert.equal(result.price,1080); assert.equal(result.originalPrice,1200);
});
test('expired/future/quantity and cart rules do not discount one scanned item', () => {
  const rules = [
    {priceType:'discount',discountPercentage:50,endDate:'2000-01-01'},
    {priceType:'discount',discountPercentage:50,startDate:'2099-01-01'},
    {priceType:'discount',discountPercentage:50,minQuantity:2},
    {priceType:'cart_threshold',discountPercentage:50,thresholdAmount:0},
  ];
  assert.equal(resolvePrice({...base,pricelist:{currency:'NGN',rules}}).price,1000);
});
test('missing prices and mismatched currencies fail closed', () => {
  assert.throws(() => resolvePrice({...base, currency:'USD'}));
  assert.throws(() => resolvePrice({...base, pricelist:{currency:'USD',rules:[]}}));
  assert.throws(() => resolvePrice({...base,size:{sellingPrice:0},subProduct:{}}));
});
test('stock subtracts reservations and does not use tenant-wide quantity', () => {
  assert.deepEqual(stockState({currentQuantity:5,reservedQuantity:3,minStockLevel:3}),{quantity:2,availability:'LOW_STOCK'});
  assert.equal(stockState(null).availability,'OUT_OF_STOCK');
  assert.equal(stockState({currentQuantity:2,reservedQuantity:9}).quantity,0);
});
test('public product explicitly omits private fields and disabled display fields', () => {
  const result = publicProduct({product:{name:'Bottle',brand:{name:'Brand'},isAlcoholic:true,costPrice:50},size:{size:'70cl',barcode:'00123'},pricing:{price:100,currency:'NGN',originalPrice:120},stock:{quantity:2,availability:'LOW_STOCK'},settings:{displayImages:false,displayBrand:false,displaySize:false,displayBarcode:false,displayStockStatus:false,displayStockQuantity:false,displayPromotions:false}});
  assert.equal(result.name,'Bottle'); assert.equal(result.price,100);
  for(const key of ['costPrice','_id','quantity','barcode','size','brand','image','availability','originalPrice']) assert.equal(result[key],undefined);
});
test('kiosk session validates purpose, expiry and signature independently of admin JWTs', () => {
  process.env.JWT_SECRET = 'price-check-test-secret';
  const kiosk={_id:'a'.repeat(24),version:3};
  const token=issueSession(kiosk);
  assert.equal(verifySession(token).version,3);
  assert.throws(()=>verifySession(token+'x'));
  const jwt=require('jsonwebtoken');
  assert.throws(()=>verifySession(jwt.sign({id:kiosk._id},process.env.JWT_SECRET)));
  assert.throws(()=>verifySession(jwt.sign({kiosk:kiosk._id,version:3},process.env.JWT_SECRET,{audience:'price-checker',issuer:'drinksharbour',expiresIn:-1})));
});
test('tax display preference never adds tax again to the POS retail amount', () => {
  const result=resolvePrice({...base,tenant:{posSettings:{taxRate:7.5,productPriceDisplay:'tax_included'}}});
  assert.equal(result.price,1000); assert.equal(result.taxLabel,'Includes tax');
});
