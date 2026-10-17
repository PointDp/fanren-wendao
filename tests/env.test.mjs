import { test } from 'node:test'; import { readFileSync, readdirSync } from 'node:fs';
test('js files are ES-module-free for file:// compatibility', () => {
  for (const f of readdirSync('js', { recursive: true }).filter(f => f.endsWith('.js'))) {
    const src = readFileSync('js/' + f, 'utf8');
    if (!/^\s*(import|export)\s/m.test(src)) continue;
    throw new Error(f + ' uses import/export');
  }
});
test('FC namespace mounts on window and globalThis', async () => {
  const { execSync } = await import('node:child_process');
  const out = execSync('node -e "require(\'./js/state.js\'); console.log(typeof globalThis.FC)"').toString().trim();
  if (out !== 'object') throw new Error('FC not mounted: ' + out);
});
