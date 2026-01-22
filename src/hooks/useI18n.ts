/**
 * 简单的 i18n 实现
 * 支持中英文切换，默认中文
 */

import { useState, useEffect } from 'react';
import zhCN from '../locales/zh-CN.json';
import en from '../locales/en.json';

type LocaleKey = 'zh-CN' | 'en';

const locales: Record<LocaleKey, typeof zhCN> = {
    'zh-CN': zhCN,
    en: en,
};

// 事件监听器列表 - 用于在语言改变时通知所有订阅的组件
let listeners: Set<() => void> = new Set();

// 获取浏览器语言，默认中文
function getDefaultLocale(): LocaleKey {
    // 首先检查 localStorage 中是否有保存的语言设置
    const saved = localStorage.getItem('i18n_locale');
    if (saved === 'en' || saved === 'zh-CN') {
        return saved;
    }

    // 否则根据浏览器语言检测
    const browserLang = navigator.language;
    if (browserLang.startsWith('en')) {
        return 'en';
    }
    return 'zh-CN';
}

let currentLocale: LocaleKey = getDefaultLocale();

/**
 * 设置当前语言
 */
export function setLocale(locale: LocaleKey) {
    if (currentLocale !== locale) {
        currentLocale = locale;
        // 保存到 localStorage 以便下次使用
        localStorage.setItem('i18n_locale', locale);
        // 通知所有监听器
        listeners.forEach(listener => listener());
    }
}

/**
 * 获取当前语言
 */
export function getLocale(): LocaleKey {
    return currentLocale;
}

/**
 * 获取翻译文本
 * @param key 点分隔的 key，如 "chat.clearButton"
 * @param fallback 找不到时的回退值
 */
export function t(key: string, fallback?: string): string {
    const keys = key.split('.');
    let value: any = locales[currentLocale];

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return fallback || key;
        }
    }

    return typeof value === 'string' ? value : fallback || key;
}

/**
 * 自定义 hook：在语言改变时自动更新组件
 */
export function useI18n() {
    const [, setLocaleState] = useState(currentLocale);

    useEffect(() => {
        // 添加监听器
        const listener = () => {
            setLocaleState(currentLocale);
        };
        listeners.add(listener);

        // 清理
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return {
        locale: currentLocale,
        t,
        setLocale,
    };
}

/**
 * React Hook 版本 (简单实现，不触发重渲染)
 */
export function useTranslation() {
    return { t, locale: currentLocale, setLocale };
}
