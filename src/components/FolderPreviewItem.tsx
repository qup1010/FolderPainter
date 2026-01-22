/**
 * 文件夹预览项组件
 * 显示单个文件夹及其版本历史
 */

import type { FolderPreview, IconVersion } from '../types/preview';
import { VersionThumbnail } from './VersionThumbnail';
import './FolderPreviewItem.css';

interface FolderPreviewItemProps {
  folder: FolderPreview;
  isExpanded: boolean;
  onToggle: () => void;
  onVersionSelect: (version: IconVersion) => void;
  onDeleteVersion: (versionId: number) => void;
  onApply: (version: IconVersion) => void;
  onRemove: () => void;
}

export function FolderPreviewItem({
  folder,
  isExpanded,
  onToggle,
  onVersionSelect,
  onDeleteVersion,
  onApply,
  onRemove,
}: FolderPreviewItemProps) {
  // 获取当前选中的版本
  const currentVersion = folder.versions.find(v => v.id === folder.currentVersionId);

  // 版本状态文本
  const getStatusText = () => {
    if (folder.versions.length === 0) return '待生成';
    if (!currentVersion) return '未选择';
    switch (currentVersion.status) {
      case 'generating':
        return '生成中...';
      case 'ready':
        return `v${currentVersion.versionNumber}`;
      case 'error':
        return '生成失败';
      default:
        return '';
    }
  };

  const getStatusClass = () => {
    if (!currentVersion) return '';
    return currentVersion.status;
  };

  return (
    <div className={`folder-preview-item ${isExpanded ? 'expanded' : ''}`}>
      {/* 折叠头部 */}
      <div className="folder-header" onClick={onToggle}>
        <div className="folder-info">
          <span className="folder-index">[{folder.displayIndex}]</span>
          <span className="folder-name" title={folder.folderPath}>
            {folder.folderName}
          </span>
        </div>

        <div className="folder-meta">
          {/* 当前版本缩略图 */}
          {currentVersion?.thumbnailBase64 && (
            <img
              src={currentVersion.thumbnailBase64}
              alt="preview"
              className="current-thumbnail"
            />
          )}

          {/* 状态标签 */}
          <span className={`status-badge ${getStatusClass()}`}>
            {getStatusText()}
          </span>

          {/* 展开/折叠图标 */}
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="folder-content">
          {/* 版本列表 */}
          {folder.versions.length > 0 ? (
            <div className="versions-grid">
              {folder.versions.map(version => (
                <VersionThumbnail
                  key={version.id}
                  version={version}
                  isSelected={version.id === folder.currentVersionId}
                  onSelect={() => onVersionSelect(version)}
                  onDelete={() => onDeleteVersion(version.id)}
                  onApply={() => onApply(version)}
                />
              ))}
            </div>
          ) : (
            <div className="no-versions">
              <span>暂无版本</span>
              <p>在聊天中说「生成图标」或「为 [{folder.displayIndex}] 生成图标」</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="folder-actions">
            <button
              className="remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="从列表移除"
            >
              移除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
