import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, 'env');
const outDir = join(root, 'src', 'environments');
const outPath = join(outDir, 'environment.ts');

function parseEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function uniqueKeys(values) {
  const keys = [];
  const seen = new Set();
  const pooled = (values.GEMINI_API_KEYS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const primary = (values.GEMINI_API_KEY || '').trim();
  for (const key of [primary, ...pooled]) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

const values = parseEnv(readFileSync(envPath, 'utf8'));
const geminiApiKeys = uniqueKeys(values);
const geminiApiKey = geminiApiKeys[0] || '';
const geminiModel = values.GEMINI_MODEL || 'gemini-3.5-flash';

mkdirSync(outDir, { recursive: true });
writeFileSync(
  outPath,
  `// Generated from ./env by scripts/sync-env.mjs — do not edit by hand.
export const environment = {
  geminiApiKey: ${JSON.stringify(geminiApiKey)},
  geminiApiKeys: ${JSON.stringify(geminiApiKeys)},
  geminiModel: ${JSON.stringify(geminiModel)}
};
`
);

console.log(`Wrote ${outPath} with ${geminiApiKeys.length} Gemini key(s).`);
