'use strict';
// Verification-only preload: compile the complete separate app without loading its
// private dotenv files. Never add this to the app's normal startup/build scripts.
const fs = require('node:fs');
const path = require('node:path');
const website = process.env.WYN_STOREFRONT_PATH || path.resolve(__dirname, '../../../wyn-city-storefront');
let modulePath;
try { modulePath = require.resolve('@next/env', { paths: [website] }); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  const nextPackage = require.resolve('next/package.json', { paths: [website] });
  modulePath = require.resolve('@next/env', { paths: [path.dirname(nextPackage)] });
}
const originalEnv = require(modulePath);
let dotenvReads = 0;
const isDotenv = value => {
  if (typeof value !== 'string' && !(value instanceof URL)) return false;
  return /^\.env(?:\.|$)/.test(path.basename(String(value)));
};
const check = value => {
  if (!isDotenv(value)) return;
  dotenvReads++;
  throw new Error('PILOT_PRIVATE_DOTENV_READ_FORBIDDEN');
};
const readSync = fs.readFileSync;
fs.readFileSync = function (file, ...args) { check(file); return readSync.call(this, file, ...args); };
const readCallback = fs.readFile;
fs.readFile = function (file, ...args) { check(file); return readCallback.call(this, file, ...args); };
const readPromise = fs.promises.readFile;
fs.promises.readFile = function (file, ...args) { check(file); return readPromise.call(this, file, ...args); };
require.cache[modulePath].exports = {
  ...originalEnv,
  loadEnvConfig: () => ({ combinedEnv: process.env, parsedEnv: {}, loadedEnvFiles: [] }),
  resetEnv: () => {},
};
process.on('exit', () => {
  process.stderr.write(`[pilot-env] pid=${process.pid} private-dotenv-read-attempts=${dotenvReads}\n`);
  if (dotenvReads) process.exitCode = 1;
});
