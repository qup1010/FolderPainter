/**
 * 聊天消息组件
 * 支持渲染工具调用结果
 */

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
  // 国际化键 (如果设置，渲染时会使用翻译而非 content)
  i18nKey?: string;
  // 可选的附加数据
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
  // 预览引用 (用于在聊天中显示生成的图标)
  previewRefs?: {
    folderIndex: number;
    versionNumber: number;
    thumbnailBase64: string;
    folderName: string;
  }[];
  // 工具调用结果
  toolResults?: ToolResult[];
}

interface ChatMessageProps {
  message: ChatMessageData;
  onAction?: (action: string, data?: any) => void;
  /** 用户点击"选择模板" */
  onSelectTemplate?: () => void;
  /** 用户点击"自定义风格" */
  onCustomStyle?: (analyses: any[]) => void;
}

export function ChatMessage({ message, onAction, onSelectTemplate, onCustomStyle }: ChatMessageProps) {
  const { t } = useI18n();

  // 获取显示内容：优先使用 i18nKey 翻译，否则使用 content
  const displayContent = message.i18nKey ? t(message.i18nKey) : message.content;

  // 处理编辑提示词
  const handleEditPrompt = (folderPath: string, newPrompt: string) => {
    onAction?.("edit-prompt", { folderPath, newPrompt });
  };

  return (
    <div className={`chat-message ${message.type} animate-fadeInUp`}>
      <div className="message-content">
        <div className="message-text">{displayContent}</div>

        {/* 显示文件夹列表 */}
        {message.folders && message.folders.length > 0 && (
          <div className="message-folders">
            {message.folders.map((folder, index) => (
              <div key={index} className="folder-tag">
                📁 {folder.split("\\").pop()}
              </div>
            ))}
          </div>
        )}

        {/* 显示预览图片 */}
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

        {/* 显示分析结果 (旧格式，保留兼容性) */}
        {message.analysisResults && message.analysisResults.length > 0 && (
          <div className="message-analysis">
            {message.analysisResults.map((result, index) => (
              <div key={index} className="analysis-card">
                <div className="analysis-card-header">
                  {result.displayIndex && (
                    <span className="folder-index">[{result.displayIndex}]</span>
                  )}
                  <span className="folder-name">{result.folderName}</span>
                  <span className="category-badge">{result.category}</span>
                </div>
                <p className="analysis-summary">{result.summary}</p>
                <div className="suggested-prompt">
                  <span className="prompt-label">建议提示词:</span>
                  <code>{result.suggestedPrompt}</code>
                </div>
              </div>
            ))}
            {onAction && (
              <button
                className="action-btn primary"
                onClick={() => onAction("apply-analysis", message.analysisResults)}
              >
                ✨ 使用这些提示词生成图标
              </button>
            )}
          </div>
        )}

        {/* 显示工具调用结果 (新格式) */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="message-tool-results">
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

        {/* 显示预览引用 (生成的图标缩略图) */}
        {message.previewRefs && message.previewRefs.length > 0 && (
          <div className="message-preview-refs">
            {message.previewRefs.map((ref, index) => (
              <div key={index} className="preview-ref-card">
                {ref.thumbnailBase64 && (
                  <img src={ref.thumbnailBase64} alt={`[${ref.folderIndex}]`} />
                )}
                <div className="preview-ref-info">
                  <span className="ref-index">[{ref.folderIndex}]</span>
                  <span className="ref-name">{ref.folderName}</span>
                  <span className="ref-version">v{ref.versionNumber}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="message-time">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
