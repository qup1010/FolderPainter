/**
 * 模板管理 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { IconTemplate, CreateTemplateRequest, UpdateTemplateRequest } from '../types/template';

export function useTemplates() {
  const [templates, setTemplates] = useState<IconTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载所有模板
  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<IconTemplate[]>('list_templates');
      setTemplates(result);
    } catch (e) {
      setError(e as string);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载分类
  const loadCategories = useCallback(async () => {
    try {
      const result = await invoke<string[]>('list_template_categories');
      setCategories(result);
    } catch (e) {
      console.error('加载分类失败:', e);
    }
  }, []);

  // 按分类筛选模板
  const loadTemplatesByCategory = useCallback(async (category: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<IconTemplate[]>('list_templates_by_category', { category });
      setTemplates(result);
      setSelectedCategory(category);
    } catch (e) {
      setError(e as string);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 创建模板
  const createTemplate = useCallback(async (request: CreateTemplateRequest): Promise<IconTemplate> => {
    const result = await invoke<IconTemplate>('create_template', { request });
    await loadTemplates(); // 刷新列表
    return result;
  }, [loadTemplates]);

  // 更新模板
  const updateTemplate = useCallback(async (
    templateId: number,
    request: UpdateTemplateRequest
  ): Promise<IconTemplate> => {
    const result = await invoke<IconTemplate>('update_template', {
      templateId,
      request,
    });
    await loadTemplates(); // 刷新列表
    return result;
  }, [loadTemplates]);

  // 删除模板
  const deleteTemplate = useCallback(async (templateId: number): Promise<void> => {
    await invoke<void>('delete_template', { templateId });
    await loadTemplates(); // 刷新列表
  }, [loadTemplates]);

  // 获取单个模板
  const getTemplate = useCallback(async (templateId: number): Promise<IconTemplate> => {
    return await invoke<IconTemplate>('get_template', { templateId });
  }, []);

  // 初始加载
  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, [loadTemplates, loadCategories]);

  // 清除分类筛选
  const clearCategoryFilter = useCallback(() => {
    setSelectedCategory(null);
    loadTemplates();
  }, [loadTemplates]);

  // 重命名分类
  const renameCategory = useCallback(async (oldName: string, newName: string): Promise<void> => {
    await invoke<void>('rename_template_category', { oldName, newName });
    await loadCategories();
    // 如果当前选中的是这个分类，刷新模板列表并保持选中状态（名字变了）
    if (selectedCategory === oldName) {
      setSelectedCategory(newName);
      await loadTemplatesByCategory(newName);
    } else {
      // 否则只刷新列表（可能该分类下有模板）
      if (selectedCategory) {
        await loadTemplatesByCategory(selectedCategory);
      } else {
        await loadTemplates();
      }
    }
  }, [selectedCategory, loadCategories, loadTemplatesByCategory, loadTemplates]);

  // 删除分类
  const deleteCategory = useCallback(async (category: string): Promise<void> => {
    await invoke<void>('delete_template_category', { category });
    await loadCategories();
    // 如果当前选中的是这个分类，清除选中状态并加载所有
    if (selectedCategory === category) {
      setSelectedCategory(null);
      await loadTemplates();
    } else {
      if (selectedCategory) {
        await loadTemplatesByCategory(selectedCategory);
      } else {
        await loadTemplates();
      }
    }
  }, [selectedCategory, loadCategories, loadTemplatesByCategory, loadTemplates]);

  return {
    templates,
    categories,
    selectedCategory,
    isLoading,
    error,
    loadTemplates,
    loadTemplatesByCategory,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    clearCategoryFilter,
    setError,
    renameCategory,
    deleteCategory,
  };
}
