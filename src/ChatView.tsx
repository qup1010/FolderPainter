/**
 * 聊天视图组件 (Agent 架构版本)
 * 使用 LLM 智能工具调用模式
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Settings, FolderOpen, PanelRightClose, PanelRightOpen, Moon, Sun, Globe } from "lucide-react";
import { ChatMessage, ChatMessageData } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { SettingsPanel } from "./SettingsPanel";
import { TemplatePanel } from "./components/TemplatePanel";
import { InputDialog } from "./components/Dialogs";
import { useChatAgent } from "./hooks/useChatAgent";
import { useFolderSelection } from "./hooks/useFolderSelection";
import { useIconGeneration } from "./hooks/useIconGeneration";
import { useI18n, setLocale, getLocale } from "./hooks/useI18n";
import { useTheme } from "./hooks/useTheme";
import { ProgressBar } from "./components/ProgressBar";
import type { PreviewSession, FolderPreview, IconVersion } from "./types/preview";
import type { IconTemplate } from "./types/template";
import type { AgentProcessResult, AnalysisResult } from "./types/agent";
import "./ChatView.css";

interface ChatViewProps {
  session: PreviewSession | null;
  isLoading: boolean;
  error: string | null;
  onAddFolders: (paths: string[]) => Promise<FolderPreview[]>;
  onGenerateVersion: (folderPath: string, prompt: string) => Promise<IconVersion>;
  onApplyIcon: (folderPath: string) => Promise<void>;
  onSaveChatHistory: (chatJson: string) => Promise<void>;
  onClearError: () => void;
  getFolderByIndex: (index: number) => FolderPreview | undefined;
  generatedCount: number;
  totalCount: number;
  onTogglePanel: () => void;
  isPanelVisible: boolean;
}

export function ChatView({
  session,
  isLoading,
  error,
  onAddFolders,
  onGenerateVersion,
  onApplyIcon,
  onSaveChatHistory,
  onClearError,
  generatedCount: _generatedCount,
  totalCount,
  onTogglePanel,
  isPanelVisible,
}: ChatViewProps) {
  // 国际化
  const { t } = useI18n();
  const { resolvedTheme, setMode } = useTheme();

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [textApiConfigured, setTextApiConfigured] = useState(false);
  // 待风格选择的分析结果
  const [pendingAnalyses, setPendingAnalyses] = useState<AnalysisResult[]>([]);
  // 自定义风格输入对话框
  const [showCustomStyleDialog, setShowCustomStyleDialog] = useState(false);
  // 风格已应用，准备生成
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [pendingAnalyzePaths, setPendingAnalyzePaths] = useState<string[]>([]);
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // 使用 Agent Hook
  const {
    sendMessage: sendAgentMessage,
    updateFolders,
    updatePrompt,
    isProcessing: isAgentProcessing,
    error: agentError,
    executeToolActions,
    getPrompts,
    buildFolderContexts,
  } = useChatAgent({
    onGenerateVersion,
    onApplyIcon,
  });

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 添加消息辅助函数
  const addUserMessage = useCallback((content: string, folders?: string[]) => {
    const msg: ChatMessageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "user",
      content,
      timestamp: new Date(),
      folders,
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const addAssistantMessage = useCallback((
    content: string,
    extras?: Partial<ChatMessageData>
  ) => {
    const msg: ChatMessageData = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "assistant",
      content,
      timestamp: new Date(),
      ...extras,
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  // 使用 IconGeneration Hook
  const {
    isGenerating,
    generationProgress,
    handleGenerateFromToolResult,
    handleLocalGenerate,
    cancelGeneration,
  } = useIconGeneration({
    apiConfigured,
    onGenerateVersion,
    addAssistantMessage,
    session,
    getPrompts,
  });

  const isProcessing = isAgentProcessing || isGenerating;

  const handleClearChat = useCallback(async () => {
    setMessages([]);
    if (session) {
      try {
        await onSaveChatHistory("[]");
      } catch (e) {
        console.error("Failed to persist cleared chat history:", e);
      }
    }
  }, [session, onSaveChatHistory]);

  // 处理 Agent 返回结果 (定义在 handleFoldersAdded 之前使用)
  const handleAgentResult = useCallback(async (result: AgentProcessResult) => {
    // 显示 Agent 的自然语言回复
    addAssistantMessage(result.response, {
      toolResults: result.tool_results,
    });

    // 检查是否有需要执行的动作
    const generateTool = result.tool_results.find(
      r => r.toolName === 'generate_icons' && r.success
    );

    if (generateTool && generateTool.data) {
      // 自动执行生成
      await handleGenerateFromToolResult(generateTool);
    }

    const applyTool = result.tool_results.find(
      r => r.toolName === 'apply_icons' && r.success
    );

    if (applyTool && applyTool.data) {
      // 自动执行应用
      await executeToolActions([applyTool]);
      addAssistantMessage(t('messages.iconsApplied'));
    }
  }, [addAssistantMessage, executeToolActions, handleGenerateFromToolResult, t]);

  // 使用 FolderSelection Hook
  const {
    handleSelectFolder,
    handleFoldersAdded,
  } = useFolderSelection({
    session,
    onAddFolders,
    updateFolders,
    textApiConfigured,
    addAssistantMessage,
    addUserMessage,
    onFoldersQueued: (folders) => {
      setPendingAnalyzePaths((prev) => {
        const next = new Set(prev);
        folders.forEach((f) => next.add(f.folderPath));
        return Array.from(next);
      });
    },
  });

  const handleAnalyzeQueuedFolders = useCallback(async () => {
    if (pendingAnalyzePaths.length === 0) return;

    if (!textApiConfigured) {
      addAssistantMessage(t("system.textModelNotConfigured"));
      return;
    }

    const queuedPaths = [...pendingAnalyzePaths];
    const queuedFolders = (session?.folders || []).filter((f) => queuedPaths.includes(f.folderPath));
    if (queuedFolders.length === 0) {
      setPendingAnalyzePaths([]);
      addAssistantMessage(t("system.noQueuedFolders"));
      return;
    }

    addUserMessage(
      t("system.analyzeQueuedFolders").replace("{count}", String(queuedFolders.length)),
      queuedPaths
    );
    const result = await sendAgentMessage(
      "Analyze these folders and suggest icon directions for each one.",
      { folders: buildFolderContexts(queuedFolders) }
    );

    if (result) {
      await handleAgentResult(result);
      setPendingAnalyzePaths((prev) => prev.filter((p) => !queuedPaths.includes(p)));
    } else if (agentError) {
      addAssistantMessage(t("messages.processingFailed").replace("{error}", agentError));
    }
  }, [
    pendingAnalyzePaths,
    textApiConfigured,
    addAssistantMessage,
    session?.folders,
    addUserMessage,
    sendAgentMessage,
    buildFolderContexts,
    handleAgentResult,
    agentError,
    t,
  ]);

  // 初始化
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // 欢迎消息 (使用 i18nKey 以支持语言切换)
    addAssistantMessage('', { i18nKey: 'app.welcome' });
  }, [addAssistantMessage]);

  // 同步文件夹到 Agent 上下文
  useEffect(() => {
    if (session?.folders) {
      updateFolders(session.folders);
    }
  }, [session?.folders, updateFolders]);

  useEffect(() => {
    const validPaths = new Set((session?.folders || []).map((f) => f.folderPath));
    setPendingAnalyzePaths((prev) => prev.filter((p) => validPaths.has(p)));
  }, [session?.folders]);

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingExternal(true);
    };
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      setIsDraggingExternal(true);
    };
    const handleDragLeave = () => {
      setIsDraggingExternal(false);
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingExternal(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // 拖拽文件夹支持
  useEffect(() => {
    if (!isTauri()) return;

    let disposed = false;
    let unlistenNative: (() => void) | null = null;

    const unlistenNativePromise = listen<string[]>("native-file-drop", (event) => {
      const paths = event.payload || [];
      if (paths.length > 0) {
        void handleFoldersAdded(paths);
      }
    })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlistenNative = fn;
        }
        return fn;
      })
      .catch((err) => {
        console.error("[dnd] failed to register native-file-drop listener", err);
        addAssistantMessage(t("system.nativeDropListenerFailed").replace("{error}", String(err)));
        return () => {};
      });

    return () => {
      disposed = true;
      if (unlistenNative) unlistenNative();
      else void unlistenNativePromise.then((fn) => fn());
    };
  }, [handleFoldersAdded, addAssistantMessage, t]);

  // 加载会话聊天历史
  useEffect(() => {
    if (session?.chatHistory) {
      try {
        const history = JSON.parse(session.chatHistory);
        if (Array.isArray(history) && history.length > 0) {
          setMessages(history.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })));
        }
      } catch (e) {
        console.log(t('chat.cannotLoadHistory'));
      }
    }
  }, [session?.id]);

  const serializedMessages = useMemo(() => JSON.stringify(messages), [messages]);

  // 保存聊天历史（防抖，避免高频写入）
  useEffect(() => {
    if (!session || messages.length === 0) return;

    const timer = window.setTimeout(() => {
      void onSaveChatHistory(serializedMessages);
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [serializedMessages, messages.length, session?.id, onSaveChatHistory]);

  const checkApiConfig = useCallback(async () => {
    try {
      const config = await invoke<{
        text_model: { api_key: string | null; endpoint: string; model: string };
        image_model: { api_key: string | null; endpoint: string; model: string };
      }>("get_config");
      setTextApiConfigured(!!config.text_model?.endpoint && !!config.text_model?.model);
      // API Key 可以为空（本地模型不需要），只检查 endpoint 和 model
      setApiConfigured(!!config.image_model?.endpoint && !!config.image_model?.model);
    } catch (error) {
      console.error("Failed to check API config:", error);
    }
  }, []);

  useEffect(() => {
    void checkApiConfig();
  }, [checkApiConfig]);

  // 处理用户发送消息
  const handleSend = async (message: string) => {
    addUserMessage(message);

    // 检查是否是 clear 命令
    if (message.toLowerCase().trim() === 'clear') {
      await handleClearChat();
      addAssistantMessage(t('chat.clearSuccess'));
      return;
    }

    // 检查是否有会话
    if (!session || session.folders.length === 0) {
      addAssistantMessage(t('messages.addFolderFirst'));
      return;
    }

    // 检查文本模型是否配置
    if (!textApiConfigured) {
      // 简单的本地处理
      handleLocalProcessing(message);
      return;
    }

    try {
      // 发送给 Agent 处理
      const result = await sendAgentMessage(message);

      if (result) {
        handleAgentResult(result);
      } else if (agentError) {
        addAssistantMessage(t('messages.processingFailed').replace('{error}', agentError));
      }
    } catch (error) {
      addAssistantMessage(t('messages.errorOccurred').replace('{error}', String(error)));
    }
  };

  // 本地简单处理 (当文本模型未配置时)
  const handleLocalProcessing = async (message: string) => {
    const lowerMsg = message.toLowerCase();

    // 确认生成
    const isConfirmGenerate =
      lowerMsg.includes("确认") ||
      lowerMsg.includes("开始生成") ||
      lowerMsg.includes("生成图标") ||
      lowerMsg.includes("可以了") ||
      lowerMsg.includes("confirm") ||
      lowerMsg.includes("generate");

    if (isConfirmGenerate) {
      await handleLocalGenerate();
      return;
    }

    // 应用图标
    if (lowerMsg.includes("应用") || lowerMsg.includes("apply")) {
      addAssistantMessage(t('messages.useApplyButton'));
      return;
    }

    // 其他情况，提示配置文本模型
    addAssistantMessage(t('messages.localProcessingHint'));
  };

  // 处理消息中的操作按钮
  const handleMessageAction = async (action: string, data?: any) => {
    if (action === "confirm-generate") {
      // 用户点击了确认生成按钮
      addUserMessage(t('chat.confirmGenerate'));

      if (textApiConfigured) {
        const result = await sendAgentMessage(t('chat.confirmGenerate'));
        if (result) {
          handleAgentResult(result);
        }
      } else {
        await handleLocalGenerate();
      }
    } else if (action === "edit-prompt" && data) {
      updatePrompt(data.folderPath, data.newPrompt);
      addAssistantMessage(t('messages.promptUpdated').replace('{name}', data.folderName));
    }
  };

  // 辅助函数：确保提示词包含白色背景要求
  const ensureWhiteBackground = (prompt: string) => {
    const lowerPrompt = prompt.toLowerCase();
    // 检查是否已有背景相关描述（白色背景、指定背景颜色等）
    const hasBackground = lowerPrompt.includes('background') ||
      lowerPrompt.includes('isolated') ||
      lowerPrompt.includes('backdrop');
    if (hasBackground) {
      return prompt;
    }
    // 自动追加白色背景要求
    return `${prompt}, isolated on solid white background`;
  };

  // 处理选择模板 (用于分析后的风格选择)
  const handleSelectTemplate = (template: IconTemplate) => {
    // 如果有待处理的分析结果，使用 visual_subject
    if (pendingAnalyses.length > 0) {
      pendingAnalyses.forEach(analysis => {
        const basePrompt = `A folder icon of ${analysis.visual_subject}, ${template.prompt}`;
        const newPrompt = ensureWhiteBackground(basePrompt);
        updatePrompt(analysis.folder_path, newPrompt);
      });
      setPendingAnalyses([]);
      addAssistantMessage(
        t('messages.templateApplied').replace('{name}', template.name).replace('{style}', template.prompt)
      );
      setReadyToGenerate(true);
    } else if (session) {
      // 旧逻辑：没有待处理的分析，从现有提示词提取主题
      const currentPrompts = getPrompts();

      session.folders.forEach(folder => {
        const existingPrompt = currentPrompts[folder.folderPath];

        let basePrompt = "";
        if (existingPrompt) {
          const subjectMatch = existingPrompt.match(/^A folder icon (?:of|for|featuring) ([^,]+)/i);

          if (subjectMatch && subjectMatch[1]) {
            const subject = subjectMatch[1].trim();
            basePrompt = `A folder icon of ${subject}, ${template.prompt}`;
          } else {
            basePrompt = `A folder icon for ${folder.folderName}, ${template.prompt}`;
          }
        } else {
          basePrompt = `A folder icon for ${folder.folderName}, ${template.prompt}`;
        }

        updatePrompt(folder.folderPath, ensureWhiteBackground(basePrompt));
      });

      addAssistantMessage(
        t('messages.templateAppliedWithExtract').replace('{name}', template.name).replace('{style}', template.prompt)
      );
      setReadyToGenerate(true);
    } else {
      addAssistantMessage(
        t('messages.templateSelected').replace('{name}', template.name)
      );
    }
  };

  // 分析结果中点击"选择模板"
  const handleAnalysisSelectTemplate = () => {
    setShowTemplates(true);
  };

  // 分析结果中点击"自定义风格"
  const handleCustomStyle = (analyses: AnalysisResult[]) => {
    setPendingAnalyses(analyses);
    setShowCustomStyleDialog(true);
  };

  // 用户输入自定义风格后确认
  const handleCustomStyleConfirm = (styleDescription: string) => {
    if (!styleDescription.trim()) return;

    pendingAnalyses.forEach(analysis => {
      const basePrompt = `A folder icon of ${analysis.visual_subject}, ${styleDescription.trim()}`;
      const newPrompt = ensureWhiteBackground(basePrompt);
      updatePrompt(analysis.folder_path, newPrompt);
    });
    setPendingAnalyses([]);
    setShowCustomStyleDialog(false);
    addAssistantMessage(
      t('messages.customStyleApplied').replace('{style}', styleDescription.trim())
    );
    setReadyToGenerate(true);
  };

  // 显示错误
  useEffect(() => {
    if (error) {
      addAssistantMessage(t('messages.errorOccurred').replace('{error}', error));
      onClearError();
    }
  }, [error, onClearError, addAssistantMessage]);

  return (
    <div className="chat-view">
      {/* 头部 */}
      <div className="chat-header">
        <h1>
          <FolderOpen size={24} className="header-icon" />
          FolderPainter
        </h1>
        <div className="header-actions">
          {/* 语言切换按钮 */}
          <button
            className="header-btn lang-btn"
            onClick={() => {
              const currentLang = getLocale();
              const newLang = currentLang === 'zh-CN' ? 'en' : 'zh-CN';
              setLocale(newLang);
            }}
            title={getLocale() === 'zh-CN' ? 'Switch to English' : '切换到中文'}
          >
            <Globe size={20} />
            <span className="lang-label">{getLocale() === 'zh-CN' ? 'EN' : '中'}</span>
          </button>
          {/* 深色模式切换按钮 */}
          <button
            className="header-btn"
            onClick={() => {
              setMode(resolvedTheme === 'dark' ? 'light' : 'dark');
            }}
            title={resolvedTheme === 'dark' ? t('header.toggleLightMode') : t('header.toggleDarkMode')}
          >
            {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {/* 预览面板切换按钮 */}
          <button
            className="header-btn"
            onClick={onTogglePanel}
            title={isPanelVisible ? t('header.hidePanel') : t('header.showPanel')}
          >
            {isPanelVisible ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
          </button>
          {/* 设置按钮 */}
          <button
            className="header-btn"
            onClick={() => setShowSettings(true)}
            title={t('header.settings')}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* API 配置提示 */}
      {(!apiConfigured || !textApiConfigured) && (
        <div className="api-warning" onClick={() => setShowSettings(true)}>
          ⚠️
          {!apiConfigured && !textApiConfigured
            ? t('apiWarning.configureAll')
            : !apiConfigured
              ? t('apiWarning.configureImage')
              : t('apiWarning.configureText')}
        </div>
      )}

      {/* 消息列表 */}
      <div className="chat-messages">
        {isDraggingExternal && <div className="dnd-overlay">{t('chat.dropOverlay')}</div>}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onAction={handleMessageAction}
            onSelectTemplate={handleAnalysisSelectTemplate}
            onCustomStyle={handleCustomStyle}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 生成按钮 (风格已应用后显示) */}
      {readyToGenerate && !generationProgress && (
        <div className="ready-to-generate-bar">
          <div className="flow-step-caption">{t("analysis.stepGenerate", "Step 2: Generate icons")}</div>
          <button
            className="generate-btn"
            onClick={async () => {
              setReadyToGenerate(false);
              if (textApiConfigured) {
                const result = await sendAgentMessage(t('chat.confirmGenerate'));
                if (result) {
                  handleAgentResult(result);
                }
              } else {
                await handleLocalGenerate();
              }
            }}
            disabled={isProcessing || isLoading}
          >
            {t('chat.generateIcon')}
          </button>
        </div>
      )}

      {/* 当前会话状态 */}
      <div className="session-status">
        {generationProgress ? (
          <ProgressBar
            current={generationProgress.current}
            total={generationProgress.total}
            onCancel={cancelGeneration}
          />
        ) : (
          <>
            <div className="flow-step-caption">
              {t("analysis.stepAnalyze", "Step 1: Analyze selected folders")}
            </div>
            <div className="status-actions">
              <button
                className="flow-primary-btn"
                onClick={handleAnalyzeQueuedFolders}
                disabled={isProcessing || isLoading || pendingAnalyzePaths.length === 0}
                title={t("system.analyzeQueuedFoldersTitle")}
              >
                {pendingAnalyzePaths.length > 0
                  ? `${t("system.analyzeFoldersButton")} (${pendingAnalyzePaths.length})`
                  : t("system.analyzeFoldersButton")}
              </button>
              <button
                className="flow-secondary-btn"
                onClick={() => { void handleClearChat(); }}
                title={t('chat.clearChatTitle')}
              >
                {t('chat.clearChat')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 输入区域 */}
      <ChatInput
        onSend={handleSend}
        onSelectFolder={handleSelectFolder}
        onOpenTemplates={() => setShowTemplates(true)}
        disabled={isProcessing || isLoading}
        placeholder={
          isProcessing || isLoading
            ? t('chat.processing')
            : totalCount > 0
              ? t('chat.inputPlaceholder')
              : t('chat.selectFolderPlaceholder')
        }
      />

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          checkApiConfig();
        }}
      />

      {/* 模板面板 */}
      <TemplatePanel
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* 自定义风格输入对话框 */}
      <InputDialog
        isOpen={showCustomStyleDialog}
        onClose={() => setShowCustomStyleDialog(false)}
        title={t('customStyle.title')}
        description={t('customStyle.description')}
        placeholder={t('customStyle.placeholder')}
        confirmLabel={t('customStyle.confirm')}
        onConfirm={handleCustomStyleConfirm}
      />
    </div>
  );
}
