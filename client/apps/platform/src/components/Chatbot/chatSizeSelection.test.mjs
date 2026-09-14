import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('./chatSizeSelection.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { selectChatSize } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const sizes = [
  { size: '70cl', stock: 4, pricing: { websitePrice: 10000 } },
  { size: '75cl', stock: 3, pricing: { websitePrice: 12000 } },
];
test('an explicit unavailable size never substitutes another bottle', () => {
  assert.equal(selectChatSize(sizes, '1L'), undefined);
  assert.equal(selectChatSize([{ ...sizes[1], stock: 0 }, sizes[0]], '75cl'), undefined);
});
test('equivalent units select the requested bottle and preserve its price', () => {
  assert.equal(selectChatSize(sizes, '750 ml'), sizes[1]);
  assert.equal(selectChatSize(sizes, null), sizes[0]);
});
