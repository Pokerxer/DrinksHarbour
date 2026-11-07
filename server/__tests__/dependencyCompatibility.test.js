'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

test('the scoped model image runtime can load and process an image natively', async () => {
  const fromModel = createRequire(require.resolve('@huggingface/transformers'));
  const sharp = fromModel('sharp');
  const image = await sharp({ create: { width: 2, height: 2, channels: 3,
    background: { r: 20, g: 30, b: 40 } } }).resize(1, 1).png().toBuffer({ resolveWithObject: true });
  assert.equal(image.info.width, 1);
  assert.equal(image.info.height, 1);
  assert.equal(image.info.format, 'png');
  assert.equal(image.data[0], 0x89);
});

test('workbook export/import preserves beverage identifiers and numeric cells', async () => {
  const XLSX = require('xlsx');
  const rows = [['SKU', 'Beverage', 'Quantity', 'Price'],
    ['000123', 'Cabernet wine', 4, 12500.50], ['SKU-002', 'Sparkling water', 0, 850]];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Stock');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const imported = XLSX.read(buffer, { type: 'buffer' });
  assert.deepEqual(XLSX.utils.sheet_to_json(imported.Sheets.Stock, { header: 1 }), rows);
  const text = await require('../services/documentText.service').extractText(buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'synthetic-stock.xlsx');
  assert.match(text, /000123\tCabernet wine\t4\t12500.5/);
  assert.match(text, /SKU-002\tSparkling water\t0\t850/);
});

test('offline mail compilation preserves recipients while removing Bcc from message headers', async () => {
  // Stream transport intentionally retains Bcc; use a recording SMTP-style
  // transport so the real composer runs with its normal private-header policy.
  const transport = require('nodemailer').createTransport({ name: 'offline', version: '1', send(mail, done) {
    const chunks = [];
    mail.message.createReadStream().on('data', chunk => chunks.push(chunk))
      .on('error', done).on('end', () => done(null, {
        envelope: mail.message.getEnvelope(), message: Buffer.concat(chunks),
      }));
  } });
  const result = await transport.sendMail({ from: 'sender@example.test', to: 'customer@example.test',
    bcc: 'archive@example.test', subject: 'Synthetic receipt', text: 'Beverage order total: NGN 12500' });
  assert.deepEqual(result.envelope.to.sort(), ['archive@example.test', 'customer@example.test']);
  assert.match(result.message.toString(), /Beverage order total: NGN 12500/);
  assert.doesNotMatch(result.message.toString(), /^Bcc:/mi);
  transport.close();
});
