import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useRef } from "react";
import type { PreviewSession, FolderPreview } from "../types/preview";
import type { ChatMessageData } from "../ChatMessage";
import { t } from "./useI18n";

interface UseFolderSelectionProps {
  session: PreviewSession | null;
  onAddFolders: (paths: string[]) => Promise<FolderPreview[]>;
  updateFolders: (folders: FolderPreview[]) => void;
  textApiConfigured: boolean;
  addAssistantMessage: (content: string, extras?: Partial<ChatMessageData>) => void;
  addUserMessage: (content: string, paths?: string[]) => void;
  onFoldersQueued?: (folders: FolderPreview[]) => void;
}

export function useFolderSelection({
  session,
  onAddFolders,
  updateFolders,
  textApiConfigured,
  addAssistantMessage,
  addUserMessage,
  onFoldersQueued,
}: UseFolderSelectionProps) {
  const inFlightPathsRef = useRef<Set<string>>(new Set());
  const recentPathTsRef = useRef<Map<string, number>>(new Map());

  const normalizePath = (p: string) => p.trim().replace(/\//g, "\\").toLowerCase();

  const handleFoldersAdded = useCallback(
    async (paths: string[]) => {
      const currentFolders = session?.folders || [];
      const existing = new Set(currentFolders.map((f) => normalizePath(f.folderPath)));

      const deduped = Array.from(new Set(paths.map((p) => p.trim()).filter((p) => p.length > 0)));
      const now = Date.now();
      const candidates = deduped.filter((p) => {
        const key = normalizePath(p);
        const lastTs = recentPathTsRef.current.get(key) || 0;
        const inCooldown = now - lastTs < 2000;
        return !existing.has(key) && !inFlightPathsRef.current.has(key) && !inCooldown;
      });

      // Silent when there is no newly-added folder.
      if (candidates.length === 0) return [];

      const folderNames = candidates.map((p) => p.split("\\").pop()).join(", ");
      addUserMessage(t("system.addedFoldersPrefix").replace("{names}", folderNames), candidates);

      const candidateKeys = candidates.map(normalizePath);
      candidateKeys.forEach((k) => inFlightPathsRef.current.add(k));

      try {
        const newFolders = await onAddFolders(candidates);
        if (newFolders.length === 0) return [];

        const indexList = newFolders.map((f) => `[${f.displayIndex}] ${f.folderName}`).join("\n");
        const incomingPaths = new Set(newFolders.map((f) => f.folderPath));
        const allFolders = [
          ...currentFolders.filter((f) => !incomingPaths.has(f.folderPath)),
          ...newFolders,
        ];

        updateFolders(allFolders);
        onFoldersQueued?.(newFolders);

        if (!textApiConfigured) {
          addAssistantMessage(
            t("system.addedFolderCount")
              .replace("{count}", String(newFolders.length))
              .replace("{list}", indexList) +
              "\n\n" +
              t("system.textModelNotConfigured")
          );
        } else {
          addAssistantMessage(
            t("system.addedFolderCount")
              .replace("{count}", String(newFolders.length))
              .replace("{list}", indexList) +
              "\n\n" +
              t("system.continueAddAndAnalyze")
          );
        }

        return newFolders;
      } catch (error) {
        console.error("Failed to add folders:", error);
        addAssistantMessage(t("system.failedAddFolders").replace("{error}", String(error)));
        return [];
      } finally {
        const doneTs = Date.now();
        candidateKeys.forEach((k) => {
          inFlightPathsRef.current.delete(k);
          recentPathTsRef.current.set(k, doneTs);
        });
      }
    },
    [
      session?.folders,
      onAddFolders,
      updateFolders,
      textApiConfigured,
      addAssistantMessage,
      addUserMessage,
      onFoldersQueued,
    ]
  );

  const handleSelectFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: t("folder.selectTitle", "Select Folder"),
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

