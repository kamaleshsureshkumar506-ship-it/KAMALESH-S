import { useState, useEffect } from 'react';
import { Form, Input, Button, List, Avatar, Space, Typography, message } from 'antd';
import { CommentOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import { loadPoemComments, savePoemComments } from '../data/index.jsx';
import {
  sanitizeText,
  checkRateLimit,
  isHoneypotTriggered,
  MAX_INPUT_LENGTHS,
} from '../utils/security.js';

const { Text, Title } = Typography;
const { TextArea } = Input;

export default function PoemComments({ poemId, userAuth }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [guestName, setGuestName] = useState('');
  const [honeypot, setHoneypot] = useState(''); // anti-bot hidden field

  useEffect(() => {
    if (poemId) {
      setComments(loadPoemComments(poemId));
    }
  }, [poemId]);

  const handleAddComment = () => {
    // ── Honeypot check ──
    if (isHoneypotTriggered(honeypot)) {
      // silently reject — don't reveal that we detected a bot
      message.success('உங்கள் கருத்து பதிவிடப்பட்டது! 💬');
      return;
    }

    // ── Rate limiting: max 5 comments per 5 minutes per poem ──
    const rl = checkRateLimit(`comment-poem-${poemId}`, 5, 5 * 60 * 1000);
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

    const rawName = userAuth?.name ? userAuth.name : (guestName.trim() || 'வாசகர்');
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
    savePoemComments(poemId, updated);
    setCommentText('');
    message.success('உங்கள் கருத்து பதிவிடப்பட்டது! 💬');
  };

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--hairline)' }}>
      <Title level={4} style={{ fontFamily: "'Noto Serif Tamil', serif", color: 'var(--ink)', marginBottom: 16 }}>
        <CommentOutlined style={{ color: 'var(--accent)', marginRight: 8 }} />
        வாசகர் கருத்துகள் ({comments.length})
      </Title>

      {/* Comment Form */}
      <Form layout="vertical" onFinish={handleAddComment} style={{ marginBottom: 20 }}>
        {!userAuth && (
          <Form.Item style={{ marginBottom: 10 }}>
            <Input
              prefix={<UserOutlined style={{ color: 'var(--accent)' }} />}
              placeholder="உங்கள் பெயர் (எ.கா: கவின்)"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              size="middle"
              maxLength={MAX_INPUT_LENGTHS.name}
            />
          </Form.Item>
        )}

        <Form.Item style={{ marginBottom: 10 }}>
          <TextArea
            rows={3}
            placeholder="இந்த கவிதை பற்றிய உங்கள் கருத்துகளைப் பகிருங்கள்..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            style={{ fontFamily: "'Noto Sans Tamil', sans-serif", fontSize: '0.95rem' }}
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
            icon={<SendOutlined />}
            style={{
              background: 'var(--accent)',
              borderColor: 'var(--accent)',
              fontFamily: "'Noto Sans Tamil', sans-serif"
            }}
          >
            கருத்தை பதிவிடு
          </Button>
        </div>
      </Form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '16px 0' }}>
          இன்னும் கருத்துகள் இல்லை. முதல் கருத்தைப் பதியுங்கள்!
        </Text>
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={comments}
          renderItem={item => (
            <List.Item style={{ padding: '12px 0', borderBottom: '1px dashed var(--hairline)' }}>
              <List.Item.Meta
                avatar={
                  <Avatar style={{ backgroundColor: item.role === 'admin' ? '#9f1239' : '#d97706' }}>
                    {item.author[0] || 'வா'}
                  </Avatar>
                }
                title={
                  <Space size={8}>
                    <Text strong style={{ fontFamily: "'Noto Serif Tamil', serif", color: 'var(--ink)' }}>
                      {item.author}
                    </Text>
                    {item.role === 'admin' && (
                      <span className="user-badge admin" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>👑 நிர்வாகி</span>
                    )}
                    <Text type="secondary" style={{ fontSize: '0.75rem' }}>• {item.date}</Text>
                  </Space>
                }
                description={
                  <div style={{ fontFamily: "'Noto Sans Tamil', sans-serif", color: 'var(--ink)', marginTop: 4, lineHeight: 1.6 }}>
                    {item.text}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
