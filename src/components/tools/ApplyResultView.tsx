/**
 * 应用结果视图
 * 展示 apply_icons 工具的结果
 */

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
        <span className="header-icon">📁</span>
        <span className="header-title">正在应用图标...</span>
      </div>

      <div className="apply-list">
        {targets.map((target) => (
          <div key={target.folder_path} className="apply-item">
            <span className="folder-index">[{target.folder_index}]</span>
            <span className="folder-name">{target.folder_name}</span>
            <span className="apply-status">
              <span className="status-indicator applying"></span>
              应用中...
            </span>
          </div>
        ))}
      </div>

      <div className="apply-footer">
        <p className="apply-hint">
          图标应用后，请刷新文件资源管理器查看效果
        </p>
      </div>
    </div>
  );
}
