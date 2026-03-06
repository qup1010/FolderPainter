import { CheckCircle2 } from 'lucide-react';
import type { ApplyTarget } from '../../types/agent';
import './ApplyResultView.css';

interface ApplyResultViewProps {
  data: {
    action: 'apply';
    targets: ApplyTarget[];
  };
}

export function ApplyResultView({ data }: ApplyResultViewProps) {
  const { targets } = data;

  return (
    <div className="apply-result-view">
      <div className="apply-header">
        <CheckCircle2 size={18} className="header-icon" />
        <span className="header-title">Applying icons...</span>
      </div>

      <div className="apply-list">
        {targets.map((target) => (
          <div key={target.folder_path} className="apply-item">
            <span className="folder-index">[{target.folder_index}]</span>
            <span className="folder-name">{target.folder_name}</span>
            <span className="apply-status">
              <span className="status-indicator applying"></span>
              Applying...
            </span>
          </div>
        ))}
      </div>

      <div className="apply-footer">
        <p className="apply-hint">Refresh File Explorer after applying to see the latest icon.</p>
      </div>
    </div>
  );
}
