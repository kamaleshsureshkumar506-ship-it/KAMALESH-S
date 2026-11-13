import { useState, useEffect, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import {
  ConfigProvider,
  theme,
  Layout,
  Typography,
  Button,
  Space,
  Modal,
  message,
  FloatButton,
  Drawer,
  Input,
  Select,
  Switch,
  Form,
  Empty
} from 'antd';
import {
  YoutubeOutlined,
  InstagramOutlined,
  HeartOutlined,
  HeartFilled,
  ShareAltOutlined,
  MenuOutlined,
  LockOutlined,
  EyeOutlined,
  UserOutlined,

  CrownOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LogoutOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  FolderAddOutlined,
  FolderOutlined,

  ReadOutlined,
  MessageOutlined
} from '@ant-design/icons';
import {
  loadInitialKavithaigal,
  subscribeToKavithaigal,
  saveKavithaiToFirebase,
  deleteKavithaiFromFirebase,
  likeKavithaiInFirebase,
  addCommentToFirebase,
  DEFAULT_KAVITHAI_IMAGE,
  DEFAULT_CATEGORIES,
  subscribeToCategories,
  saveCategoryToFirebase
} from './data/index.jsx';
import {
  sanitizeText,
  validateImageUrl,
  MAX_INPUT_LENGTHS,
} from './utils/security.js';
import ImageUploader from './components/ImageUploader.jsx';
import PoemPage from './components/PoemPage.jsx';
import AdminPortal from './components/admin/AdminPortal.jsx';
import {
  getCategorySlug,
  getCategoryNameFromSlug,
  getPoemSlug,
  getPoemUrl,
  findPoemBySlugOrId
} from './utils/slug.js';
import 'antd/dist/reset.css';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

function Seal({ size = 48, dark = false }) {
  const base = dark ? '#e07f2e' : '#132745';
  const ring = dark ? '#132745' : '#ef9c4e';
  const glyph = dark ? '#132745' : '#fdf6ee';
  const dot = dark ? '#132745' : '#ef9c4e';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill={base} />
      <circle cx="60" cy="60" r="47" fill="none" stroke={ring} strokeWidth="3" strokeDasharray="5 4" />
      <circle cx="60" cy="40" fill="rgba(255,255,255,0.08)" />
      <text x="60" y="82" textAnchor="middle" fontFamily="'Noto Serif Tamil', serif" fontWeight="700" fontSize="48" fill={glyph}>க</text>
      <circle cx="60" cy="20" r="3.6" fill={dot} />
      <circle cx="60" cy="100" r="3.6" fill={dot} />
      <circle cx="20" cy="60" r="3.6" fill={dot} />
      <circle cx="100" cy="60" r="3.6" fill={dot} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════
// LANDING PAGE — Choose Admin or User
// ═══════════════════════════════════════════════════
function LandingPage({ onAdminLogin, onUserLogin }) {
  return (
    <div className="landing-page">
      {/* Floating particles */}
      <div className="landing-particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${4 + Math.random() * 6}s`,
            width: `${3 + Math.random() * 6}px`,
            height: `${3 + Math.random() * 6}px`,
          }} />
        ))}
      </div>

      <div className="landing-content">
        <div className="landing-seal-anim">
          <Seal size={120} />
        </div>
        <h1 className="landing-title">கவிஞன் கமலேஷ்</h1>
        <p className="landing-subtitle">Tamil Kavithai • முத்திரை</p>
        <p className="landing-desc">
          காதல், தமிழ், நட்பு — தமிழ் வரிகளில் உங்கள் இதயம் தேடும் ஒவ்வொரு கவிதையும் இங்கே.
        </p>

        <div className="landing-buttons">
          <button className="landing-btn admin-btn" onClick={onAdminLogin}>
            <div className="landing-btn-icon">
              <CrownOutlined />
            </div>
            <div className="landing-btn-text">
              <span className="landing-btn-label">நிர்வாகி</span>
              <span className="landing-btn-sub">Admin Portal</span>
            </div>
            <LockOutlined className="landing-btn-lock" />
          </button>

          <button className="landing-btn user-btn" onClick={onUserLogin}>
            <div className="landing-btn-icon">
              <ReadOutlined />
            </div>
            <div className="landing-btn-text">
              <span className="landing-btn-label">பயனர்</span>
              <span className="landing-btn-sub">User Access</span>
            </div>
            <ArrowLeftOutlined className="landing-btn-lock" style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>

        <div className="landing-footer-text">
          © 2026 கவிஞன் கமலேஷ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.
        </div>
      </div>
    </div>
  );
}

function UserView({
  onBack,
  initialCategory = null,
  onSelectPoem,
  navigate,
  kavithaigal: parentKavithaigal,
  likesMap: parentLikesMap,
  likedIds: parentLikedIds,
  onLike: parentOnLike,
  onShare: parentOnShare,
  onAddComment: parentOnAddComment
}) {
  const [localKavithaigal, setLocalKavithaigal] = useState(() => loadInitialKavithaigal());
  const kavithaigal = parentKavithaigal || localKavithaigal;
  const setKavithaigal = setLocalKavithaigal;

  const [customCategories, setCustomCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || null);
  const [selectedKavithai, setSelectedKavithai] = useState(null);
  const [localLikesMap, setLocalLikesMap] = useState({});
  const [localLikedIds, setLocalLikedIds] = useState({});
  const likesMap = parentLikesMap || localLikesMap;
  const likedIds = parentLikedIds || localLikedIds;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commentForm] = Form.useForm();

  useEffect(() => {
    setSelectedCategory(initialCategory || null);
  }, [initialCategory]);

  useEffect(() => {
    const unsubscribe = subscribeToKavithaigal((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setKavithaigal(data);
        setSelectedKavithai(prev => {
          if (!prev) return null;
          const updated = data.find(k => k.id === prev.id);
          return updated || prev;
        });
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      setCustomCategories(cats || []);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // When opening a category folder, always scroll to the top of the folder
  useEffect(() => {
    if (selectedCategory) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  }, [selectedCategory]);

  const allCategoriesList = useMemo(() => {
    const map = new Map();
    DEFAULT_CATEGORIES.forEach(c => map.set(c.name, c));
    (customCategories || []).forEach(c => {
      if (c && c.name) {
        map.set(c.name, {
          name: c.name,
          emoji: c.emoji || '📖',
          en: c.en || c.name
        });
      }
    });
    kavithaigal.forEach(k => {
      if (k && k.category && !map.has(k.category)) {
        map.set(k.category, {
          name: k.category,
          emoji: '📜',
          en: k.category
        });
      }
    });
    return Array.from(map.values());
  }, [customCategories, kavithaigal]);

  const categoryEmojiMap = useMemo(() => Object.fromEntries(allCategoriesList.map(c => [c.name, c.emoji])), [allCategoriesList]);

  const handleLike = (id, e) => {
    if (e) e.stopPropagation();
    const isLiked = likedIds[id];
    const diff = isLiked ? -1 : 1;
    setLikedIds(prev => ({ ...prev, [id]: !isLiked }));
    setLikesMap(prev => ({
      ...prev,
      [id]: (prev[id] ?? 0) + diff
    }));
    setKavithaigal(prev => prev.map(p => p.id === id ? { ...p, likes: Math.max(0, (p.likes || 0) + diff) } : p));
    likeKavithaiInFirebase(id, diff);
    if (!isLiked) {
      message.success('நன்றி! கவிதை உங்களுக்கு பிடித்துள்ளது ❤️');
    }
  };

  const handleShare = (kavithai, e) => {
    if (e) e.stopPropagation();
    const text = `${kavithai.title}\n\n${kavithai.content}\n\n- ${kavithai.author}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      message.success('கவிதை உரை நகலெடுக்கப்பட்டது!');
    }
  };

  const safeOpen = (url) => {
    const allowed = ['https://youtube.com', 'https://www.youtube.com', 'https://www.instagram.com'];
    try {
      const parsed = new URL(url);
      if (allowed.some(a => parsed.origin === new URL(a).origin)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch { /* invalid URL */ }
  };

  // Group poems by categories
  const categoryGroups = allCategoriesList.map(cat => ({
    name: cat.name,
    emoji: cat.emoji || '📖',
    poems: kavithaigal.filter(k => k.category === cat.name),
  })).filter(g => g.poems.length > 0);

  const poemsInSelectedCategory = selectedCategory
    ? kavithaigal.filter(k => k.category === selectedCategory)
    : [];

  const navItems = [
    { key: 'home', label: 'முகப்பு', num: '01' },
    { key: 'categories', label: 'வகைகள்', num: '02' },
    { key: 'youtube', label: 'கேட்பொலி', num: '03' },
  ];

  const handleNavClick = (target) => {
    setDrawerOpen(false);
    setSelectedCategory(null);
    setSelectedKavithai(null);
    const el = document.getElementById(`${target}-section`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // ── If a category is selected, show poems in that category ──
  if (selectedCategory) {
    return (
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#e07f2e',
            fontFamily: "'Noto Sans Tamil', 'Noto Serif Tamil', sans-serif",
            borderRadius: 12,
          },
          algorithm: theme.defaultAlgorithm,
        }}
      >
        <Layout style={{ minHeight: '100vh', background: 'var(--porcelain)' }}>
          <div className="top-strip" />
          <Header className="blue-header" style={{ padding: 0, lineHeight: 'inherit' }}>
            <div className="blue-header-inner">
              <div className="brand-row" onClick={() => {
                setSelectedCategory(null);
                if (navigate) navigate('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
                <Seal size={42} />
                <div>
                  <div className="brand-name">கவிஞன் கமலேஷ்</div>
                  <div className="brand-sub">Tamil Kavithai</div>
                </div>
              </div>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setSelectedCategory(null);
                  if (navigate) navigate('/categories');
                  setTimeout(() => {
                    const el = document.getElementById('categories-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                style={{ color: '#fdf6ee', borderColor: 'rgba(255,255,255,0.3)', background: 'transparent' }}
              >
                வகைகளுக்குத் திரும்பு
              </Button>
            </div>
          </Header>

          <Content style={{ maxWidth: 1360, margin: '0 auto', padding: '32px clamp(16px, 4vw, 44px)', width: '100%' }}>
            <div className="cat-session-header">
              <span className="cat-session-emoji">{categoryEmojiMap[selectedCategory] || '📖'}</span>
              <div>
                <h2 className="cat-session-title">{selectedCategory}</h2>
                <span className="cat-session-count">{poemsInSelectedCategory.length} கவிதைகள்</span>
              </div>
            </div>

            <div className="user-poems-grid">
              {poemsInSelectedCategory.map(poem => {
                const totalLikes = (poem.likes || 0) + (likesMap[poem.id] ?? 0);
                const isLiked = likedIds[poem.id];
                return (
                  <div
                    className="user-poem-tile"
                    key={poem.id}
                    onClick={() => {
                      if (onSelectPoem) {
                        onSelectPoem(poem);
                      } else {
                        setSelectedKavithai(poem);
                      }
                    }}
                  >
                    <img className="user-poem-tile-img" src={poem.image || DEFAULT_KAVITHAI_IMAGE} alt={poem.title} />
                    <div className="user-poem-tile-body">
                      <div className="tile-top">
                        <span className="tile-cat">{poem.category}</span>
                        <span className="tile-num">№ {String(poem.id).padStart(2, '0')}</span>
                      </div>
                      <div className="tile-title">{poem.title}</div>
                      <p className="tile-excerpt">{(poem.content || '').split('\n').slice(0, 2).join('\n')}</p>
                      <div className="tile-foot">
                        <span className="tile-author">— {poem.author}</span>
                        <div className="tile-actions">
                          <Button
                            type="text"
                            icon={isLiked ? <HeartFilled style={{ color: '#d06a24' }} /> : <HeartOutlined />}
                            size="small"
                            onClick={(e) => handleLike(poem.id, e)}
                          >
                            {totalLikes}
                          </Button>
                          <Button
                            type="text"
                            icon={<MessageOutlined />}
                            size="small"
                          >
                            {poem.comments?.length || 0}
                          </Button>
                          <Button
                            type="text"
                            icon={<ShareAltOutlined />}
                            size="small"
                            onClick={(e) => handleShare(poem, e)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Content>

          <Footer className="footer-navy" style={{ marginTop: 40, textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ color: 'var(--parchment-dim, #c0c8d4)', fontSize: '0.88rem' }}>
              © 2026 கவிஞன் கமலேஷ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.
            </div>
          </Footer>
        </Layout>

        {/* Full Poem Modal */}
        <Modal
          open={!!selectedKavithai}
          onCancel={() => setSelectedKavithai(null)}
          width={680}
          style={{ top: 40 }}
          footer={[
            <Button
              key="like"
              icon={selectedKavithai && likedIds[selectedKavithai.id] ? <HeartFilled style={{ color: '#d06a24' }} /> : <HeartOutlined />}
              onClick={() => selectedKavithai && handleLike(selectedKavithai.id)}
            >
              விரும்பு ({selectedKavithai ? (selectedKavithai.likes || 0) + (likesMap[selectedKavithai.id] ?? 0) : 0})
            </Button>,
            <Button key="share" icon={<ShareAltOutlined />} onClick={() => selectedKavithai && handleShare(selectedKavithai)}>
              பகிர்
            </Button>,
            <Button key="close" type="primary" onClick={() => setSelectedKavithai(null)}>
              மூடு
            </Button>
          ]}
        >
          {selectedKavithai && (
            <div style={{ padding: '12px 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="tile-cat">{selectedKavithai.category}</span>
                <span className="tile-num">№ {String(selectedKavithai.id).padStart(2, '0')}</span>
              </div>
              <Title level={3} style={{ fontFamily: "'Noto Serif Tamil', serif", color: 'var(--navy-800)', margin: '0 0 6px' }}>
                {selectedKavithai.title}
              </Title>
              <p style={{ fontFamily: "'Noto Sans Tamil', sans-serif", color: 'var(--ink-soft)', fontSize: '0.88rem', marginBottom: 18 }}>
                ஆசிரியர்: {selectedKavithai.author}
              </p>
              {(selectedKavithai.image || DEFAULT_KAVITHAI_IMAGE) && (
                <img
                  src={selectedKavithai.image || DEFAULT_KAVITHAI_IMAGE}
                  alt={selectedKavithai.title}
                  style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 14, marginBottom: 20 }}
                />
              )}
              <p style={{
                whiteSpace: 'pre-line',
                fontSize: '1.22rem',
                lineHeight: 2.1,
                fontFamily: "'Noto Serif Tamil', serif",
                color: 'var(--ink)',
                background: 'var(--porcelain)',
                padding: 26,
                borderRadius: 14,
                border: '1px solid var(--hairline)',
              }}>
                {selectedKavithai.content}
              </p>
              
              {/* Comments Section */}
              <div className="comments-section" style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid var(--hairline)' }}>
                <Title level={4} style={{ fontFamily: "'Noto Sans Tamil', sans-serif", fontSize: '1.1rem', marginBottom: 16 }}>
                  கருத்துகள் ({selectedKavithai.comments?.length || 0})
                </Title>
                <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 16 }}>
                  {(selectedKavithai.comments || []).map((c, i) => (
                    <div key={i} style={{ marginBottom: 12, padding: 12, background: '#fff', border: '1px solid var(--hairline)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ color: 'var(--navy-800)' }}>{c.author}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{c.date}</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>{c.text}</div>
                    </div>
                  ))}
                  {(!selectedKavithai.comments || selectedKavithai.comments.length === 0) && (
                    <div style={{ color: 'var(--ink-soft)', fontStyle: 'italic' }}>முதல் கருத்தை பதிவு செய்யுங்கள்!</div>
                  )}
                </div>
                <Form
                  form={commentForm}
                  layout="vertical"
                  onFinish={(values) => {
                    const newComment = {
                      id: Date.now(),
                      author: values.author,
                      text: values.text,
                      date: new Date().toLocaleDateString('ta-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
                      role: 'user'
                    };
                    addCommentToFirebase(selectedKavithai.id, newComment);
                    setSelectedKavithai(prev => prev ? {
                      ...prev,
                      comments: [...(prev.comments || []), newComment]
                    } : null);
                    setKavithaigal(prev => prev.map(p => p.id === selectedKavithai.id ? {
                      ...p,
                      comments: [...(p.comments || []), newComment]
                    } : p));
                    message.success('உங்கள் கருத்து பதிவு செய்யப்பட்டது!');
                    commentForm.resetFields();
                  }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Form.Item name="author" style={{ marginBottom: 8 }} rules={[{ required: true, message: 'பெயரை உள்ளிடவும்' }]}>
                      <Input placeholder="உங்கள் பெயர்" />
                    </Form.Item>
                    <Form.Item name="text" style={{ marginBottom: 8 }} rules={[{ required: true, message: 'கருத்தை உள்ளிடவும்' }]}>
                      <TextArea placeholder="உங்கள் கருத்து..." rows={2} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" style={{ background: 'var(--ember-500)', borderColor: 'var(--ember-500)' }}>
                      கருத்தை பதிவு செய்
                    </Button>
                  </Space>
                </Form>
              </div>

            </div>
          )}
        </Modal>

        <FloatButton.BackTop style={{ right: 24, bottom: 24 }} />
      </ConfigProvider>
    );
  }

  // ── Main User View — Category Tiles ──
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#e07f2e',
          fontFamily: "'Noto Sans Tamil', 'Noto Serif Tamil', sans-serif",
          borderRadius: 12,
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <Layout style={{ minHeight: '100vh', background: 'var(--porcelain)' }}>
        <div className="top-strip" />
        <Header className="blue-header" style={{ padding: 0, lineHeight: 'inherit' }}>
          <div className="blue-header-inner">
            <div className="brand-row" onClick={() => handleNavClick('home')}>
              <Seal size={42} />
              <div>
                <div className="brand-name">கவிஞன் கமலேஷ்</div>
                <div className="brand-sub">Tamil Kavithai • முத்திரை</div>
              </div>
            </div>
            <div className="header-nav">
              {navItems.map(item => (
                <button key={item.key} className="nav-pill" onClick={() => handleNavClick(item.key)}>
                  <span className="num">{item.num}</span>
                  {item.label}
                </button>
              ))}
              <button className="nav-pill" onClick={onBack} style={{ color: 'var(--ember-300)' }}>
                <LogoutOutlined style={{ marginRight: 6 }} />
                திரும்பு
              </button>
            </div>
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: '#fdf6ee', fontSize: 22 }} />}
              onClick={() => setDrawerOpen(true)}
              className="mobile-menu-btn"
            />
          </div>
        </Header>

        <Content>
          {/* ── HERO ── */}
          <section id="home-section" className="hero-board">
            <div className="hero-seal-bg">
              <Seal size={480} />
            </div>
            <div className="hero-inner">
              <div>
                <span className="hero-kicker">
                  <Seal size={20} /> கவிதை ஒலிப்பதிவு & எழுத்து
                </span>
                <h1 className="hero-title">
                  உரையில் பூத்த <span className="o">உணர்வுகள்</span>
                </h1>
                <p className="hero-sub">
                  காதல், தமிழ், நட்பு — தமிழ் வரிகளில் உங்கள் இதயம்
                  தேடும் ஒவ்வொரு கவிதையும் இங்கே.
                </p>
                <div className="hero-cta-row">
                  <button className="ember-btn" onClick={() => {
                    const el = document.getElementById('categories-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    கவிதைகள் படிக்க →
                  </button>
                  <button className="ghost-btn" onClick={() => safeOpen('https://youtube.com/@tamilpoetkamal')}>
                    <YoutubeOutlined /> YouTube
                  </button>
                  <button className="ghost-btn" onClick={() => safeOpen('https://www.instagram.com/tamilpoet_kamal_yt')}>
                    <InstagramOutlined style={{ color: '#E4405F' }} /> Instagram
                  </button>
                </div>
              </div>

              <div className="stat-grid">
                <div className="stat-cell">
                  <div className="n">{String(kavithaigal.length).padStart(2, '0')}</div>
                  <div className="l">கவிதைகள்</div>
                </div>
                <div className="stat-cell">
                  <div className="n">{String(categoryGroups.length).padStart(2, '0')}</div>
                  <div className="l">வகைகள்</div>
                </div>
                <div className="stat-cell">
                  <div className="n">{String(kavithaigal.filter(k => k.featured).length).padStart(2, '0')}</div>
                  <div className="l">சிறப்பு</div>
                </div>
                <div className="stat-cell">
                  <div className="n">YT</div>
                  <div className="l">@tamilpoetkamal</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── CATEGORY TILES — Click to open session ── */}
          <section id="categories-section" className="section-shell">
            <div className="section-head-row">
              <div>
                <div className="sec-label">02 — கவிதை வகைகள்</div>
                <h2 className="sec-title">வகை தேர்ந்தெடுக்கவும்</h2>
              </div>
              <p style={{ fontSize: '0.92rem', color: 'var(--ink-soft)', maxWidth: 340, lineHeight: 1.8, margin: 0 }}>
                ஒரு வகையைத் தட்டவும் — அந்த வகையின் கவிதைகளைப் படிக்கலாம்.
              </p>
            </div>

            <div className="category-tiles-grid">
              {categoryGroups.map(group => (
                <div
                  className="category-tile"
                  key={group.name}
                  onClick={() => {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                    setSelectedCategory(group.name);
                    if (navigate) {
                      navigate('/' + getCategorySlug(group.name));
                    }
                  }}
                >
                  <div className="category-tile-bg" />
                  <div className="category-tile-emoji">{group.emoji}</div>
                  <h3 className="category-tile-name">{group.name}</h3>
                  <span className="category-tile-count">{group.poems.length} கவிதைகள்</span>
                  <div className="category-tile-preview">
                    {group.poems.slice(0, 3).map(p => (
                      <div className="category-tile-preview-item" key={p.id}>
                        {p.title}
                      </div>
                    ))}
                    {group.poems.length > 3 && (
                      <div className="category-tile-preview-more">+{group.poems.length - 3} மேலும்...</div>
                    )}
                  </div>
                  <div className="category-tile-arrow">→</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── YouTube BAND ── */}
          <section id="youtube-section" className="yt-band">
            <div className="yt-inner">
              <div>
                <div className="yt-label">03 — கேட்பொலி</div>
                <h2 className="yt-title">குரலில் உயிர்பெறும் கவிதைகள்</h2>
                <p className="yt-desc">
                  எம் YouTube சேனலில் ஒவ்வொரு கவிதையும் ஒலி, இசை, உணர்வுடன்
                  பதிவாகிறது.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    className="ember-btn"
                    style={{ background: 'linear-gradient(135deg, #e34828, #b81f12)', boxShadow: '0 8px 22px rgba(184, 31, 18, 0.5)' }}
                    onClick={() => safeOpen('https://youtube.com/shorts/S9D2qzZRdpM')}
                  >
                    <YoutubeOutlined /> YouTube
                  </button>
                  <button
                    className="ember-btn"
                    style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)', boxShadow: '0 8px 22px rgba(225, 48, 108, 0.4)' }}
                    onClick={() => safeOpen('https://www.instagram.com/tamilpoet_kamal_yt')}
                  >
                    <InstagramOutlined /> Instagram
                  </button>
                </div>
              </div>
              <div className="yt-filled">
                <iframe
                  width="100%"
                  height="380"
                  src="https://www.youtube.com/embed/S9D2qzZRdpM"
                  title="YouTube - கவிஞன் கமலேஷ்"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(10, 19, 34, 0.95)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  borderTop: '1px solid rgba(224, 127, 46, 0.3)'
                }}>
                  <span style={{ color: '#b9c9e2', fontSize: '0.82rem' }}>
                    தோல்வியிலும் வெற்றி உண்டு! 🔥
                  </span>
                  <a
                    href="https://youtube.com/shorts/S9D2qzZRdpM"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#fff',
                      background: '#e34828',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <YoutubeOutlined /> YouTube-ல் பார்க்க
                  </a>
                </div>
              </div>
            </div>
          </section>
        </Content>

        {/* ── FOOTER ── */}
        <Footer className="footer-navy">
          <div className="footer-inner">
            <div>
              <div className="footer-brand-row">
                <Seal size={52} dark />
                <div>
                  <h4 style={{ margin: 0 }}>கவிஞன் கமலேஷ்</h4>
                  <div style={{ fontSize: '0.66rem', letterSpacing: 3, textTransform: 'uppercase', color: '#ef9c4e' }}>
                    Tamil Kavithai • முத்திரை
                  </div>
                </div>
              </div>
              <p>
                தமிழ் கவிதையின் இதயத்தை வரியில் பொறிக்கும் மின்னிதழ்.
              </p>
            </div>
            <div>
              <h4>இணைப்புகள்</h4>
              <ul>
                <li><a onClick={() => safeOpen('https://youtube.com/@tamilpoetkamal')}>YouTube — @tamilpoetkamal</a></li>
                <li><a onClick={() => safeOpen('https://www.instagram.com/tamilpoet_kamal_yt')}><InstagramOutlined style={{ color: '#E4405F', marginRight: 4 }} /> Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-sign">
            <span>© 2026 கவிஞன் கமலேஷ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.</span>
          </div>
        </Footer>

        <FloatButton.BackTop style={{ right: 24, bottom: 24 }} />

        {/* Mobile Drawer */}
        <Drawer
          title={<span style={{ fontFamily: "'Noto Serif Tamil', serif", color: 'var(--navy-800)' }}>கவிஞன் கமலேஷ்</span>}
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          styles={{ body: { padding: 10 } }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {navItems.map(item => (
              <Button
                key={item.key}
                block
                size="large"
                style={{ textAlign: 'left', fontFamily: "'Noto Sans Tamil', sans-serif", height: 48 }}
                onClick={() => handleNavClick(item.key)}
              >
                <span style={{ color: '#e07f2e', marginRight: 8 }}>{item.num}</span>
                {item.label}
              </Button>
            ))}
            <Button
              block
              size="large"
              icon={<LogoutOutlined />}
              style={{ textAlign: 'left', fontFamily: "'Noto Sans Tamil', sans-serif", height: 48, color: 'var(--ember-600)' }}
              onClick={() => { setDrawerOpen(false); onBack(); }}
            >
              முகப்புக்குத் திரும்பு
            </Button>
          </Space>
        </Drawer>
      </Layout>
    </ConfigProvider>
  );
}

// ═══════════════════════════════════════════════════
// MAIN APP — Router
// ═══════════════════════════════════════════════════
function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [kavithaigal, setKavithaigal] = useState(() => loadInitialKavithaigal());
  const [customCategories, setCustomCategories] = useState([]);
  const [likesMap, setLikesMap] = useState({});
  const [likedIds, setLikedIds] = useState({});

  useEffect(() => {
    const onPop = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToKavithaigal((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setKavithaigal(data);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      setCustomCategories(cats || []);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const allCategoriesList = useMemo(() => {
    const map = new Map();
    DEFAULT_CATEGORIES.forEach(c => map.set(c.name, c));
    (customCategories || []).forEach(c => {
      if (c && c.name) {
        map.set(c.name, {
          name: c.name,
          emoji: c.emoji || '📖',
          en: c.en || c.name
        });
      }
    });
    kavithaigal.forEach(k => {
      if (k && k.category && !map.has(k.category)) {
        map.set(k.category, {
          name: k.category,
          emoji: '📜',
          en: k.category
        });
      }
    });
    return Array.from(map.values());
  }, [customCategories, kavithaigal]);

  const categoryEmojiMap = useMemo(() => Object.fromEntries(allCategoriesList.map(c => [c.name, c.emoji])), [allCategoriesList]);

  const handleLike = (id, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const isLiked = likedIds[id];
    const diff = isLiked ? -1 : 1;
    setLikedIds(prev => ({ ...prev, [id]: !isLiked }));
    setLikesMap(prev => ({
      ...prev,
      [id]: (prev[id] ?? 0) + diff
    }));
    setKavithaigal(prev => prev.map(p => p.id === id ? { ...p, likes: Math.max(0, (p.likes || 0) + diff) } : p));
    likeKavithaiInFirebase(id, diff);
    if (!isLiked) {
      message.success('நன்றி! கவிதை உங்களுக்கு பிடித்துள்ளது ❤️');
    }
  };

  const handleShare = (kavithai, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const fullUrl = window.location.origin + getPoemUrl(kavithai);
    const text = `${kavithai.title}\n\n${kavithai.content}\n\n- ${kavithai.author}\n${fullUrl}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      message.success('கவிதை இணைப்பு & வரிகள் நகலெடுக்கப்பட்டது!');
    }
  };

  const handleAddComment = (poemId, newComment) => {
    addCommentToFirebase(poemId, newComment);
    setKavithaigal(prev => prev.map(p => p.id === poemId ? {
      ...p,
      comments: [...(p.comments || []), newComment]
    } : p));
  };

  // Route matching
  const cleanPath = (currentPath || '/').replace(/\/+$/, '') || '/';
  const parts = cleanPath.slice(1).split('/').filter(Boolean);

  let activeView = 'landing';
  let matchedPoem = null;
  let activeCategory = null;

  if (cleanPath === '/admin') {
    activeView = 'admin';
  } else if (parts.length === 2) {
    const [catSlug, poemSlug] = parts;
    matchedPoem = findPoemBySlugOrId(poemSlug, kavithaigal);
    if (matchedPoem) {
      activeView = 'poem';
    } else {
      const catName = getCategoryNameFromSlug(catSlug, allCategoriesList);
      activeCategory = catName || null;
      activeView = 'user';
    }
  } else if (parts.length === 1) {
    if (parts[0] === 'categories' || parts[0] === 'user') {
      activeView = 'user';
      activeCategory = null;
    } else {
      const catName = getCategoryNameFromSlug(parts[0], allCategoriesList);
      if (catName) {
        activeView = 'user';
        activeCategory = catName;
      } else {
        activeView = 'landing';
      }
    }
  } else {
    activeView = 'landing';
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#e07f2e',
          colorInfo: '#e07f2e',
          colorLink: '#d06a24',
          colorBgBase: '#f3f6fa',
          colorText: '#1a2639',
          colorTextSecondary: '#5b6b80',
          fontFamily: "'Noto Sans Tamil', 'Noto Serif Tamil', sans-serif",
          borderRadius: 12,
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      {activeView === 'poem' && matchedPoem && (
        <PoemPage
          poem={matchedPoem}
          allPoems={kavithaigal}
          categoryEmojiMap={categoryEmojiMap}
          onBackToCategory={() => navigate('/' + getCategorySlug(matchedPoem.category))}
          onNavigateToPoem={(p) => navigate(getPoemUrl(p))}
          onNavigateHome={() => navigate('/')}
          onLike={handleLike}
          onShare={handleShare}
          liked={!!likedIds[matchedPoem.id]}
          totalLikes={(matchedPoem.likes || 0) + (likesMap[matchedPoem.id] ?? 0)}
          onAddComment={handleAddComment}
        />
      )}
      {activeView === 'user' && (
        <UserView
          onBack={() => navigate('/')}
          initialCategory={activeCategory}
          onSelectPoem={(poem) => navigate(getPoemUrl(poem))}
          navigate={navigate}
          kavithaigal={kavithaigal}
          likesMap={likesMap}
          likedIds={likedIds}
          onLike={handleLike}
          onShare={handleShare}
          onAddComment={handleAddComment}
        />
      )}
      {activeView === 'admin' && (
        <AdminPortal onBackHome={() => navigate('/')} />
      )}
      {activeView === 'landing' && (
        <LandingPage
          onAdminLogin={() => navigate('/admin')}
          onUserLogin={() => navigate('/categories')}
        />
      )}
      <Analytics />
    </ConfigProvider>
  );
}

export default App;