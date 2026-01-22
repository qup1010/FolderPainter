/**
 * 模板编辑器组件
 * 用于创建和编辑模板
 */

import { useState } from 'react';
import { X, Save, Image, Loader2 } from 'lucide-react';
import type { IconTemplate, UpdateTemplateRequest } from '../types/template';
import { useI18n } from '../hooks/useI18n';
import './TemplateEditor.css';

interface TemplateEditorProps {
  template: IconTemplate | null; // null 表示创建新模板
  categories: string[];
  onSave: (data: UpdateTemplateRequest & { name: string; description: string; prompt: string; category: string }) => Promise<void>;
  onCancel: () => void;
}

export function TemplateEditor({ template, categories, onSave, onCancel }: TemplateEditorProps) {
  const { t } = useI18n();
  const isEditing = !!template;

  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [prompt, setPrompt] = useState(template?.prompt || '');
  const [category, setCategory] = useState(template?.category || categories[0] || '通用');
  const [coverImage, setCoverImage] = useState<string | undefined>(template?.coverImage);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理保存
  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('templateEditor.nameRequired'));
      return;
    }
    if (!prompt.trim()) {
      setError(t('templateEditor.promptRequired'));
      return;
    }

    const finalCategory = showNewCategory && newCategory.trim() ? newCategory.trim() : category;

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        category: finalCategory,
        coverImage,
      });
      alert(t('templateEditor.saveSuccess'));
    } catch (e) {
      setError(e as string);
      setIsSaving(false);
    }
  };

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCoverImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 清除封面图
  const handleClearImage = () => {
    setCoverImage(undefined);
  };

  return (
    <div className="template-editor-overlay animate-fadeIn" onClick={onCancel}>
      <div className="template-editor animate-scaleIn" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="editor-header">
          <h3>{isEditing ? t('templateEditor.editTitle') : t('templateEditor.createTitle')}</h3>
          <button className="close-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <div className="editor-form">
          {/* 封面图上传 */}
          <div className="form-group cover-group">
            <label>{t('templateEditor.coverImage')}</label>
            <div className="cover-upload">
              {coverImage ? (
                <div className="cover-preview">
                  <img src={coverImage} alt={t('templateEditor.coverPreview')} />
                  <button className="remove-cover" onClick={handleClearImage}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="upload-area">
                  <Image size={24} />
                  <span>{t('templateEditor.uploadImage')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    hidden
                  />
                </label>
              )}
            </div>
          </div>

          {/* 名称 */}
          <div className="form-group">
            <label>{t('templateEditor.templateName')} <span className="required">{t('templateEditor.required')}</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('templateEditor.templateNamePlaceholder')}
              maxLength={50}
            />
          </div>

          {/* 描述 */}
          <div className="form-group">
            <label>{t('templateEditor.description')}</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('templateEditor.descriptionPlaceholder')}
              maxLength={100}
            />
          </div>

          {/* 分类 */}
          <div className="form-group">
            <label>{t('templateEditor.category')}</label>
            {!showNewCategory ? (
              <div className="category-select">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="new-category-btn"
                  onClick={() => setShowNewCategory(true)}
                >
                  {t('templateEditor.newCategory')}
                </button>
              </div>
            ) : (
              <div className="new-category-input">
                <input
                  type="text"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  placeholder={t('templateEditor.newCategoryPlaceholder')}
                  maxLength={20}
                />
                <button
                  type="button"
                  className="cancel-new-btn"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategory('');
                  }}
                >
                  {t('templateEditor.cancel')}
                </button>
              </div>
            )}
          </div>

          {/* 提示词 */}
          <div className="form-group">
            <label>{t('templateEditor.prompt')} <span className="required">{t('templateEditor.required')}</span></label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t('templateEditor.promptPlaceholder')}
              rows={4}
            />
            <span className="hint">{t('templateEditor.promptHint')}</span>
          </div>

          {/* 错误信息 */}
          {error && <div className="error-message">{error}</div>}
        </div>

        {/* 底部按钮 */}
        <div className="editor-footer">
          <button className="cancel-btn" onClick={onCancel} disabled={isSaving}>
            {t('templateEditor.cancel')}
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 size={16} className="spinner" />
                {t('templateEditor.saving')}
              </>
            ) : (
              <>
                <Save size={16} />
                {t('templateEditor.save')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
