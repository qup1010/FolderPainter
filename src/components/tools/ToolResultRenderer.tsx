import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ToolResult } from "../../types/agent";
import { useI18n } from "../../hooks/useI18n";
import { AnalysisResultView } from "./AnalysisResultView";
import { PromptListView } from "./PromptListView";
import { GenerationProgress } from "./GenerationProgress";
import { ApplyResultView } from "./ApplyResultView";
import "./ToolResultRenderer.css";

interface ToolResultRendererProps {
  result: ToolResult;
  onEditPrompt?: (folderPath: string, newPrompt: string) => void;
  onSelectTemplate?: () => void;
  onCustomStyle?: (analyses: any[]) => void;
}

export function ToolResultRenderer({
  result,
  onEditPrompt,
  onSelectTemplate,
  onCustomStyle,
}: ToolResultRendererProps) {
  const { t } = useI18n();

  if (!result.success) {
    return (
      <div className="tool-result tool-error">
        <span className="error-icon" aria-hidden="true">
          <AlertCircle size={16} />
        </span>
        <span className="error-text">{result.error || t("tools.executionFailed", "Tool execution failed")}</span>
      </div>
    );
  }

  switch (result.toolName) {
    case "analyze_folders":
      return (
        <AnalysisResultView
          data={result.data}
          onSelectTemplate={onSelectTemplate}
          onCustomStyle={onCustomStyle}
        />
      );

    case "show_prompts":
      return <PromptListView data={result.data} onEditPrompt={onEditPrompt} />;

    case "update_prompt":
      return (
        <div className="tool-result tool-update-prompt">
          <div className="update-success">
            <span className="success-icon" aria-hidden="true">
              <CheckCircle2 size={16} />
            </span>
            <span>
              {t("tools.promptUpdatedFor", "Updated prompt")}: [{result.data?.folder_index}] {result.data?.folder_name}
            </span>
          </div>
          {result.data?.new_prompt && (
            <div className="new-prompt">
              <code>{result.data.new_prompt}</code>
            </div>
          )}
        </div>
      );

    case "generate_icons":
      return <GenerationProgress data={result.data} />;

    case "apply_icons":
      return <ApplyResultView data={result.data} />;

    default:
      return (
        <div className="tool-result tool-unknown">
          <span className="info-icon" aria-hidden="true">
            <Info size={16} />
          </span>
          <span>{t("tools.executionDone", "Tool finished")}: {result.toolName}</span>
        </div>
      );
  }
}

