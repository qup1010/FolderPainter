import { Palette, Pencil } from "lucide-react";
import type { AnalysisResult } from "../../types/agent";
import { useI18n } from "../../hooks/useI18n";
import "./AnalysisResultView.css";

interface AnalysisResultViewProps {
  data: {
    analyses: AnalysisResult[];
    errors: string[];
  };
  onSelectTemplate?: () => void;
  onCustomStyle?: (analyses: AnalysisResult[]) => void;
}

export function AnalysisResultView({ data, onSelectTemplate, onCustomStyle }: AnalysisResultViewProps) {
  const { t } = useI18n();
  const { analyses, errors } = data;

  return (
    <div className="analysis-result-view">
      <div className="analysis-flow-guide" role="note" aria-label="onboarding-flow">
        <div className="flow-step active">
          <span className="flow-step-index">1</span>
          <span>{t("analysis.stepChooseStyle", "Choose a style")}</span>
        </div>
        <div className="flow-step pending">
          <span className="flow-step-index">2</span>
          <span>{t("analysis.stepGenerate", "Generate icons")}</span>
        </div>
      </div>

      {analyses.map((analysis) => (
        <div key={analysis.folder_path} className="analysis-card">
          <div className="analysis-header">
            <span className="folder-index">[{analysis.folder_index}]</span>
            <span className="folder-name">{analysis.folder_name}</span>
            <span className="category-badge">{analysis.category}</span>
          </div>
          <p className="analysis-summary">{analysis.summary}</p>
          {analysis.visual_subject && (
            <div className="visual-subject">
              <span className="subject-label">{t("analysis.subjectLabel", "Subject")}</span>
              <code>{analysis.visual_subject}</code>
            </div>
          )}
        </div>
      ))}

      {errors.length > 0 && (
        <div className="analysis-errors">
          {errors.map((error, index) => (
            <div key={index} className="error-item">
              {t("analysis.warningPrefix", "Warning")}: {error}
            </div>
          ))}
        </div>
      )}

      {analyses.length > 0 && (
        <div className="style-selection-actions">
          <p className="style-hint">{t("analysis.selectStyleHint", "Choose icon style:")}</p>
          <div className="style-buttons">
            {onSelectTemplate && (
              <button className="style-btn template-btn" onClick={onSelectTemplate}>
                <Palette size={16} />
                {t("analysis.selectTemplate", "Select Template")}
              </button>
            )}
            {onCustomStyle && (
              <button className="style-btn custom-btn" onClick={() => onCustomStyle(analyses)}>
                <Pencil size={16} />
                {t("analysis.customStyle", "Custom Style")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

