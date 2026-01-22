/**
 * 生成进度视图
 * 展示 generate_icons 工具的结果
 */

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
        <span className="header-icon">🎨</span>
        <span className="header-title">正在生成图标...</span>
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
              <span className="status-text">生成中...</span>
            </div>
          </div>
        ))}
      </div>

      <div className="progress-footer">
        <p className="progress-hint">
          图标生成需要一些时间，请稍候...
        </p>
      </div>
    </div>
  );
}
