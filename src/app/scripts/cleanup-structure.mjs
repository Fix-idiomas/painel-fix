// scripts/cleanup-structure.mjs
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');
const COMPONENTS = path.join(SRC, 'components');
const LIB = path.join(SRC, 'lib');

const APPLY = process.argv.includes('--apply');

const log = (...a) => console.log(...a);
const act = (msg) => APPLY ? `APPLY: ${msg}` : `DRY  : ${msg}`;

const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const mkdirp = (p) => fs.mkdirSync(p, { recursive: true });
const mv = (src, dst) => fs.renameSync(src, dst);
const rm = (p) => fs.rmSync(p, { force: true });

function walk(dir, filter = () => true) {
  const out = [];
  if (!exists(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of fs.readdirSync(cur)) {
      const full = path.join(cur, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (filter(full)) out.push(full);
    }
  }
  return out;
}

function looksLikeJSX(code) {
  return /<\w|<\/\w/.test(code) && /return\s*\(/.test(code);
}

function replaceImportsExtensionless(code) {
  return code.replace(
    /(\bfrom\s+['"])([^'"]+)\.(jsx?|tsx?)(['"])/g,
    (_, p1, p2, _ext, p4) => `${p1}${p2}${p4}`
  ).replace(
    /(\bimport\s+['"])([^'"]+)\.(jsx?|tsx?)(['"])/g,
    (_, p1, p2, _ext, p4) => `${p1}${p2}${p4}`
  );
}

function ensureJsconfig() {
  const jsconfigPath = path.join(ROOT, 'jsconfig.json');
  const desired = {
    compilerOptions: { baseUrl: 'src', paths: { '@/*': ['*'] } }
  };
  if (!exists(jsconfigPath)) {
    log(act(`create ${path.relative(ROOT, jsconfigPath)}`));
    if (APPLY) write(jsconfigPath, JSON.stringify(desired, null, 2) + '\n');
    return;
  }
  try {
    const cur = JSON.parse(read(jsconfigPath));
    let changed = false;
    cur.compilerOptions = cur.compilerOptions || {};
    if (cur.compilerOptions.baseUrl !== 'src') { cur.compilerOptions.baseUrl = 'src'; changed = true; }
    cur.compilerOptions.paths = cur.compilerOptions.paths || {};
    if (JSON.stringify(cur.compilerOptions.paths) !== JSON.stringify({ '@/*': ['*'] })) {
      cur.compilerOptions.paths = { '@/*': ['*'] };
      changed = true;
    }
    if (changed) {
      log(act(`update ${path.relative(ROOT, jsconfigPath)}`));
      if (APPLY) write(jsconfigPath, JSON.stringify(cur, null, 2) + '\n');
    }
  } catch {
    log('WARN : jsconfig.json inválido — não alterado.');
  }
}

function ensureGlobalsCssAndLayoutImport() {
  const globals = path.join(APP, 'globals.css');
  if (!exists(globals)) {
    log(act(`create ${path.relative(ROOT, globals)}`));
    if (APPLY) {
      mkdirp(path.dirname(globals));
      write(globals, `/* Tailwind entry & base resets */\n@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);
    }
  }
  const layout = path.join(APP, 'layout.jsx');
  if (exists(layout)) {
    const code = read(layout);
    if (!/['"]\.\/globals\.css['"]/.test(code)) {
      const injected = `import './globals.css'\n` + code;
      log(act(`insert import './globals.css' into ${path.relative(ROOT, layout)}`));
      if (APPLY) write(layout, injected);
    }
  }
}

function renameApiPageToRoute() {
  const apiPages = walk(path.join(APP, 'api'), (f) =>
    /[\\/]api[\\/].*[\\/]page\.jsx?$/.test(f)
  );
  for (const p of apiPages) {
    const dir = path.dirname(p);
    const dest = path.join(dir, 'route.js');
    if (exists(dest)) {
      log(`INFO : já existe ${path.relative(ROOT, dest)} — removendo ${path.basename(p)}.`);
      log(act(`remove ${path.relative(ROOT, p)}`));
      if (APPLY) rm(p);
    } else {
      log(act(`mv ${path.relative(ROOT, p)} → ${path.relative(ROOT, dest)}`));
      if (APPLY) mv(p, dest);
    }
  }
}

function removeDuplicatesJsVsJsx() {
  const candidates = ['page', 'layout'];
  const files = walk(APP, (f) => /\.(jsx?|tsx?)$/.test(f));
  const byDir = new Map();
  for (const f of files) {
    const d = path.dirname(f);
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(f);
  }
  for (const [dir, arr] of byDir.entries()) {
    for (const base of candidates) {
      const js = path.join(dir, `${base}.js`);
      const jsx = path.join(dir, `${base}.jsx`);
      if (exists(js) && exists(jsx)) {
        log(act(`remove ${path.relative(ROOT, js)} (duplicado de ${base}.jsx)`));
        if (APPLY) rm(js);
      }
    }
  }
}

function renameJsxFiles() {
  const scanRoots = [APP, COMPONENTS];
  for (const root of scanRoots) {
    const jsFiles = walk(root, (f) =>
      /\.js$/.test(f) && !/[\\/]api[\\/].*[\\/]route\.js$/.test(f)
    );
    for (const file of jsFiles) {
      const code = read(file);
      if (looksLikeJSX(code)) {
        const dest = file.replace(/\.js$/, '.jsx');
        if (exists(dest)) {
          log(act(`remove ${path.relative(ROOT, file)} (já existe .jsx)`));
          if (APPLY) rm(file);
        } else {
          log(act(`mv ${path.relative(ROOT, file)} → ${path.relative(ROOT, dest)}`));
          if (APPLY) mv(file, dest);
        }
      }
    }
  }
}

function normalizeImports() {
  const targets = walk(SRC, (f) =>
    /\.(jsx?|tsx?)$/.test(f) &&
    !f.startsWith(LIB) &&
    !/[\\/]app[\\/]api[\\/]/.test(f)
  );
  for (const file of targets) {
    const code = read(file);
    const updated = replaceImportsExtensionless(code);
    if (updated !== code) {
      log(act(`rewrite imports ${path.relative(ROOT, file)}`));
      if (APPLY) write(file, updated);
    }
  }
}

// ---- RUN ----
if (!exists(SRC)) {
  console.error('ERRO: pasta src/ não encontrada. Execute na raiz do projeto.');
  process.exit(1);
}

log(`Mode : ${APPLY ? 'APPLY (aplicando mudanças)' : 'DRY-RUN (mostrando sem aplicar)'}`);
renameApiPageToRoute();
removeDuplicatesJsVsJsx();
renameJsxFiles();
normalizeImports();
ensureJsconfig();
ensureGlobalsCssAndLayoutImport();

log('OK   : análise concluída.');
if (!APPLY) log('Dica : rode novamente com --apply para aplicar as mudanças.');
