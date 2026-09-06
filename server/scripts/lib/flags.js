// scripts/lib/flags.js
//
// Zero-dependency CLI flag parser for the seeder.
// Supports:  --key value   --key=value   --flag (boolean)
// Env fallback via the second argument to get().

function parseArgv(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    if (eq !== -1) {
      out[raw.slice(2, eq)] = raw.slice(eq + 1);
      continue;
    }
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** Parse `--flag "min-max"` (or plain int) into [min, max]. */
function parseRange(value, fallback) {
  if (value === undefined) return fallback;
  const str = String(value).trim();
  if (!str) return fallback;
  const parts = str.split('-').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 1 && Number.isFinite(parts[0])) return [parts[0], parts[0]];
  if (parts.length === 2 && parts.every(Number.isFinite) && parts[0] <= parts[1]) return parts;
  throw new Error(`Invalid range "${value}", expected "min-max"`);
}

function parseInteger(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid integer "${value}"`);
  return n;
}

function bool(value) {
  if (value === true) return true;
  if (value === undefined || value === null) return false;
  const s = String(value).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

/**
 * Read a flag with env fallback. Returns undefined when neither is set.
 * @param {object} args   output of parseArgv()
 * @param {string} flag   flag name without leading --
 * @param {string} [env]  environment variable name to fall back on
 */
function get(args, flag, env) {
  if (args[flag] !== undefined) return args[flag];
  if (env && process.env[env] !== undefined && process.env[env] !== '') return process.env[env];
  return undefined;
}

module.exports = { parseArgv, parseRange, parseInteger, bool, get };
