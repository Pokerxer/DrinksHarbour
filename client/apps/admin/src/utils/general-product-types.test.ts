import {describe,it,expect} from 'vitest';
import {productTypes} from '@/app/shared/ecommerce/product/create-edit/form-utils';
import {productTypes as tenantTypes} from '@/app/shared/ecommerce/sub-product/create-edit/form-utils';
import {productFormSchema} from '@/validators/create-product.schema';
import {isBeverageProductType} from './product-types';
import {generalProductTypeValues,generalNonBeverageTypes} from './general-product-types';
describe('general catalog type support',()=>{
 it.each(generalProductTypeValues)('offers and accepts %s',value=>{
  expect(productTypes.some(t=>t.value===value)).toBe(true);
  expect(tenantTypes.some(t=>t.value===value)).toBe(true);
  expect(productFormSchema.shape.type.safeParse(value).success).toBe(true);
 });
 it.each(generalNonBeverageTypes)('hides beverage fields for %s',value=>expect(isBeverageProductType(value)).toBe(false));
 it('retains beverage fields for coffee beans and traditional drinks',()=>{
  expect(isBeverageProductType('coffee_beans')).toBe(true);
  expect(isBeverageProductType('hibiscus_drink')).toBe(true);
 });
});
