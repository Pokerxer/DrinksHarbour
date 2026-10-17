import {describe,it,expect} from 'vitest';
import {productTypes} from '@/app/shared/ecommerce/product/create-edit/form-utils';
import {productTypes as tenantTypes} from '@/app/shared/ecommerce/sub-product/create-edit/form-utils';
import {productFormSchema} from '@/validators/create-product.schema';
const values=['syrup','flavoured_syrup','fruit_syrup','sugar_free_syrup','fruit_puree','fruit_mix','juice_concentrate','beverage_concentrate','cocktail_mix','dessert_sauce','frappe_mix','malt_drink','palm_wine','rice_wine','shochu','baijiu','cordial','shrub'];
describe('whole catalog expanded product types',()=>{
 it.each(values)('offers and accepts %s in both product flows',value=>{
  expect(productTypes.some(p=>p.value===value)).toBe(true);
  expect(tenantTypes.some(p=>p.value===value)).toBe(true);
  expect(productFormSchema.shape.type.safeParse(value).success).toBe(true);
 });
 it('keeps unknown values invalid',()=>expect(productFormSchema.shape.type.safeParse('invented_type').success).toBe(false));
});

import {categoryFormSchema} from '@/validators/create-category.schema';
describe('expanded category classification',()=>{
 it.each(['sake','fermented_drink','non_alcoholic'])('accepts %s when editing the new categories',value=>{
  expect(categoryFormSchema.shape.type.safeParse(value).success).toBe(true);
 });
});
