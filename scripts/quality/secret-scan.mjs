import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rules = [
  ['database-credentials', /mongodb(?:\+srv)?:\/\/[^\s'"/@]+:[^\s'"@]+@/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['payment-secret', /\bsk_live_[a-zA-Z0-9]{20,}\b/g],
];
export function findSecrets(source) {
  const findings = [];
  for (const [rule, expression] of rules) {
    expression.lastIndex = 0;
    for (const match of source.matchAll(expression)) {
      findings.push({ rule, line: source.slice(0, match.index).split('\n').length });
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}
export function scanRepository(root) {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, maxBuffer: 16 * 1024 * 1024 })
    .toString().split('\0').filter(Boolean);
  const findings = [];
  for (const file of new Set(files)) {
    if (/(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)) continue;
    const full = path.join(root, file);
    let info;
    try { info = statSync(full); } catch { continue; }
    if (!info.isFile() || info.size > 2 * 1024 * 1024) continue;
    const bytes = readFileSync(full);
    if (bytes.subarray(0, 8192).includes(0)) continue;
    findings.push(...findSecrets(bytes.toString('utf8')).map(finding => ({ file, ...finding })));
  }
  return findings;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel']).toString().trim();
  const findings = scanRepository(root);
  for (const f of findings) console.error(`${f.file}:${f.line}: ${f.rule} (value redacted)`);
  console.log(`Credential check: ${findings.length} findings. Scans tracked and non-ignored text files up to 2 MB; not Git history.`);
  process.exitCode = findings.length ? 1 : 0;
}
