/**
 * Agent 相关类型定义
 * 用于 LLM 工具调用交互架构
 */

/** 工具调用 */
export interface ToolCall {
  name: string;
  params: Record<string, any>;
}

/** Agent 响应 (LLM 返回) */
export interface AgentResponse {
  response: string;
  tools: ToolCall[];
}

/** 工具执行结果 */
export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
}

/** 文件夹上下文 */
export interface FolderContext {
  index: number;
  path: string;
  name: string;
  prompt?: string;
  hasIcon: boolean;
}

/** 聊天上下文 */
export interface ChatContext {
  folders: FolderContext[];
  prompts: Record<string, string>; // folder_path -> prompt
}

/** Agent 处理结果 (从后端返回) */
export interface AgentProcessResult {
  response: string;
  tool_results: ToolResult[];
  updated_prompts: Record<string, string>;
}

/** 分析结果 (analyze_folders 工具返回) */
export interface AnalysisResult {
  folder_index: number;
  folder_name: string;
  folder_path: string;
  category: string;
  /** 纯净的视觉主体描述 (不包含风格) */
  visual_subject: string;
  /** 建议的完整提示词 (包含默认风格，可选显示) */
  suggested_prompt: string;
  summary: string;
}

/** 提示词信息 (show_prompts 工具返回) */
export interface PromptInfo {
  folder_index: number;
  folder_name: string;
  folder_path: string;
  prompt: string;
}

/** 生成目标 (generate_icons 工具返回) */
export interface GenerateTarget {
  folder_index: number;
  folder_path: string;
  folder_name: string;
  prompt: string;
}

/** 应用目标 (apply_icons 工具返回) */
export interface ApplyTarget {
  folder_index: number;
  folder_path: string;
  folder_name: string;
}

/** 工具数据类型映射 */
export interface ToolDataMap {
  analyze_folders: {
    analyses: AnalysisResult[];
    errors: string[];
  };
  show_prompts: {
    prompts: PromptInfo[];
  };
  update_prompt: {
    folder_index: number;
    folder_name: string;
    folder_path: string;
    new_prompt: string;
  };
  generate_icons: {
    action: 'generate';
    targets: GenerateTarget[];
  };
  apply_icons: {
    action: 'apply';
    targets: ApplyTarget[];
  };
}

/** 工具名称类型 */
export type ToolName = keyof ToolDataMap;

/** 获取特定工具的数据类型 */
export type ToolData<T extends ToolName> = ToolDataMap[T];
