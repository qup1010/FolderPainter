/**
 * 应用分栏布局组件
 * 左侧: 聊天区域 | 右侧: 预览面板 (可隐藏)
 */

import { useState, useCallback } from 'react';
import { PanelRightOpen } from 'lucide-react';
import type { PreviewSession, FolderPreview, IconVersion } from './types/preview';
import { PreviewPanel } from './components/PreviewPanel';
import { ChatView } from './ChatView';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useI18n } from './hooks/useI18n';
import './AppLayout.css';

interface AppLayoutProps {
  session: PreviewSession | null;
  isLoading: boolean;
  error: string | null;
  onAddFolders: (paths: string[]) => Promise<FolderPreview[]>;
  onRemoveFolder: (path: string) => Promise<void>;
  onClearFolders: () => Promise<void>;
  onGenerateVersion: (folderPath: string, prompt: string) => Promise<IconVersion>;
  onDeleteVersion: (versionId: number, folderPath: string) => Promise<void>;
  onSetCurrentVersion: (folderId: number, versionId: number) => Promise<void>;
  onApplySingle: (folderPath: string, versionId: number) => Promise<string>;
  onApplyAll: () => Promise<string[]>;
  onSaveChatHistory: (chatJson: string) => Promise<void>;
  onClearError: () => void;
  getFolderByIndex: (index: number) => FolderPreview | undefined;
  onSessionUpdate?: () => Promise<void>;
}

export function AppLayout({
  session,
  isLoading,
  error,
  onAddFolders,
  onRemoveFolder,
  onClearFolders,
  onGenerateVersion,
  onDeleteVersion,
  onSetCurrentVersion,
  onApplySingle,
  onApplyAll,
  onSaveChatHistory,
  onClearError,
  getFolderByIndex,
  onSessionUpdate,
}: AppLayoutProps) {
  const { t } = useI18n();
  const [panelWidth, setPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [showApplyAllConfirm, setShowApplyAllConfirm] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResults, setApplyResults] = useState<string[] | null>(null);
  const [uiMessage, setUiMessage] = useState<string | null>(null);

  // 切换面板可见性
  const togglePanel = useCallback(() => {
    setIsPanelVisible(prev => !prev);
  }, []);

  // 拖拽调整面板宽度
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = panelWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.max(280, Math.min(480, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelWidth]);

  // 处理版本选择
  const handleVersionSelect = useCallback(async (folder: FolderPreview, version: IconVersion) => {
    await onSetCurrentVersion(folder.id, version.id);
  }, [onSetCurrentVersion]);

  // 处理删除版本
  const handleDeleteVersion = useCallback(async (versionId: number, folderPath: string) => {
    await onDeleteVersion(versionId, folderPath);
  }, [onDeleteVersion]);

  // 处理应用单个
  const handleApplySingle = useCallback(async (folder: FolderPreview, version: IconVersion) => {
    try {
      await onApplySingle(folder.folderPath, version.id);
    } catch (e) {
      console.error('应用失败:', e);
      setUiMessage(`${t('appLayout.applyFailed')} ${String(e)}`);
    }
  }, [onApplySingle, t]);

  // 显示全部应用确认
  const handleApplyAllClick = useCallback(() => {
    setShowApplyAllConfirm(true);
  }, []);

  // 确认全部应用
  const handleApplyAllConfirm = useCallback(async () => {
    setIsApplying(true);
    try {
      const results = await onApplyAll();
      setApplyResults(results);
      setShowApplyAllConfirm(false);
    } catch (e) {
      console.error('应用失败:', e);
      setUiMessage(`${t('appLayout.applyFailed')} ${String(e)}`);
    } finally {
      setIsApplying(false);
    }
  }, [onApplyAll, t]);

  // 关闭确认对话框
  const handleApplyAllCancel = useCallback(() => {
    setShowApplyAllConfirm(false);
  }, []);

  // 关闭结果对话框
  const handleCloseResults = useCallback(() => {
    setApplyResults(null);
  }, []);

  // 通过路径应用图标 (用于 Agent 工具调用)
  const handleApplyIconByPath = useCallback(async (folderPath: string) => {
    if (!session) return;

    const folder = session.folders.find(f => f.folderPath === folderPath);
    if (!folder || !folder.currentVersionId) {
      throw new Error('未找到可应用的图标版本');
    }

    const version = folder.versions.find(v => v.id === folder.currentVersionId);
    if (!version || version.status !== 'ready') {
      throw new Error('图标版本未就绪');
    }

    await onApplySingle(folderPath, version.id);
  }, [session, onApplySingle]);

  // 清除所有文件夹
  const handleClearAll = useCallback(async () => {
    if (!session) return;
    try {
      await onClearFolders();
    } catch (e) {
      setUiMessage(`${t('appLayout.clearAllFailed')} ${String(e)}`);
    }
  }, [session, onClearFolders, t]);

  // 获取就绪的文件夹数量
  const readyCount = session?.folders.filter(f => {
    if (!f.currentVersionId) return false;
    const version = f.versions.find(v => v.id === f.currentVersionId);
    return version?.status === 'ready';
  }).length ?? 0;

  // 获取已生成图标的数量
  const generatedCount = session?.folders.filter(f => f.versions.length > 0).length ?? 0;
  const totalCount = session?.folders.length ?? 0;

  return (
    <div className={`app-layout ${isResizing ? 'resizing' : ''}`}>
      {/* 左侧聊天区域 */}
      <div className="chat-container">
        <ChatView
          session={session}
          isLoading={isLoading}
          error={error}
          onAddFolders={onAddFolders}
          onGenerateVersion={onGenerateVersion}
          onApplyIcon={handleApplyIconByPath}
          onSaveChatHistory={onSaveChatHistory}
          onClearError={onClearError}
          getFolderByIndex={getFolderByIndex}
          generatedCount={generatedCount}
          totalCount={totalCount}
          onTogglePanel={togglePanel}
          isPanelVisible={isPanelVisible}
        />
      </div>

      {/* 可拖拽分隔条 */}
      {isPanelVisible && (
        <div
          className="resizer"
          onMouseDown={handleResizeStart}
        />
      )}

      {/* 右侧预览面板 */}
      <div
        className={`preview-panel-container ${isPanelVisible ? 'visible' : 'hidden'}`}
        style={{ width: isPanelVisible ? panelWidth : 0 }}
      >
        <PreviewPanel
          session={session}
          onVersionSelect={handleVersionSelect}
          onDeleteVersion={handleDeleteVersion}
          onApplySingle={handleApplySingle}
          onApplyAll={handleApplyAllClick}
          onRemoveFolder={onRemoveFolder}
          onClearAll={handleClearAll}
          onSessionUpdate={onSessionUpdate}
          isApplying={isApplying}
        />
      </div>

      {/* 面板切换按钮 (当面板隐藏时显示) */}
      {!isPanelVisible && (
        <button
          className="panel-toggle-btn"
          onClick={togglePanel}
          title={t('appLayout.showPanel')}
        >
          <PanelRightOpen size={20} />
        </button>
      )}

      {/* 全部应用确认对话框 */}
      <ConfirmDialog
        isOpen={showApplyAllConfirm}
        title={t('appLayout.confirmApplyAll')}
        message={t('appLayout.applyAllMessage').replace('{count}', String(readyCount))}
        details={session?.folders
          .filter(f => f.currentVersionId && f.versions.find(v => v.id === f.currentVersionId)?.status === 'ready')
          .map(f => `[${f.displayIndex}] ${f.folderName}`)
        }
        confirmText={t('appLayout.applyAllBtn')}
        cancelText={t('appLayout.cancel')}
        loadingText={t('appLayout.processing')}
        onConfirm={handleApplyAllConfirm}
        onCancel={handleApplyAllCancel}
        isLoading={isApplying}
      />

      {/* 应用结果对话框 */}
      <ConfirmDialog
        isOpen={!!applyResults}
        title={t('appLayout.applyComplete')}
        message={t('appLayout.applyCompleteMessage')}
        details={applyResults ?? []}
        confirmText={t('appLayout.confirm')}
        cancelText=""
        onConfirm={handleCloseResults}
        onCancel={handleCloseResults}
      />

      {/* 通用错误提示 */}
      <ConfirmDialog
        isOpen={!!uiMessage}
        title={t('appLayout.errorTitle')}
        message={uiMessage || ''}
        confirmText={t('appLayout.confirm')}
        cancelText=""
        onConfirm={() => setUiMessage(null)}
        onCancel={() => setUiMessage(null)}
      />
    </div>
  );
}
