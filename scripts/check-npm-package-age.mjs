import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/scripts\/?$/, '');
const quarantineDays = Number.parseInt(process.env.NPM_QUARANTINE_DAYS ?? '7', 10);
const cutoff = new Date(Date.now() - quarantineDays * 24 * 60 * 60 * 1000);
const specs = new Map();
const failures = [];

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

function collectPackageJson(path) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(pkg[group] ?? {})) {
      if (version.startsWith('file:') || version.startsWith('workspace:')) {
        continue;
      }
      specs.set(`${name}@${version}`, { name, version });
    }
  }
}

function npmViewTime(name) {
  try {
    const raw = execFileSync(
      'npm',
      ['view', name, 'time', '--json', '--ignore-scripts', '--cache', '.npm-cache'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          npm_config_update_notifier: 'false',
          npm_config_fund: 'false',
          npm_config_audit: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return JSON.parse(raw);
  } catch (error) {
    failures.push(`${name} was not found in npm registry metadata or could not be queried`);
    return null;
  }
}

walk(repoRoot, (path) => {
  if (path.endsWith('/package.json')) {
    collectPackageJson(path);
  }
});

for (const { name, version } of specs.values()) {
  if (name.startsWith('@altopelago/')) {
    console.log(`OK ${name}@${version} first-party package`);
    continue;
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    failures.push(`${name}@${version} is not an exact npm version`);
    continue;
  }
  const time = npmViewTime(name);
  if (!time) {
    continue;
  }
  const publishedAt = time[version];
  if (!publishedAt) {
    failures.push(`${name}@${version} was not found in npm registry time metadata`);
    continue;
  }
  const published = new Date(publishedAt);
  if (published >= cutoff) {
    failures.push(`${name}@${version} was published ${publishedAt}, inside the ${quarantineDays}-day quarantine window`);
    continue;
  }
  console.log(`OK ${name}@${version} ${publishedAt}`);
}

if (failures.length > 0) {
  console.error('NPM package age check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`All npm package versions are older than ${quarantineDays} days.`);
