/**
 * 进度条组件
 * 用于可视化图标生成进度
 */

import './ProgressBar.css';

interface ProgressBarProps {
    current: number;
    total: number;
    onCancel?: () => void;
}

export function ProgressBar({ current, total, onCancel }: ProgressBarProps) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="progress-bar-container">
            <div className="progress-info">
                <span className="progress-text">
                    正在生成 {current}/{total}
                </span>
                <span className="progress-percentage">{percentage}%</span>
            </div>
            <div className="progress-track">
                <div
                    className="progress-fill"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {onCancel && (
                <button className="progress-cancel-btn" onClick={onCancel}>
                    取消
                </button>
            )}
        </div>
    );
}
