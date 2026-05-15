import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/scripts\/?$/, '');
const rangePrefix = /^[~^*<>]/;
const npmInstallPattern = /\bnpm\s+(?:install|i|ci)\b(?![^\n`]*--ignore-scripts)/;
const failures = [];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function walk(dir, callback) {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist') {
      continue;
    }
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, callback);
    } else {
      callback(path);
    }
  }
}

function checkPackageJson(path) {
  const pkg = readJson(path);
  if (!pkg.dependencies && !pkg.devDependencies && !pkg.optionalDependencies) {
    return;
  }

  const dir = path.slice(0, -'/package.json'.length);
  const npmrcPath = join(dir, '.npmrc');
  let npmrc = '';
  try {
    npmrc = readFileSync(npmrcPath, 'utf8');
  } catch {
    failures.push(`${relative(repoRoot, dir)} is missing .npmrc with ignore-scripts=true`);
  }
  if (npmrc && !/^ignore-scripts\s*=\s*true\s*$/m.test(npmrc)) {
    failures.push(`${relative(repoRoot, npmrcPath)} must set ignore-scripts=true`);
  }

  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(pkg[group] ?? {})) {
      if (typeof version !== 'string' || rangePrefix.test(version) || version.includes(' - ')) {
        failures.push(`${relative(repoRoot, path)} uses a floating ${group} range: ${name}@${version}`);
      }
    }
  }
}

function checkReadme(path) {
  const text = readFileSync(path, 'utf8');
  if (npmInstallPattern.test(text)) {
    failures.push(`${relative(repoRoot, path)} documents npm install without --ignore-scripts`);
  }
}

walk(repoRoot, (path) => {
  if (path.endsWith('/package.json')) {
    checkPackageJson(path);
  } else if (path.endsWith('/README.md')) {
    checkReadme(path);
  }
});

if (failures.length > 0) {
  console.error('NPM install policy violations found:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('NPM install policy checks passed.');
