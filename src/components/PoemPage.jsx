import { useState, useEffect } from 'react';
import {
  Layout,
  Typography,
  Button,
  Space,
  Form,
  Input,
  message,
  Breadcrumb,
  Tag,
  Divider,
  FloatButton
} from 'antd';
import {
  HeartOutlined,
  HeartFilled,
  ShareAltOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  EyeOutlined,
  MessageOutlined,
  BookOutlined,
  HomeOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { DEFAULT_KAVITHAI_IMAGE } from '../data/index.jsx';
import { getCategorySlug, getPoemSlug, getPoemUrl } from '../utils/slug.js';
import { downloadPoemCard } from '../utils/generatePoemCard.js';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function Seal({ size = 42, dark = false }) {
  const base = dark ? '#e07f2e' : '#132745';
  const ring = dark ? '#132745' : '#ef9c4e';
  const glyph = dark ? '#132745' : '#fdf6ee';
  const dot = dark ? '#132745' : '#ef9c4e';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill={base} />
      <circle cx="60" cy="47" r="47" fill="none" stroke={ring} strokeWidth="3" strokeDasharray="5 4" />
      <text x="60" y="82" textAnchor="middle" fontFamily="'Noto Serif Tamil', serif" fontWeight="700" fontSize="48" fill={glyph}>க</text>
      <circle cx="60" cy="20" r="3.6" fill={dot} />
      <circle cx="60" cy="100" r="3.6" fill={dot} />
      <circle cx="20" cy="60" r="3.6" fill={dot} />
      <circle cx="100" cy="60" r="3.6" fill={dot} />
    </svg>
  );
}

export default function PoemPage({
  poem,
  allPoems = [],
  categoryEmojiMap = {},
  onBackToCategory,
  onNavigateToPoem,
  onNavigateHome,
  onLike,
  onShare,
  liked = false,
  totalLikes = 0,
  onAddComment
}) {
  const [commentForm] = Form.useForm();
  const [downloading, setDownloading] = useState(false);

  // Scroll to top when poem page mounts or poem changes
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [poem?.id]);

  // Update dynamic document title and meta description
  useEffect(() => {
    if (!poem) return;

    const previousTitle = document.title;
    const catSlug = getCategorySlug(poem.category);
    const poemSlug = getPoemSlug(poem);
    const pageUrl = `https://tamil-kavithai-delta.vercel.app/${catSlug}/${poemSlug}`;
    const cleanExcerpt = (poem.content || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    const metaDescText = `${poem.title} — ${cleanExcerpt}... ஆசிரியர்: ${poem.author || 'கவிஞன் கமலேஷ்'}. தமிழ் கவிதைகள் வாசிக்கவும் பகிரவும்.`;

    document.title = `${poem.title} | ${poem.category} கவிதை — கவிஞன் கமலேஷ்`;

    // Update or insert meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    const oldDesc = metaDesc.getAttribute('content');
    metaDesc.setAttribute('content', metaDescText);

    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const oldCanonical = canonical.getAttribute('href');
    canonical.setAttribute('href', pageUrl);

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${poem.title} | ${poem.category} கவிதை`);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', metaDescText);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);

    return () => {
      document.title = previousTitle;
      if (metaDesc && oldDesc) metaDesc.setAttribute('content', oldDesc);
      if (canonical && oldCanonical) canonical.setAttribute('href', oldCanonical);
    };
  }, [poem]);

  // Append attribution to copied text on poem pages (without disabling selection or right-click)
  useEffect(() => {
    const handleCopy = (e) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const selectedText = selection.toString();
      if (!selectedText || !selectedText.trim()) return;

      // Skip modifying if user is copying from an input or textarea
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const attribution = "\n\n© கவிஞன் கமலேஷ் – tamil-kavithai-delta.vercel.app";
      if (e.clipboardData) {
        e.preventDefault();
        e.clipboardData.setData('text/plain', selectedText + attribution);
      }
    };
    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, []);

  if (!poem) return null;

  const categoryEmoji = categoryEmojiMap[poem.category] || '📖';
  const relatedPoems = allPoems
    .filter(p => p && p.category === poem.category && p.id !== poem.id)
    .slice(0, 4);

  const handleCopyPoem = () => {
    const attribution = "\n\n© கவிஞன் கமலேஷ் – tamil-kavithai-delta.vercel.app";
    const text = `${poem.title}\n\n${poem.content}\n\n— ${poem.author}${attribution}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      message.success('முழுக் கவிதை வரிகள் நகலெடுக்கப்பட்டது! 📋');
    }
  };

  const handleDownloadImage = async () => {
    try {
      setDownloading(true);
      const success = await downloadPoemCard(poem);
      if (success) {
        message.success('கவிதைப் படம் பதிவிறக்கப்பட்டது! 🎨');
      } else {
        message.error('படத்தைப் பதிவிறக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
      }
    } catch (err) {
      console.error('Image download error:', err);
      message.error('படத்தைப் பதிவிறக்க முடியவில்லை.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCommentFinish = (values) => {
    if (!values.author?.trim() || !values.text?.trim()) return;
    const newComment = {
      id: Date.now(),
      author: values.author.trim(),
      text: values.text.trim(),
      date: new Date().toLocaleDateString('ta-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      role: 'user'
    };
    if (onAddComment) {
      onAddComment(poem.id, newComment);
    }
    commentForm.resetFields();
    message.success('உங்கள் கருத்து பதிவு செய்யப்பட்டது! ✍️');
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--porcelain, #faf7f2)' }}>
      <div className="top-strip" />

      {/* Header */}
      <Header className="blue-header" style={{ padding: 0, lineHeight: 'inherit' }}>
        <div className="blue-header-inner">
          <div className="brand-row" onClick={onNavigateHome} style={{ cursor: 'pointer' }}>
            <Seal size={42} />
            <div>
              <div className="brand-name">கவிஞன் கமலேஷ்</div>
              <div className="brand-sub">Tamil Kavithai • முத்திரை</div>
            </div>
          </div>
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={onBackToCategory}
              style={{
                color: '#fdf6ee',
                borderColor: 'rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.08)',
                fontFamily: "'Noto Sans Tamil', sans-serif"
              }}
            >
              {categoryEmoji} {poem.category} வகைக்குத் திரும்பு
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ maxWidth: 880, margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px)', width: '100%' }}>
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: 20 }}>
          <Breadcrumb
            items={[
              {
                title: (
                  <a onClick={onNavigateHome} style={{ color: 'var(--ink-soft)' }}>
                    <HomeOutlined /> முகப்பு
                  </a>
                )
              },
              {
                title: (
                  <a onClick={onBackToCategory} style={{ color: 'var(--ember-600, #d96f27)' }}>
                    <BookOutlined /> {categoryEmoji} {poem.category}
                  </a>
                )
              },
              {
                title: <span style={{ color: 'var(--navy-800)' }}>{poem.title}</span>
              }
            ]}
          />
        </div>

        {/* Back Button Banner */}
        <div style={{ marginBottom: 24 }}>
          <Button
            type="dashed"
            icon={<ArrowLeftOutlined />}
            size="large"
            onClick={onBackToCategory}
            style={{
              borderColor: 'var(--ember-500, #d96f27)',
              color: 'var(--ember-600, #d96f27)',
              borderRadius: 12,
              height: 44,
              fontFamily: "'Noto Sans Tamil', sans-serif",
              fontWeight: 500
            }}
          >
            ← {categoryEmoji} "{poem.category}" கவிதைத் தலைப்புக்குத் திரும்பு
          </Button>
        </div>

        {/* Main Poem Card */}
        <article
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: 'clamp(24px, 5vw, 44px)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.06)',
            border: '1px solid var(--hairline, #eadcd0)',
            marginBottom: 36
          }}
        >
          {/* Top category badge & poem ID */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Tag
              onClick={onBackToCategory}
              style={{
                cursor: 'pointer',
                background: '#fff3ea',
                borderColor: '#ffd8be',
                color: 'var(--ember-600, #d96f27)',
                fontSize: '0.9rem',
                padding: '4px 12px',
                borderRadius: 20,
                fontWeight: 600
              }}
            >
              {categoryEmoji} {poem.category}
            </Tag>
            <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', fontWeight: 600, letterSpacing: 1 }}>
              № {String(poem.id).padStart(2, '0')}
            </span>
          </div>

          {/* Poem Title */}
          <Title
            level={1}
            style={{
              fontFamily: "'Noto Serif Tamil', serif",
              color: 'var(--navy-800, #132745)',
              margin: '0 0 10px',
              fontSize: 'clamp(1.7rem, 4vw, 2.3rem)',
              lineHeight: 1.3
            }}
          >
            {poem.title}
          </Title>

          {/* Author */}
          <p style={{ color: 'var(--ink-soft)', fontSize: '0.95rem', margin: '0 0 24px' }}>
            ஆசிரியர்: <strong style={{ color: 'var(--navy-800)' }}>{poem.author || 'கவிஞன் கமலேஷ்'}</strong>
          </p>

          {/* Poem Image */}
          {(poem.image || DEFAULT_KAVITHAI_IMAGE) && (
            <div style={{ marginBottom: 28, borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}>
              <img
                src={poem.image || DEFAULT_KAVITHAI_IMAGE}
                alt={poem.title}
                style={{ width: '100%', maxHeight: 380, objectFit: 'cover', display: 'block' }}
              />
            </div>
          )}

          {/* Poem Content */}
          <div
            style={{
              whiteSpace: 'pre-line',
              fontSize: 'clamp(1.15rem, 2.5vw, 1.35rem)',
              lineHeight: 2.2,
              fontFamily: "'Noto Serif Tamil', serif",
              color: 'var(--ink, #1f2d3d)',
              background: 'linear-gradient(180deg, #fbf7f2 0%, #ffffff 100%)',
              padding: 'clamp(24px, 4vw, 36px)',
              borderRadius: 16,
              border: '1px solid #eedecf',
              margin: '20px 0 28px'
            }}
          >
            {poem.content}
          </div>

          {/* Interactive Actions Toolbar */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '16px 0',
              borderTop: '1px solid #f0e6dc',
              borderBottom: '1px solid #f0e6dc'
            }}
          >
            <Button
              type={liked ? 'primary' : 'default'}
              icon={liked ? <HeartFilled style={{ color: '#fff' }} /> : <HeartOutlined style={{ color: '#d06a24' }} />}
              size="large"
              onClick={(e) => onLike && onLike(poem.id, e)}
              style={liked ? { background: '#d06a24', borderColor: '#d06a24' } : { borderColor: '#d06a24', color: '#d06a24' }}
            >
              விரும்பு ({totalLikes})
            </Button>

            <Button
              icon={<CopyOutlined />}
              size="large"
              onClick={handleCopyPoem}
            >
              வரிகளை நகலெடு
            </Button>

            <Button
              icon={<ShareAltOutlined />}
              size="large"
              onClick={(e) => onShare && onShare(poem, e)}
            >
              பகிர்
            </Button>

            <Button
              icon={<DownloadOutlined />}
              size="large"
              loading={downloading}
              onClick={handleDownloadImage}
              style={{
                borderColor: '#e07f2e',
                color: '#d06a24'
              }}
            >
              Download as image
            </Button>
          </div>

          {/* Comments Section */}
          <section style={{ marginTop: 32 }}>
            <Title level={3} style={{ fontFamily: "'Noto Sans Tamil', sans-serif", fontSize: '1.25rem', marginBottom: 20 }}>
              <MessageOutlined style={{ marginRight: 8, color: 'var(--ember-500, #d96f27)' }} />
              வாசகர் கருத்துகள் ({poem.comments?.length || 0})
            </Title>

            <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 24 }}>
              {(poem.comments || []).map((c, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 14,
                    padding: '14px 18px',
                    background: '#faf7f2',
                    border: '1px solid #eee1d4',
                    borderRadius: 12
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--navy-800)', fontSize: '0.98rem' }}>{c.author}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{c.date}</span>
                  </div>
                  <div style={{ fontSize: '0.96rem', color: 'var(--ink)', lineHeight: 1.7 }}>{c.text}</div>
                </div>
              ))}
              {(!poem.comments || poem.comments.length === 0) && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-soft)', fontStyle: 'italic', background: '#faf7f2', borderRadius: 10 }}>
                  முதல் கருத்தை நீங்கள் பதிவு செய்யுங்கள்! ✍️
                </div>
              )}
            </div>

            {/* Comment Form */}
            <Form form={commentForm} layout="vertical" onFinish={handleCommentFinish}>
              <Form.Item name="author" style={{ marginBottom: 12 }} rules={[{ required: true, message: 'தயவுசெய்து உங்கள் பெயரை உள்ளிடவும்' }]}>
                <Input placeholder="உங்கள் பெயர்" size="large" />
              </Form.Item>
              <Form.Item name="text" style={{ marginBottom: 14 }} rules={[{ required: true, message: 'தயவுசெய்து உங்கள் கருத்தை உள்ளிடவும்' }]}>
                <TextArea placeholder="உங்கள் அன்பான கருத்தை இங்கு எழுதவும்..." rows={3} />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                style={{
                  background: 'linear-gradient(135deg, var(--ember-500, #d96f27), var(--ember-600, #c45b17))',
                  borderColor: 'var(--ember-500, #d96f27)',
                  fontFamily: "'Noto Sans Tamil', sans-serif"
                }}
              >
                கருத்தை பதிவு செய் ✦
              </Button>
            </Form>
          </section>
        </article>

        {/* Related Poems in this category */}
        {relatedPoems.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <Title level={3} style={{ fontFamily: "'Noto Serif Tamil', serif", margin: 0, fontSize: '1.25rem', color: 'var(--navy-800)' }}>
                {categoryEmoji} "{poem.category}" வகையின் பிற கவிதைகள்
              </Title>
              <Button type="link" onClick={onBackToCategory} style={{ color: 'var(--ember-600, #d96f27)', fontWeight: 600 }}>
                அனைத்தும் பார்க்க →
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {relatedPoems.map(p => (
                <div
                  key={p.id}
                  onClick={() => onNavigateToPoem && onNavigateToPoem(p)}
                  style={{
                    background: '#fff',
                    borderRadius: 14,
                    padding: 16,
                    border: '1px solid var(--hairline, #eadcd0)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--ember-400, #ef9c4e)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--hairline, #eadcd0)'; }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--ember-600, #d96f27)', fontWeight: 600, marginBottom: 4 }}>
                    № {String(p.id).padStart(2, '0')} • {p.category}
                  </div>
                  <h4 style={{ fontFamily: "'Noto Serif Tamil', serif", margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--navy-800)' }}>
                    {p.title}
                  </h4>
                  <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
                    {(p.content || '').split('\n').slice(0, 2).join(' ')}...
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </Content>

      {/* Footer */}
      <Footer className="footer-navy" style={{ marginTop: 'auto' }}>
        <div className="footer-inner">
          <div>
            <div className="footer-brand-row">
              <Seal size={48} dark />
              <div>
                <h4 style={{ margin: 0 }}>கவிஞன் கமலேஷ்</h4>
                <div style={{ fontSize: '0.66rem', letterSpacing: 3, textTransform: 'uppercase', color: '#ef9c4e' }}>
                  Tamil Kavithai • முத்திரை
                </div>
              </div>
            </div>
            <p>தமிழ் கவிதையின் இதயத்தை வரியில் பொறிக்கும் மின்னிதழ்.</p>
          </div>
          <div>
            <h4>இணைப்புகள்</h4>
            <ul>
              <li><a onClick={onNavigateHome}>முகப்பு (Home)</a></li>
              <li><a onClick={onBackToCategory}>{poem.category} கவிதைகள்</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-sign">
          <span>© 2026 கவிஞன் கமலேஷ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.</span>
        </div>
      </Footer>

      <FloatButton.BackTop style={{ right: 24, bottom: 24 }} />
    </Layout>
  );
}

