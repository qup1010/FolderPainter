/**
 * 预览会话相关类型定义
 */

/** 会话状态 */
export type SessionStatus = 'active' | 'completed' | 'archived';

/** 版本状态 */
export type VersionStatus = 'generating' | 'ready' | 'error';

/** 预览会话 */
export interface PreviewSession {
  id: string;
  folders: FolderPreview[];
  status: SessionStatus;
  chatHistory?: string;
  createdAt: string;
  updatedAt: string;
}

/** 会话摘要 (用于列表显示) */
export interface SessionSummary {
  id: string;
  folderCount: number;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

/** 文件夹预览 */
export interface FolderPreview {
  id: number;
  folderPath: string;
  folderName: string;
  displayIndex: number;  // [1], [2], [3]
  versions: IconVersion[];
  currentVersionId?: number;
}

/** 图标版本 */
export interface IconVersion {
  id: number;
  versionNumber: number;
  prompt: string;
  imagePath: string;
  thumbnailBase64?: string;
  status: VersionStatus;
  errorMessage?: string;
  createdAt: string;
}

/** 聊天消息中的预览引用 */
export interface MessagePreviewRef {
  folderIndex: number;      // [1]
  versionNumber: number;    // v1
  thumbnailBase64: string;
  folderName: string;
}

/** 生成请求 */
export interface GenerateRequest {
  folderPath: string;
  prompt: string;
}
