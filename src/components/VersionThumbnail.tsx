/**
 * 版本缩略图组件
 */

import { useState } from 'react';
import { Check, X, Loader2, AlertCircle, ZoomIn, Scissors } from 'lucide-react';
import type { IconVersion } from '../types/preview';
import { ImagePreviewModal } from './ImagePreviewModal';
import './VersionThumbnail.css';

interface VersionThumbnailProps {
  version: IconVersion;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onApply: () => void;
  onRemoveBg?: () => void;
  isRemovingBg?: boolean;
}

export function VersionThumbnail({
  version,
  isSelected,
  onSelect,
  onDelete,
  onApply,
  onRemoveBg,
  isRemovingBg,
}: VersionThumbnailProps) {
  const [showPreview, setShowPreview] = useState(false);

  // 打开放大预览 - 使用原图路径
  const handleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (version.status === 'ready' && version.imagePath) {
      setShowPreview(true);
    }
  };



  return (
    <>
      <div
        className={`version-thumbnail ${isSelected ? 'selected' : ''} ${version.status} ${isRemovingBg ? 'processing' : ''}`}
        onClick={onSelect}
      >
        {/* 缩略图 */}
        <div className="thumbnail-image">
          {version.status === 'generating' && (
            <div className="thumbnail-loading">
              <Loader2 size={20} className="spinner" />
            </div>
          )}
          {version.status === 'error' && (
            <div className="thumbnail-error">
              <AlertCircle size={20} />
            </div>
          )}
          {version.status === 'ready' && version.thumbnailBase64 && (
            <img src={version.thumbnailBase64} alt={`v${version.versionNumber}`} />
          )}
          {/* 抠图处理中遮罩 */}
          {isRemovingBg && (
            <div className="thumbnail-processing">
              <Loader2 size={16} className="spinner" />
              <span>抠图中</span>
            </div>
          )}
        </div>

        {/* 版本号 */}
        <span className="version-number">v{version.versionNumber}</span>

        {/* 操作按钮 (悬停显示) */}
        <div className="thumbnail-actions">
          {version.status === 'ready' && (
            <>
              <button
                className="action-btn zoom"
                onClick={handleZoom}
                title="放大查看"
              >
                <ZoomIn size={10} />
              </button>
              {onRemoveBg && (
                <button
                  className="action-btn removebg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveBg();
                  }}
                  disabled={isRemovingBg}
                  title="抠图 (移除背景)"
                >
                  <Scissors size={10} />
                </button>
              )}
              <button
                className="action-btn apply"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                title="应用此版本"
              >
                <Check size={10} />
              </button>
            </>
          )}
          <button
            className="action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除此版本"
          >
            <X size={10} />
          </button>
        </div>

        {/* 选中标记 */}
        {isSelected && (
          <div className="selected-mark">
            <Check size={10} />
          </div>
        )}
      </div>

      {/* 放大预览模态框 - 使用原图 */}
      {showPreview && (
        <ImagePreviewModal
          imagePath={version.imagePath || undefined}
          fallbackSrc={version.thumbnailBase64 || undefined}
          title={`版本 ${version.versionNumber}`}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
