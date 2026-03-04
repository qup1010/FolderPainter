/**
 * 预览会话状态管理 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  PreviewSession,
  FolderPreview,
  IconVersion,
  SessionSummary,
} from '../types/preview';

export interface UsePreviewSessionReturn {
  /** 当前会话 */
  session: PreviewSession | null;
  /** 加载中状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 创建新会话 */
  createSession: (folderPaths: string[]) => Promise<PreviewSession>;
  /** 加载现有会话 */
  loadSession: (sessionId: string) => Promise<PreviewSession>;
  /** 刷新当前会话 */
  reloadSession: () => Promise<void>;
  /** 添加文件夹到会话 */
  addFolders: (folderPaths: string[]) => Promise<FolderPreview[]>;
  /** 移除文件夹 */
  removeFolder: (folderPath: string) => Promise<void>;
  /** 清空所有文件夹 */
  clearFolders: () => Promise<void>;
  /** 生成新版本图标 */
  generateVersion: (folderPath: string, prompt: string) => Promise<IconVersion>;
  /** 删除版本 */
  deleteVersion: (versionId: number, folderPath: string) => Promise<void>;
  /** 设置当前版本 */
  setCurrentVersion: (folderId: number, versionId: number) => Promise<void>;
  /** 应用单个文件夹图标 */
  applySingle: (folderPath: string, versionId: number) => Promise<string>;
  /** 应用所有图标 */
  applyAll: () => Promise<string[]>;
  /** 保存聊天历史 */
  saveChatHistory: (chatJson: string) => Promise<void>;
  /** 删除会话 */
  deleteSession: () => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
  /** 根据编号获取文件夹 */
  getFolderByIndex: (index: number) => FolderPreview | undefined;
  /** 根据路径获取文件夹 */
  getFolderByPath: (path: string) => FolderPreview | undefined;
}

export function usePreviewSession(): UsePreviewSessionReturn {
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 创建新会话
  const createSession = useCallback(async (folderPaths: string[]): Promise<PreviewSession> => {
    setIsLoading(true);
    setError(null);
    try {
      const newSession = await invoke<PreviewSession>('create_preview_session', {
        folderPaths,
      });
      setSession(newSession);
      return newSession;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载现有会话
  const loadSession = useCallback(async (sessionId: string): Promise<PreviewSession> => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await invoke<PreviewSession>('load_preview_session', {
        sessionId,
      });
      setSession(loaded);
      return loaded;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 刷新当前会话
  const reloadSession = useCallback(async (): Promise<void> => {
    if (!session) return;
    try {
      const loaded = await invoke<PreviewSession>('load_preview_session', {
        sessionId: session.id,
      });
      setSession(loaded);
    } catch (e) {
      console.error('刷新会话失败:', e);
    }
  }, [session]);

  // 添加文件夹
  const addFolders = useCallback(async (folderPaths: string[]): Promise<FolderPreview[]> => {
    if (!session) {
      // 如果没有会话，创建新会话
      const newSession = await createSession(folderPaths);
      return newSession.folders;
    }

    setError(null);
    try {
      const newFolders = await invoke<FolderPreview[]>('add_folders_to_session', {
        sessionId: session.id,
        folderPaths,
      });

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          folders: [...prev.folders, ...newFolders],
        };
      });

      return newFolders;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [session, createSession]);

  // 移除文件夹
  const removeFolder = useCallback(async (folderPath: string): Promise<void> => {
    if (!session) return;

    setError(null);
    try {
      await invoke('remove_folder_from_session', {
        sessionId: session.id,
        folderPath,
      });

      // 重新加载会话以获取更新后的编号
      const updated = await invoke<PreviewSession>('load_preview_session', {
        sessionId: session.id,
      });
      setSession(updated);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [session]);

  // 清空所有文件夹
  const clearFolders = useCallback(async (): Promise<void> => {
    if (!session) return;

    setError(null);
    try {
      await invoke('clear_folders_from_session', {
        sessionId: session.id,
      });

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          folders: [],
        };
      });
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [session]);

  // 生成新版本
  const generateVersion = useCallback(async (
    folderPath: string,
    prompt: string
  ): Promise<IconVersion> => {
    if (!session) {
      throw new Error('没有活跃的会话');
    }

    setError(null);
    try {
      const version = await invoke<IconVersion>('generate_preview_version', {
        sessionId: session.id,
        folderPath,
        prompt,
      });

      // 更新本地状态
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          folders: prev.folders.map(f =>
            f.folderPath === folderPath
              ? {
                  ...f,
                  versions: [...f.versions, version],
                  currentVersionId: version.id,
                }
              : f
          ),
        };
      });

      return version;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [session]);

  // 删除版本
  const deleteVersion = useCallback(async (
    versionId: number,
    folderPath: string
  ): Promise<void> => {
    setError(null);
    try {
      await invoke('delete_preview_version', { versionId });

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          folders: prev.folders.map(f =>
            f.folderPath === folderPath
              ? {
                  ...f,
                  versions: f.versions.filter(v => v.id !== versionId),
                  currentVersionId: f.currentVersionId === versionId
                    ? f.versions.find(v => v.id !== versionId)?.id
                    : f.currentVersionId,
                }
              : f
          ),
        };
      });
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // 设置当前版本
  const setCurrentVersionFn = useCallback(async (
    folderId: number,
    versionId: number
  ): Promise<void> => {
    setError(null);
    try {
      await invoke('set_current_version', { folderId, versionId });

      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          folders: prev.folders.map(f =>
            f.id === folderId
              ? { ...f, currentVersionId: versionId }
              : f
          ),
        };
      });
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // 应用单个
  const applySingle = useCallback(async (
    folderPath: string,
    versionId: number
  ): Promise<string> => {
    setError(null);
    try {
      const result = await invoke<string>('apply_folder_preview', {
        folderPath,
        versionId,
      });
      return result;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  // 应用所有
  const applyAll = useCallback(async (): Promise<string[]> => {
    if (!session) {
      throw new Error('没有活跃的会话');
    }

    setError(null);
    try {
      const results = await invoke<string[]>('apply_all_previews', {
        sessionId: session.id,
      });

      // 标记会话完成
      setSession(prev =>
        prev ? { ...prev, status: 'completed' } : prev
      );

      return results;
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [session]);

  // 保存聊天历史
  const saveChatHistory = useCallback(async (chatJson: string): Promise<void> => {
    if (!session) return;

    try {
      await invoke('save_session_chat', {
        sessionId: session.id,
        chatJson,
      });
    } catch (e) {
      console.error('保存聊天历史失败:', e);
    }
  }, [session]);

  // 删除会话
  const deleteSession = useCallback(async (): Promise<void> => {
    if (!session) return;

    setError(null);
    try {
      await invoke('delete_preview_session', {
        sessionId: session.id,
      });
      setSession(null);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      throw new Error(msg);
    }
  }, [session]);

  // 根据编号获取文件夹
  const getFolderByIndex = useCallback((index: number): FolderPreview | undefined => {
    return session?.folders.find(f => f.displayIndex === index);
  }, [session]);

  // 根据路径获取文件夹
  const getFolderByPath = useCallback((path: string): FolderPreview | undefined => {
    return session?.folders.find(f => f.folderPath === path);
  }, [session]);

  // 自动加载上次活跃会话
  useEffect(() => {
    const loadLastSession = async () => {
      try {
        const sessions = await invoke<SessionSummary[]>('list_active_sessions');
        if (sessions.length > 0) {
          // 加载最近的活跃会话
          await loadSession(sessions[0].id);
        }
      } catch (e) {
        console.log('没有可恢复的会话');
      }
    };

    loadLastSession();
  }, [loadSession]);

  return {
    session,
    isLoading,
    error,
    createSession,
    loadSession,
    reloadSession,
    addFolders,
    removeFolder,
    clearFolders,
    generateVersion,
    deleteVersion,
    setCurrentVersion: setCurrentVersionFn,
    applySingle,
    applyAll,
    saveChatHistory,
    deleteSession,
    clearError,
    getFolderByIndex,
    getFolderByPath,
  };
}
