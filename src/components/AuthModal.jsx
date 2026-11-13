import { useState } from 'react';
import { Modal, Tabs, Form, Input, Button, message, Typography, Space } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined, SmileOutlined } from '@ant-design/icons';
import {
  verifyPassword,
  ADMIN_PASSWORD_HASH,
  sanitizeText,
  checkRateLimit,
  MAX_INPUT_LENGTHS,
} from '../utils/security.js';

const { Text } = Typography;

export default function AuthModal({ open, onClose, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('user');
  const [userName, setUserName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUserLogin = () => {
    const rawName = userName.trim() || 'அன்பர்';
    const finalName = sanitizeText(rawName).slice(0, MAX_INPUT_LENGTHS.name);
    onLoginSuccess({ role: 'user', name: finalName });
    message.success(`வரவேற்கிறோம், ${finalName}! 👋`);
    setUserName('');
    onClose();
  };

  const handleAdminLogin = async () => {
    // ── Rate limiting: max 5 attempts per 15 minutes ──
    const rl = checkRateLimit('admin-login', 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      const mins = Math.ceil(rl.retryAfterMs / 60000);
      message.error(`அதிக முயற்சிகள்! ${mins} நிமிடம் கழித்து முயற்சிக்கவும். (Too many attempts)`);
      return;
    }

    if (!adminPassword.trim()) {
      message.warning('கடவுச்சொல்லை உள்ளிடவும்');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyPassword(adminPassword, ADMIN_PASSWORD_HASH);
      if (isValid) {
        onLoginSuccess({ role: 'admin', name: 'நிர்வாகி (Admin)' });
        message.success('நிர்வாகியாக வெற்றிகரமாக நுழைந்துள்ளீர்கள்! 👑');
        setAdminPassword('');
        onClose();
      } else {
        message.error('தவறான கடவுச்சொல்! (Incorrect password)');
      }
    } catch {
      message.error('உள்நுழைவில் பிழை ஏற்பட்டது');
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: 'user',
      label: (
        <span>
          <SmileOutlined /> பயனர் நுழைவு (User)
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0 8px' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            கவிதைகளை வாசிக்க, விரும்ப மற்றும் பகிர கடவுச்சொல் தேவையில்லை. உங்கள் பெயரை பதிவு செய்து நுழையலாம்.
          </Text>
          <Form layout="vertical" onFinish={handleUserLogin}>
            <Form.Item label="உங்கள் பெயர் (விருப்பத்தின்பேரில்)">
              <Input
                prefix={<UserOutlined style={{ color: 'var(--accent)' }} />}
                placeholder="எ.கா: கவின் / அன்புக்கினியவர்"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                size="large"
                maxLength={MAX_INPUT_LENGTHS.name}
                showCount
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              style={{
                background: 'var(--accent)',
                borderColor: 'var(--accent)',
                fontFamily: "'Noto Sans Tamil', sans-serif"
              }}
            >
              பயனராக நுழைக ✦
            </Button>
          </Form>
        </div>
      )
    },
    {
      key: 'admin',
      label: (
        <span>
          <CrownOutlined /> நிர்வாகி நுழைவு (Admin)
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0 8px' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            நிர்வாகி (Admin) கணக்கிற்கு கடவுச்சொல் தேவை. புதிய கவிதைகள் சேர்க்க மற்றும் திருத்தலாம்.
          </Text>
          <Form layout="vertical" onFinish={handleAdminLogin}>
            <Form.Item
              label="நிர்வாகி கடவுச்சொல் (Password)"
              required
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--accent)' }} />}
                placeholder="கடவுச்சொல்லை உள்ளிடவும்"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                size="large"
                maxLength={MAX_INPUT_LENGTHS.password}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              style={{
                background: 'var(--ink)',
                borderColor: 'var(--ink)',
                fontFamily: "'Noto Sans Tamil', sans-serif"
              }}
            >
              நிர்வாகியாக நுழைக 👑
            </Button>
          </Form>
        </div>
      )
    }
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <Space size={8} style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: '1.2rem', color: 'var(--ink)' }}>
          <span>தமிழ் கவிதை — நுழைவு (Login)</span>
        </Space>
      }
      centered
      width={460}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={items} />
    </Modal>
  );
}
