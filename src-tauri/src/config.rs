use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 单个 AI 模型配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIModelConfig {
    /// Full API Endpoint URL (e.g. https://api.openai.com/v1/chat/completions)
    pub endpoint: String,
    /// API Key (Optional)
    pub api_key: Option<String>,
    /// 模型名称 (e.g. gpt-4o, dall-e-3)
    pub model: String,
    /// Image Size (e.g. 1024x1024). Only used for image models.
    #[serde(default = "default_size")]
    pub size: String,
    /// 是否使用自定义端点 (Deprecated: endpoint is always custom now)
    pub use_custom_endpoint: bool,
}

fn default_size() -> String {
    "1024x1024".to_string()
}

impl AIModelConfig {
    /// 检查是否已配置 (Endpoint 和 Model 必填，API Key 可选)
    pub fn is_configured(&self) -> bool {
        !self.endpoint.is_empty() && !self.model.is_empty()
    }
}

/// 默认配置 (全空，不预设 OpenAI)
impl Default for AIModelConfig {
    fn default() -> Self {
        Self {
            endpoint: "".to_string(),
            api_key: None,
            model: "".to_string(),
            size: "1024x1024".to_string(),
            use_custom_endpoint: true,
        }
    }
}

/// 图像模型默认配置
fn default_image_model() -> AIModelConfig {
    AIModelConfig::default()
}

/// 图标存储位置
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IconStorage {
    /// 存放在目标文件夹内
    InFolder,
    /// 集中存放在 AppData 下
    Centralized,
}

impl Default for IconStorage {
    fn default() -> Self {
        IconStorage::InFolder
    }
}

/// 模型预设配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPreset {
    /// 预设名称
    pub name: String,
    /// API Endpoint
    pub endpoint: String,
    /// API Key (可选)
    pub api_key: Option<String>,
    /// 模型名称
    pub model: String,
    /// 图像尺寸 (仅图像模型使用)
    #[serde(default)]
    pub size: Option<String>,
}

fn default_concurrency_limit() -> u8 {
    3
}

/// API 类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BgRemovalApiType {
    /// Hugging Face Inference API (直接发送二进制)
    InferenceApi,
    /// Hugging Face Space / Gradio API (发送 JSON)
    Gradio,
}

impl Default for BgRemovalApiType {
    fn default() -> Self {
        Self::Gradio
    }
}

/// 背景移除配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundRemovalConfig {
    /// 是否启用背景移除 (默认 false)
    #[serde(default)]
    pub enabled: bool,
    /// API 类型
    #[serde(default)]
    pub api_type: BgRemovalApiType,
    /// Hugging Face 模型 ID 或 Space URL
    /// API 类型为 InferenceApi 时，如 "briaai/RMBG-2.0"
    /// API 类型为 Gradio 时，如 "briaai/BRIA-RMBG-2.0"
    #[serde(default = "default_bg_removal_model")]
    pub model_id: String,
    /// Gradio 请求模板 (仅 Gradio 模式使用)
    /// 包含 {{IMAGE}} 占位符
    #[serde(default = "default_gradio_template")]
    pub payload_template: Option<String>,
    /// Hugging Face API Token (可选)
    #[serde(default)]
    pub api_token: Option<String>,
}

fn default_bg_removal_model() -> String {
    "briaai/BRIA-RMBG-2.0".to_string()
}

fn default_gradio_template() -> Option<String> {
    Some(r#"{"image": "{{IMAGE}}", "api_name": "/image"}"#.to_string())
}

impl Default for BackgroundRemovalConfig {
    fn default() -> Self {
        Self {
            enabled: true,  // 默认开启背景移除
            api_type: BgRemovalApiType::default(),
            model_id: default_bg_removal_model(),
            payload_template: default_gradio_template(),
            api_token: None,
        }
    }
}

/// 应用配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 文本模型配置 (用于智能分析)
    #[serde(default)]
    pub text_model: AIModelConfig,
    /// 图像模型配置 (用于生成图标)
    #[serde(default = "default_image_model")]
    pub image_model: AIModelConfig,
    /// 图标存储位置
    #[serde(default)]
    pub icon_storage: IconStorage,
    /// 文本模型预设列表
    #[serde(default)]
    pub text_presets: Vec<ModelPreset>,
    /// 图像模型预设列表
    #[serde(default)]
    pub image_presets: Vec<ModelPreset>,
    /// 是否启用并行生成
    #[serde(default)]
    pub parallel_generation: bool,
    /// 并行生成时的并发数限制
    #[serde(default = "default_concurrency_limit")]
    pub concurrency_limit: u8,
    /// 背景移除配置 (可选后处理)
    #[serde(default)]
    pub bg_removal: BackgroundRemovalConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            text_model: AIModelConfig::default(),
            image_model: default_image_model(),
            icon_storage: IconStorage::default(),
            text_presets: Vec::new(),
            image_presets: Vec::new(),
            parallel_generation: false,
            concurrency_limit: default_concurrency_limit(),
            bg_removal: BackgroundRemovalConfig::default(),
        }
    }
}

impl AppConfig {
    /// 获取配置文件路径
    fn config_path() -> Result<PathBuf, String> {
        let app_data = std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 路径".to_string())?;

        let config_dir = PathBuf::from(app_data).join("FolderPainter");

        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
        }

        Ok(config_dir.join("config.json"))
    }

    /// 加载配置
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()?;

        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path).map_err(|e| format!("读取配置文件失败: {}", e))?;

        serde_json::from_str(&content).map_err(|e| format!("解析配置文件失败: {}", e))
    }

    /// 保存配置
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()?;

        let content =
            serde_json::to_string_pretty(self).map_err(|e| format!("序列化配置失败: {}", e))?;

        fs::write(&path, content).map_err(|e| format!("写入配置文件失败: {}", e))?;

        Ok(())
    }

    /// 检查图像模型是否已配置
    pub fn is_image_model_configured(&self) -> bool {
        self.image_model.is_configured()
    }

    /// 检查文本模型是否已配置
    pub fn is_text_model_configured(&self) -> bool {
        self.text_model.is_configured()
    }
}

// ============ Tauri Commands ============

/// 获取当前配置
#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    AppConfig::load()
}

/// 保存配置
#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    config.save()
}

/// 检查 API 是否已配置 (图像模型)
#[tauri::command]
pub async fn is_api_configured() -> Result<bool, String> {
    let config = AppConfig::load()?;
    Ok(config.is_image_model_configured())
}

// 保留旧的命令以兼容，但标记为废弃
#[tauri::command]
pub async fn set_api_key(_provider: String, _api_key: String) -> Result<(), String> {
    Ok(()) // 不再使用，通过 save_config 保存
}

#[tauri::command]
pub async fn set_ai_provider(_provider: String) -> Result<(), String> {
    Ok(()) // 不再使用
}

// ============ 预设管理命令 ============

/// 保存模型预设
#[tauri::command]
pub async fn save_model_preset(preset_type: String, preset: ModelPreset) -> Result<(), String> {
    let mut config = AppConfig::load()?;

    let presets = match preset_type.as_str() {
        "text" => &mut config.text_presets,
        "image" => &mut config.image_presets,
        _ => return Err("无效的预设类型".to_string()),
    };

    // 如果已存在同名预设，则更新；否则添加
    if let Some(existing) = presets.iter_mut().find(|p| p.name == preset.name) {
        *existing = preset;
    } else {
        presets.push(preset);
    }

    config.save()
}

/// 删除模型预设
#[tauri::command]
pub async fn delete_model_preset(preset_type: String, name: String) -> Result<(), String> {
    let mut config = AppConfig::load()?;

    let presets = match preset_type.as_str() {
        "text" => &mut config.text_presets,
        "image" => &mut config.image_presets,
        _ => return Err("无效的预设类型".to_string()),
    };

    presets.retain(|p| p.name != name);
    config.save()
}

/// 获取模型预设列表
#[tauri::command]
pub async fn list_model_presets(preset_type: String) -> Result<Vec<ModelPreset>, String> {
    let config = AppConfig::load()?;

    match preset_type.as_str() {
        "text" => Ok(config.text_presets),
        "image" => Ok(config.image_presets),
        _ => Err("无效的预设类型".to_string()),
    }
}

// ============ 兼容旧配置的类型 ============
// 这些用于向后兼容，新代码不应使用

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AIProvider {
    OpenAI,
    Gemini,
}

impl Default for AIProvider {
    fn default() -> Self {
        AIProvider::OpenAI
    }
}
