/**
 * 模板工具函数
 * 处理内置模板的多语言显示和封面图加载
 */

import type { IconTemplate } from '../types/template';

// 直接导入封面图资源 - 确保 Vite 正确处理和打包
import cover_3d_clay from '/template-covers/3d_clay.webp?url';
import cover_glassmorphism from '/template-covers/glassmorphism.webp?url';
import cover_cyberpunk from '/template-covers/cyberpunk.webp?url';
import cover_low_poly from '/template-covers/low_poly.webp?url';
import cover_paper_cut from '/template-covers/paper_cut.webp?url';
import cover_pixel_art from '/template-covers/pixel_art.webp?url';
import cover_watercolor from '/template-covers/watercolor.webp?url';
import cover_minimalist_line from '/template-covers/minimalist_line.webp?url';
import cover_ukiyo_e from '/template-covers/ukiyo_e.webp?url';
import cover_vaporwave from '/template-covers/vaporwave.webp?url';
import cover_industrial_metal from '/template-covers/industrial_metal.webp?url';
import cover_pop_art from '/template-covers/pop_art.webp?url';

// 预设模板封面图映射 (preset_id -> 导入的图片URL)
const PRESET_COVERS: Record<string, string> = {
  '3d_clay': cover_3d_clay,
  'glassmorphism': cover_glassmorphism,
  'cyberpunk': cover_cyberpunk,
  'low_poly': cover_low_poly,
  'paper_cut': cover_paper_cut,
  'pixel_art': cover_pixel_art,
  'watercolor': cover_watercolor,
  'minimalist_line': cover_minimalist_line,
  'ukiyo_e': cover_ukiyo_e,
  'vaporwave': cover_vaporwave,
  'industrial_metal': cover_industrial_metal,
  'pop_art': cover_pop_art,
};

/**
 * 获取模板显示名称
 * 内置模板使用翻译，用户模板直接显示
 */
export function getTemplateName(
  template: IconTemplate,
  t: (key: string) => string
): string {
  if (template.isBuiltin && template.presetId) {
    const translated = t(`presetTemplates.${template.presetId}.name`);
    // 如果翻译键不存在，返回原始名称
    if (translated !== `presetTemplates.${template.presetId}.name`) {
      return translated;
    }
  }
  return template.name;
}

/**
 * 获取模板描述
 * 内置模板使用翻译，用户模板直接显示
 */
export function getTemplateDescription(
  template: IconTemplate,
  t: (key: string) => string
): string {
  if (template.isBuiltin && template.presetId) {
    const translated = t(`presetTemplates.${template.presetId}.desc`);
    // 如果翻译键不存在，返回原始描述
    if (translated !== `presetTemplates.${template.presetId}.desc`) {
      return translated;
    }
  }
  return template.description;
}

/**
 * 获取模板封面图
 * 内置模板使用预设资源，用户模板使用 base64
 */
export function getTemplateCover(template: IconTemplate): string | undefined {
  // 内置模板：优先使用预设封面图
  if (template.isBuiltin && template.presetId) {
    const presetCover = PRESET_COVERS[template.presetId];
    if (presetCover) {
      return presetCover;
    }
  }
  // 用户模板或无预设封面：使用数据库存储的 base64
  return template.coverImage;
}

/**
 * 获取分类显示名称
 * 预设分类使用翻译，用户自建分类直接显示
 */
export function getCategoryName(
  categoryId: string,
  t: (key: string) => string
): string {
  const translated = t(`templateCategories.${categoryId}`);
  // 如果翻译键不存在（返回原 key），说明是用户自建分类
  if (translated !== `templateCategories.${categoryId}`) {
    return translated;
  }
  return categoryId;
}

/**
 * 检查是否为预设分类
 */
export function isPresetCategory(categoryId: string): boolean {
  const presetCategories = [
    'general',
    '3d_style',
    'modern_ui',
    'scifi',
    'artistic',
    'retro',
    'realistic',
  ];
  return presetCategories.includes(categoryId);
}
