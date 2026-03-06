/**
 * 鐗堟湰缂╃暐鍥剧粍浠?
 */

import { useState } from 'react';
import { Check, X, Loader2, AlertCircle, ZoomIn, Scissors } from 'lucide-react';
import type { IconVersion } from '../types/preview';
import { ImagePreviewModal } from './ImagePreviewModal';
import { useI18n } from '../hooks/useI18n';
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
  const { t } = useI18n();

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
          {isRemovingBg && (
            <div className="thumbnail-processing">
              <Loader2 size={16} className="spinner" />
              <span>{t('version.processing', '处理中')}</span>
            </div>
          )}
        </div>

        <div className="thumbnail-meta">
          <span className="version-number">v{version.versionNumber}</span>
          {isSelected && <span className="version-current">{t('version.current', '当前')}</span>}
        </div>

        <div className="thumbnail-actions">
          {version.status === 'ready' && (
            <>
              <button
                className="action-btn zoom"
                onClick={handleZoom}
                title={t('version.zoom', '查看大图')}
                aria-label={t('version.zoom', '查看大图')}
              >
                <ZoomIn size={12} />
                <span>{t('version.zoomShort', '查看')}</span>
              </button>
              {onRemoveBg && (
                <button
                  className="action-btn removebg"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveBg();
                  }}
                  disabled={isRemovingBg}
                  title={t('version.removeBg', '抠图')}
                  aria-label={t('version.removeBg', '抠图')}
                >
                  <Scissors size={12} />
                  <span>{t('version.removeBgShort', '抠图')}</span>
                </button>
              )}
              <button
                className="action-btn apply"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                title={t('version.apply', '应用此版本')}
                aria-label={t('version.apply', '应用此版本')}
              >
                <Check size={12} />
                <span>{t('version.applyShort', '应用')}</span>
              </button>
            </>
          )}
          <button
            className="action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t('version.delete', '删除此版本')}
            aria-label={t('version.delete', '删除此版本')}
          >
            <X size={12} />
            <span>{t('version.deleteShort', '删除')}</span>
          </button>
        </div>

        {isSelected && (
          <div className="selected-mark">
            <Check size={10} />
          </div>
        )}
      </div>

      {showPreview && (
        <ImagePreviewModal
          imagePath={version.imagePath || undefined}
          fallbackSrc={version.thumbnailBase64 || undefined}
          title={t('version.title', '版本 {number}').replace('{number}', String(version.versionNumber))}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

