import { useState } from 'react';
import {
  Button,
  Upload,
  Progress,
  Space,
  Tag,
  Modal,
  message
} from 'antd';
import {
  UploadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { uploadLocalImage, formatFileSize } from '../utils/imageUpload.js';

const { Dragger } = Upload;

export default function ImageUploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      message.error('படக் கோப்புகளை மட்டுமே தேர்ந்தெடுக்கவும் (JPG, PNG, WEBP, GIF)');
      return false;
    }

    if (file.size > 15 * 1024 * 1024) {
      message.error('கோப்பின் அளவு 15MB-க்கு குறைவாக இருக்க வேண்டும்');
      return false;
    }

    try {
      setUploading(true);
      setProgress(15);
      setFileMeta({
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type
      });

      const result = await uploadLocalImage(file, (p) => setProgress(p));
      setProgress(100);

      onChange?.(result.url);

      if (result.isStorage) {
        message.success('படம் கிளவுடில் (Firebase) வெற்றிகரமாக பதிவேற்றப்பட்டது! ☁️');
      } else {
        message.success('படம் வெற்றிகரமாக இணைக்கப்பட்டது! 🖼️');
      }
    } catch (err) {
      console.error('Upload error:', err);
      message.error(err.message || 'படத்தைப் பதிவேற்றுவதில் பிழை ஏற்பட்டது');
    } finally {
      setUploading(false);
    }

    return false; // Prevent Ant Design default ajax upload
  };

  return (
    <div style={{ width: '100%' }}>
      {!value ? (
        <div style={{ position: 'relative' }}>
          <Dragger
            accept="image/*"
            beforeUpload={handleFile}
            showUploadList={false}
            disabled={uploading}
            style={{
              padding: '24px 16px',
              background: '#faf8f5',
              border: '2px dashed #e3cbbe',
              borderRadius: 14,
              cursor: uploading ? 'wait' : 'pointer',
              transition: 'border-color 0.2s'
            }}
          >
            <p className="ant-upload-drag-icon" style={{ margin: '0 0 8px', color: 'var(--ember-500, #d96f27)' }}>
              <InboxOutlined style={{ fontSize: 42 }} />
            </p>
            <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.98rem', color: '#2a2421' }}>
              கணினி அல்லது கைபேசியிலிருந்து படத்தைத் தேர்ந்தெடுக்கவும்
            </p>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#7a7067' }}>
              இங்கு படத்தை இழுத்துவிடலாம் (Drag & Drop) அல்லது கிளிக் செய்யலாம் • JPG, PNG, WEBP (அதிகபட்சம் 15MB)
            </p>
          </Dragger>

          {uploading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4, color: '#555' }}>
                <span><SyncOutlined spin style={{ marginRight: 6 }} /> படம் செயலாக்கப்படுகிறது...</span>
                <span>{progress}%</span>
              </div>
              <Progress percent={progress} strokeColor="#d96f27" size="small" showInfo={false} />
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              padding: 12,
              borderRadius: 12,
              background: '#faf8f5',
              border: '1px solid #ebdcd0',
              alignItems: 'center'
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 100,
                height: 75,
                borderRadius: 8,
                overflow: 'hidden',
                background: '#eee',
                flexShrink: 0,
                cursor: 'pointer'
              }}
              onClick={() => setPreviewVisible(true)}
              title="முன்னோட்டம் காண்க"
            >
              <img
                src={value}
                alt="Kavithai Preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  color: '#fff'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <EyeOutlined style={{ fontSize: 18 }} />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  படம் இணைக்கப்பட்டது
                </Tag>
                {fileMeta?.size && (
                  <span style={{ fontSize: '0.78rem', color: '#7a7067' }}>
                    {fileMeta.size}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#2a2421',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {fileMeta?.name || (value === '/kavingnar-kamalesh.jpg' ? 'கவிஞர் கமலேஷ் படம் (Default)' : 'உள்ளூர் படம் (Local Media Image)')}
              </div>
            </div>

            <Space>
              <Button
                size="middle"
                icon={<EyeOutlined />}
                onClick={() => setPreviewVisible(true)}
              >
                முன்னோட்டம்
              </Button>
              <Upload
                accept="image/*"
                beforeUpload={handleFile}
                showUploadList={false}
                disabled={uploading}
              >
                <Button
                  size="middle"
                  icon={<UploadOutlined />}
                  loading={uploading}
                  style={{
                    background: 'var(--ember-500, #d96f27)',
                    borderColor: 'var(--ember-500, #d96f27)',
                    color: '#fff'
                  }}
                >
                  மாற்று
                </Button>
              </Upload>
            </Space>
          </div>

          {uploading && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4, color: '#555' }}>
                <span><SyncOutlined spin style={{ marginRight: 6 }} /> புதிய படம் செயலாக்கப்படுகிறது...</span>
                <span>{progress}%</span>
              </div>
              <Progress percent={progress} strokeColor="#d96f27" size="small" showInfo={false} />
            </div>
          )}
        </div>
      )}

      {/* Full preview modal */}
      <Modal
        open={previewVisible}
        title="பட முன்னோட்டம் (Image Preview)"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        centered
        width={680}
      >
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <img
            src={value}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 8, objectFit: 'contain' }}
          />
        </div>
      </Modal>
    </div>
  );
}
