import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import poem files
import { kaadhalKavithaigal } from '../src/data/kavithaigal/kaadhal.js';
import { tamilKavithaigal } from '../src/data/kavithaigal/tamil.js';
import { iyarkaiKavithaigal } from '../src/data/kavithaigal/iyarkai.js';
import { vaazhkaiKavithaigal } from '../src/data/kavithaigal/vaazhkai.js';
import { natpuKavithaigal } from '../src/data/kavithaigal/natpu.js';
import { getCategorySlug, getPoemSlug } from '../src/utils/slug.js';

const DOMAIN = 'https://tamil-kavithai-delta.vercel.app';
const TODAY = new Date().toISOString().split('T')[0];

const defaultPoems = [
  ...kaadhalKavithaigal,
  ...tamilKavithaigal,
  ...iyarkaiKavithaigal,
  ...vaazhkaiKavithaigal,
  ...natpuKavithaigal
];

// Optional: check if local storage or cache has more poems, or deduplicate by ID
const poemMap = new Map();
defaultPoems.forEach(p => poemMap.set(p.id, p));

const allPoems = Array.from(poemMap.values()).sort((a, b) => a.id - b.id);

const categories = [
  'categories',
  'kadhal',
  'tamil',
  'iyarkai',
  'natpu',
  'ookkam',
  'thathuvam',
  'samuugam',
  'kalvi',
  'vaazhkai',
  'audio-kavithaigal'
];

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main Home Page -->
  <url>
    <loc>${DOMAIN}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Categories & Sections -->
`;

categories.forEach(slug => {
  xml += `  <url>
    <loc>${DOMAIN}/${slug}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
});

xml += `\n  <!-- Individual Poem Pages (${allPoems.length} poems) -->\n`;

allPoems.forEach(poem => {
  const catSlug = getCategorySlug(poem.category);
  const poemSlug = getPoemSlug(poem);
  const url = `${DOMAIN}/${catSlug}/${poemSlug}`;
  xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
});

xml += `</urlset>\n`;

const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
fs.writeFileSync(sitemapPath, xml, 'utf8');

console.log(`[generate-sitemap] Successfully wrote ${allPoems.length} poem URLs + ${categories.length} category URLs to ${sitemapPath}`);

