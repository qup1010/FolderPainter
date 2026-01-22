import { useState, useEffect, useRef } from 'react';
import './Dialogs.css';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
}

interface InputDialogProps extends DialogProps {
    description?: string;
    defaultValue?: string;
    placeholder?: string;
    confirmLabel?: string;
    onConfirm: (value: string) => void;
}

export function InputDialog({
    isOpen,
    onClose,
    title,
    description,
    defaultValue = '',
    placeholder,
    confirmLabel = '确定',
    onConfirm,
}: InputDialogProps) {
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(defaultValue);
            // 延迟聚焦，等待动画开始
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultValue]);

    if (!isOpen) return null;

    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div className="dialog-container" onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                    <h3>{title}</h3>
                </div>
                <div className="dialog-content">
                    {description && <p style={{ marginBottom: '0.5rem' }}>{description}</p>}
                    <input
                        ref={inputRef}
                        type="text"
                        className="dialog-input"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder={placeholder}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                onConfirm(value);
                            } else if (e.key === 'Escape') {
                                onClose();
                            }
                        }}
                    />
                </div>
                <div className="dialog-footer">
                    <button className="dialog-btn dialog-btn-cancel" onClick={onClose}>
                        取消
                    </button>
                    <button
                        className="dialog-btn dialog-btn-confirm"
                        onClick={() => onConfirm(value)}
                        disabled={!value.trim()}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ConfirmDialogProps extends DialogProps {
    message: string;
    confirmLabel?: string;
    isDangerous?: boolean;
    onConfirm: () => void;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    title,
    message,
    confirmLabel = '确定',
    isDangerous = false,
    onConfirm,
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="dialog-overlay" onClick={onClose}>
            <div className="dialog-container" onClick={e => e.stopPropagation()}>
                <div className="dialog-header">
                    <h3>{title}</h3>
                </div>
                <div className="dialog-content">
                    <p>{message}</p>
                </div>
                <div className="dialog-footer">
                    <button className="dialog-btn dialog-btn-cancel" onClick={onClose}>
                        取消
                    </button>
                    <button
                        className={`dialog-btn ${isDangerous ? 'dialog-btn-danger' : 'dialog-btn-confirm'}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
