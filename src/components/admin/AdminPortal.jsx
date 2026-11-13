import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layout,
  Typography,
  Button,
  Space,
  Input,
  Select,
  Modal,
  message,
  Table,
  Tag,
  Popconfirm,
  Badge,
  Spin,
  Card,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LogoutOutlined,
  HomeOutlined,
  SearchOutlined,
  FolderAddOutlined,
  BookOutlined,
  HeartFilled,
  SafetyCertificateOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import AdminLogin from './AdminLogin.jsx';
import AdminPoemModal from '../AdminPoemModal.jsx';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_KAVITHAI_IMAGE,
  subscribeToKavithaigal,
  subscribeToCategories,
  loadInitialKavithaigal
} from '../../data/index.jsx';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

export default function AdminPortal({ onBackHome }) {
  const [authState, setAuthState] = useState({
    checking: true,
    authenticated: false,
    user: null,
    csrfToken: ''
  });

  const [kavithaigal, setKavithaigal] = useState(() => loadInitialKavithaigal());
  const [customCategories, setCustomCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('அனைத்தும்');
  const [searchQuery, setSearchQuery] = useState('');
  const [poemModalOpen, setPoemModalOpen] = useState(false);
  const [editingPoem, setEditingPoem] = useState(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📖');
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Verify session on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth-check');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setAuthState({
            checking: false,
            authenticated: true,
            user: data.user,
            csrfToken: data.csrfToken || ''
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Session verification check failed:', err);
    }
    setAuthState({
      checking: false,
      authenticated: false,
      user: null,
      csrfToken: ''
    });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 2. Real-time data subscriptions
  useEffect(() => {
    const unsubPoems = subscribeToKavithaigal((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setKavithaigal(data);
      }
    });
    const unsubCats = subscribeToCategories((cats) => {
      setCustomCategories(cats || []);
    });
    return () => {
      if (typeof unsubPoems === 'function') unsubPoems();
      if (typeof unsubCats === 'function') unsubCats();
    };
  }, []);

  // 3. Inactivity auto-logout (30 minutes)
  useEffect(() => {
    if (!authState.authenticated) return;
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        message.warning('அமர்வு காலாவதியானது (Session timed out due to inactivity)');
        handleLogout();
      }, 30 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [authState.authenticated]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // Ignore error on logout
    }
    setAuthState({
      checking: false,
      authenticated: false,
      user: null,
      csrfToken: ''
    });
    message.info('நிர்வாக அமர்விலிருந்து வெளியேறிவிட்டீர்கள்.');
  };

  // Compute categories
  const allCategories = useMemo(() => {
    const map = new Map();
    DEFAULT_CATEGORIES.forEach((c) => map.set(c.name, c));
    (customCategories || []).forEach((c) => {
      if (c && c.name) map.set(c.name, c);
    });
    kavithaigal.forEach((k) => {
      if (k && k.category && !map.has(k.category)) {
        map.set(k.category, { name: k.category, emoji: '📜' });
      }
    });
    return Array.from(map.values());
  }, [customCategories, kavithaigal]);

  const categoryNames = useMemo(() => allCategories.map((c) => c.name), [allCategories]);

  // Filter poems
  const filteredPoems = useMemo(() => {
    return kavithaigal.filter((poem) => {
      const matchCat = selectedCategory === 'அனைத்தும்' || poem.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (poem.title && poem.title.toLowerCase().includes(q)) ||
        (poem.content && poem.content.toLowerCase().includes(q)) ||
        (poem.author && poem.author.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [kavithaigal, selectedCategory, searchQuery]);

  // 4. Save poem via protected API
  const handleSavePoem = async (poemData) => {
    setActionLoading(true);
    try {
      const isEdit = Boolean(poemData.id);
      const res = await fetch('/api/admin/poems', {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authState.csrfToken
        },
        body: JSON.stringify(poemData)
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save poem');
      }

      message.success(isEdit ? 'கவிதை வெற்றிகரமாக திருத்தப்பட்டது! ✏️' : 'புதிய கவிதை வெற்றிகரமாக வெளியிடப்பட்டது! ✦');
      setPoemModalOpen(false);
      setEditingPoem(null);
    } catch (err) {
      console.error('Save error:', err);
      message.error(err.message || 'கவிதையை சேமிக்க முடியவில்லை.');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Delete poem via protected API
  const handleDeletePoem = async (poemId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/poems?id=${poemId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': authState.csrfToken
        }
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete poem');
      }

      message.success('கவிதை வெற்றிகரமாக நீக்கப்பட்டது.');
    } catch (err) {
      console.error('Delete error:', err);
      message.error(err.message || 'கவிதையை நீக்க முடியவில்லை.');
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Create category via protected API
  const handleCreateCategory = async () => {
    const name = newCatName.trim();
    if (!name) {
      message.error('தலைப்பு பெயரை உள்ளிடவும்');
      return;
    }

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': authState.csrfToken
        },
        body: JSON.stringify({ name, emoji: newCatEmoji })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create category');
      }

      message.success(`புதிய தலைப்பு "${name}" உருவாக்கப்பட்டது!`);
      setNewCatName('');
      setCategoryModalOpen(false);
    } catch (err) {
      message.error(err.message || 'தலைப்பை உருவாக்க முடியவில்லை.');
    }
  };

  // Loading spinner during auth check
  if (authState.checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #070d18 0%, #0d1b2e 50%, #152744 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <Spin size="large" />
        <Text style={{ color: '#b9c9e2', fontFamily: "'Noto Serif Tamil', serif" }}>
          நிர்வாகி பாதுகாப்பு சரிபார்க்கப்படுகிறது...
        </Text>
      </div>
    );
  }

  // Not authenticated -> show Admin Login
  if (!authState.authenticated) {
    return (
      <AdminLogin
        onLoginSuccess={(user, csrfToken) => {
          setAuthState({
            checking: false,
            authenticated: true,
            user,
            csrfToken
          });
        }}
        onBackHome={onBackHome}
      />
    );
  }

  // Table Columns
  const columns = [
    {
      title: '№',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      render: (id) => <Text style={{ color: '#e07f2e', fontWeight: 600 }}>#{id}</Text>
    },
    {
      title: 'தலைப்பு (Title)',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: '1rem', color: '#1a2639' }}>
            {title}
          </Text>
          <Text style={{ fontSize: '0.8rem', color: '#68778d' }}>
            {record.author || 'கவிஞன் கமலேஷ்'}
          </Text>
        </Space>
      )
    },
    {
      title: 'பிரிவு (Category)',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (cat) => <Tag color="orange" style={{ borderRadius: 6, fontWeight: 500 }}>{cat}</Tag>
    },
    {
      title: 'விருப்பங்கள் (Likes)',
      dataIndex: 'likes',
      key: 'likes',
      width: 120,
      render: (likes) => (
        <span>
          <HeartFilled style={{ color: '#e07f2e', marginRight: 6 }} />
          {likes || 0}
        </span>
      )
    },
    {
      title: 'செயல்கள் (Actions)',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size={8}>
          <Button
            type="text"
            icon={<EditOutlined style={{ color: '#2980b9' }} />}
            onClick={() => {
              setEditingPoem(record);
              setPoemModalOpen(true);
            }}
          >
            திருத்து
          </Button>
          <Popconfirm
            title="கவிதையை நீக்க விரும்புகிறீர்களா?"
            description={`"${record.title}" நிரந்தரமாக நீக்கப்படும்.`}
            okText="நீக்கு"
            cancelText="ரத்து"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeletePoem(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              நீக்கு
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--porcelain, #faf7f2)' }}>
      {/* Top Strip */}
      <div className="top-strip" />

      {/* Header */}
      <Header className="blue-header" style={{ padding: '0 24px', lineHeight: 'inherit' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: '#132745',
                border: '2px solid #ef9c4e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef9c4e',
                fontFamily: "'Noto Serif Tamil', serif",
                fontSize: '1.2rem',
                fontWeight: 700
              }}
            >
              க
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem', fontFamily: "'Noto Serif Tamil', serif" }}>
                கவிஞன் கமலேஷ் — நிர்வாகி பலகை
              </div>
              <div style={{ color: '#ef9c4e', fontSize: '0.72rem', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Secure Admin Portal • {authState.user?.username || 'Admin'}
              </div>
            </div>
          </div>

          <Space size={12}>
            <Button
              icon={<HomeOutlined />}
              onClick={onBackHome}
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              தளத்திற்குச் செல்
            </Button>
            <Button
              danger
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ borderRadius: 8 }}
            >
              வெளியேறு (Logout)
            </Button>
          </Space>
        </div>
      </Header>

      <Content style={{ padding: '24px 20px', maxWidth: 1360, margin: '0 auto', width: '100%' }}>
        {/* Security & Overview Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 14, border: '1px solid #e8decb' }}>
              <Statistic
                title="மொத்த கவிதைகள் (Poems)"
                value={kavithaigal.length}
                prefix={<BookOutlined style={{ color: '#e07f2e' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 14, border: '1px solid #e8decb' }}>
              <Statistic
                title="தலைப்புகள் (Categories)"
                value={allCategories.length}
                prefix={<FolderAddOutlined style={{ color: '#27ae60' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 14, border: '1px solid #e8decb' }}>
              <Statistic
                title="மொத்த விருப்பங்கள் (Likes)"
                value={kavithaigal.reduce((acc, k) => acc + (k.likes || 0), 0)}
                prefix={<HeartFilled style={{ color: '#e74c3c' }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{ borderRadius: 14, border: '1px solid #e8decb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: '100%' }}>
                <SafetyCertificateOutlined style={{ fontSize: 32, color: '#27ae60' }} />
                <div>
                  <div style={{ fontSize: '0.82rem', color: '#68778d' }}>பாதுகாப்பு நிலை</div>
                  <Tag color="success" icon={<CheckCircleOutlined />}>Server-Protected</Tag>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Action Controls Bar */}
        <div
          style={{
            background: '#fff',
            padding: '16px 20px',
            borderRadius: 14,
            border: '1px solid #eee1d4',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20
          }}
        >
          <Space size={12} wrap>
            <Input
              placeholder="கவிதையைத் தேடுங்கள்..."
              prefix={<SearchOutlined style={{ color: '#999' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 240, borderRadius: 8 }}
              allowClear
            />
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ width: 170 }}
              options={[
                { value: 'அனைத்தும்', label: 'அனைத்து தலைப்புகள்' },
                ...categoryNames.map((c) => ({ value: c, label: c }))
              ]}
            />
          </Space>

          <Space size={12} wrap>
            <Button
              icon={<FolderAddOutlined />}
              onClick={() => setCategoryModalOpen(true)}
              style={{ borderRadius: 8 }}
            >
              தலைப்பு சேர்க்க
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingPoem(null);
                setPoemModalOpen(true);
              }}
              style={{
                borderRadius: 8,
                background: 'linear-gradient(135deg, #e07f2e, #b81f12)',
                borderColor: '#e07f2e',
                fontWeight: 600
              }}
            >
              புதிய கவிதை சேர்க்க ✦
            </Button>
          </Space>
        </div>

        {/* Poems Table */}
        <Card
          style={{ borderRadius: 14, border: '1px solid #eee1d4', overflow: 'hidden' }}
          styles={{ body: { padding: 0 } }}
        >
          <Table
            columns={columns}
            dataSource={filteredPoems}
            rowKey="id"
            loading={actionLoading}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `மொத்தம் ${total} கவிதைகள்`
            }}
          />
        </Card>
      </Content>

      {/* Footer */}
      <Footer className="footer-navy" style={{ marginTop: 40, textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ color: 'var(--parchment-dim, #c0c8d4)', fontSize: '0.88rem' }}>
          © 2026 கவிஞன் கமலேஷ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.
        </div>
      </Footer>

      {/* Add / Edit Poem Modal */}
      <AdminPoemModal
        open={poemModalOpen}
        poemToEdit={editingPoem}
        onClose={() => {
          setPoemModalOpen(false);
          setEditingPoem(null);
        }}
        onSave={handleSavePoem}
      />

      {/* Add Category Modal */}
      <Modal
        title="புதிய கவிதைத் தலைப்பு உருவாக்கு"
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
        onOk={handleCreateCategory}
        okText="உருவாக்கு"
        cancelText="ரத்து"
        centered
      >
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size={16}>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>தலைப்பு பெயர் (Category Name):</Text>
            <Input
              placeholder="எ.கா: ஆன்மீகம் / சமூகம்"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              size="large"
            />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 6 }}>எமோஜி அடையாளம் (Emoji):</Text>
            <Input
              placeholder="எ.கா: 🌺"
              value={newCatEmoji}
              onChange={(e) => setNewCatEmoji(e.target.value)}
              size="large"
              style={{ width: 120 }}
            />
          </div>
        </Space>
      </Modal>
    </Layout>
  );
}

