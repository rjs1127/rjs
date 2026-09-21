const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const publicDir = path.join(root, 'public');
const outDir = path.join(root, '.local-public');
const sourceConfig = path.join(root, 'wrangler.toml');
const localConfig = path.join(root, '.wrangler.local.toml');

function readSiteName(toml) {
  const fixed = String(toml || '').replace(/\[vars\]\s*SITE_NAME\s*=/, '[vars]\nSITE_NAME =');
  const match = fixed.match(/^\s*SITE_NAME\s*=\s*["']([^"']+)["']/m);
  return { fixed, siteName: (match?.[1] || '').trim() };
}

function copyPublic() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(publicDir, outDir, {
    recursive: true,
    filter(source) {
      const rel = path.relative(publicDir, source).replace(/\\/g, '/');
      return rel !== '_build' && !rel.startsWith('_build/');
    },
  });
}

if (!fs.existsSync(sourceConfig)) {
  throw new Error('wrangler.toml을 찾지 못했습니다.');
}

const rawConfig = fs.readFileSync(sourceConfig, 'utf8');
const { fixed, siteName } = readSiteName(rawConfig);
fs.writeFileSync(localConfig, fixed, 'utf8');
copyPublic();

const indexPath = path.join(outDir, 'index.html');
if (fs.existsSync(indexPath) && siteName) {
  const html = fs.readFileSync(indexPath, 'utf8').replaceAll('__SITE_NAME__', siteName);
  fs.writeFileSync(indexPath, html, 'utf8');
}

console.log(`[local] 준비 완료${siteName ? ` · SITE_NAME=${siteName}` : ''}`);
console.log('[local] 종료하려면 Ctrl+C');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, [
  'wrangler',
  'pages',
  'dev',
  '.local-public',
  '--config',
  '.wrangler.local.toml',
  '--persist-to',
  '.wrangler/state',
], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

process.exitCode = result.status ?? 1;
