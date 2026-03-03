/**
 * 模板管理面板组件
 * 显示所有可用模板，支持选择、创建、编辑、删除
 */

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import {
  Palette,
  Plus,
  Search,
  Tag,
  X,
  Edit2,
  Trash2,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import type { IconTemplate } from '../types/template';
import { useTemplates } from '../hooks/useTemplates';
import { useI18n } from '../hooks/useI18n';
import { TemplateEditor } from './TemplateEditor';
import { InputDialog, ConfirmDialog } from './Dialogs';
import {
  getTemplateName,
  getTemplateDescription,
  getTemplateCover,
  getCategoryName,
} from '../utils/templateUtils';
import './TemplatePanel.css';

interface TemplatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: IconTemplate) => void;
}

export function TemplatePanel({ isOpen, onClose, onSelectTemplate }: TemplatePanelProps) {
  const { t } = useI18n();
  const {
    templates,
    categories,
    selectedCategory,
    isLoading,
    loadTemplatesByCategory,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    clearCategoryFilter,
    renameCategory,
    deleteCategory,
  } = useTemplates();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<IconTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Dialog States
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<IconTemplate | null>(null);

  if (!isOpen) return null;

  // 过滤模板
  const filteredTemplates = templates.filter(template => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = getTemplateName(template, t).toLowerCase();
      const desc = getTemplateDescription(template, t).toLowerCase();
      return (
        name.includes(query) ||
        desc.includes(query) ||
        template.prompt.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // 处理重命名分类 (改为打开 Dialog)
  const handleRenameCategoryClick = () => {
    if (!selectedCategory) return;
    setRenameDialogOpen(true);
  };

  // 真正的重命名逻辑
  const handleRenameCategoryConfirm = async (newName: string) => {
    if (!selectedCategory) return;
    if (newName && newName.trim() && newName !== selectedCategory) {
      try {
        await renameCategory(selectedCategory, newName.trim());
        setRenameDialogOpen(false);
      } catch (e) {
        alert(t('template.renameFailed').replace('{error}', String(e)));
      }
    }
  };

  // 处理删除分类 (改为打开 Dialog)
  const handleDeleteCategoryClick = () => {
    if (!selectedCategory) return;
    setDeleteCategoryDialogOpen(true);
  };

  // 真正的删除分类逻辑
  const handleDeleteCategoryConfirm = async () => {
    if (!selectedCategory) return;
    try {
      await deleteCategory(selectedCategory);
      setDeleteCategoryDialogOpen(false);
    } catch (e) {
      alert(t('template.deleteFailed').replace('{error}', String(e)));
    }
  };

  // 处理选择模板
  const handleSelect = (template: IconTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  // 处理编辑
  const handleEdit = (template: IconTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    // 允许编辑所有模板
    setEditingTemplate(template);
  };

  // 处理删除模板 (打开确认 Dialog)
  const handleDeleteClick = (template: IconTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateToDelete(template);
    setDeleteTemplateDialogOpen(true);
  };

  // 真正的删除模板逻辑
  const handleDeleteTemplateConfirm = async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate(templateToDelete.id);
      setTemplateToDelete(null);
      // Alert 也可以改为 Toast，但目前先保持简单
    } catch (error) {
      console.error("Delete failed:", error);
      alert(t('template.deleteFailed').replace('{error}', String(error)));
    }
  };

  // 处理复制 (创建副本)
  const handleCopy = async (template: IconTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    await createTemplate({
      name: t('template.copyName').replace('{name}', template.name),
      description: template.description,
      prompt: template.prompt,
      coverImage: template.coverImage,
      category: template.category,
    });
  };

  // 处理创建/更新完成
  const handleSaveComplete = async () => {
    setEditingTemplate(null);
    setIsCreating(false);
  };

  // 导出模板
  const handleExport = async () => {
    try {
      setIsExporting(true);

      // 获取导出数据
      const exportData = await invoke<any>('export_user_templates');

      if (exportData.templates.length === 0) {
        alert(t('template.noUserTemplates'));
        return;
      }

      // 选择保存路径
      const filePath = await save({
        defaultPath: 'folderpainter-templates.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
        alert(t('template.exportSuccess').replace('{count}', String(exportData.templates.length)));
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(t('template.exportFailed').replace('{error}', String(error)));
    } finally {
      setIsExporting(false);
    }
  };

  // 导入模板
  const handleImport = async () => {
    try {
      setIsImporting(true);

      // 选择文件
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      });

      if (filePath) {
        const content = await readTextFile(filePath as string);
        const importData = JSON.parse(content);

        // 验证格式
        if (!importData.version || !importData.templates) {
          throw new Error(t('template.invalidFormat'));
        }

        // 调用导入
        const result = await invoke<{ imported: number; skipped: number }>('import_templates', { data: importData });

        // 刷新列表
        clearCategoryFilter();

        alert(t('template.importSuccess')
          .replace('{imported}', String(result.imported))
          .replace('{skipped}', String(result.skipped)));
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert(t('template.importFailed').replace('{error}', String(error)));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="template-panel-overlay animate-fadeIn" onClick={onClose}>
      <div className="template-panel animate-scaleIn" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="panel-header">
          <div className="header-left">
            <Palette size={20} className="header-icon" />
            <h2>{t('template.library')}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 工具栏 */}
        <div className="panel-toolbar">
          {/* 搜索框 */}
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder={t('template.search')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* 导入导出按钮 */}
          <button
            className="toolbar-btn import-btn"
            onClick={handleImport}
            disabled={isImporting}
            title={t('template.import')}
          >
            <Upload size={16} />
            <span>{isImporting ? t('settings.saving') : t('template.import')}</span>
          </button>
          <button
            className="toolbar-btn export-btn"
            onClick={handleExport}
            disabled={isExporting}
            title={t('template.export')}
          >
            <Download size={16} />
            <span>{isExporting ? t('settings.saving') : t('template.export')}</span>
          </button>

          {/* 创建按钮 */}
          <button className="create-btn" onClick={() => setIsCreating(true)}>
            <Plus size={16} />
            <span>{t('template.create')}</span>
          </button>
        </div>

        {/* 分类标签 */}
        <div className="category-tags">
          <button
            className={`category-tag ${!selectedCategory ? 'active' : ''}`}
            onClick={clearCategoryFilter}
          >
            <Tag size={12} />
            {t('template.all')}
          </button>

          <div className="category-list-scroll">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-tag ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => loadTemplatesByCategory(cat)}
              >
                {getCategoryName(cat, t)}
              </button>
            ))}
          </div>

          {selectedCategory && (
            <div className="category-actions">
              <button
                className="category-action-btn edit"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameCategoryClick();
                }}
                title={t('template.renameCategory')}
              >
                <Edit2 size={12} />
              </button>
              <button
                className="category-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCategoryClick();
                }}
                title={t('template.deleteCategory')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 模板网格 */}
        <div className="template-grid">
          {isLoading ? (
            <div className="loading-state">{t('template.loading')}</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? t('template.noMatch') : t('template.empty')}
            </div>
          ) : (
            filteredTemplates.map(template => (
              <div
                key={template.id}
                className={`template-card ${template.isBuiltin ? 'builtin' : ''}`}
                onClick={() => handleSelect(template)}
              >
                {/* 封面图 */}
                <div className="card-cover">
                  {getTemplateCover(template) ? (
                    <img src={getTemplateCover(template)} alt={getTemplateName(template, t)} />
                  ) : (
                    <div className="cover-placeholder">
                      <Palette size={32} />
                    </div>
                  )}
                  {/* 内置标签已移除 */}
                </div>

                {/* 卡片信息 */}
                <div className="card-info">
                  <h3 className="card-name" title={getTemplateName(template, t)}>{getTemplateName(template, t)}</h3>
                  <p className="card-desc" title={getTemplateDescription(template, t)}>{getTemplateDescription(template, t) || t('template.noDescription')}</p>

                  <div className="card-footer">
                    <span className="card-category">{getCategoryName(template.category, t)}</span>
                  </div>
                </div>

                {/* 操作按钮 - 所有模板均可编辑 */}
                <div className="card-actions">
                  <button
                    className="action-btn"
                    onClick={e => handleCopy(template, e)}
                    title={t('template.copy')}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="action-btn"
                    onClick={e => handleEdit(template, e)}
                    title={t('template.edit')}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={e => handleDeleteClick(template, e)}
                    title={t('template.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 模板编辑器 */}
        {
          (isCreating || editingTemplate) && (
            <TemplateEditor
              template={editingTemplate}
              categories={categories}
              onSave={async (data) => {
                if (editingTemplate) {
                  await updateTemplate(editingTemplate.id, data);
                } else {
                  await createTemplate({
                    name: data.name!,
                    description: data.description!,
                    prompt: data.prompt!,
                    coverImage: data.coverImage,
                    category: data.category!,
                  });
                }
                handleSaveComplete();
              }}
              onCancel={() => {
                setEditingTemplate(null);
                setIsCreating(false);
              }}
            />
          )
        }
      </div >

      {/* Dialogs */}
      < InputDialog
        isOpen={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)
        }
        title={t('template.renameCategoryTitle')}
        description={t('template.renameCategoryDesc')}
        defaultValue={selectedCategory || ''}
        placeholder={t('template.categoryPlaceholder')}
        onConfirm={handleRenameCategoryConfirm}
      />

      <ConfirmDialog
        isOpen={deleteCategoryDialogOpen}
        onClose={() => setDeleteCategoryDialogOpen(false)}
        title={t('template.deleteCategoryTitle')}
        message={t('template.deleteCategoryMessage').replace('{name}', selectedCategory || '')}
        confirmLabel={t('template.deleteBtn')}
        isDangerous={true}
        onConfirm={handleDeleteCategoryConfirm}
      />

      <ConfirmDialog
        isOpen={deleteTemplateDialogOpen}
        onClose={() => setDeleteTemplateDialogOpen(false)}
        title={t('template.deleteTemplateTitle')}
        message={t('template.deleteTemplateMessage').replace('{name}', templateToDelete?.name || '')}
        confirmLabel={t('template.deleteBtn')}
        isDangerous={true}
        onConfirm={handleDeleteTemplateConfirm}
      />
    </div >
  );
}
