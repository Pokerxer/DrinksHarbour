import { requestKey } from './api';
export type Hours = { day: number; opens: string; closes: string; overnight?: boolean };
export type Profile = { slug: string; name: string; types: string[]; timezone: string; description: string; address: string; hours: Hours[]; exceptions: {date:string;closed:boolean;opens?:string;closes?:string;overnight?:boolean}[]; policies: string; publicPhone?:string; photos?:{url:string;alt:string}[] };
// Modifier options reference their own SubProduct/Size; extras are priced only
// at order time through those refs — menu items never carry a price.
export type MenuItemModifierOption = { id:string; label:string; subProductId:string; sizeId:string };
export type MenuItemModifierGroup = { id:string; name:string; required:boolean; minSelect:number; maxSelect:number; incompatibleWith:string[]; options:MenuItemModifierOption[] };
export type MenuItem = { menuItemId?:string;categoryId?:string;servingVersion?:number;acceptedRecipeVersionId?:string;modifierSchemaVersion?:2; subProductId:string; sizeId:string; published:boolean; display?:string; category?:string; modifierGroups?:MenuItemModifierGroup[]; pourMl?:number };
export type Menu = { schemaVersion?:2;categories?:{id:string;sectionId:string;parentId:string|null;name:string;sortOrder:number}[];sections: {id:string;name:string;items:MenuItem[];servicePresetIds?:string[]}[] };
export type Floor = {zones:{id:string;name:string}[];tables:{tableId:string;zone:string;x:number;y:number;shape:string}[]};
export type Configuration = {locationId:string;version:number;profileVersion:number;publication:string;profile:Profile|null;menu:Menu;floor:Floor};
export type CapacityClaim = {id:string;state:string;version:number;resourceIds:string[];policyVersion:number;start:string;end:string;expiresAt:string|null};
export type RequestRow = {id:string;reference:string;status:string;statusLabel:string;requestState:string;version:number;bookingAt:string;partySize:number;guest:{name:string;phone:string};locationId:string;serviceSessionId:string|null;capacity?:CapacityClaim|null;policy:{timezone:string;policies:string;locationName:string;venueName:string}};
export type Workspace = {capacityEnabled?:boolean;config:Configuration;tables:{_id:string;name:string;seats:number;status:string;venueVersion:number}[];visits:{_id:string;state:string;version:number;booking?:string;businessDate:string}[];canBill?:boolean;canReview?:boolean;canManage:boolean;capabilities?:string[];canonicalCheckoutEnabled:boolean;readiness:Record<string,string|boolean>};
export type Candidate = {id:string;name:string;sizes:{id:string;name:string}[]};
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
export async function experienceRequest<T>(token:string,path:string,method='GET',body?:unknown):Promise<T>{
 const headers:Record<string,string>={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 if(method!=='GET')headers['Idempotency-Key']=await requestKey(JSON.stringify([token,path,body]));
 const response=await fetch(`${API}/api/venue-experience/staff${path}`,{method,headers,cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json() as {data:T;message?:string};if(!response.ok)throw new Error(result.message||'Unable to load venue. Reload and retry.');return result.data;
}
