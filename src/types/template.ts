/**
 * 模板类型定义
 */

export interface IconTemplate {
  id: number;
  /** 预设 ID (内置模板用于多语言和封面图查找，如 "3d_clay") */
  presetId?: string;
  name: string;
  description: string;
  prompt: string;
  coverImage?: string;
  /** 分类 ID (内置模板使用 ID 如 "3d_style"，用户模板使用自定义名称) */
  category: string;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  prompt: string;
  coverImage?: string;
  category: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  prompt?: string;
  coverImage?: string;
  category?: string;
}
