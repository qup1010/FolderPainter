/**
 * 预览面板组件
 * 显示所有待处理的文件夹及其图标版本（网格卡片布局）
 */

import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, FolderOpen, X, ChevronDown, ChevronUp, RotateCcw, Trash2, Scissors } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { PreviewSession, FolderPreview, IconVersion } from '../types/preview';
import { VersionThumbnail } from './VersionThumbnail';
import { useI18n } from '../hooks/useI18n';
import { ConfirmDialog } from './ConfirmDialog';
import './PreviewPanel.css';

interface PreviewPanelProps {
  session: PreviewSession | null;
  onVersionSelect: (folder: FolderPreview, version: IconVersion) => void;
  onDeleteVersion: (versionId: number, folderPath: string) => void;
  onApplySingle: (folder: FolderPreview, version: IconVersion) => void;
  onApplyAll: () => void;
  onRemoveFolder: (folderPath: string) => Promise<void>;
  onClearAll?: () => Promise<void>;
  onSessionUpdate?: () => void;
  isApplying: boolean;
}

export function PreviewPanel({
  session,
  onVersionSelect,
  onDeleteVersion,
  onApplySingle,
  onApplyAll,
  onRemoveFolder,
  onClearAll,
  onSessionUpdate,
  isApplying,
}: PreviewPanelProps) {
  const { t } = useI18n();
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [restoringFolder, setRestoringFolder] = useState<string | null>(null);
  const [restorableFolders, setRestorableFolders] = useState<Record<string, boolean>>({});
  const [removingBgVersion, setRemovingBgVersion] = useState<number | null>(null);
  const [isRemovingBgAll, setIsRemovingBgAll] = useState(false);
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);

  const showMessageDialog = (message: string) => {
    setDialogMessage(message);
  };

  // 切换展开状态
  const toggleExpand = (folderPath: string) => {
    setExpandedFolder(prev => prev === folderPath ? null : folderPath);
  };

  useEffect(() => {
    const loadRestorableState = async () => {
      if (!session || session.folders.length === 0) {
        setRestorableFolders({});
        return;
      }

      const entries = await Promise.all(
        session.folders.map(async (folder) => {
          try {
            const canRestore = await invoke<boolean>('can_restore_folder', {
              folderPath: folder.folderPath,
            });
            return [folder.folderPath, canRestore] as const;
          } catch {
            return [folder.folderPath, false] as const;
          }
        })
      );

      setRestorableFolders(Object.fromEntries(entries));
    };

    void loadRestorableState();
  }, [session?.id, session?.folders]);

  // 还原文件夹图标
  const handleRestoreIcon = async (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (restoringFolder) return;

    if (!restorableFolders[folderPath]) {
      showMessageDialog(t('preview.restoreNoBackup'));
      return;
    }

    try {
      setRestoringFolder(folderPath);
      const result = await invoke<string>('restore_folder_icon', { folderPath });
      console.log(t('preview.restoreSuccess'), result);
      setRestorableFolders((prev) => ({ ...prev, [folderPath]: false }));
      // 可以添加一个 toast 通知
    } catch (error) {
      console.error('Restore failed:', error);
      showMessageDialog(t('preview.restoreFailed').replace('{error}', String(error)));
    } finally {
      setRestoringFolder(null);
    }
  };

  // 对单个版本执行抠图
  const handleRemoveBg = async (folder: FolderPreview, version: IconVersion) => {
    if (removingBgVersion || !session) return;

    try {
      setRemovingBgVersion(version.id);
      await invoke('remove_background_for_version', {
        sessionId: session.id,
        folderPath: folder.folderPath,
        versionId: version.id,
      });
      // 刷新会话数据
      onSessionUpdate?.();
    } catch (error) {
      console.error('Remove bg failed:', error);
      showMessageDialog(t('preview.removeBgFailed').replace('{error}', String(error)));
    } finally {
      setRemovingBgVersion(null);
    }
  };

  // 一键抠图
  const handleRemoveBgAll = async () => {
    if (isRemovingBgAll || !session) return;

    try {
      setIsRemovingBgAll(true);
      const results = await invoke<string[]>('remove_background_all', {
        sessionId: session.id,
      });
      console.log(t('preview.removeBgAllResults'), results);
      // 刷新会话数据
      onSessionUpdate?.();
      showMessageDialog(results.join('\n'));
    } catch (error) {
      console.error('Batch remove bg failed:', error);
      showMessageDialog(t('preview.removeBgAllFailed').replace('{error}', String(error)));
    } finally {
      setIsRemovingBgAll(false);
    }
  };

  // 空状态
  if (!session || session.folders.length === 0) {
    return (
      <div className="preview-panel empty">
        <div className="empty-state">
          <FolderOpen size={48} className="empty-icon" />
          <p className="empty-title">{t('preview.noFolders')}</p>
          <p className="empty-hint">{t('preview.selectFolderHint')}</p>
        </div>
      </div>
    );
  }

  // 计算就绪数量
  const readyCount = session.folders.filter(f => {
    if (!f.currentVersionId) return false;
    const version = f.versions.find(v => v.id === f.currentVersionId);
    return version?.status === 'ready';
  }).length;

  const totalCount = session.folders.length;

  return (
    <div className="preview-panel">
      {/* 头部 */}
      <div className="panel-header">
        <h3>{t('preview.title')}</h3>
        <span className="folder-count">
          {t('preview.readyCount').replace('{ready}', String(readyCount)).replace('{total}', String(totalCount))}
        </span>
      </div>

      {/* 网格卡片列表 */}
      <div className="folder-grid">
        {session.folders.map(folder => {
          const currentVersion = folder.versions.find(v => v.id === folder.currentVersionId);
          const isExpanded = expandedFolder === folder.folderPath;
          const hasVersions = folder.versions.length > 0;
          const isGenerating = currentVersion?.status === 'generating';
          const isReady = currentVersion?.status === 'ready';

          return (
            <div key={folder.folderPath} className={`folder-card ${isExpanded ? 'expanded' : ''}`}>
              {/* 卡片主体 */}
              <div className="card-main" onClick={() => hasVersions && toggleExpand(folder.folderPath)}>
                {/* 图标预览 */}
                <div className="card-preview">
                  {currentVersion?.thumbnailBase64 ? (
                    <img src={currentVersion.thumbnailBase64} alt="icon" />
                  ) : isGenerating ? (
                    <Loader2 size={32} className="loading-icon" />
                  ) : (
                    <FolderOpen size={32} className="placeholder-icon" />
                  )}
                </div>

                {/* 文件夹信息 */}
                <div className="card-info">
                  <span className="card-index">[{folder.displayIndex}]</span>
                  <span className="card-name" title={folder.folderPath}>
                    {folder.folderName}
                  </span>
                </div>

                {/* 状态标签 */}
                <div className="card-status">
                  {isGenerating && (
                    <span className="status-badge generating">
                      <Loader2 size={12} className="status-icon" />
                      {t('preview.generating')}
                    </span>
                  )}
                  {isReady && (
                    <span className="status-badge ready">
                      <CheckCircle2 size={12} />
                      v{currentVersion.versionNumber}
                    </span>
                  )}
                  {!hasVersions && (
                    <span className="status-badge pending">{t('preview.pending')}</span>
                  )}
                </div>

                {/* 展开指示器 */}
                {hasVersions && (
                  <div className="expand-indicator">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                )}

                {/* 移除按钮 */}
                <button
                  className="remove-btn"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await onRemoveFolder(folder.folderPath);
                    } catch (error) {
                      console.error('Remove folder failed:', error);
                      showMessageDialog(t('preview.removeFolderFailed').replace('{error}', String(error)));
                    }
                  }}
                  title={t('preview.removeFolder')}
                >
                  <X size={14} />
                </button>

                {/* 还原按钮 */}
                <button
                  className="restore-btn"
                  onClick={(e) => handleRestoreIcon(folder.folderPath, e)}
                  disabled={restoringFolder === folder.folderPath || !restorableFolders[folder.folderPath]}
                  title={restoringFolder === folder.folderPath ? t('preview.restoreInProgress') : restorableFolders[folder.folderPath] ? t('preview.restoreIcon') : t('preview.restoreNoBackup')}
                >
                  {restoringFolder === folder.folderPath ? (
                    <Loader2 size={12} className="spinning" />
                  ) : (
                    <RotateCcw size={12} />
                  )}
                </button>
              </div>

              {/* 展开的版本列表 */}
              {isExpanded && hasVersions && (
                <div className="card-expanded animate-fadeIn">
                  <div className="versions-row">
                    {folder.versions.map(version => (
                      <VersionThumbnail
                        key={version.id}
                        version={version}
                        isSelected={version.id === folder.currentVersionId}
                        onSelect={() => onVersionSelect(folder, version)}
                        onDelete={() => onDeleteVersion(version.id, folder.folderPath)}
                        onApply={() => onApplySingle(folder, version)}
                        onRemoveBg={() => handleRemoveBg(folder, version)}
                        isRemovingBg={removingBgVersion === version.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部操作区 */}
      <div className="panel-footer">
        {/* 清除所有按钮 */}
        {onClearAll && totalCount > 0 && (
          <button
            className="clear-all-btn"
            onClick={onClearAll}
            disabled={isApplying || isRemovingBgAll}
            title={t('preview.clearAllTitle')}
          >
            <Trash2 size={16} className="btn-icon" />
            {t('preview.clearAll')}
          </button>
        )}
        {/* 一键抠图按钮 */}
        {readyCount > 0 && (
          <button
            className="removebg-all-btn"
            onClick={handleRemoveBgAll}
            disabled={isApplying || isRemovingBgAll}
            title={t('preview.removeBgAllTitle')}
          >
            {isRemovingBgAll ? (
              <>
                <Loader2 size={16} className="btn-icon spinning" />
                {t('preview.removingBg')}
              </>
            ) : (
              <>
                <Scissors size={16} className="btn-icon" />
                {t('preview.removeBgAll')}
              </>
            )}
          </button>
        )}
        <button
          className="apply-all-btn"
          onClick={onApplyAll}
          disabled={isApplying || isRemovingBgAll || readyCount === 0}
        >
          {isApplying ? (
            <>
              <Loader2 size={16} className="btn-icon spinning" />
              {t('preview.applying')}
            </>
          ) : (
            <>
              <CheckCircle2 size={16} className="btn-icon" />
              {t('preview.applyAll')} ({readyCount})
            </>
          )}
        </button>
      </div>

      <ConfirmDialog
        isOpen={!!dialogMessage}
        title={t('preview.noticeTitle')}
        message={dialogMessage || ''}
        confirmText={t('preview.noticeConfirm')}
        cancelText=""
        onConfirm={() => setDialogMessage(null)}
        onCancel={() => setDialogMessage(null)}
      />
    </div>
  );
}
