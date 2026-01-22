/**
 * 全局状态管理 (Zustand)
 * 管理应用级别的状态，减少 props drilling
 */

import { create } from 'zustand';
import type { ChatMessageData } from '../ChatMessage';
import type { PreviewSession } from '../types/preview';

interface GenerationProgress {
    current: number;
    total: number;
}

interface AppConfig {
    parallelGeneration: boolean;
    concurrencyLimit: number;
}

interface AppState {
    // Session state
    session: PreviewSession | null;

    // Chat state
    messages: ChatMessageData[];

    // API config status
    apiConfigured: boolean;
    textApiConfigured: boolean;

    // Generation state
    isGenerating: boolean;
    generationProgress: GenerationProgress | null;

    // UI state
    showSettings: boolean;
    showTemplates: boolean;
    isDarkMode: boolean;

    // Config
    config: AppConfig;

    // Actions
    setSession: (session: PreviewSession | null) => void;
    addMessage: (message: ChatMessageData) => void;
    setMessages: (messages: ChatMessageData[]) => void;
    clearMessages: () => void;
    setApiConfigured: (configured: boolean) => void;
    setTextApiConfigured: (configured: boolean) => void;
    setIsGenerating: (generating: boolean) => void;
    setGenerationProgress: (progress: GenerationProgress | null) => void;
    setShowSettings: (show: boolean) => void;
    setShowTemplates: (show: boolean) => void;
    toggleDarkMode: () => void;
    setConfig: (config: Partial<AppConfig>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    // Initial state
    session: null,
    messages: [],
    apiConfigured: false,
    textApiConfigured: false,
    isGenerating: false,
    generationProgress: null,
    showSettings: false,
    showTemplates: false,
    isDarkMode: localStorage.getItem('darkMode') === 'true',
    config: {
        parallelGeneration: false,
        concurrencyLimit: 3,
    },

    // Actions
    setSession: (session) => set({ session }),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
    })),

    setMessages: (messages) => set({ messages }),

    clearMessages: () => set({ messages: [] }),

    setApiConfigured: (configured) => set({ apiConfigured: configured }),

    setTextApiConfigured: (configured) => set({ textApiConfigured: configured }),

    setIsGenerating: (generating) => set({ isGenerating: generating }),

    setGenerationProgress: (progress) => set({ generationProgress: progress }),

    setShowSettings: (show) => set({ showSettings: show }),

    setShowTemplates: (show) => set({ showTemplates: show }),

    toggleDarkMode: () => {
        const newMode = !get().isDarkMode;
        localStorage.setItem('darkMode', String(newMode));

        // 切换 DOM class
        if (newMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        set({ isDarkMode: newMode });
    },

    setConfig: (config) => set((state) => ({
        config: { ...state.config, ...config },
    })),
}));

// 初始化深色模式
if (typeof window !== 'undefined') {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) {
        document.documentElement.classList.add('dark');
    }
}
