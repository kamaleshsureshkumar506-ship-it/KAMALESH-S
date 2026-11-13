// Tamil transliteration mapping for SEO-friendly URLs
const TAMIL_MAP = {
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au',
  'க': 'ka', 'ங': 'nga', 'ச': 'sa', 'ஞ': 'nya', 'ட': 'ta', 'ண': 'na', 'த': 'tha', 'ந': 'na', 'ப': 'pa', 'ம': 'ma', 'ய': 'ya', 'ர': 'ra', 'ல': 'la', 'வ': 'va', 'ழ': 'zha', 'ள': 'la', 'ற': 'ra', 'ன': 'na',
  'ஜ': 'ja', 'ஷ': 'sha', 'ஸ': 'sa', 'ஹ': 'ha', 'க்ஷ': 'ksha', 'ஸ்ரீ': 'sri'
};

const VOWEL_SIGNS = {
  '\u0BBE': 'aa', '\u0BBF': 'i', '\u0BC0': 'ee', '\u0BC1': 'u', '\u0BC2': 'oo',
  '\u0BC6': 'e', '\u0BC7': 'ae', '\u0BC8': 'ai', '\u0BCA': 'o', '\u0BCB': 'oa',
  '\u0BCC': 'au', '\u0BCD': ''
};

export function transliterateTamil(text) {
  if (!text) return '';
  let str = String(text);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const next = str[i + 1];
    if (TAMIL_MAP[c]) {
      let base = TAMIL_MAP[c];
      if (next && VOWEL_SIGNS[next] !== undefined) {
        if (next === '\u0BCD') {
          // mei ezhuthu (dot above consonant) - remove inherent 'a'
          out += base.slice(0, -1);
        } else {
          out += base.slice(0, -1) + VOWEL_SIGNS[next];
        }
        i++; // skip combined vowel sign
      } else {
        out += base;
      }
    } else if (/[a-zA-Z0-9]/.test(c)) {
      out += c.toLowerCase();
    } else if (/[\s\-_.,!?:;'"()]+/.test(c)) {
      out += '-';
    }
  }
  return out.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

export const CATEGORY_SLUG_MAP = {
  'காதல்': 'kadhal',
  'தமிழ்': 'tamil',
  'இயற்கை': 'iyarkai',
  'நட்பு': 'natpu',
  'ஊக்கம்': 'ookkam',
  'தத்துவம்': 'thathuvam',
  'சமூகம்': 'samuugam',
  'கல்வி': 'kalvi',
  'வாழ்க்கை': 'vaazhkai'
};

export const SLUG_TO_CATEGORY_MAP = Object.fromEntries(
  Object.entries(CATEGORY_SLUG_MAP).map(([name, slug]) => [slug, name])
);

export function getCategorySlug(category) {
  if (!category) return 'kavithaigal';
  if (CATEGORY_SLUG_MAP[category]) return CATEGORY_SLUG_MAP[category];
  const trans = transliterateTamil(category);
  return trans || 'kavithaigal';
}

export function getCategoryNameFromSlug(slug, allCategories = []) {
  if (!slug) return null;
  const lower = slug.toLowerCase();
  if (SLUG_TO_CATEGORY_MAP[lower]) return SLUG_TO_CATEGORY_MAP[lower];
  const found = allCategories.find(c => {
    return c && (c.name === slug || getCategorySlug(c.name) === lower || (c.en && c.en.toLowerCase() === lower));
  });
  return found ? found.name : null;
}

export function getPoemSlug(poem) {
  if (!poem) return '';
  const titleSlug = transliterateTamil(poem.title) || 'kavithai';
  return `${titleSlug}-${poem.id}`;
}

export function getPoemUrl(poem) {
  if (!poem) return '/';
  const catSlug = getCategorySlug(poem.category);
  const poemSlug = getPoemSlug(poem);
  return `/${catSlug}/${poemSlug}`;
}

export function findPoemBySlugOrId(param, kavithaigalList = []) {
  if (!param || !Array.isArray(kavithaigalList)) return null;
  const decoded = decodeURIComponent(param).trim().toLowerCase();

  // 1. Try exact poem id match if param is a number
  if (/^\d+$/.test(decoded)) {
    const byId = kavithaigalList.find(p => p && String(p.id) === decoded);
    if (byId) return byId;
  }

  // 2. Try matching id at the end of the slug (e.g. `...-48`)
  const idMatch = decoded.match(/-(\d+)$/);
  if (idMatch) {
    const id = idMatch[1];
    const byId = kavithaigalList.find(p => p && String(p.id) === id);
    if (byId) return byId;
  }

  // 3. Try exact poem slug match
  const bySlug = kavithaigalList.find(p => p && getPoemSlug(p).toLowerCase() === decoded);
  if (bySlug) return bySlug;

  // 4. Try title transliteration match
  const byTitle = kavithaigalList.find(p => {
    if (!p) return false;
    const trans = transliterateTamil(p.title);
    return trans === decoded || p.title.toLowerCase() === decoded;
  });
  if (byTitle) return byTitle;

  return null;
}

