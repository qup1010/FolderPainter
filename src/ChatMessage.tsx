import { ToolResultRenderer } from "./components/tools";
import type { ToolResult } from "./types/agent";
import { useI18n } from "./hooks/useI18n";
import "./ChatMessage.css";

export type MessageType = "user" | "assistant" | "system";

export interface ChatMessageData {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  i18nKey?: string;
  folders?: string[];
  previewImages?: { folderPath: string; imageUrl: string }[];
  analysisResults?: {
    folderPath: string;
    folderName: string;
    displayIndex?: number;
    category: string;
    suggestedPrompt: string;
    summary: string;
  }[];
  previewRefs?: {
    folderIndex: number;
    versionNumber: number;
    thumbnailBase64: string;
    folderName: string;
  }[];
  toolResults?: ToolResult[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  onAction?: (action: string, data?: any) => void;
  onSelectTemplate?: () => void;
  onCustomStyle?: (analyses: any[]) => void;
}

export function ChatMessage({ message, onAction, onSelectTemplate, onCustomStyle }: ChatMessageProps) {
  const { t } = useI18n();
  const displayContent = message.i18nKey ? t(message.i18nKey) : message.content;

  const isFolderActionMessage =
    message.type === "user" &&
    (displayContent.startsWith("Added folders:") ||
      displayContent.startsWith("Analyze queued folders") ||
      displayContent.startsWith("已添加文件夹:") ||
      displayContent.startsWith("分析待处理文件夹"));

  const hasToolResults = Boolean(message.toolResults && message.toolResults.length > 0);
  const isAssistantNote = message.type === "assistant" && !hasToolResults;
  const showSystemLabel = message.type === "system" || isAssistantNote;

  const handleEditPrompt = (folderPath: string, newPrompt: string) => {
    onAction?.("edit-prompt", { folderPath, newPrompt });
  };

  return (
    <div className={`chat-message ${message.type} animate-fadeInUp`}>
      <div className="message-content">
        {showSystemLabel && (
          <div className="message-section-label system-label">{t("chat.systemMessageLabel", "System")}</div>
        )}
        <div className={`message-text ${isAssistantNote ? "assistant-note" : ""}`}>{displayContent}</div>

        {message.folders && message.folders.length > 0 && !isFolderActionMessage && (
          <div className="message-folders">
            {message.folders.map((folder, index) => (
              <div key={index} className="folder-tag">
                Folder: {folder.split("\\").pop()}
              </div>
            ))}
          </div>
        )}

        {message.previewImages && message.previewImages.length > 0 && (
          <div className="message-previews">
            {message.previewImages.map((preview, index) => (
              <div key={index} className="preview-card">
                <img src={preview.imageUrl} alt={preview.folderPath} />
                <span>{preview.folderPath.split("\\").pop()}</span>
              </div>
            ))}
          </div>
        )}

        {message.analysisResults && message.analysisResults.length > 0 && (
          <div className="message-analysis">
            {message.analysisResults.map((result, index) => (
              <div key={index} className="analysis-card">
                <div className="analysis-card-header">
                  {result.displayIndex && <span className="folder-index">[{result.displayIndex}]</span>}
                  <span className="folder-name">{result.folderName}</span>
                  <span className="category-badge">{result.category}</span>
                </div>
                <p className="analysis-summary">{result.summary}</p>
                <div className="suggested-prompt">
                  <span className="prompt-label">{t("analysis.promptLabel", "Suggested Prompt")}</span>
                  <code>{result.suggestedPrompt}</code>
                </div>
              </div>
            ))}
            {onAction && (
              <button className="action-btn primary" onClick={() => onAction("apply-analysis", message.analysisResults)}>
                {t("analysis.applyPrompts", "Use These Prompts")}
              </button>
            )}
          </div>
        )}

        {message.toolResults && message.toolResults.length > 0 && (
          <div className="message-tool-results">
            <div className="message-section-label result-label">{t("chat.aiResultLabel", "AI Result")}</div>
            {message.toolResults.map((result, index) => (
              <ToolResultRenderer
                key={index}
                result={result}
                onEditPrompt={handleEditPrompt}
                onSelectTemplate={onSelectTemplate}
                onCustomStyle={onCustomStyle}
              />
            ))}
          </div>
        )}

        {message.previewRefs && message.previewRefs.length > 0 && (
          <div className="message-preview-refs">
            {message.previewRefs.map((ref, index) => (
              <div key={index} className="preview-ref-card">
                {ref.thumbnailBase64 && <img src={ref.thumbnailBase64} alt={`[${ref.folderIndex}]`} />}
                <div className="preview-ref-info">
                  <span className="ref-index">[{ref.folderIndex}]</span>
                  <span className="ref-name">{ref.folderName}</span>
                  <span className="ref-version">v{ref.versionNumber}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="message-time">{message.timestamp.toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

