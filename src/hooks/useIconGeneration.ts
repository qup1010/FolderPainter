import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PreviewSession, IconVersion } from "../types/preview";
import type { ToolResult } from "../types/agent";
import type { ChatMessageData } from "../ChatMessage";

interface AppConfig {
    parallel_generation: boolean;
    concurrency_limit: number;
}

interface GenerationTarget {
    folder_path: string;
    folder_index: number;
    folder_name: string;
    prompt: string;
}

interface UseIconGenerationProps {
    apiConfigured: boolean;
    onGenerateVersion: (folderPath: string, prompt: string) => Promise<IconVersion>;
    addAssistantMessage: (content: string, extras?: Partial<ChatMessageData>) => void;
    session: PreviewSession | null;
    getPrompts: () => Record<string, string>;
}

// 工具函数：将数组分成指定大小的块
function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

export function useIconGeneration({
    apiConfigured,
    onGenerateVersion,
    addAssistantMessage,
    session,
    getPrompts,
}: UseIconGenerationProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);

    // 用于取消生成的标志
    const cancelRef = useRef(false);

    // 取消生成
    const cancelGeneration = useCallback(() => {
        cancelRef.current = true;
        setIsGenerating(false);
        setGenerationProgress(null);
        addAssistantMessage("⏹️ 已取消生成。");
    }, [addAssistantMessage]);

    // 获取配置
    const getConfig = async (): Promise<{ parallel: boolean; concurrency: number }> => {
        try {
            const config = await invoke<AppConfig>("get_config");
            return {
                parallel: config.parallel_generation || false,
                concurrency: config.concurrency_limit || 3,
            };
        } catch {
            return { parallel: false, concurrency: 3 };
        }
    };

    // 从工具结果执行生成
    const handleGenerateFromToolResult = useCallback(async (toolResult: ToolResult) => {
        if (!apiConfigured) {
            addAssistantMessage(
                "需要先配置图像模型 API 才能生成图标。\n" +
                "点击右上角的设置按钮进行配置。"
            );
            return;
        }

        const targets = (toolResult.data?.targets || []) as GenerationTarget[];
        if (targets.length === 0) return;

        const { parallel, concurrency } = await getConfig();

        cancelRef.current = false;
        setIsGenerating(true);
        setGenerationProgress({ current: 0, total: targets.length });

        try {
            let completedCount = 0;

            if (parallel && targets.length > 1) {
                // 并行模式：分批处理
                const chunks = chunkArray(targets, concurrency);

                for (const chunk of chunks) {
                    if (cancelRef.current) {
                        addAssistantMessage(`⏹️ 生成已取消 (${completedCount}/${targets.length} 完成)`);
                        break;
                    }

                    const results = await Promise.allSettled(
                        chunk.map(target => onGenerateVersion(target.folder_path, target.prompt))
                    );

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        const target = chunk[i];

                        if (result.status === 'fulfilled') {
                            addAssistantMessage(
                                `✅ [${target.folder_index}] ${target.folder_name} 生成完成 (v${result.value.versionNumber})`,
                                {
                                    previewRefs: [{
                                        folderIndex: target.folder_index,
                                        versionNumber: result.value.versionNumber,
                                        thumbnailBase64: result.value.thumbnailBase64 || '',
                                        folderName: target.folder_name,
                                    }],
                                }
                            );
                        } else {
                            addAssistantMessage(`❌ [${target.folder_index}] ${target.folder_name} 生成失败: ${result.reason}`);
                        }

                        completedCount++;
                        setGenerationProgress({ current: completedCount, total: targets.length });
                    }
                }
            } else {
                // 串行模式
                for (const target of targets) {
                    if (cancelRef.current) {
                        addAssistantMessage(`⏹️ 生成已取消 (${completedCount}/${targets.length} 完成)`);
                        break;
                    }

                    try {
                        const version = await onGenerateVersion(target.folder_path, target.prompt);

                        addAssistantMessage(
                            `✅ [${target.folder_index}] ${target.folder_name} 生成完成 (v${version.versionNumber})`,
                            {
                                previewRefs: [{
                                    folderIndex: target.folder_index,
                                    versionNumber: version.versionNumber,
                                    thumbnailBase64: version.thumbnailBase64 || '',
                                    folderName: target.folder_name,
                                }],
                            }
                        );
                    } catch (e) {
                        addAssistantMessage(`❌ [${target.folder_index}] ${target.folder_name} 生成失败: ${e}`);
                    }

                    completedCount++;
                    setGenerationProgress({ current: completedCount, total: targets.length });
                }
            }

            if (!cancelRef.current) {
                addAssistantMessage(
                    "🎉 图标生成完成！\n\n" +
                    "• 在右侧面板预览效果\n" +
                    "• 如果不满意，可以说「[编号] 改成 xxx」重新生成\n" +
                    "• 满意后说「应用」或在面板中点击应用按钮"
                );
            }
        } finally {
            setIsGenerating(false);
            setGenerationProgress(null);
            cancelRef.current = false;
        }
    }, [apiConfigured, onGenerateVersion, addAssistantMessage]);

    // 本地生成 (无 Agent)
    const handleLocalGenerate = useCallback(async () => {
        if (!apiConfigured) {
            addAssistantMessage("请先配置图像模型 API。");
            return;
        }

        if (!session || session.folders.length === 0) {
            addAssistantMessage("请先添加文件夹。");
            return;
        }

        const prompts = getPrompts();
        const { parallel, concurrency } = await getConfig();

        cancelRef.current = false;
        setIsGenerating(true);
        setGenerationProgress({ current: 0, total: session.folders.length });

        try {
            let completedCount = 0;

            if (parallel && session.folders.length > 1) {
                // 并行模式
                const chunks = chunkArray(session.folders, concurrency);

                for (const chunk of chunks) {
                    if (cancelRef.current) {
                        addAssistantMessage(`⏹️ 生成已取消 (${completedCount}/${session.folders.length} 完成)`);
                        break;
                    }

                    const results = await Promise.allSettled(
                        chunk.map(folder => {
                            const prompt = prompts[folder.folderPath] ||
                                `A folder icon for ${folder.folderName}, modern minimalist design, single centered object, isolated on solid white background`;
                            return onGenerateVersion(folder.folderPath, prompt);
                        })
                    );

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        const folder = chunk[i];

                        if (result.status === 'fulfilled') {
                            addAssistantMessage(
                                `✅ [${folder.displayIndex}] ${folder.folderName} 生成完成`,
                                {
                                    previewRefs: [{
                                        folderIndex: folder.displayIndex,
                                        versionNumber: result.value.versionNumber,
                                        thumbnailBase64: result.value.thumbnailBase64 || '',
                                        folderName: folder.folderName,
                                    }],
                                }
                            );
                        } else {
                            addAssistantMessage(`❌ [${folder.displayIndex}] ${folder.folderName} 生成失败: ${result.reason}`);
                        }

                        completedCount++;
                        setGenerationProgress({ current: completedCount, total: session.folders.length });
                    }
                }
            } else {
                // 串行模式
                for (const folder of session.folders) {
                    if (cancelRef.current) {
                        addAssistantMessage(`⏹️ 生成已取消 (${completedCount}/${session.folders.length} 完成)`);
                        break;
                    }

                    const prompt = prompts[folder.folderPath] ||
                        `A folder icon for ${folder.folderName}, modern minimalist design, single centered object, isolated on solid white background`;

                    try {
                        const version = await onGenerateVersion(folder.folderPath, prompt);

                        addAssistantMessage(
                            `✅ [${folder.displayIndex}] ${folder.folderName} 生成完成`,
                            {
                                previewRefs: [{
                                    folderIndex: folder.displayIndex,
                                    versionNumber: version.versionNumber,
                                    thumbnailBase64: version.thumbnailBase64 || '',
                                    folderName: folder.folderName,
                                }],
                            }
                        );
                    } catch (e) {
                        addAssistantMessage(`❌ [${folder.displayIndex}] ${folder.folderName} 生成失败: ${e}`);
                    }

                    completedCount++;
                    setGenerationProgress({ current: completedCount, total: session.folders.length });
                }
            }

            if (!cancelRef.current) {
                addAssistantMessage("🎉 图标生成完成！在右侧面板预览并应用。");
            }
        } finally {
            setIsGenerating(false);
            setGenerationProgress(null);
            cancelRef.current = false;
        }
    }, [apiConfigured, session, getPrompts, onGenerateVersion, addAssistantMessage]);

    return {
        isGenerating,
        generationProgress,
        handleGenerateFromToolResult,
        handleLocalGenerate,
        cancelGeneration,
    };
}
