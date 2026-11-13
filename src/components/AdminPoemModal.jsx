import { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, Button, Space, message } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  sanitizeText,
  validateImageUrl,
  MAX_INPUT_LENGTHS,
} from '../utils/security.js';
import { DEFAULT_KAVITHAI_IMAGE } from '../data/index.jsx';
import ImageUploader from './ImageUploader.jsx';

const { TextArea } = Input;

const CATEGORIES = ['காதல்', 'தமிழ்', 'இயற்கை', 'வாழ்க்கை', 'நட்பு'];

export default function AdminPoemModal({ open, poemToEdit, onClose, onSave }) {
  const [form] = Form.useForm();
  const isEditing = !!poemToEdit;

  useEffect(() => {
    if (poemToEdit) {
      form.setFieldsValue({
        title: poemToEdit.title,
        category: poemToEdit.category,
        content: poemToEdit.content,
        author: poemToEdit.author || 'கவிஞன் கமலேஷ்',
        featured: !!poemToEdit.featured,
        image: poemToEdit.image || DEFAULT_KAVITHAI_IMAGE
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        category: 'வாழ்க்கை',
        author: 'கவிஞன் கமலேஷ்',
        featured: true,
        image: DEFAULT_KAVITHAI_IMAGE
      });
    }
  }, [poemToEdit, open, form]);

  const handleSubmit = (values) => {
    // ── Sanitize all text inputs ──
    const sanitizedTitle = sanitizeText(values.title).slice(0, MAX_INPUT_LENGTHS.title);
    const sanitizedContent = sanitizeText(values.content).slice(0, MAX_INPUT_LENGTHS.content);
    const sanitizedAuthor = sanitizeText(values.author).slice(0, MAX_INPUT_LENGTHS.author);

    if (!sanitizedTitle || !sanitizedContent || !sanitizedAuthor) {
      message.error('உள்ளீடு செல்லுபடியாகவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.');
      return;
    }

    // ── Validate image URL ──
    const imgResult = validateImageUrl(values.image);
    if (!imgResult.valid) {
      message.error(imgResult.reason);
      return;
    }

    onSave({
      title: sanitizedTitle,
      category: values.category,
      content: sanitizedContent,
      author: sanitizedAuthor,
      featured: values.featured,
      image: values.image?.trim() || DEFAULT_KAVITHAI_IMAGE,
      id: isEditing ? poemToEdit.id : undefined
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <Space size={8} style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: '1.2rem', color: 'var(--ink)' }}>
          {isEditing ? <EditOutlined style={{ color: 'var(--accent)' }} /> : <PlusOutlined style={{ color: 'var(--accent)' }} />}
          <span>{isEditing ? 'கவிதையைத் திருத்துக (Edit Kavithai)' : 'புதிய கவிதை சேர்க்க (Add New Kavithai)'}</span>
        </Space>
      }
      centered
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="title"
          label="கவிதை தலைப்பு (Title)"
          rules={[{ required: true, message: 'தயவுசெய்து தலைப்பை உள்ளிடவும்' }]}
        >
          <Input
            placeholder="எ.கா: மாயப் பறவை / ஒரு சாதாரண கவிஞன்"
            size="large"
            maxLength={MAX_INPUT_LENGTHS.title}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="category"
          label="வகை (Category)"
          rules={[{ required: true, message: 'தயவுசெய்து வகையைத் தேர்ந்தெடுக்கவும்' }]}
        >
          <Select size="large">
            {CATEGORIES.map(cat => (
              <Select.Option key={cat} value={cat}>
                {cat}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="content"
          label="கவிதை வரிகள் (Content)"
          rules={[{ required: true, message: 'தயவுசெய்து கவிதை வரிகளை உள்ளிடவும்' }]}
        >
          <TextArea
            rows={7}
            placeholder="கவிதை வரிகளை இங்கு தட்டச்சு செய்யவும்..."
            style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: '1.05rem', lineHeight: 1.8 }}
            maxLength={MAX_INPUT_LENGTHS.content}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="author"
          label="ஆசிரியர் (Author)"
          rules={[{ required: true, message: 'ஆசிரியர் பெயரை உள்ளிடவும்' }]}
        >
          <Input
            placeholder="கமலேஷ் / கவிஞன் கமலேஷ்"
            size="large"
            maxLength={MAX_INPUT_LENGTHS.author}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="image"
          label="பின்னணி படம் (Background Image)"
          extra="கணினி அல்லது கைபேசியிலிருந்து படத்தைப் பதிவேற்றலாம் (JPG, PNG, WEBP)."
        >
          <ImageUploader />
        </Form.Item>

        <Form.Item
          name="featured"
          label="தலையங்கம் (Featured) பகுதியில் காட்டவா?"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button onClick={onClose} size="large">
            ரத்து செய்
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            style={{
              background: 'var(--accent)',
              borderColor: 'var(--accent)',
              fontFamily: "'Noto Sans Tamil', sans-serif"
            }}
          >
            {isEditing ? 'மாற்றங்களைச் சேமி' : 'கவிதையை வெளியிடு ✦'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
