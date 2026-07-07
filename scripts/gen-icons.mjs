import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const app = join(root, '..');

const COLLECTIONS = ['logos', 'lucide', 'simple-icons'];

const used = new Map(COLLECTIONS.map((c) => [c, new Set()]));

function scanFile(path) {
	const text = readFileSync(path, 'utf8');
	for (const match of text.matchAll(
		/["'`](logos|lucide|simple-icons):([a-z0-9][a-z0-9-]*)["'`]/g
	)) {
		used.get(match[1]).add(match[2]);
	}
}

function scanDir(dir) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) scanDir(path);
		else if (/\.(ts|svelte)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) scanFile(path);
	}
}
scanDir(join(app, 'src/lib'));

const catalog = readFileSync(join(app, 'src/lib/catalog/components.ts'), 'utf8');
for (const match of catalog.matchAll(/icon:\s*"([A-Za-z0-9]+)"/g)) {
	used.get('lucide').add(
		match[1]
			.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
			.replace(/([a-z])([0-9])/g, '$1-$2')
			.toLowerCase()
	);
}

for (const extra of ['box', 'database', 'server', 'network']) used.get('lucide').add(extra);

const bundle = [];
const missing = [];
for (const collection of COLLECTIONS) {
	const names = used.get(collection);
	if (names.size === 0) continue;
	const full = JSON.parse(
		readFileSync(join(app, 'node_modules', `@iconify-json/${collection}`, 'icons.json'), 'utf8')
	);
	const subset = { prefix: full.prefix, icons: {}, width: full.width, height: full.height };
	for (const name of [...names].sort()) {
		const icon = full.icons[name];

		if (!icon && full.aliases?.[name]) {
			const parent = full.aliases[name].parent;
			subset.icons[name] = { ...full.icons[parent], ...full.aliases[name], parent: undefined };
			continue;
		}
		if (!icon) {
			missing.push(`${collection}:${name}`);
			continue;
		}
		subset.icons[name] = icon;
	}
	bundle.push(subset);
}

writeFileSync(join(app, 'src/lib/catalog/icon-bundle.json'), JSON.stringify(bundle));
const total = bundle.reduce((s, c) => s + Object.keys(c.icons).length, 0);
console.log(`icon-bundle.json: ${total} icons across ${bundle.length} collections`);
if (missing.length) {
	console.error(`MISSING (${missing.length}): ${missing.join(', ')}`);
	process.exit(1);
}
