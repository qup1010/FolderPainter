/**
 * useChatAgent Hook
 * 管理与 Agent 的对话交互
 */

import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  ChatContext,
  FolderContext,
  AgentProcessResult,
  ToolResult,
} from '../types/agent';
import type { FolderPreview } from '../types/preview';

interface UseChatAgentOptions {
  /** 生成图标的回调 */
  onGenerateVersion: (folderPath: string, prompt: string) => Promise<any>;
  /** 应用图标的回调 */
  onApplyIcon: (folderPath: string) => Promise<void>;
}

interface UseChatAgentReturn {
  /** 发送消息给 Agent */
  sendMessage: (message: string, overrideContext?: Partial<ChatContext>) => Promise<AgentProcessResult | null>;
  /** 当前上下文 */
  context: ChatContext;
  /** 更新文件夹上下文 */
  updateFolders: (folders: FolderPreview[]) => void;
  /** 更新单个提示词 */
  updatePrompt: (folderPath: string, prompt: string) => void;
  /** 清除对话历史 (保留会话状态) */
  clearHistory: () => void;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 错误信息 */
  error: string | null;
  /** 执行工具调用返回的动作 */
  executeToolActions: (toolResults: ToolResult[]) => Promise<void>;
  /** 获取当前提示词 */
  getPrompts: () => Record<string, string>;
  /** 将 FolderPreview[] 转换为 FolderContext[] (供外部使用) */
  buildFolderContexts: (folders: FolderPreview[]) => FolderContext[];
}

export function useChatAgent(options: UseChatAgentOptions): UseChatAgentReturn {
  const { onGenerateVersion, onApplyIcon } = options;

  const [context, setContext] = useState<ChatContext>({
    folders: [],
    prompts: {},
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于跟踪对话历史 (可选，用于更复杂的多轮对话)
  const conversationRef = useRef<{ role: string; content: string }[]>([]);

  /**
   * 将 FolderPreview[] 转换为 FolderContext[]
   */
  const buildFolderContexts = useCallback((folders: FolderPreview[]): FolderContext[] => {
    return folders.map((f) => ({
      index: f.displayIndex,
      path: f.folderPath,
      name: f.folderName,
      prompt: undefined,
      hasIcon: f.versions.length > 0,
    }));
  }, []);

  /**
   * 更新文件夹上下文
   */
  const updateFolders = useCallback((folders: FolderPreview[]) => {
    const folderContexts = buildFolderContexts(folders);

    setContext((prev) => ({
      ...prev,
      folders: folderContexts,
    }));
  }, [buildFolderContexts]);

  /**
   * 更新单个提示词
   */
  const updatePrompt = useCallback((folderPath: string, prompt: string) => {
    setContext((prev) => ({
      ...prev,
      prompts: {
        ...prev.prompts,
        [folderPath]: prompt,
      },
    }));
  }, []);

  /**
   * 获取当前提示词
   */
  const getPrompts = useCallback(() => {
    return context.prompts;
  }, [context.prompts]);

  /**
   * 清除对话历史
   */
  const clearHistory = useCallback(() => {
    conversationRef.current = [];
    // 不清除 context，保留文件夹和提示词状态
  }, []);

  /**
   * 发送消息给 Agent
   * @param message 用户消息
   * @param overrideContext 可选的上下文覆盖 (用于解决 React 状态异步更新问题)
   */
  const sendMessage = useCallback(async (
    message: string,
    overrideContext?: Partial<ChatContext>
  ): Promise<AgentProcessResult | null> => {
    // 检查是否是 clear 命令
    if (message.toLowerCase().trim() === 'clear') {
      clearHistory();
      return {
        response: '对话历史已清除，会话状态保留。',
        tool_results: [],
        updated_prompts: context.prompts,
      };
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 合并当前 context 和 overrideContext
      const effectiveContext: ChatContext = {
        folders: overrideContext?.folders ?? context.folders,
        prompts: { ...context.prompts, ...overrideContext?.prompts },
      };

      // 将 context 序列化为 JSON
      const contextJson = JSON.stringify(effectiveContext);

      // 调用后端 Agent
      const result = await invoke<AgentProcessResult>('chat_with_agent', {
        userMessage: message,
        contextJson,
      });

      // 更新本地提示词
      if (result.updated_prompts) {
        setContext((prev) => ({
          ...prev,
          prompts: result.updated_prompts,
        }));
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [context, clearHistory]);

  /**
   * 执行工具调用返回的动作
   * 某些工具 (如 generate_icons, apply_icons) 返回的是指令，需要前端执行
   */
  const executeToolActions = useCallback(async (toolResults: ToolResult[]) => {
    for (const result of toolResults) {
      if (!result.success || !result.data) continue;

      switch (result.toolName) {
        case 'generate_icons': {
          const { targets } = result.data as { targets: Array<{ folder_path: string; prompt: string }> };
          for (const target of targets) {
            try {
              await onGenerateVersion(target.folder_path, target.prompt);
            } catch (err) {
              console.error(`生成图标失败 [${target.folder_path}]:`, err);
            }
          }
          break;
        }

        case 'apply_icons': {
          const { targets } = result.data as { targets: Array<{ folder_path: string }> };
          for (const target of targets) {
            try {
              await onApplyIcon(target.folder_path);
            } catch (err) {
              console.error(`应用图标失败 [${target.folder_path}]:`, err);
            }
          }
          break;
        }

        // analyze_folders, show_prompts, update_prompt 不需要额外执行
        default:
          break;
      }
    }
  }, [onGenerateVersion, onApplyIcon]);

  return {
    sendMessage,
    context,
    updateFolders,
    updatePrompt,
    clearHistory,
    isProcessing,
    error,
    executeToolActions,
    getPrompts,
    buildFolderContexts,
  };
}
