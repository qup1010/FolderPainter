/**
 * 工具结果渲染器
 * 根据工具类型分发渲染对应的 UI 组件
 */

import type { ToolResult } from '../../types/agent';
import { AnalysisResultView } from './AnalysisResultView';
import { PromptListView } from './PromptListView';
import { GenerationProgress } from './GenerationProgress';
import { ApplyResultView } from './ApplyResultView';
import './ToolResultRenderer.css';

interface ToolResultRendererProps {
  result: ToolResult;
  onEditPrompt?: (folderPath: string, newPrompt: string) => void;
  /** 用户点击"选择模板" */
  onSelectTemplate?: () => void;
  /** 用户点击"自定义风格" */
  onCustomStyle?: (analyses: any[]) => void;
}

export function ToolResultRenderer({
  result,
  onEditPrompt,
  onSelectTemplate,
  onCustomStyle,
}: ToolResultRendererProps) {
  if (!result.success) {
    return (
      <div className="tool-result tool-error">
        <span className="error-icon">❌</span>
        <span className="error-text">{result.error || '工具执行失败'}</span>
      </div>
    );
  }

  switch (result.toolName) {
    case 'analyze_folders':
      return (
        <AnalysisResultView
          data={result.data}
          onSelectTemplate={onSelectTemplate}
          onCustomStyle={onCustomStyle}
        />
      );

    case 'show_prompts':
      return (
        <PromptListView
          data={result.data}
          onEditPrompt={onEditPrompt}
        />
      );

    case 'update_prompt':
      return (
        <div className="tool-result tool-update-prompt">
          <div className="update-success">
            <span className="success-icon">✅</span>
            <span>已更新 [{result.data?.folder_index}] {result.data?.folder_name} 的提示词</span>
          </div>
          {result.data?.new_prompt && (
            <div className="new-prompt">
              <code>{result.data.new_prompt}</code>
            </div>
          )}
        </div>
      );

    case 'generate_icons':
      return (
        <GenerationProgress
          data={result.data}
        />
      );

    case 'apply_icons':
      return (
        <ApplyResultView
          data={result.data}
        />
      );

    default:
      return (
        <div className="tool-result tool-unknown">
          <span className="info-icon">ℹ️</span>
          <span>工具 {result.toolName} 执行完成</span>
        </div>
      );
  }
}
