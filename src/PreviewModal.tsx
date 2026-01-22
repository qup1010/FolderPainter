import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./PreviewModal.css";

interface PreviewItem {
  folderPath: string;
  folderName: string;
  prompt: string;
  previewUrl?: string;
  status: "pending" | "loading" | "success" | "error";
  error?: string;
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: string[];
  prompts: { [key: string]: string };
  onApply: (selectedItems: { folderPath: string; imageData: string }[]) => void;
}

export function PreviewModal({
  isOpen,
  onClose,
  folders,
  prompts,
  onApply,
}: PreviewModalProps) {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // 初始化预览项
  const initItems = () => {
    const newItems: PreviewItem[] = folders.map((folder) => {
      const folderName = folder.split("\\").pop() || folder;
      return {
        folderPath: folder,
        folderName,
        prompt: prompts[folder] || `folder icon for ${folderName}`,
        status: "pending",
      };
    });
    setItems(newItems);
    setSelectedItems(new Set(folders));
  };

  // 生成所有预览
  const handleGenerateAll = async () => {
    if (items.length === 0) {
      initItems();
      return;
    }

    setIsGenerating(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 更新状态为加载中
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, status: "loading" } : it
        )
      );

      try {
        const previewUrl = await invoke<string>("preview_ai_icon", {
          prompt: item.prompt,
        });

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "success", previewUrl } : it
          )
        );
      } catch (error) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: "error", error: String(error) }
              : it
          )
        );
      }
    }

    setIsGenerating(false);
  };

  // 重新生成单个预览
  const handleRegenerate = async (index: number) => {
    const item = items[index];

    setItems((prev) =>
      prev.map((it, idx) =>
        idx === index ? { ...it, status: "loading" } : it
      )
    );

    try {
      const previewUrl = await invoke<string>("preview_ai_icon", {
        prompt: item.prompt,
      });

      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index ? { ...it, status: "success", previewUrl } : it
        )
      );
    } catch (error) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? { ...it, status: "error", error: String(error) }
            : it
        )
      );
    }
  };

  // 切换选择
  const toggleSelect = (folderPath: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  // 应用选中的图标
  const handleApply = () => {
    // 收集选中的且已成功生成预览的项目
    const selectedWithImages = items
      .filter((item) => selectedItems.has(item.folderPath) && item.status === "success" && item.previewUrl)
      .map((item) => ({
        folderPath: item.folderPath,
        imageData: item.previewUrl!,
      }));

    onApply(selectedWithImages);
    onClose();
  };

  // 打开时初始化
  if (isOpen && items.length === 0) {
    initItems();
  }

  if (!isOpen) return null;

  const successCount = items.filter((it) => it.status === "success").length;
  const selectedCount = selectedItems.size;

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h2>🎨 图标预览</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="preview-content">
          {items.length === 0 ? (
            <div className="preview-empty">
              <p>没有可预览的文件夹</p>
            </div>
          ) : (
            <>
              <div className="preview-toolbar">
                <button
                  className="btn primary"
                  onClick={handleGenerateAll}
                  disabled={isGenerating}
                >
                  {isGenerating ? "生成中..." : "🚀 生成全部预览"}
                </button>
                <span className="preview-stats">
                  已生成: {successCount}/{items.length} | 已选择: {selectedCount}
                </span>
              </div>

              <div className="preview-grid">
                {items.map((item, index) => (
                  <div
                    key={item.folderPath}
                    className={`preview-item ${
                      selectedItems.has(item.folderPath) ? "selected" : ""
                    }`}
                    onClick={() => toggleSelect(item.folderPath)}
                  >
                    <div className="preview-image-container">
                      {item.status === "pending" && (
                        <div className="preview-placeholder">📁</div>
                      )}
                      {item.status === "loading" && (
                        <div className="preview-loading">⏳</div>
                      )}
                      {item.status === "success" && item.previewUrl && (
                        <img
                          src={item.previewUrl}
                          alt={item.folderName}
                          className="preview-image"
                        />
                      )}
                      {item.status === "error" && (
                        <div className="preview-error">❌</div>
                      )}
                    </div>

                    <div className="preview-info">
                      <span className="preview-folder-name">
                        {item.folderName}
                      </span>
                      <span className="preview-prompt" title={item.prompt}>
                        {item.prompt.slice(0, 30)}
                        {item.prompt.length > 30 ? "..." : ""}
                      </span>
                    </div>

                    {item.status === "success" && (
                      <button
                        className="regenerate-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerate(index);
                        }}
                        title="重新生成"
                      >
                        🔄
                      </button>
                    )}

                    <div className="select-indicator">
                      {selectedItems.has(item.folderPath) ? "✓" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="preview-footer">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn primary"
            onClick={handleApply}
            disabled={selectedCount === 0 || successCount === 0}
          >
            应用选中的图标 ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
}
