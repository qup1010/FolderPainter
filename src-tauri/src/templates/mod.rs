//! 模板管理模块
//!
//! 管理图标生成的模板，包含封面图、描述和提示词

pub mod store;

use serde::{Deserialize, Serialize};

/// 模板数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IconTemplate {
    /// 模板唯一 ID
    pub id: i64,
    /// 预设 ID (内置模板用于多语言和封面图查找，如 "3d_clay")
    pub preset_id: Option<String>,
    /// 模板名称
    pub name: String,
    /// 模板描述
    pub description: String,
    /// 提示词 (用于 AI 生成)
    pub prompt: String,
    /// 封面图 (base64 编码，用户模板使用)
    pub cover_image: Option<String>,
    /// 分类 ID (内置模板使用 ID 如 "3d_style"，用户模板使用自定义名称)
    pub category: String,
    /// 是否为内置模板
    pub is_builtin: bool,
    /// 创建时间
    pub created_at: String,
    /// 更新时间
    pub updated_at: String,
}

/// 创建模板的请求数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: String,
    pub prompt: String,
    pub cover_image: Option<String>,
    pub category: String,
}

/// 更新模板的请求数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub prompt: Option<String>,
    pub cover_image: Option<String>,
    pub category: Option<String>,
}

/// 导出用的模板数据 (不包含 id 和时间戳)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableTemplate {
    pub name: String,
    pub description: String,
    pub prompt: String,
    pub cover_image: Option<String>,
    pub category: String,
}

/// 导出文件格式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateExportData {
    /// 版本号，用于未来兼容性
    pub version: u32,
    /// 导出时间
    pub exported_at: String,
    /// 模板列表
    pub templates: Vec<ExportableTemplate>,
}

impl From<&IconTemplate> for ExportableTemplate {
    fn from(t: &IconTemplate) -> Self {
        Self {
            name: t.name.clone(),
            description: t.description.clone(),
            prompt: t.prompt.clone(),
            cover_image: t.cover_image.clone(),
            category: t.category.clone(),
        }
    }
}

// ============ Tauri Commands ============

use store::TemplateStore;

/// 获取所有模板
#[tauri::command]
pub async fn list_templates() -> Result<Vec<IconTemplate>, String> {
    let store = TemplateStore::new()?;
    store.list_templates()
}

/// 获取单个模板
#[tauri::command]
pub async fn get_template(template_id: i64) -> Result<IconTemplate, String> {
    let store = TemplateStore::new()?;
    store.get_template(template_id)
}

/// 创建新模板
#[tauri::command]
pub async fn create_template(request: CreateTemplateRequest) -> Result<IconTemplate, String> {
    let store = TemplateStore::new()?;
    store.create_template(&request)
}

/// 更新模板
#[tauri::command]
pub async fn update_template(
    template_id: i64,
    request: UpdateTemplateRequest,
) -> Result<IconTemplate, String> {
    let store = TemplateStore::new()?;
    store.update_template(template_id, &request)
}

/// 删除模板
#[tauri::command]
pub async fn delete_template(template_id: i64) -> Result<(), String> {
    let store = TemplateStore::new()?;
    store.delete_template(template_id)
}

/// 按分类获取模板
#[tauri::command]
pub async fn list_templates_by_category(category: String) -> Result<Vec<IconTemplate>, String> {
    let store = TemplateStore::new()?;
    store.list_templates_by_category(&category)
}

/// 获取所有分类
#[tauri::command]
pub async fn list_template_categories() -> Result<Vec<String>, String> {
    let store = TemplateStore::new()?;
    store.list_categories()
}

/// 重命名分类
#[tauri::command]
pub async fn rename_template_category(old_name: String, new_name: String) -> Result<(), String> {
    let store = TemplateStore::new()?;
    store.rename_category(&old_name, &new_name)
}

/// 删除分类
#[tauri::command]
pub async fn delete_template_category(category: String) -> Result<(), String> {
    let store = TemplateStore::new()?;
    store.delete_category_by_name(&category)
}

/// 导出用户模板 (不包括内置模板)
#[tauri::command]
pub async fn export_user_templates() -> Result<TemplateExportData, String> {
    let store = TemplateStore::new()?;
    let all_templates = store.list_templates()?;

    // 只导出非内置模板
    let user_templates: Vec<ExportableTemplate> = all_templates
        .iter()
        .filter(|t| !t.is_builtin)
        .map(ExportableTemplate::from)
        .collect();

    Ok(TemplateExportData {
        version: 1,
        exported_at: chrono_now(),
        templates: user_templates,
    })
}

/// 导入模板
#[tauri::command]
pub async fn import_templates(data: TemplateExportData) -> Result<ImportResult, String> {
    let store = TemplateStore::new()?;

    let mut imported = 0;
    let mut skipped = 0;

    for template in data.templates {
        // 检查是否已存在同名模板
        let existing = store.list_templates()?;
        let exists = existing.iter().any(|t| t.name == template.name && !t.is_builtin);

        if exists {
            skipped += 1;
            continue;
        }

        let request = CreateTemplateRequest {
            name: template.name,
            description: template.description,
            prompt: template.prompt,
            cover_image: template.cover_image,
            category: template.category,
        };

        store.create_template(&request)?;
        imported += 1;
    }

    Ok(ImportResult { imported, skipped })
}

/// 导入结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: u32,
    pub skipped: u32,
}

/// 获取当前时间字符串
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    format!("{}", secs)
}
