import { useState } from 'react';
import { Form, Input, Button, List, Avatar, Space, Typography, message, Card } from 'antd';
import { MessageOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import { loadGlobalComments, saveGlobalComments } from '../data/index.jsx';
import {
  sanitizeText,
  checkRateLimit,
  isHoneypotTriggered,
  MAX_INPUT_LENGTHS,
} from '../utils/security.js';

const { Text } = Typography;
const { TextArea } = Input;

export default function GlobalGuestbook({ userAuth }) {
  const [comments, setComments] = useState(loadGlobalComments);
  const [commentText, setCommentText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [honeypot, setHoneypot] = useState(''); // anti-bot hidden field

  const handleAddComment = () => {
    // ── Honeypot check ──
    if (isHoneypotTriggered(honeypot)) {
      // silently reject — don't reveal that we detected a bot
      message.success('உங்கள் பொது கருத்து வெற்றிகரமாகப் பதிவிடப்பட்டது! 🌟');
      return;
    }

    // ── Rate limiting: max 5 entries per 10 minutes ──
    const rl = checkRateLimit('global-guestbook', 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      const mins = Math.ceil(rl.retryAfterMs / 60000);
      message.warning(`அதிக கருத்துகள்! ${mins} நிமிடம் கழித்து முயற்சிக்கவும்.`);
      return;
    }

    // ── Sanitize inputs ──
    const sanitizedText = sanitizeText(commentText).slice(0, MAX_INPUT_LENGTHS.comment);
    if (!sanitizedText) {
      message.warning('கருத்தை உள்ளிடவும்');
      return;
    }

    const rawName = userAuth?.name ? userAuth.name : (guestName.trim() || 'அன்பான வாசகர்');
    const authorName = sanitizeText(rawName).slice(0, MAX_INPUT_LENGTHS.name);
    const authorRole = userAuth?.role || 'user';

    const newComment = {
      id: Date.now(),
      author: authorName,
      text: sanitizedText,
      date: new Date().toLocaleDateString('ta-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      role: authorRole
    };

    const updated = [newComment, ...comments];
    setComments(updated);
    saveGlobalComments(updated);
    setCommentText('');
    message.success('உங்கள் பொது கருத்து வெற்றிகரமாகப் பதிவிடப்பட்டது! 🌟');
  };

  return (
    <section id="comments-section" className="toc-section" style={{ background: 'var(--paper-2)', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--ink)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <span className="kicker">06 — பொது கருத்துகள்</span>
        <h2 className="section-head">வாசகர் கருத்துப்பலகை (Guestbook)</h2>
        <p className="section-sub" style={{ color: '#7a7060', marginBottom: 30 }}>
          எங்கள் தளம் மற்றும் கவிதைகள் பற்றிய உங்கள் பொதுவான கருத்துகள், வாழ்த்துகள் மற்றும் எண்ணங்களை இங்கு எழுதுங்கள்.
        </p>

        <Card
          bordered={false}
          style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 0, marginBottom: 32 }}
        >
          <Form layout="vertical" onFinish={handleAddComment}>
            {!userAuth && (
              <Form.Item label="உங்கள் பெயர்">
                <Input
                  prefix={<UserOutlined style={{ color: 'var(--accent)' }} />}
                  placeholder="எ.கா: நிலாவழகன் / கவின்"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  size="large"
                  maxLength={MAX_INPUT_LENGTHS.name}
                  showCount
                />
              </Form.Item>
            )}

            <Form.Item label="உங்கள் கருத்து / வாழ்த்து செய்தி">
              <TextArea
                rows={4}
                placeholder="எங்கள் கவிதைத் தளம் பற்றிய உங்களின் அன்பான வார்த்தைகளை இங்கு எழுதுங்கள்..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: '1.05rem', lineHeight: 1.8 }}
                maxLength={MAX_INPUT_LENGTHS.comment}
                showCount
              />
            </Form.Item>

            {/* Honeypot — hidden from real users, bots will fill it */}
            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
              <Input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={e => setHoneypot(e.target.value)}
                placeholder="Leave this empty"
              />
            </div>

            <div style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<SendOutlined />}
                style={{
                  background: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  fontFamily: "'Noto Sans Tamil', sans-serif"
                }}
              >
                கருத்தைப் பதிவிடு ✦
              </Button>
            </div>
          </Form>
        </Card>

        {/* List of Global Comments */}
        <List
          itemLayout="horizontal"
          dataSource={comments}
          renderItem={item => (
            <Card
              key={item.id}
              style={{
                marginBottom: 16,
                background: 'var(--paper)',
                border: '1px solid var(--hairline)',
                borderRadius: 0
              }}
              styles={{ body: { padding: '18px 24px' } }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar size="large" style={{ backgroundColor: item.role === 'admin' ? '#9f1239' : '#854d0e', fontFamily: "'Noto Serif Tamil', serif" }}>
                    {item.author[0] || 'வா'}
                  </Avatar>
                }
                title={
                  <Space size={10}>
                    <Text strong style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: '1.1rem', color: 'var(--ink)' }}>
                      {item.author}
                    </Text>
                    {item.role === 'admin' && (
                      <span className="user-badge admin" style={{ fontSize: '0.7rem' }}>👑 நிர்வாகி</span>
                    )}
                    <Text type="secondary" style={{ fontSize: '0.8rem' }}>• {item.date}</Text>
                  </Space>
                }
                description={
                  <div style={{ fontFamily: "'Noto Serif Tamil', serif", color: 'var(--ink)', fontSize: '1.05rem', lineHeight: 1.8, marginTop: 8 }}>
                    "{item.text}"
                  </div>
                }
              />
            </Card>
          )}
        />
      </div>
    </section>
  );
}
