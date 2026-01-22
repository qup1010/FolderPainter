import { open } from "@tauri-apps/plugin-dialog";
import { useCallback } from "react";
import type { PreviewSession, FolderPreview } from "../types/preview";
import type { ChatMessageData } from "../ChatMessage";
import type { AgentProcessResult } from "../types/agent";

interface UseFolderSelectionProps {
    session: PreviewSession | null;
    onAddFolders: (paths: string[]) => Promise<FolderPreview[]>;
    updateFolders: (folders: FolderPreview[]) => void;
    textApiConfigured: boolean;
    addAssistantMessage: (content: string, extras?: Partial<ChatMessageData>) => void;
    addUserMessage: (content: string, paths?: string[]) => void;
    sendAgentMessage: (message: string, context?: any) => Promise<AgentProcessResult | null>;
    buildFolderContexts: (folders: FolderPreview[]) => any[];
    handleAgentResult: (result: AgentProcessResult) => Promise<void>;
}

export function useFolderSelection({
    session,
    onAddFolders,
    updateFolders,
    textApiConfigured,
    addAssistantMessage,
    addUserMessage,
    sendAgentMessage,
    buildFolderContexts,
    handleAgentResult,
}: UseFolderSelectionProps) {

    // 处理添加文件夹
    const handleFoldersAdded = useCallback(async (paths: string[]) => {
        const folderNames = paths.map((p) => p.split("\\").pop()).join(", ");
        addUserMessage(`添加了文件夹: ${folderNames}`, paths);

        try {
            const newFolders = await onAddFolders(paths);
            if (newFolders.length === 0) return;

            const indexList = newFolders.map(f => `[${f.displayIndex}] ${f.folderName}`).join("\n");

            // ⚡ 关键：构建完整的文件夹上下文
            // 注意：这里需要确保合并逻辑正确，避免重复
            const currentFolders = session?.folders || [];
            const incomingPaths = new Set(newFolders.map(f => f.folderPath));

            const allFolders = [
                ...currentFolders.filter(f => !incomingPaths.has(f.folderPath)),
                ...newFolders
            ];

            // 同步更新 Hook 状态
            updateFolders(allFolders);

            // 构建用于立即使用的 context
            const immediateContext = {
                folders: buildFolderContexts(allFolders),
            };

            if (!textApiConfigured) {
                addAssistantMessage(
                    `已添加 ${newFolders.length} 个文件夹:\n${indexList}\n\n` +
                    "⚠️ 文本模型未配置，无法智能分析。\n" +
                    "你可以在设置中配置，或直接描述想要的图标风格。"
                );
                return;
            }

            addAssistantMessage(`已添加 ${newFolders.length} 个文件夹，正在分析... 🔍`);

            // 通过 Agent 自动分析
            const folderIndices = newFolders.map(f => f.displayIndex);
            const result = await sendAgentMessage(
                `分析文件夹 ${folderIndices.join(", ")}`,
                immediateContext
            );

            if (result) {
                // 处理 Agent 响应
                await handleAgentResult(result);
            }
        } catch (error) {
            console.error("添加文件夹失败:", error);
            addAssistantMessage(`添加文件夹失败: ${error}`);
        }
    }, [
        session?.folders,
        onAddFolders,
        updateFolders,
        textApiConfigured,
        addAssistantMessage,
        addUserMessage,
        sendAgentMessage,
        buildFolderContexts,
        handleAgentResult
    ]);

    // 处理选择文件夹
    const handleSelectFolder = useCallback(async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: true,
                title: "选择文件夹",
            });

            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                if (paths.length > 0) {
                    await handleFoldersAdded(paths);
                }
            }
        } catch (error) {
            console.error("Failed to open folder dialog:", error);
        }
    }, [handleFoldersAdded]);

    return {
        handleSelectFolder,
        handleFoldersAdded,
    };
}
