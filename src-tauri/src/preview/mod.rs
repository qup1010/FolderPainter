//! 预览会话模块
//!
//! 管理图标生成的预览会话，支持版本历史和审核流程

pub mod store;

use serde::{Deserialize, Serialize};

/// 会话状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Completed,
    Archived,
}

impl Default for SessionStatus {
    fn default() -> Self {
        Self::Active
    }
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Active => write!(f, "active"),
            Self::Completed => write!(f, "completed"),
            Self::Archived => write!(f, "archived"),
        }
    }
}

impl std::str::FromStr for SessionStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "active" => Ok(Self::Active),
            "completed" => Ok(Self::Completed),
            "archived" => Ok(Self::Archived),
            _ => Err(format!("未知状态: {}", s)),
        }
    }
}

/// 版本状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum VersionStatus {
    Generating,
    Ready,
    Error,
}

impl Default for VersionStatus {
    fn default() -> Self {
        Self::Ready
    }
}

impl std::fmt::Display for VersionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Generating => write!(f, "generating"),
            Self::Ready => write!(f, "ready"),
            Self::Error => write!(f, "error"),
        }
    }
}

impl std::str::FromStr for VersionStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "generating" => Ok(Self::Generating),
            "ready" => Ok(Self::Ready),
            "error" => Ok(Self::Error),
            _ => Err(format!("未知状态: {}", s)),
        }
    }
}

/// 预览会话
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSession {
    pub id: String,
    pub folders: Vec<FolderPreview>,
    pub status: SessionStatus,
    pub chat_history: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 会话摘要 (用于列表显示)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: String,
    pub folder_count: i32,
    pub status: SessionStatus,
    pub created_at: String,
    pub updated_at: String,
}

/// 文件夹预览
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderPreview {
    pub id: i64,
    pub folder_path: String,
    pub folder_name: String,
    pub display_index: i32, // [1], [2], [3]
    pub versions: Vec<IconVersion>,
    pub current_version_id: Option<i64>,
}

/// 图标版本
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IconVersion {
    pub id: i64,
    pub version_number: i32,
    pub prompt: String,
    pub image_path: String,
    pub thumbnail_base64: Option<String>,
    pub status: VersionStatus,
    pub error_message: Option<String>,
    pub created_at: String,
}

// ============ Tauri Commands ============

use crate::ai_client::AIClient;
use crate::config::AppConfig;
use crate::error::AppError;
use store::PreviewStore;

/// 创建新的预览会话
#[tauri::command]
pub async fn create_preview_session(folder_paths: Vec<String>) -> Result<PreviewSession, AppError> {
    let store = PreviewStore::new()?;
    Ok(store.create_session(&folder_paths)?)
}

/// 加载现有会话
#[tauri::command]
pub async fn load_preview_session(session_id: String) -> Result<PreviewSession, AppError> {
    let store = PreviewStore::new()?;
    Ok(store.load_session(&session_id)?)
}

/// 获取活跃会话列表
#[tauri::command]
pub async fn list_active_sessions() -> Result<Vec<SessionSummary>, AppError> {
    let store = PreviewStore::new()?;
    Ok(store.list_sessions()?)
}

/// 删除会话
#[tauri::command]
pub async fn delete_preview_session(session_id: String) -> Result<(), AppError> {
    let store = PreviewStore::new()?;
    Ok(store.delete_session(&session_id)?)
}

/// 保存聊天历史到会话
#[tauri::command]
pub async fn save_session_chat(session_id: String, chat_json: String) -> Result<(), AppError> {
    let store = PreviewStore::new()?;
    Ok(store.save_chat_history(&session_id, &chat_json)?)
}

/// 添加文件夹到现有会话
#[tauri::command]
pub async fn add_folders_to_session(
    session_id: String,
    folder_paths: Vec<String>,
) -> Result<Vec<FolderPreview>, AppError> {
    let store = PreviewStore::new()?;
    Ok(store.add_folders(&session_id, &folder_paths)?)
}

/// 从会话移除文件夹
#[tauri::command]
pub async fn remove_folder_from_session(
    session_id: String,
    folder_path: String,
) -> Result<(), AppError> {
    let store = PreviewStore::new()?;
    store.remove_folder(&session_id, &folder_path)?;
    // 重新排序编号
    store.reindex_folders(&session_id)?;
    Ok(())
}

/// 为指定文件夹生成新版本图标
#[tauri::command]
pub async fn generate_preview_version(
    session_id: String,
    folder_path: String,
    prompt: String,
) -> Result<IconVersion, AppError> {
    let store = PreviewStore::new()?;

    // 获取文件夹信息
    let folder = store.get_folder(&session_id, &folder_path)?;

    // 计算新版本号
    let version_number = folder.versions.len() as i32 + 1;

    // 生成图像存储路径
    let image_path = store.get_version_image_path(&session_id, &folder_path, version_number)?;

    // 创建版本记录 (状态为 generating)
    let version_id = store.create_version(
        folder.id,
        version_number,
        &prompt,
        &image_path.to_string_lossy(),
        VersionStatus::Generating,
    )?;

    // 调用 AI 生成图像
    let config = AppConfig::load()?;
    if !config.is_image_model_configured() {
        store.update_version_status(
            version_id,
            VersionStatus::Error,
            Some("请先配置图像模型 API Key"),
        )?;
        return Err(AppError::Config("请先配置图像模型 API Key".to_string()));
    }

    let client = AIClient::new();
    match client
        .generate_icon_with_config(&config.image_model, &prompt)
        .await
    {
        Ok(image_bytes) => {
            // 保存图像（不再自动抠图，用户可在预览面板手动抠图）
            store.save_image(&image_path, &image_bytes)?;

            // 生成缩略图
            let thumbnail = store.generate_thumbnail(&image_bytes)?;

            // 更新版本状态
            store.update_version_with_thumbnail(version_id, VersionStatus::Ready, &thumbnail)?;

            // 设置为当前版本
            store.set_current_version(folder.id, version_id)?;

            // 返回完整版本信息
            Ok(store.get_version(version_id)?)
        }
        Err(e) => {
            store.update_version_status(version_id, VersionStatus::Error, Some(&e.to_string()))?;
            Err(e)
        }
    }
}

/// 删除指定版本
#[tauri::command]
pub async fn delete_preview_version(version_id: i64) -> Result<(), AppError> {
    let store = PreviewStore::new()?;
    Ok(store.delete_version(version_id)?)
}

/// 设置当前选中版本
#[tauri::command]
pub async fn set_current_version(folder_id: i64, version_id: i64) -> Result<(), AppError> {
    let store = PreviewStore::new()?;
    Ok(store.set_current_version(folder_id, version_id)?)
}

/// 应用单个文件夹的图标
#[tauri::command]
pub async fn apply_folder_preview(
    folder_path: String,
    version_id: i64,
) -> Result<String, AppError> {
    let store = PreviewStore::new()?;
    let version = store.get_version(version_id)?;

    // 读取预览图像
    let image_bytes = std::fs::read(&version.image_path).map_err(|e| AppError::Io(e))?;

    // 备份原始图标
    let history_manager = crate::history::HistoryManager::new()?;
    let backup_path = history_manager.backup_folder(&folder_path)?;

    // 生成 ICO 文件路径
    let folder = std::path::Path::new(&folder_path);
    let icon_path = folder.join("icon.ico");

    // 清除旧属性
    let _ = crate::windows_api::clear_attributes(&folder_path);
    if icon_path.exists() {
        let _ = crate::windows_api::clear_attributes(&icon_path.to_string_lossy());
    }

    // 转换为 ICO 并保存
    crate::icon_gen::create_icon_from_ai_image(&image_bytes, &icon_path.to_string_lossy())
        .map_err(|e| AppError::System(format!("图标转换失败: {}", e)))?;

    // 创建 desktop.ini
    crate::desktop_ini::create(&folder_path, "icon.ico")
        .map_err(|e| AppError::System(format!("创建 desktop.ini 失败: {}", e)))?;

    // 设置文件属性
    let ini_path = folder.join("desktop.ini");
    crate::windows_api::set_hidden_system(&ini_path.to_string_lossy())
        .map_err(|e| AppError::System(format!("设置属性失败: {}", e)))?;
    crate::windows_api::set_folder_readonly(&folder_path)
        .map_err(|e| AppError::System(format!("设置只读失败: {}", e)))?;

    // 通知 Shell 刷新
    crate::windows_api::notify_shell_update(&folder_path)
        .map_err(|e| AppError::System(format!("刷新 Shell 失败: {}", e)))?;

    // 记录历史
    history_manager.add_entry(
        &folder_path,
        "ai_preview",
        &version.prompt,
        backup_path.as_deref(),
    )?;

    Ok(format!("已应用图标到: {}", folder_path))
}

/// 应用所有文件夹的当前选中图标
#[tauri::command]
pub async fn apply_all_previews(session_id: String) -> Result<Vec<String>, AppError> {
    let store = PreviewStore::new()?;
    let session = store.load_session(&session_id)?;

    let mut results = Vec::new();

    for folder in session.folders {
        if let Some(version_id) = folder.current_version_id {
            match apply_folder_preview(folder.folder_path.clone(), version_id).await {
                Ok(msg) => results.push(msg),
                Err(e) => results.push(format!("失败 [{}]: {}", folder.folder_name, e)),
            }
        } else {
            results.push(format!("跳过 [{}]: 没有选中的版本", folder.folder_name));
        }
    }

    // 标记会话为已完成
    store.update_session_status(&session_id, SessionStatus::Completed)?;

    Ok(results)
}

/// 对指定版本执行背景移除，创建新版本
#[tauri::command]
pub async fn remove_background_for_version(
    session_id: String,
    folder_path: String,
    version_id: i64,
) -> Result<IconVersion, AppError> {
    let config = AppConfig::load()?;

    // 检查抠图功能是否启用
    if !config.bg_removal.enabled {
        return Err(AppError::Config("请先在设置中开启背景移除功能".to_string()));
    }

    let store = PreviewStore::new()?;

    // 获取原版本信息
    let original_version = store.get_version(version_id)?;

    // 读取原版本图像
    let image_bytes = std::fs::read(&original_version.image_path)
        .map_err(|e| AppError::Io(e))?;

    // 执行背景移除
    eprintln!("[Preview] 对版本 {} 执行背景移除...", version_id);
    let processed_bytes = crate::bg_removal::BgRemovalClient::remove_background(
        &config.bg_removal,
        &image_bytes,
    )
    .await?;

    // 获取文件夹信息
    let folder = store.get_folder(&session_id, &folder_path)?;

    // 计算新版本号
    let version_number = folder.versions.len() as i32 + 1;

    // 生成图像存储路径
    let image_path = store.get_version_image_path(&session_id, &folder_path, version_number)?;

    // 保存处理后的图像
    store.save_image(&image_path, &processed_bytes)?;

    // 生成缩略图
    let thumbnail = store.generate_thumbnail(&processed_bytes)?;

    // 创建新版本记录
    let new_prompt = format!("{} (已抠图)", original_version.prompt);
    let new_version_id = store.create_version(
        folder.id,
        version_number,
        &new_prompt,
        &image_path.to_string_lossy(),
        VersionStatus::Ready,
    )?;

    // 更新缩略图
    store.update_version_with_thumbnail(new_version_id, VersionStatus::Ready, &thumbnail)?;

    // 设置为当前版本
    store.set_current_version(folder.id, new_version_id)?;

    eprintln!("[Preview] 背景移除完成，新版本 ID: {}", new_version_id);

    // 返回完整版本信息
    Ok(store.get_version(new_version_id)?)
}

/// 批量对所有文件夹的当前版本执行背景移除
#[tauri::command]
pub async fn remove_background_all(session_id: String) -> Result<Vec<String>, AppError> {
    let config = AppConfig::load()?;

    // 检查抠图功能是否启用
    if !config.bg_removal.enabled {
        return Err(AppError::Config("请先在设置中开启背景移除功能".to_string()));
    }

    let store = PreviewStore::new()?;
    let session = store.load_session(&session_id)?;

    let mut results = Vec::new();

    for folder in session.folders {
        if let Some(version_id) = folder.current_version_id {
            match remove_background_for_version(
                session_id.clone(),
                folder.folder_path.clone(),
                version_id,
            )
            .await
            {
                Ok(new_version) => {
                    results.push(format!(
                        "✅ [{}] {} 抠图成功 (v{})",
                        folder.display_index, folder.folder_name, new_version.version_number
                    ));
                }
                Err(e) => {
                    results.push(format!(
                        "❌ [{}] {} 抠图失败: {}",
                        folder.display_index, folder.folder_name, e
                    ));
                }
            }
        } else {
            results.push(format!(
                "⏭️ [{}] {} 跳过: 没有选中的版本",
                folder.display_index, folder.folder_name
            ));
        }
    }

    Ok(results)
}
