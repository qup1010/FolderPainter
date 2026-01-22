/**
 * 分析结果视图
 * 展示 analyze_folders 工具的结果
 * 用户选择风格后再组合完整提示词
 */

import { Palette, Pencil } from 'lucide-react';
import type { AnalysisResult } from '../../types/agent';
import './AnalysisResultView.css';

interface AnalysisResultViewProps {
  data: {
    analyses: AnalysisResult[];
    errors: string[];
  };
  /** 用户点击"选择模板" */
  onSelectTemplate?: () => void;
  /** 用户点击"自定义风格"，传入 visual_subjects */
  onCustomStyle?: (analyses: AnalysisResult[]) => void;
}

export function AnalysisResultView({ data, onSelectTemplate, onCustomStyle }: AnalysisResultViewProps) {
  const { analyses, errors } = data;

  return (
    <div className="analysis-result-view">
      {analyses.map((analysis) => (
        <div key={analysis.folder_path} className="analysis-card">
          <div className="analysis-header">
            <span className="folder-index">[{analysis.folder_index}]</span>
            <span className="folder-name">{analysis.folder_name}</span>
            <span className="category-badge">{analysis.category}</span>
          </div>
          <p className="analysis-summary">{analysis.summary}</p>
          {/* 显示视觉主体描述 */}
          {analysis.visual_subject && (
            <div className="visual-subject">
              <span className="subject-label">主体描述:</span>
              <code>{analysis.visual_subject}</code>
            </div>
          )}
          {/* 不再显示 suggested_prompt */}
        </div>
      ))}

      {errors.length > 0 && (
        <div className="analysis-errors">
          {errors.map((error, index) => (
            <div key={index} className="error-item">
              ⚠️ {error}
            </div>
          ))}
        </div>
      )}

      {/* 风格选择按钮 */}
      {analyses.length > 0 && (
        <div className="style-selection-actions">
          <p className="style-hint">请选择图标风格：</p>
          <div className="style-buttons">
            {onSelectTemplate && (
              <button className="style-btn template-btn" onClick={onSelectTemplate}>
                <Palette size={16} />
                选择模板
              </button>
            )}
            {onCustomStyle && (
              <button className="style-btn custom-btn" onClick={() => onCustomStyle(analyses)}>
                <Pencil size={16} />
                自定义风格
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

