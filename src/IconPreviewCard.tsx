import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, FolderOpen, Loader2, Pencil, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
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
      <div className="preview-image-area">
        {data.status === "pending" && (
          <div className="preview-placeholder">
            <FolderOpen size={28} className="icon" />
            <span className="text">Pending</span>
          </div>
        )}
        {data.status === "generating" && (
          <div className="preview-loading">
            <Loader2 size={28} className="spinner" />
            <span className="text">Generating...</span>
          </div>
        )}
        {data.status === "ready" && data.imageUrl && (
          <img src={data.imageUrl} alt={data.folderName} className="preview-image" />
        )}
        {data.status === "error" && (
          <div className="preview-error">
            <X size={28} className="icon" />
            <span className="text">Generation failed</span>
          </div>
        )}
      </div>

      <div className="folder-info">
        <span className="folder-name" title={data.folderPath}>
          {data.folderName}
        </span>
      </div>

      <div className="prompt-section">
        {isEditing ? (
          <div className="prompt-edit">
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={2}
              placeholder="Describe the icon you want..."
            />
            <div className="edit-actions">
              <button onClick={handleSavePrompt} className="save-btn" title="Save prompt">
                <Check size={15} />
              </button>
              <button onClick={handleCancelEdit} className="cancel-btn" title="Cancel editing">
                <X size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="prompt-display" onClick={() => !disabled && setIsEditing(true)}>
            <span className="prompt-text" title={data.prompt}>
              {data.prompt.length > 50 ? data.prompt.slice(0, 50) + "..." : data.prompt}
            </span>
            {!disabled && <Pencil size={14} className="edit-icon" />}
          </div>
        )}
      </div>

      <div className="card-actions">
        {data.status === "ready" && (
          <>
            <button
              className="action-btn regenerate"
              onClick={onRegenerate}
              disabled={disabled}
              title="Regenerate"
            >
              <RefreshCw size={15} />
            </button>
            <button
              className="action-btn apply"
              onClick={onApply}
              disabled={disabled}
              title="Apply this icon"
            >
              <Check size={15} />
              <span>Apply</span>
            </button>
          </>
        )}
        {data.status === "pending" && (
          <button
            className="action-btn generate"
            onClick={onRegenerate}
            disabled={disabled}
            title="Generate icon"
          >
            <Sparkles size={15} />
            <span>Generate</span>
          </button>
        )}
        {data.status === "error" && (
          <button
            className="action-btn retry"
            onClick={onRegenerate}
            disabled={disabled}
            title="Retry"
          >
            <RefreshCw size={15} />
            <span>Retry</span>
          </button>
        )}
        <button
          className="action-btn remove"
          onClick={onRemove}
          disabled={disabled}
          title="Remove"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

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
          <FolderOpen size={16} />
          <span>{items.length} folders</span>
          <span className="panel-title-divider">?</span>
          <span>{readyCount} ready</span>
        </span>
        <div className="panel-actions">
          <button
            className="btn secondary"
            onClick={onGenerateAll}
            disabled={disabled || items.length === 0}
          >
            <Sparkles size={15} />
            <span>Generate all</span>
          </button>
          <button
            className="btn primary"
            onClick={onApplyAll}
            disabled={disabled || !allReady}
          >
            <Check size={15} />
            <span>Apply all</span>
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
          <p>Add folders to start generating icons.</p>
        </div>
      )}
    </div>
  );
}
