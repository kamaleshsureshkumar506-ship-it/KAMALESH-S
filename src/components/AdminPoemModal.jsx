import { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, Switch, Button, Space, message } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  sanitizeText,
  validateImageUrl,
  MAX_INPUT_LENGTHS,
} from '../utils/security.js';
import { DEFAULT_CATEGORIES, DEFAULT_KAVITHAI_IMAGE } from '../data/index.jsx';
import ImageUploader from './ImageUploader.jsx';

const { TextArea } = Input;

export default function AdminPoemModal({ open, poemToEdit, categories, onClose, onSave }) {
  const [form] = Form.useForm();
  const isEditing = Boolean(poemToEdit && poemToEdit.id);

  // Normalize available categories list including custom/dynamic categories
  const availableCategories = useMemo(() => {
    const defaultList = DEFAULT_CATEGORIES.map(c => typeof c === 'string' ? c : c.name);
    const sourceList = Array.isArray(categories) && categories.length > 0 ? categories : defaultList;
    const set = new Set(sourceList.filter(c => c && c !== 'அனைத்தும்'));
    if (poemToEdit?.category) {
      set.add(poemToEdit.category);
    }
    return Array.from(set);
  }, [categories, poemToEdit]);

  const [initialValues, setInitialValues] = useState(() => ({
    title: '',
    category: 'வாழ்க்கை',
    content: '',
    author: 'கவிஞன் கமலேஷ்',
    featured: true,
    image: DEFAULT_KAVITHAI_IMAGE
  }));

  const [formTick, setFormTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Reactive observation of form fields via Ant Design useWatch
  const watchedTitle = Form.useWatch('title', form);
  const watchedCategory = Form.useWatch('category', form);
  const watchedContent = Form.useWatch('content', form);
  const watchedAuthor = Form.useWatch('author', form);
  const watchedFeatured = Form.useWatch('featured', form);
  const watchedImage = Form.useWatch('image', form);

  // Synchronize form when opened or poemToEdit changes
  useEffect(() => {
    if (open) {
      if (poemToEdit) {
        const init = {
          title: poemToEdit.title || '',
          category: poemToEdit.category || 'வாழ்க்கை',
          content: poemToEdit.content || '',
          author: poemToEdit.author || 'கவிஞன் கமலேஷ்',
          featured: Boolean(poemToEdit.featured),
          image: poemToEdit.image || DEFAULT_KAVITHAI_IMAGE
        };
        form.setFieldsValue(init);
        setInitialValues(init);
      } else {
        form.resetFields();
        const init = {
          title: '',
          category: 'வாழ்க்கை',
          content: '',
          author: 'கவிஞன் கமலேஷ்',
          featured: true,
          image: DEFAULT_KAVITHAI_IMAGE
        };
        form.setFieldsValue(init);
        setInitialValues(init);
      }
      setFormTick(0);
    }
  }, [poemToEdit, open, form]);

  // Current field values (combining useWatch and form getters for guaranteed reactivity)
  const currentTitle = (watchedTitle !== undefined ? watchedTitle : form.getFieldValue('title')) ?? '';
  const currentCategory = (watchedCategory !== undefined ? watchedCategory : form.getFieldValue('category')) ?? '';
  const currentContent = (watchedContent !== undefined ? watchedContent : form.getFieldValue('content')) ?? '';
  const currentAuthor = (watchedAuthor !== undefined ? watchedAuthor : form.getFieldValue('author')) ?? '';
  const currentFeatured = Boolean(watchedFeatured !== undefined ? watchedFeatured : form.getFieldValue('featured'));
  const currentImage = (watchedImage !== undefined ? watchedImage : form.getFieldValue('image')) ?? '';

  // 1. Dirty-state detection: check if any field has changed compared to initialValues
  const isDirty = useMemo(() => {
    if (!isEditing || !initialValues) return false;

    const titleChanged = currentTitle.trim() !== (initialValues.title || '').trim();
    const categoryChanged = currentCategory !== (initialValues.category || '');
    const contentChanged = currentContent !== (initialValues.content || '');
    const authorChanged = currentAuthor.trim() !== (initialValues.author || '').trim();
    const featuredChanged = currentFeatured !== Boolean(initialValues.featured);
    const imageChanged = currentImage.trim() !== (initialValues.image || '').trim();

    return Boolean(
      titleChanged ||
      categoryChanged ||
      contentChanged ||
      authorChanged ||
      featuredChanged ||
      imageChanged
    );
  }, [
    isEditing,
    initialValues,
    currentTitle,
    currentCategory,
    currentContent,
    currentAuthor,
    currentFeatured,
    currentImage,
    formTick
  ]);

  // 2. Validity check: ensure required fields are not empty
  const isValid = useMemo(() => {
    const hasTitle = Boolean(currentTitle.trim());
    const hasContent = Boolean(currentContent.trim());
    const hasCategory = Boolean(currentCategory);
    const hasAuthor = Boolean(currentAuthor.trim());
    return hasTitle && hasContent && hasCategory && hasAuthor;
  }, [currentTitle, currentContent, currentCategory, currentAuthor]);

  // 3. Save button disabled condition:
  // - In Edit mode: Disabled when pristine (no changes made) OR if required fields become invalid
  // - In Create mode: Disabled until required fields are provided
  const isSaveDisabled = isEditing ? (!isDirty || !isValid) : !isValid;

  const handleSubmit = async (values) => {
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

    try {
      setSubmitting(true);
      await onSave({
        title: sanitizedTitle,
        category: values.category,
        content: sanitizedContent,
        author: sanitizedAuthor,
        featured: values.featured,
        image: values.image?.trim() || DEFAULT_KAVITHAI_IMAGE,
        id: isEditing ? poemToEdit.id : undefined
      });
      onClose?.();
    } catch (err) {
      console.error('Poem save error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <Space size={8} style={{ fontFamily: "'Noto Serif Tamil', serif", fontSize: '1.2rem', color: 'var(--ink)' }}>
          {isEditing ? <EditOutlined style={{ color: '#e07f2e' }} /> : <PlusOutlined style={{ color: '#e07f2e' }} />}
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
        onValuesChange={() => setFormTick(t => t + 1)}
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
          <Select
            size="large"
            placeholder="வகையைத் தேர்ந்தெடுக்கவும்"
            options={availableCategories.map(cat => ({ value: cat, label: cat }))}
          />
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

        <div className="admin-modal-action-footer">
          <Button onClick={onClose} size="large" style={{ borderRadius: 8 }}>
            ரத்து செய்
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={submitting}
            disabled={isSaveDisabled}
            className={`admin-poem-save-btn ${isSaveDisabled ? 'disabled' : 'enabled'}`}
          >
            {isEditing ? 'மாற்றங்களைச் சேமி' : 'கவிதையை வெளியிடு ✦'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
