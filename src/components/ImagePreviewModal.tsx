/**
 * 图标放大预览模态框
 * 点击图标可以放大查看
 */

import { useEffect, useCallback, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import './ImagePreviewModal.css';

interface ImagePreviewModalProps {
  imagePath?: string; // 优先使用文件路径读取高清图
  fallbackSrc?: string; // 降级使用的缩略图
  title?: string;
  onClose: () => void;
}

export function ImagePreviewModal({ imagePath, fallbackSrc, title, onClose }: ImagePreviewModalProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 按 ESC 关闭
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // 防止背景滚动
    document.body.style.overflow = 'hidden';

    // 加载图片逻辑
    const loadImage = async () => {
      if (imagePath) {
        setLoading(true);
        try {
          const base64 = await invoke<string>('get_file_base64', { filePath: imagePath });
          // 加上 data URI scheme 前缀 (假设生成的都是 png)
          setImgSrc(`data:image/png;base64,${base64}`);
        } catch (error) {
          console.error("加载高清大图失败，使用缩略图", error);
          setImgSrc(fallbackSrc || null);
        } finally {
          setLoading(false);
        }
      } else {
        // 如果没有 path，直接用 fallback
        setImgSrc(fallbackSrc || null);
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown, imagePath, fallbackSrc]);

  return createPortal(
    <div className="image-preview-modal" onClick={onClose}>
      <button className="close-btn" onClick={onClose} title="关闭 (ESC)">
        <X size={24} />
      </button>

      {loading ? (
        <Loader2 size={48} className="loading-spinner" />
      ) : imgSrc ? (
        <img
          src={imgSrc}
          alt={title || '图标预览'}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div style={{ color: 'white' }}>无法加载图片</div>
      )}

      {title && (
        <div className="preview-info">
          {title}
        </div>
      )}
    </div>,
    document.body
  );
}
