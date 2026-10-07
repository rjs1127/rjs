const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { versionStaticAssetUrls } = require('./version-static-assets.cjs');

const root = path.resolve(__dirname, '..', '..');
const publicDir = path.join(root, 'public');
const outDir = path.join(root, '.local-public');
const sourceConfig = path.join(root, 'wrangler.toml');
const localDir = path.join(root, '.local-pages');
const localConfig = path.join(localDir, 'wrangler.toml');
const devVars = path.join(root, '.dev.vars');

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
if (!fs.existsSync(devVars)) throw new Error('.dev.vars를 찾지 못했습니다.');
fs.mkdirSync(localDir, { recursive: true });
const functionsSource = path.join(root, 'functions');
const functionsLink = path.join(localDir, 'functions');
const fallbackMarker = path.join(localDir, '.functions-copy');
if (fs.existsSync(fallbackMarker)) {
  if (fs.lstatSync(functionsLink).isSymbolicLink()) throw new Error('Functions fallback 경로가 링크입니다.');
  fs.rmSync(functionsLink, { recursive: true, force: true });
}
if (!fs.existsSync(functionsLink)) {
  try {
    fs.symlinkSync(functionsSource, functionsLink, process.platform === 'win32' ? 'junction' : 'dir');
    fs.rmSync(fallbackMarker, { force: true });
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
    fs.cpSync(functionsSource, functionsLink, { recursive: true });
    fs.writeFileSync(fallbackMarker, 'Local Functions copy fallback\n');
    console.warn('[local] Functions 링크 생성 불가: 복사 fallback (변경 후 재실행 필요)');
  }
}
if (!fs.existsSync(fallbackMarker) && fs.realpathSync(functionsLink) !== fs.realpathSync(functionsSource)) {
  throw new Error('로컬 Functions 경로가 원본 functions와 연결되지 않았습니다.');
}
const localToml = fixed.replace(/^[ \t]*pages_build_output_dir[ \t]*=[^\r\n]*/m,
  `pages_build_output_dir = ${JSON.stringify(outDir.replaceAll('\\', '/'))}`);
fs.writeFileSync(localConfig, localToml, 'utf8');
copyPublic();

const indexPath = path.join(outDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  if (siteName) html = html.replaceAll('__SITE_NAME__', siteName);
  html = versionStaticAssetUrls(html, { publicDir: outDir });
  fs.writeFileSync(indexPath, html, 'utf8');
}

console.log(`[local] 준비 완료${siteName ? ` · SITE_NAME=${siteName}` : ''}`);
console.log('[local] 종료하려면 Ctrl+C');

const args = [
  'wrangler',
  'pages',
  'dev',
  outDir,
  '--cwd',
  localDir,
  '--persist-to',
  path.join(root, '.wrangler', 'state'),
  '--env-file',
  devVars,
];
const options = {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  // Pages dev loads --env-file into process.env before constructing bindings.
  env: { ...process.env, CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true' },
};
let result;
if (process.platform === 'win32') {
  const quote = (value) => {
    if (/["%!\r\n]/.test(value)) throw new Error('Windows 실행 인자에 지원하지 않는 셸 문자가 있습니다.');
    return `"${value}"`;
  };
  const npx = (process.env.PATH || '').split(path.delimiter)
    .map((dir) => path.join(dir.replace(/^"|"$/g, ''), 'npx.cmd'))
    .find((file) => fs.existsSync(file));
  if (!npx) throw new Error('PATH에서 npx.cmd를 찾지 못했습니다.');
  const command = `"${[npx, ...args].map(quote).join(' ')}"`;
  result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/v:off', '/c', command],
    { ...options, windowsVerbatimArguments: true });
} else {
  result = spawnSync('npx', args, options);
}
if (result.error) throw result.error;

process.exitCode = result.status ?? 1;
