import { HeartOutlined, StarOutlined, FireOutlined, CrownOutlined, EditOutlined, BookOutlined, BulbOutlined, CompassOutlined, TeamOutlined, ReadOutlined } from '@ant-design/icons';
import { kaadhalKavithaigal } from './kavithaigal/kaadhal.js';
import { tamilKavithaigal } from './kavithaigal/tamil.js';
import { iyarkaiKavithaigal } from './kavithaigal/iyarkai.js';
import { vaazhkaiKavithaigal } from './kavithaigal/vaazhkai.js';
import { natpuKavithaigal } from './kavithaigal/natpu.js';
import { collection, doc, setDoc, deleteDoc, updateDoc, increment, arrayUnion, arrayRemove, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  validateKavithaiSchema,
  validateCommentSchema,
  sanitizeText,
  MAX_COMMENTS_PER_POEM,
  MAX_GLOBAL_COMMENTS,
  MAX_INPUT_LENGTHS,
} from '../utils/security.js';

export const DEFAULT_KAVITHAI_IMAGE = '/kavingnar-kamalesh.jpg';

export const normalizePoemImage = (poem) => {
  if (!poem) return poem;
  const isUnsplash = typeof poem.image === 'string' && poem.image.includes('images.unsplash.com');
  const isEmpty = !poem.image || String(poem.image).trim() === '';
  if (isUnsplash || isEmpty) {
    return { ...poem, image: DEFAULT_KAVITHAI_IMAGE };
  }
  return poem;
};

export const defaultKavithaigal = [
  ...kaadhalKavithaigal,
  ...tamilKavithaigal,
  ...iyarkaiKavithaigal,
  ...vaazhkaiKavithaigal,
  ...natpuKavithaigal
].map(normalizePoemImage);

export const loadInitialKavithaigal = () => {
  try {
    const saved = localStorage.getItem('tamil_kavithaigal_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // ── Schema-validate, upgrade image, and sanitise every loaded poem ──
        const validated = parsed
          .map(validateKavithaiSchema)
          .filter(Boolean)
          .map(normalizePoemImage);

        if (validated.length === 0) {
          // all items failed validation — fall back to defaults
          console.warn('All stored kavithaigal failed validation, using defaults');
          return defaultKavithaigal;
        }

        const existingIds = new Set(validated.map(k => k.id));
        const missingDefaults = defaultKavithaigal.filter(k => !existingIds.has(k.id));
        const merged = missingDefaults.length > 0 ? [...validated, ...missingDefaults] : validated;
        localStorage.setItem('tamil_kavithaigal_data', JSON.stringify(merged));
        return merged;
      }
    }
  } catch (err) {
    console.error('Error loading kavithaigal from localStorage:', err);
  }
  return defaultKavithaigal;
};

export const saveKavithaigalToStorage = (kavithaigalList) => {
  try {
    // ── Validate before saving ──
    const validated = kavithaigalList
      .map(validateKavithaiSchema)
      .filter(Boolean);
    localStorage.setItem('tamil_kavithaigal_data', JSON.stringify(validated));
  } catch (err) {
    console.error('Error saving kavithaigal to localStorage:', err);
  }
};

export const subscribeToKavithaigal = (callback) => {
  // 1. Immediately emit cached or default data so the UI NEVER loads empty or with 0 counts
  const initial = loadInitialKavithaigal();
  if (Array.isArray(initial) && initial.length > 0) {
    try {
      callback(initial);
    } catch (e) {
      console.warn('Initial callback delivery error:', e);
    }
  }

  // 2. Listen to Firestore real-time updates
  try {
    const q = query(collection(db, 'kavithaigal'));
    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          // Initialize with default data if Firestore collection is empty
          defaultKavithaigal.forEach(async (k) => {
            try {
              await setDoc(doc(db, 'kavithaigal', k.id.toString()), k);
            } catch (e) {
              // Ignore permission error if Firestore write fails
            }
          });
          saveKavithaigalToStorage(defaultKavithaigal);
          callback(defaultKavithaigal);
        } else {
          const data = snapshot.docs.map(doc => normalizePoemImage(doc.data()));
          data.sort((a, b) => a.id - b.id);
          saveKavithaigalToStorage(data);
          callback(data);
        }
      },
      (err) => {
        console.warn('Firestore kavithaigal subscription error (retaining offline/cached data):', err);
        const fallback = loadInitialKavithaigal();
        callback(fallback);
      }
    );
  } catch (err) {
    console.warn('Firestore subscription failed to start (using offline/cached data):', err);
    const fallback = loadInitialKavithaigal();
    callback(fallback);
    return () => {};
  }
};

export const saveKavithaiToFirebase = async (poem) => {
  const validated = validateKavithaiSchema(normalizePoemImage(poem));
  if (!validated) return null;
  if (!validated.comments) validated.comments = [];

  // 1. Save to local storage first so changes are immediate & offline-capable
  try {
    const current = loadInitialKavithaigal();
    const idx = current.findIndex(k => k.id === validated.id);
    let updated;
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = validated;
    } else {
      updated = [validated, ...current];
    }
    saveKavithaigalToStorage(updated);
  } catch (e) {
    console.error('LocalStorage save error:', e);
  }

  // 2. Sync to Firebase
  try {
    await setDoc(doc(db, 'kavithaigal', validated.id.toString()), validated);
  } catch (err) {
    console.warn('Firebase save failed (saved locally):', err);
  }
  return validated;
};

export const deleteKavithaiFromFirebase = async (poemId) => {
  // 1. Delete from local storage first
  try {
    const current = loadInitialKavithaigal();
    const updated = current.filter(k => k.id !== poemId);
    saveKavithaigalToStorage(updated);
  } catch (e) {
    console.error('LocalStorage delete error:', e);
  }

  // 2. Delete from Firebase
  try {
    await deleteDoc(doc(db, 'kavithaigal', poemId.toString()));
  } catch (err) {
    console.warn('Firebase delete failed (deleted locally):', err);
  }
};

export const likeKavithaiInFirebase = async (poemId, value) => {
  // 1. Update in local storage first
  try {
    const current = loadInitialKavithaigal();
    const updated = current.map(p =>
      p.id === poemId ? { ...p, likes: Math.max(0, (p.likes || 0) + value) } : p
    );
    saveKavithaigalToStorage(updated);
  } catch (e) {}

  // 2. Sync to Firebase
  try {
    const ref = doc(db, 'kavithaigal', poemId.toString());
    await updateDoc(ref, {
      likes: increment(value)
    });
  } catch (err) {
    console.warn("Error updating likes in Firestore (updated locally):", err);
  }
};

export const addCommentToFirebase = async (poemId, comment) => {
  try {
    const validatedComment = validateCommentSchema(comment);
    if (!validatedComment) return;

    // 1. Update in local storage first
    const current = loadInitialKavithaigal();
    const updated = current.map(p => {
      if (p.id === poemId) {
        const comments = p.comments || [];
        return { ...p, comments: [...comments, validatedComment].slice(-MAX_COMMENTS_PER_POEM) };
      }
      return p;
    });
    saveKavithaigalToStorage(updated);

    // 2. Sync to Firebase
    try {
      const ref = doc(db, 'kavithaigal', poemId.toString());
      await updateDoc(ref, {
        comments: arrayUnion(validatedComment)
      });
    } catch (err) {
      console.warn("Firestore error adding comment (saved locally):", err);
    }
  } catch (err) {
    console.error("Error adding comment: ", err);
  }
};

export const deleteCommentFromFirebase = async (poemId, comment) => {
  try {
    // 1. Update in local storage first
    const current = loadInitialKavithaigal();
    const updated = current.map(p => {
      if (p.id === poemId) {
        const comments = (p.comments || []).filter(c => c.id !== comment.id && c.text !== comment.text);
        return { ...p, comments };
      }
      return p;
    });
    saveKavithaigalToStorage(updated);

    // 2. Sync to Firebase
    try {
      const ref = doc(db, 'kavithaigal', poemId.toString());
      await updateDoc(ref, {
        comments: arrayRemove(comment)
      });
    } catch (err) {
      console.warn("Firestore deleteComment failed (deleted locally):", err);
    }
  } catch (err) {
    console.error("Error deleting comment: ", err);
  }
};

// --- Per-Poem Comments Helpers ---
export const loadPoemComments = (poemId) => {
  try {
    const saved = localStorage.getItem(`tamil_comments_poem_${poemId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // ── Validate and sanitise loaded comments, cap at max ──
      return parsed
        .map(validateCommentSchema)
        .filter(Boolean)
        .slice(0, MAX_COMMENTS_PER_POEM);
    }
  } catch (err) {
    console.error('Error loading poem comments:', err);
  }
  // Default initial comments for demonstration
  return [
    {
      id: 1,
      author: 'அன்பரசு',
      text: 'மிகவும் அருமையான கவிதை! மனதைத் தொடும் வரிகள்.',
      date: 'செப் 02, 2026',
      role: 'user'
    }
  ];
};

export const savePoemComments = (poemId, commentsList) => {
  try {
    // ── Validate, sanitise, and cap before saving ──
    const validated = commentsList
      .map(validateCommentSchema)
      .filter(Boolean)
      .slice(0, MAX_COMMENTS_PER_POEM);
    localStorage.setItem(`tamil_comments_poem_${poemId}`, JSON.stringify(validated));
  } catch (err) {
    console.error('Error saving poem comments:', err);
  }
};

// --- Site-Wide Global Guestbook Helpers ---
export const loadGlobalComments = () => {
  try {
    const saved = localStorage.getItem('tamil_global_comments');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // ── Validate and sanitise loaded comments, cap at max ──
      return parsed
        .map(validateCommentSchema)
        .filter(Boolean)
        .slice(0, MAX_GLOBAL_COMMENTS);
    }
  } catch (err) {
    console.error('Error loading global comments:', err);
  }
  return [
    {
      id: 1,
      author: 'கவின் நிலா',
      text: 'தமிழ் கவிதைகளின் இந்த இணையதளம் மிகவும் நேர்த்தியாக உள்ளது! வாழ்த்துகள் கமலேஷ்.',
      date: 'செப் 01, 2026',
      role: 'user'
    },
    {
      id: 2,
      author: 'தமிழ்ச்செல்வன்',
      text: 'கவிதைகளின் வரிகளும் இசையும் அருமை. தொடர்ந்து புதிய கவிதைகளைப் படையுங்கள்!',
      date: 'செப் 03, 2026',
      role: 'user'
    }
  ];
};

export const saveGlobalComments = (commentsList) => {
  try {
    // ── Validate, sanitise, and cap before saving ──
    const validated = commentsList
      .map(validateCommentSchema)
      .filter(Boolean)
      .slice(0, MAX_GLOBAL_COMMENTS);
    localStorage.setItem('tamil_global_comments', JSON.stringify(validated));
  } catch (err) {
    console.error('Error saving global comments:', err);
  }
};

export const kavithaigal = loadInitialKavithaigal();

const categoryConfigs = [
  { name: 'காதல்', icon: HeartOutlined },
  { name: 'தமிழ்', icon: StarOutlined },
  { name: 'இயற்கை', icon: FireOutlined },
  { name: 'நட்பு', icon: EditOutlined },
  { name: 'ஊக்கம்', icon: BulbOutlined },
  { name: 'தத்துவம்', icon: CompassOutlined },
  { name: 'சமூகம்', icon: TeamOutlined },
  { name: 'கல்வி', icon: ReadOutlined },
  { name: 'வாழ்க்கை', icon: CrownOutlined }
];

export const getCategoriesWithCount = (kavithaigalList = kavithaigal) => [
  { name: 'அனைத்தும்', icon: <BookOutlined />, count: kavithaigalList.length },
  ...categoryConfigs.map(config => ({
    name: config.name,
    icon: <config.icon />,
    count: kavithaigalList.filter(k => k.category === config.name).length
  }))
];

export const DEFAULT_CATEGORIES = [
  { name: 'காதல்', emoji: '❤️', en: 'Kadhal (Love)' },
  { name: 'தமிழ்', emoji: '⭐', en: 'Tamil' },
  { name: 'இயற்கை', emoji: '🌿', en: 'Iyarkai (Nature)' },
  { name: 'நட்பு', emoji: '🤝', en: 'Natpu (Friendship)' },
  { name: 'ஊக்கம்', emoji: '🔥', en: 'Ookkam (Motivation)' },
  { name: 'தத்துவம்', emoji: '🧠', en: 'Thathuvam (Philosophy)' },
  { name: 'சமூகம்', emoji: '🏛️', en: 'Samuugam (Society)' },
  { name: 'கல்வி', emoji: '📚', en: 'Kalvi (Education)' },
  { name: 'வாழ்க்கை', emoji: '👑', en: 'Vaazhkai (Life)' }
];

export const loadCustomCategories = () => {
  try {
    const saved = localStorage.getItem('tamil_custom_categories');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading custom categories:', err);
  }
  return [];
};

export const saveCustomCategories = (list) => {
  try {
    localStorage.setItem('tamil_custom_categories', JSON.stringify(list));
  } catch (err) {
    console.error('Error saving custom categories:', err);
  }
};

export const subscribeToCategories = (callback) => {
  try {
    const q = query(collection(db, 'categories'));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs.map(doc => doc.data());
        saveCustomCategories(data);
        callback(data);
      } else {
        const local = loadCustomCategories();
        callback(local);
      }
    }, (err) => {
      console.warn('Firestore categories subscription error, falling back to local:', err);
      callback(loadCustomCategories());
    });
  } catch (err) {
    console.warn('Firestore categories error:', err);
    callback(loadCustomCategories());
    return () => {};
  }
};

export const saveCategoryToFirebase = async (category) => {
  const sanitized = {
    name: sanitizeText(category.name).trim(),
    emoji: (category.emoji || '📖').trim(),
    en: sanitizeText(category.en || category.name).trim(),
    createdAt: Date.now()
  };
  if (!sanitized.name) return null;

  // Save to local storage
  const existing = loadCustomCategories();
  if (!existing.some(c => c.name === sanitized.name)) {
    const updated = [...existing, sanitized];
    saveCustomCategories(updated);
  }

  // Save to Firebase
  try {
    await setDoc(doc(db, 'categories', sanitized.name), sanitized);
  } catch (err) {
    console.error('Error saving category to Firebase:', err);
  }
  return sanitized;
};

export const categories = getCategoriesWithCount(defaultKavithaigal);