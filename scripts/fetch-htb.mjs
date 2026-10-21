// Fetches HTB machine info for each walkthrough into src/data/htb-machines.json.
//
//   npm run htb                 fetch only walkthroughs missing from the JSON (also runs before every build)
//   npm run htb -- signed       re-fetch specific slugs, overwriting their entries
//   npm run htb -- --all        re-fetch every walkthrough, overwriting all entries
//
// Existing entries are never touched unless named or --all is used, so manual edits to the JSON stick.
// The token is read from HTB_API_TOKEN in .env (or the environment).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const WALKTHROUGHS_DIR = 'src/content/walkthroughs';
const DATA_FILE = 'src/data/htb-machines.json';
const API = 'https://labs.hackthebox.com/api/v4/machine/profile/';

try { process.loadEnvFile('.env'); } catch {}
const token = process.env.HTB_API_TOKEN?.trim();

function frontmatterField(md, field) {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  return fm.match(new RegExp(`^${field}:\\s*["']?(.*?)["']?\\s*$`, 'm'))?.[1];
}

// Strip markdown links/backticks so the synopsis reads as plain text.
const plain = (md) => md.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '').trim();

async function fetchMachine(title) {
  const res = await fetch(API + encodeURIComponent(title), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { info } = await res.json();
  return {
    name: info.name,
    difficulty: String(info.difficultyText).toLowerCase(),
    os: info.os,
    released: new Date(info.release).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    rating: Number(info.stars).toFixed(1),
    avatar: info.avatar,
    description: plain(info.synopsis ?? ''),
  };
}

const args = process.argv.slice(2);
const refetchAll = args.includes('--all');
const named = args.filter((a) => !a.startsWith('--'));

const walkthroughs = readdirSync(WALKTHROUGHS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const md = readFileSync(`${WALKTHROUGHS_DIR}/${f}`, 'utf8');
    return { slug: frontmatterField(md, 'slug'), title: frontmatterField(md, 'title') };
  });

const data = existsSync(DATA_FILE) ? JSON.parse(readFileSync(DATA_FILE, 'utf8')) : {};
const todo = walkthroughs.filter((w) => refetchAll || named.includes(w.slug) || !data[w.slug]);

if (!todo.length) {
  console.log('[htb] All walkthroughs already have machine info.');
  process.exit(0);
}
if (!token) {
  // No token (e.g. CI): leave it to the build to report anything missing.
  console.warn(`[htb] No HTB_API_TOKEN, skipping fetch for: ${todo.map((w) => w.slug).join(', ')}`);
  process.exit(0);
}

let failed = false;
for (const { slug, title } of todo) {
  try {
    data[slug] = await fetchMachine(title);
    console.log(`[htb] Fetched ${title}`);
  } catch (err) {
    failed = true;
    console.error(`[htb] Failed to fetch ${title}: ${err.message}`);
  }
}

const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2) + '\n');
process.exit(failed ? 1 : 0);
