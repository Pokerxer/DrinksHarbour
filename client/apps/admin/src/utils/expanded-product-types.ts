import {generalProductTypeValues,generalProductTypeOptions} from './general-product-types';
// Keep in sync with server/constants/expandedProductTypes.js.
export const expandedProductTypeValues = ["syrup","flavoured_syrup","fruit_syrup","sugar_free_syrup","fruit_puree","fruit_mix","juice_concentrate","beverage_concentrate","cocktail_mix","dessert_sauce","frappe_mix","malt_drink","palm_wine","rice_wine","shochu","baijiu","cordial","shrub",...generalProductTypeValues] as const;
export const expandedProductTypeOptions = [
  ...generalProductTypeOptions,
  {value:'syrup',label:"Syrup",category:'Non-Alcoholic'},
  {value:'flavoured_syrup',label:"Flavoured Syrup",category:'Non-Alcoholic'},
  {value:'fruit_syrup',label:"Fruit Syrup",category:'Non-Alcoholic'},
  {value:'sugar_free_syrup',label:"Sugar-Free Syrup",category:'Non-Alcoholic'},
  {value:'fruit_puree',label:"Fruit Purée",category:'Non-Alcoholic'},
  {value:'fruit_mix',label:"Fruit Mix",category:'Non-Alcoholic'},
  {value:'juice_concentrate',label:"Juice Concentrate",category:'Non-Alcoholic'},
  {value:'beverage_concentrate',label:"Beverage Concentrate",category:'Non-Alcoholic'},
  {value:'cocktail_mix',label:"Cocktail Mix",category:'Non-Alcoholic'},
  {value:'dessert_sauce',label:"Dessert & Drink Sauce",category:'Non-Alcoholic'},
  {value:'frappe_mix',label:"Frappé & Smoothie Base",category:'Non-Alcoholic'},
  {value:'malt_drink',label:"Non-Alcoholic Malt Drink",category:'Non-Alcoholic'},
  {value:'palm_wine',label:"Palm Wine",category:'Alcoholic'},
  {value:'rice_wine',label:"Rice Wine",category:'Alcoholic'},
  {value:'shochu',label:"Shochu",category:'Alcoholic'},
  {value:'baijiu',label:"Baijiu",category:'Alcoholic'},
  {value:'cordial',label:"Cordial",category:'Non-Alcoholic'},
  {value:'shrub',label:"Shrub",category:'Non-Alcoholic'},
];
