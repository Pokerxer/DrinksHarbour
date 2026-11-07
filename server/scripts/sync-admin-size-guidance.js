'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PRODUCT_TYPE_VALUES, getSizesForType } = require('../constants/productTypes');

const groups = [];
const types = {};
const groupIds = new Map();
for (const type of [...new Set(PRODUCT_TYPE_VALUES)].sort()) {
  const sizes = getSizesForType(type);
  const key = JSON.stringify(sizes);
  if (!groupIds.has(key)) {
    groupIds.set(key, groups.length);
    groups.push(sizes);
  }
  types[type] = groupIds.get(key);
}

const target = path.resolve(__dirname, '../../client/apps/admin/src/utils/product-size-guidance.json');
const output = `{\n  "groups": [\n${groups.map(group => '    ' + JSON.stringify(group)).join(',\n')}\n  ],\n  "types": ${JSON.stringify(types, null, 2).replace(/\n/g, '\n  ')}\n}\n`;
fs.writeFileSync(target, output);
