/**
 * 棰勮闈㈡澘缁勪欢
 * 鏄剧ず鎵€鏈夊緟澶勭悊鐨勬枃浠跺す鍙婂叾鍥炬爣鐗堟湰锛堢綉鏍煎崱鐗囧竷灞€锛?
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

  // 鍒囨崲灞曞紑鐘舵€?
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

  // 杩樺師鏂囦欢澶瑰浘鏍?
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
      // 鍙互娣诲姞涓€涓?toast 閫氱煡
    } catch (error) {
      console.error('Restore failed:', error);
      showMessageDialog(t('preview.restoreFailed').replace('{error}', String(error)));
    } finally {
      setRestoringFolder(null);
    }
  };

  // 瀵瑰崟涓増鏈墽琛屾姞鍥?
  const handleRemoveBg = async (folder: FolderPreview, version: IconVersion) => {
    if (removingBgVersion || !session) return;

    try {
      setRemovingBgVersion(version.id);
      await invoke('remove_background_for_version', {
        sessionId: session.id,
        folderPath: folder.folderPath,
        versionId: version.id,
      });
      // 鍒锋柊浼氳瘽鏁版嵁
      onSessionUpdate?.();
    } catch (error) {
      console.error('Remove bg failed:', error);
      showMessageDialog(t('preview.removeBgFailed').replace('{error}', String(error)));
    } finally {
      setRemovingBgVersion(null);
    }
  };

  // 涓€閿姞鍥?
  const handleRemoveBgAll = async () => {
    if (isRemovingBgAll || !session) return;

    try {
      setIsRemovingBgAll(true);
      const results = await invoke<string[]>('remove_background_all', {
        sessionId: session.id,
      });
      console.log(t('preview.removeBgAllResults'), results);
      // 鍒锋柊浼氳瘽鏁版嵁
      onSessionUpdate?.();
      showMessageDialog(results.join('\n'));
    } catch (error) {
      console.error('Batch remove bg failed:', error);
      showMessageDialog(t('preview.removeBgAllFailed').replace('{error}', String(error)));
    } finally {
      setIsRemovingBgAll(false);
    }
  };

  // 绌虹姸鎬?
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

  // 璁＄畻灏辩华鏁伴噺
  const readyCount = session.folders.filter(f => {
    if (!f.currentVersionId) return false;
    const version = f.versions.find(v => v.id === f.currentVersionId);
    return version?.status === 'ready';
  }).length;

  const totalCount = session.folders.length;

  return (
    <div className="preview-panel">
      {/* 澶撮儴 */}
      <div className="panel-header">
        <h3>{t('preview.title')}</h3>
        <span className="folder-count">
          {t('preview.readyCount').replace('{ready}', String(readyCount)).replace('{total}', String(totalCount))}
        </span>
      </div>

      {/* 缃戞牸鍗＄墖鍒楄〃 */}
      <div className="folder-grid">
        {session.folders.map(folder => {
          const currentVersion = folder.versions.find(v => v.id === folder.currentVersionId);
          const isExpanded = expandedFolder === folder.folderPath;
          const hasVersions = folder.versions.length > 0;
          const isGenerating = currentVersion?.status === 'generating';
          const isReady = currentVersion?.status === 'ready';

          return (
            <div key={folder.folderPath} className={`folder-card ${isExpanded ? 'expanded' : ''}`}>
              {/* 鍗＄墖涓讳綋 */}
              <div className="card-main" onClick={() => hasVersions && toggleExpand(folder.folderPath)}>
                {/* 鍥炬爣棰勮 */}
                <div className="card-preview">
                  {currentVersion?.thumbnailBase64 ? (
                    <img src={currentVersion.thumbnailBase64} alt="icon" />
                  ) : isGenerating ? (
                    <Loader2 size={32} className="loading-icon" />
                  ) : (
                    <FolderOpen size={32} className="placeholder-icon" />
                  )}
                </div>

                {/* 鏂囦欢澶逛俊鎭?*/}
                <div className="card-info">
                  <span className="card-index">[{folder.displayIndex}]</span>
                  <span className="card-name" title={folder.folderPath}>
                    {folder.folderName}
                  </span>
                </div>

                {/* 鐘舵€佹爣绛?*/}
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

                {/* 灞曞紑鎸囩ず鍣?*/}
                {hasVersions && (
                  <div className="expand-indicator">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                )}

                {/* 绉婚櫎鎸夐挳 */}
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

                {/* 杩樺師鎸夐挳 */}
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

              {/* 灞曞紑鐨勭増鏈垪琛?*/}
              {isExpanded && hasVersions && (
                <div className="card-expanded animate-fadeIn">
                  <div className="versions-helper">{t('preview.versionActionsHint', '点击版本卡片切换当前图标，再使用下方按钮查看大图、抠图、应用或删除。')}</div>
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

      {/* 搴曢儴鎿嶄綔鍖?*/}
      <div className="panel-footer">
        {/* 娓呴櫎鎵€鏈夋寜閽?*/}
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
        {/* 涓€閿姞鍥炬寜閽?*/}
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




