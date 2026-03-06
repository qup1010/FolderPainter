import { Sparkles } from 'lucide-react';
import type { GenerateTarget } from '../../types/agent';
import './GenerationProgress.css';

interface GenerationProgressProps {
  data: {
    action: 'generate';
    targets: GenerateTarget[];
  };
}

export function GenerationProgress({ data }: GenerationProgressProps) {
  const { targets } = data;

  return (
    <div className="generation-progress">
      <div className="progress-header">
        <Sparkles size={18} className="header-icon" />
        <span className="header-title">Generating icons...</span>
      </div>

      <div className="target-list">
        {targets.map((target) => (
          <div key={target.folder_path} className="target-item">
            <div className="target-info">
              <span className="folder-index">[{target.folder_index}]</span>
              <span className="folder-name">{target.folder_name}</span>
            </div>
            <div className="target-prompt">
              <code>{target.prompt}</code>
            </div>
            <div className="target-status">
              <span className="status-indicator generating"></span>
              <span className="status-text">Generating...</span>
            </div>
          </div>
        ))}
      </div>

      <div className="progress-footer">
        <p className="progress-hint">This can take a little while when generating multiple icons.</p>
      </div>
    </div>
  );
}
