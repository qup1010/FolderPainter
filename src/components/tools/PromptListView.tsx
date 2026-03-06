import { useState } from 'react';
import { FileText, Pencil } from 'lucide-react';
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
        <FileText size={18} className="header-icon" />
        <span className="header-title">Current prompts</span>
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
                  title="Edit prompt"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {editingIndex === prompt.folder_index ? (
              <div className="prompt-edit-area">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Enter a new prompt..."
                  rows={3}
                />
                <div className="edit-actions">
                  <button
                    className="save-btn"
                    onClick={() => handleSaveEdit(prompt.folder_path)}
                  >
                    Save
                  </button>
                  <button className="cancel-btn" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="prompt-content">
                {prompt.prompt || <span className="no-prompt">No prompt yet</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
