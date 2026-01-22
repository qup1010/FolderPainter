import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./IconPreviewCard.css";

export interface IconPreviewData {
  folderPath: string;
  folderName: string;
  prompt: string;
  imageUrl?: string;
  status: "pending" | "generating" | "ready" | "error";
  error?: string;
}

interface IconPreviewCardProps {
  data: IconPreviewData;
  onPromptChange: (newPrompt: string) => void;
  onRegenerate: () => void;
  onApply: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function IconPreviewCard({
  data,
  onPromptChange,
  onRegenerate,
  onApply,
  onRemove,
  disabled = false,
}: IconPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(data.prompt);

  const handleSavePrompt = () => {
    onPromptChange(editPrompt);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditPrompt(data.prompt);
    setIsEditing(false);
  };

  return (
    <div className={`icon-preview-card ${data.status}`}>
      {/* 图标预览区域 */}
      <div className="preview-image-area">
        {data.status === "pending" && (
          <div className="preview-placeholder">
            <span className="icon">📁</span>
            <span className="text">待生成</span>
          </div>
        )}
        {data.status === "generating" && (
          <div className="preview-loading">
            <span className="spinner">⏳</span>
            <span className="text">生成中...</span>
          </div>
        )}
        {data.status === "ready" && data.imageUrl && (
          <img src={data.imageUrl} alt={data.folderName} className="preview-image" />
        )}
        {data.status === "error" && (
          <div className="preview-error">
            <span className="icon">❌</span>
            <span className="text">生成失败</span>
          </div>
        )}
      </div>

      {/* 文件夹信息 */}
      <div className="folder-info">
        <span className="folder-name" title={data.folderPath}>
          {data.folderName}
        </span>
      </div>

      {/* 提示词编辑 */}
      <div className="prompt-section">
        {isEditing ? (
          <div className="prompt-edit">
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={2}
              placeholder="描述想要的图标..."
            />
            <div className="edit-actions">
              <button onClick={handleSavePrompt} className="save-btn">✓</button>
              <button onClick={handleCancelEdit} className="cancel-btn">✕</button>
            </div>
          </div>
        ) : (
          <div className="prompt-display" onClick={() => !disabled && setIsEditing(true)}>
            <span className="prompt-text" title={data.prompt}>
              {data.prompt.length > 50 ? data.prompt.slice(0, 50) + "..." : data.prompt}
            </span>
            {!disabled && <span className="edit-icon">✏️</span>}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="card-actions">
        {data.status === "ready" && (
          <>
            <button
              className="action-btn regenerate"
              onClick={onRegenerate}
              disabled={disabled}
              title="重新生成"
            >
              🔄
            </button>
            <button
              className="action-btn apply"
              onClick={onApply}
              disabled={disabled}
              title="应用此图标"
            >
              ✓ 应用
            </button>
          </>
        )}
        {data.status === "pending" && (
          <button
            className="action-btn generate"
            onClick={onRegenerate}
            disabled={disabled}
            title="生成图标"
          >
            ✨ 生成
          </button>
        )}
        {data.status === "error" && (
          <button
            className="action-btn retry"
            onClick={onRegenerate}
            disabled={disabled}
            title="重试"
          >
            🔄 重试
          </button>
        )}
        <button
          className="action-btn remove"
          onClick={onRemove}
          disabled={disabled}
          title="移除"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// 图标预览面板组件 - 用于批量展示和操作
interface IconPreviewPanelProps {
  items: IconPreviewData[];
  onItemUpdate: (index: number, updates: Partial<IconPreviewData>) => void;
  onItemRemove: (index: number) => void;
  onGenerateAll: () => void;
  onApplyAll: () => void;
  onApplySingle: (index: number, imageData: string) => void;
  disabled?: boolean;
}

export function IconPreviewPanel({
  items,
  onItemUpdate,
  onItemRemove,
  onGenerateAll,
  onApplyAll,
  onApplySingle,
  disabled = false,
}: IconPreviewPanelProps) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  const readyCount = items.filter((item) => item.status === "ready").length;
  const allReady = items.length > 0 && readyCount === items.length;

  // 生成单个图标
  const handleGenerateSingle = async (index: number) => {
    const item = items[index];
    setGeneratingIndex(index);
    onItemUpdate(index, { status: "generating" });

    try {
      const imageUrl = await invoke<string>("preview_ai_icon", {
        prompt: item.prompt,
      });
      onItemUpdate(index, { status: "ready", imageUrl, error: undefined });
    } catch (error) {
      onItemUpdate(index, { status: "error", error: String(error) });
    } finally {
      setGeneratingIndex(null);
    }
  };

  // 应用单个图标
  const handleApplySingle = async (index: number) => {
    const item = items[index];
    if (item.imageUrl) {
      onApplySingle(index, item.imageUrl);
    }
  };

  return (
    <div className="icon-preview-panel">
      <div className="panel-header">
        <span className="panel-title">
          📁 {items.length} 个文件夹 | ✅ {readyCount} 个已就绪
        </span>
        <div className="panel-actions">
          <button
            className="btn secondary"
            onClick={onGenerateAll}
            disabled={disabled || items.length === 0}
          >
            🚀 生成全部
          </button>
          <button
            className="btn primary"
            onClick={onApplyAll}
            disabled={disabled || !allReady}
          >
            ✓ 应用全部
          </button>
        </div>
      </div>

      <div className="preview-grid">
        {items.map((item, index) => (
          <IconPreviewCard
            key={item.folderPath}
            data={item}
            onPromptChange={(newPrompt) => onItemUpdate(index, { prompt: newPrompt })}
            onRegenerate={() => handleGenerateSingle(index)}
            onApply={() => handleApplySingle(index)}
            onRemove={() => onItemRemove(index)}
            disabled={disabled || generatingIndex !== null}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          <p>拖拽文件夹到这里，或点击 📁 按钮选择</p>
        </div>
      )}
    </div>
  );
}
