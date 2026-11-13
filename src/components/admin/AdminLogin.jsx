import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Divider, message } from 'antd';
import {
  LockOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  ArrowLeftOutlined,
  KeyOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function AdminLogin({ onLoginSuccess, onBackHome }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [retryAfter, setRetryAfter] = useState(0);

  const handleSubmit = async (values) => {
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.username?.trim(),
          password: values.password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('நிர்வாகியாக வெற்றிகரமாக நுழைந்துள்ளீர்கள்! 👑');
        if (onLoginSuccess) {
          onLoginSuccess(data.user, data.csrfToken);
        }
      } else {
        const error = data.error || 'நுழைவு அனுமதி மறுக்கப்பட்டது (Authentication failed)';
        setErrorMsg(error);
        if (typeof data.remaining === 'number') {
          setRemainingAttempts(data.remaining);
        }
        if (data.retryAfterSeconds) {
          setRetryAfter(data.retryAfterSeconds);
        }
        message.error(error);
      }
    } catch (err) {
      console.error('Login network error:', err);
      setErrorMsg('சேவையகத்தை தொடர்பு கொள்ள முடியவில்லை (Connection error)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #070d18 0%, #0d1b2e 50%, #152744 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative'
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(13, 27, 46, 0.95)',
          borderColor: 'rgba(224, 127, 46, 0.35)',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(224, 127, 46, 0.2)',
          backdropFilter: 'blur(16px)'
        }}
        styles={{ body: { padding: '36px 28px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e07f2e, #b81f12)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(224, 127, 46, 0.4)',
              marginBottom: 16
            }}
          >
            <SafetyOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title
            level={3}
            style={{
              color: '#ffffff',
              fontFamily: "'Noto Serif Tamil', serif",
              margin: '0 0 6px'
            }}
          >
            பாதுகாப்பான நிர்வாகி நுழைவு
          </Title>
          <Text style={{ color: '#8ea4c2', fontSize: '0.85rem' }}>
            Secure Admin Portal • கவிஞன் கமலேஷ்
          </Text>
        </div>

        {errorMsg && (
          <Alert
            type={retryAfter > 0 ? 'warning' : 'error'}
            showIcon
            message={errorMsg}
            description={
              remainingAttempts !== null && remainingAttempts > 0 && retryAfter === 0
                ? `மீதமுள்ள முயற்சிகள் (Remaining attempts): ${remainingAttempts}`
                : retryAfter > 0
                ? `தயவுசெய்து ${retryAfter} வினாடிகள் காத்திருக்கவும்.`
                : null
            }
            style={{ marginBottom: 20, borderRadius: 10 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ username: 'kamalesh' }}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label={<span style={{ color: '#d3e2f5' }}>நிர்வாகி பயனர் பெயர் (Username)</span>}
            rules={[{ required: true, message: 'பயனர் பெயரை உள்ளிடவும்' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#e07f2e' }} />}
              placeholder="Username"
              size="large"
              style={{
                background: 'rgba(7, 13, 24, 0.7)',
                borderColor: 'rgba(224, 127, 46, 0.3)',
                color: '#fff',
                borderRadius: 10
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ color: '#d3e2f5' }}>கடவுச்சொல் (Password)</span>}
            rules={[{ required: true, message: 'கடவுச்சொல்லை உள்ளிடவும்' }]}
          >
            <Input.Password
              prefix={<KeyOutlined style={{ color: '#e07f2e' }} />}
              placeholder="Admin Password"
              size="large"
              style={{
                background: 'rgba(7, 13, 24, 0.7)',
                borderColor: 'rgba(224, 127, 46, 0.3)',
                color: '#fff',
                borderRadius: 10
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 28, marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              disabled={retryAfter > 0}
              style={{
                height: 48,
                background: 'linear-gradient(135deg, #e07f2e 0%, #b81f12 100%)',
                borderColor: '#e07f2e',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1rem',
                boxShadow: '0 8px 24px rgba(224, 127, 46, 0.35)'
              }}
            >
              உள்நுழை (Sign In)
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={onBackHome}
            style={{ color: '#8ea4c2', fontSize: '0.86rem' }}
          >
            முகப்பு பக்கத்திற்குத் திரும்பு (Back to Website)
          </Button>
        </div>

        <Divider style={{ borderColor: 'rgba(224, 127, 46, 0.15)', margin: '20px 0 16px' }} />

        {/* Security Badges */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            color: '#6e85a3',
            fontSize: '0.72rem',
            textAlign: 'center'
          }}
        >
          <span>
            <SafetyCertificateOutlined style={{ color: '#27ae60', marginRight: 4 }} />
            bcrypt Hashed
          </span>
          <span>
            <LockOutlined style={{ color: '#2980b9', marginRight: 4 }} />
            HttpOnly Sessions
          </span>
          <span>
            <SafetyOutlined style={{ color: '#e07f2e', marginRight: 4 }} />
            Rate-Limited
          </span>
        </div>
      </Card>
    </div>
  );
}
