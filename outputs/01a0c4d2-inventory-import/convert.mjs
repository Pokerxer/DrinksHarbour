import fs from 'node:fs/promises';
import {FileBlob, SpreadsheetFile} from '@oai/artifact-tool';
const dir = '/Users/mac/Documents/drinksharbour/outputs/01a0c4d2-inventory-import';
const source = JSON.parse(await fs.readFile(`${dir}/source.json`, 'utf8'));
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load('/Users/mac/Downloads/extracted_product_list.xlsx'));
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:1000})).ndjson);
await fs.writeFile(`${dir}/before.png`,new Uint8Array(await (await wb.render({sheetName:'Products',range:'A1:C10',scale:1.5})).arrayBuffer()));
const sheet = wb.worksheets.getItem('Products');
const headers = ['productName','productType','brand','category','subCategory','subProductSku','costPrice','sellingPrice','size','sizeSku','barcode','sizePrice','sizeCostPrice','openingQty'];
const groups = {
  glassware:[3,5,9,15,16,17,37,44,45,46,47,48,49,54,55,56,57,58,59,60,66,67,68,69,76,77,78,80,81,82,83,84,85,86,87],
  bar_tool:[6,14],
  coffee:[4],
  tea:[70],
  snack:[50,51,61,62,63],
  liqueur:[64],
  whiskey:[65],
  gift_set:[7,18,19,20,21,22,23,25,27,28,29,31,32,39,41,42,43],
};
const rows = source.slice(1).map(([name,qty,price],i)=>{
  const sourceRow=i+2;
  const type=Object.keys(groups).find(t=>groups[t].includes(sourceRow))||'accessory';
  const size=[76,77].includes(sourceRow)?'set-6':sourceRow===85?'set-2':'unit-single';
  return [name,type,null,null,null,null,null,price,size,null,null,price,null,qty];
});
sheet.getUsedRange().clear({applyTo:'all'});
sheet.getRange('A1:N91').values=[headers,...rows];
sheet.getRange('A1:N91').format.font.name='Arial';
sheet.getRange('A1:N91').format.font.size=10;
sheet.getRange('A1:N91').format.rowHeight=21;
sheet.getRange('A1:N91').format.columnWidth=18;
sheet.getRange('A1:A91').format.columnWidth=53;
sheet.getRange('A1:N1').format.fill='#243746';
sheet.getRange('A1:N1').format.font.color='#FFFFFF';
sheet.getRange('A1:N1').format.font.bold=true;
sheet.getRange('A1:N1').format.rowHeight=28;
sheet.getRange('G2:H91').setNumberFormat('#,##0.00');
sheet.getRange('L2:M91').setNumberFormat('#,##0.00');
sheet.getRange('N2:N91').setNumberFormat('0');
sheet.getRange('F2:F91').setNumberFormat('@');
sheet.getRange('J2:K91').setNumberFormat('@');
sheet.freezePanes.freezeRows(1);
sheet.showGridLines=false;
sheet.tables.add('A1:N91',true,'InventoryImport');
for(const address of ['H23','L23','N23','H50','L50']) sheet.getRange(address).conditionalFormats.add('containsBlanks',{format:{fill:'#FFF0C2'}});
const notes = wb.worksheets.add('Review');
const noteRows=[
 ['Review before importing','Details'],
 ['Selling prices','Confirmed by user: Price (NGN) is selling price per item or set. Copied to sellingPrice and sizePrice.'],
 ['Missing quantity and price','Products row 23: Signature Collection (Baylis & Harding). Fill openingQty, sellingPrice and sizePrice.'],
 ['Missing price','Products row 50: Cashew Nut. Fill sellingPrice and sizePrice.'],
 ['Purchase costs','Not supplied. costPrice and sizeCostPrice are blank. Add actual costs before linking existing catalog products.'],
 ['Size convention','unit-single means one listed item or set, not a known bottle volume or weight.'],
 ['Explicit set sizes','Yu Jing Glass Ware 6pcs: set-6. 2-Piece Drink Ware Set: set-2. Quantities count sellable sets.'],
 ['Beverage sizes','Jagermeister and Jack Daniels have no bottle volume. Verify sizes before matching existing inventory.'],
 ['Product types','Inferred from names using supported types. Review ambiguous items and AI-enriched names in the import preview.'],
 ['Catalog identifiers','Brands, categories, SKUs and barcodes are not supplied and remain blank. Product names are preserved.'],
 ['Warehouse','Select the destination warehouse before Validate & preview because this file contains opening stock.'],
 ['Import mode','Create adds products/sizes and opening stock. Update existing sets stock to the supplied absolute quantity. Review matches first.'],
 ['Missing values','Blank means unknown, not zero. Complete highlighted cells before confirming the import.'],
 ['Source','/Users/mac/Downloads/extracted_product_list.xlsx, Products!A1:C91. All 90 rows retained in their original order.'],
 ['Verification scope','Workbook structure and source values checked locally. Live catalog matches and tenant limits require the application preview.'],
];
notes.getRange('A1:B15').values=noteRows;
notes.getRange('A1:B15').format.font.name='Arial';
notes.getRange('A1:B15').format.font.size=10;
notes.getRange('A1:A15').format.columnWidth=27;
notes.getRange('B1:B15').format.columnWidth=100;
notes.getRange('A1:B15').format.wrapText=true;
notes.getRange('A1:B15').format.rowHeight=38;
notes.getRange('A1:B1').format.fill='#243746';
notes.getRange('A1:B1').format.font.color='#FFFFFF';
notes.getRange('A1:B1').format.font.bold=true;
notes.showGridLines=false;
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Products!A1:N4',include:'values,formulas',tableMaxCols:14,tableMaxRows:4,maxChars:2500})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10},maxChars:1000})).ndjson);
for(const [name,range] of [['Products','A1:N8'],['Review','A1:B15']]) {
  await fs.writeFile(`${dir}/${name}.png`,new Uint8Array(await (await wb.render({sheetName:name,range,scale:1.5})).arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save(`${dir}/extracted_product_list_import.xlsx`);
await fs.writeFile(`${dir}/import-rows.json`,JSON.stringify(rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])))));
console.log('Exported 90 products');
