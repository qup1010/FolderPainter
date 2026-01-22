/**
 * 提示词列表视图
 * 展示 show_prompts 工具的结果，支持编辑
 */

import { useState } from 'react';
import type { PromptInfo } from '../../types/agent';
import './PromptListView.css';

interface PromptListViewProps {
  data: {
    prompts: PromptInfo[];
  };
  onEditPrompt?: (folderPath: string, newPrompt: string) => void;
}

export function PromptListView({ data, onEditPrompt }: PromptListViewProps) {
  const { prompts } = data;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (prompt: PromptInfo) => {
    setEditingIndex(prompt.folder_index);
    setEditValue(prompt.prompt);
  };

  const handleSaveEdit = (folderPath: string) => {
    if (onEditPrompt && editValue.trim()) {
      onEditPrompt(folderPath, editValue.trim());
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  return (
    <div className="prompt-list-view">
      <div className="prompt-list-header">
        <span className="header-icon">📝</span>
        <span className="header-title">当前提示词列表</span>
      </div>

      <div className="prompt-cards">
        {prompts.map((prompt) => (
          <div key={prompt.folder_path} className="prompt-card">
            <div className="prompt-card-header">
              <span className="folder-index">[{prompt.folder_index}]</span>
              <span className="folder-name">{prompt.folder_name}</span>
              {editingIndex !== prompt.folder_index && onEditPrompt && (
                <button
                  className="edit-btn"
                  onClick={() => handleStartEdit(prompt)}
                  title="编辑提示词"
                >
                  ✏️
                </button>
              )}
            </div>

            {editingIndex === prompt.folder_index ? (
              <div className="prompt-edit-area">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="输入新的提示词..."
                  rows={3}
                />
                <div className="edit-actions">
                  <button
                    className="save-btn"
                    onClick={() => handleSaveEdit(prompt.folder_path)}
                  >
                    保存
                  </button>
                  <button className="cancel-btn" onClick={handleCancelEdit}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="prompt-content">
                {prompt.prompt || <span className="no-prompt">暂无提示词</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
