import { useState, useRef } from "react";
import { FolderOpen, Send, Palette } from "lucide-react";
import { useI18n } from "./hooks/useI18n";
import "./ChatInput.css";

interface ChatInputProps {
  onSend: (message: string) => void;
  onSelectFolder: () => void;
  onOpenTemplates?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onSelectFolder,
  onOpenTemplates,
  disabled = false,
  placeholder: defaultPlaceholder,
}: ChatInputProps) {
  const { t } = useI18n();
  const placeholder = defaultPlaceholder || t('chat.inputMessage');
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleClear = () => {
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter 发送（不按 Shift）
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Esc 清空输入
    if (e.key === "Escape") {
      e.preventDefault();
      handleClear();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // 自动调整高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <button
          className="attach-btn"
          onClick={onSelectFolder}
          title={t('chat.selectFolderButton')}
          disabled={disabled}
        >
          <FolderOpen size={20} />
        </button>
        {onOpenTemplates && (
          <button
            className="attach-btn template-btn"
            onClick={onOpenTemplates}
            title={t('chat.templateButton')}
            disabled={disabled}
          >
            <Palette size={20} />
          </button>
        )}
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          title="发送 (Enter)"
        >
          <Send size={18} />
        </button>
      </div>
      <div className="chat-input-hint">
        {t('chat.keyboardHint')}
      </div>
    </div>
  );
}
