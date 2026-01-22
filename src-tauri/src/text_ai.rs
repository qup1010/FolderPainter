use crate::config::{AIModelConfig, AppConfig};
use crate::error::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// OpenAI Chat Completions 请求结构
#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

/// OpenAI Chat Completions 响应结构
#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

/// 文件夹分析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderAnalysis {
    /// 文件夹路径
    pub folder_path: String,
    /// 文件夹名称
    pub folder_name: String,
    /// AI 分析的类别/主题
    pub category: String,
    /// 纯净的视觉主体 (不包含风格、材质、光影，仅描述"是什么")
    pub visual_subject: String,
    /// 建议的完整提示词 (默认风格 + 视觉主体，用于兼容直接生成)
    pub suggested_prompt: String,
    /// 分析摘要
    pub summary: String,
}

/// 文本 AI 客户端 (用于智能分析)
pub struct TextAIClient {
    http_client: &'static Client,
}

impl TextAIClient {
    pub fn new() -> Self {
        Self {
            http_client: crate::ai_client::get_http_client(),
        }
    }

    /// 分析文件夹内容并生成图标建议
    pub async fn analyze_folder(
        &self,
        config: &AIModelConfig,
        folder_path: &str,
        folder_name: &str,
        file_list: &[String],
    ) -> Result<FolderAnalysis, AppError> {
        let api_key = config.api_key.as_deref();
        let endpoint = &config.endpoint;
        let model = &config.model;

        if endpoint.is_empty() {
            return Err(AppError::Config("文本模型未配置 Endpoint".to_string()));
        }

        // 构建文件列表摘要 (限制数量避免 token 过多)
        let files_summary: String = file_list
            .iter()
            .take(50)
            .map(|f| format!("- {}", f))
            .collect::<Vec<_>>()
            .join("\n");

        let system_prompt = crate::prompts::TEXT_AI_ANALYSIS_PROMPT;

        let user_prompt = format!(
            "文件夹名称: {}\n\n文件夹内容:\n{}",
            folder_name,
            if files_summary.is_empty() {
                "(空文件夹)".to_string()
            } else {
                files_summary
            }
        );

        let request = ChatRequest {
            model: model.to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 0.5,
        };

        // endpoint is the full URL
        let url = endpoint;

        let mut request_builder = self.http_client.post(url);

        if let Some(key) = api_key {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", key));
        }

        let response = request_builder
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(AppError::Network)?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("文本模型 API 错误: {}", error_text)));
        }

        let chat_response: ChatResponse = response.json().await.map_err(AppError::Network)?;

        let content = chat_response
            .choices
            .first()
            .ok_or(AppError::Ai("未返回结果".to_string()))?
            .message
            .content
            .clone();

        // 解析 JSON 响应
        self.parse_analysis_response(folder_path, folder_name, &content)
    }

    /// 解析 AI 返回的 JSON 分析结果
    fn parse_analysis_response(
        &self,
        folder_path: &str,
        folder_name: &str,
        content: &str,
    ) -> Result<FolderAnalysis, AppError> {
        // 尝试提取 JSON (可能被包裹在 markdown 代码块中)
        let json_str = if content.contains("```json") {
            content
                .split("```json")
                .nth(1)
                .and_then(|s| s.split("```").next())
                .unwrap_or(content)
                .trim()
        } else if content.contains("```") {
            content.split("```").nth(1).unwrap_or(content).trim()
        } else {
            content.trim()
        };

        #[derive(Deserialize)]
        struct AIResponse {
            category: String,
            visual_subject: String,
            summary: String,
        }

        let parsed: AIResponse = serde_json::from_str(json_str).map_err(AppError::Json)?;

        // 在这里进行"默认风格组装"，保持向下兼容
        // 默认风格: 现代 3D 图标
        let default_prompt = format!(
            "A folder icon of {}, 3d render style, claymorphism, highly detailed, single centered object, isolated on a solid white background, no cutoff, full view",
            parsed.visual_subject
        );

        Ok(FolderAnalysis {
            folder_path: folder_path.to_string(),
            folder_name: folder_name.to_string(),
            category: parsed.category,
            visual_subject: parsed.visual_subject,
            suggested_prompt: default_prompt,
            summary: parsed.summary,
        })
    }

    /// 批量分析多个文件夹
    pub async fn analyze_folders(
        &self,
        config: &AIModelConfig,
        folders: Vec<(String, String, Vec<String>)>, // (path, name, files)
    ) -> Vec<Result<FolderAnalysis, String>> {
        // Note: keeping return type as Result<..., String> inside the Vec for now
        // because ChatAgent might expect strings in error list?
        // Actually ChatAgent probably pushes errors to a Vec<String>.
        // Let's coerce AppError to String here for the Vec result to minimize ripple effect on ChatAgent logic if strict.
        let mut results = Vec::new();

        for (path, name, files) in folders {
            let result = self
                .analyze_folder(config, &path, &name, &files)
                .await
                .map_err(|e| e.to_string());
            results.push(result);
        }

        results
    }
    /// 根据用户指令优化/修改提示词
    pub async fn refine_prompt(
        &self,
        config: &AIModelConfig,
        current_prompt: &str,
        user_instruction: &str,
    ) -> Result<String, AppError> {
        let api_key = config.api_key.as_deref();
        let endpoint = &config.endpoint;
        let model = &config.model;

        if endpoint.is_empty() {
            return Err(AppError::Config("文本模型未配置 Endpoint".to_string()));
        }

        let system_prompt = crate::prompts::TEXT_AI_REFINE_PROMPT;

        let user_prompt = format!(
            "Current Prompt: {}\nUser Instruction: {}",
            current_prompt, user_instruction
        );

        let request = ChatRequest {
            model: model.to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_prompt,
                },
            ],
            temperature: 0.3, // 低温以保证稳定
        };

        let url = endpoint;
        let mut request_builder = self.http_client.post(url);

        if let Some(key) = api_key {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", key));
        }

        let response = request_builder
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(AppError::Network)?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Ai(format!("文本模型 API 错误: {}", error_text)));
        }

        let chat_response: ChatResponse = response.json().await.map_err(AppError::Network)?;

        let refined_prompt = chat_response
            .choices
            .first()
            .ok_or(AppError::Ai("未返回结果".to_string()))?
            .message
            .content
            .clone();

        Ok(refined_prompt.trim().to_string())
    }
}

// ============ Tauri Commands ============

/// 分析单个文件夹
#[tauri::command]
pub async fn analyze_folder_content(folder_path: String) -> Result<FolderAnalysis, AppError> {
    let config = AppConfig::load().map_err(|e| AppError::Config(e.to_string()))?;

    if !config.text_model.is_configured() {
        return Err(AppError::Config(
            "请先配置文本模型 (Endpoint 和 Model)".to_string(),
        ));
    }

    // 获取文件夹名称
    let folder_name = std::path::Path::new(&folder_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "未知文件夹".to_string());

    // 扫描文件夹内容
    let files = scan_folder_files(&folder_path, 2)?; // 扫描 2 层深度

    let client = TextAIClient::new();
    client
        .analyze_folder(&config.text_model, &folder_path, &folder_name, &files)
        .await
}

/// 批量分析多个文件夹
#[tauri::command]
pub async fn analyze_multiple_folders(
    folder_paths: Vec<String>,
) -> Result<Vec<FolderAnalysis>, AppError> {
    let config = AppConfig::load().map_err(|e| AppError::Config(e.to_string()))?;

    if !config.text_model.is_configured() {
        return Err(AppError::Config(
            "请先配置文本模型 (Endpoint 和 Model)".to_string(),
        ));
    }

    let client = TextAIClient::new();
    let mut analyses = Vec::new();
    let mut errors = Vec::new();

    for path in &folder_paths {
        let folder_name = std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "未知文件夹".to_string());

        let files = scan_folder_files(path, 2).unwrap_or_default();

        match client
            .analyze_folder(&config.text_model, path, &folder_name, &files)
            .await
        {
            Ok(analysis) => analyses.push(analysis),
            Err(e) => {
                eprintln!("分析失败 [{}]: {}", folder_name, e);
                errors.push(format!("{}: {}", folder_name, e));
            }
        }
    }

    // 如果全部失败，返回错误
    if analyses.is_empty() && !errors.is_empty() {
        return Err(AppError::Ai(format!("分析失败: {}", errors.join("; "))));
    }

    Ok(analyses)
}

/// 优化提示词 (根据用户对话)
#[tauri::command]
pub async fn refine_prompt_with_ai(
    current_prompt: String,
    user_instruction: String,
) -> Result<String, AppError> {
    let config = AppConfig::load().map_err(|e| AppError::Config(e.to_string()))?;

    if !config.text_model.is_configured() {
        // 如果没有配置文本模型，直接返回原提示词（或者简单的拼接，防止报错）
        return Ok(current_prompt);
    }

    let client = TextAIClient::new();
    client
        .refine_prompt(&config.text_model, &current_prompt, &user_instruction)
        .await
}

/// 扫描文件夹内的文件列表（树形结构输出）
pub fn scan_folder_files(folder_path: &str, max_depth: u32) -> Result<Vec<String>, AppError> {
    use std::path::Path;

    let folder = Path::new(folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("文件夹不存在: {}", folder_path),
        )));
    }

    let mut output = Vec::new();
    let mut total_count = 0;
    scan_tree(folder, &mut output, &mut total_count, 0, max_depth, "").map_err(AppError::Io)?;

    Ok(output)
}

/// 树形结构扫描（带缩进）
fn scan_tree(
    dir: &std::path::Path,
    output: &mut Vec<String>,
    total_count: &mut usize,
    current_depth: u32,
    max_depth: u32,
    prefix: &str,
) -> std::io::Result<()> {
    use std::fs;

    // 防止输出过多
    const MAX_TOTAL_ITEMS: usize = 80;
    const MAX_ITEMS_PER_DIR: usize = 8;

    if current_depth > max_depth || *total_count >= MAX_TOTAL_ITEMS {
        return Ok(());
    }

    // 收集并排序条目（目录优先）
    let mut entries: Vec<_> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            // 跳过隐藏文件和系统文件
            !name.starts_with('.') && name != "desktop.ini" && name != "icon.ico"
        })
        .collect();

    // 排序：目录在前，文件在后
    entries.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    let total_entries = entries.len();
    let show_count = total_entries.min(MAX_ITEMS_PER_DIR);
    let hidden_count = total_entries.saturating_sub(MAX_ITEMS_PER_DIR);

    for (i, entry) in entries.iter().take(show_count).enumerate() {
        if *total_count >= MAX_TOTAL_ITEMS {
            output.push(format!("{}... (已达上限)", prefix));
            break;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_last = i == show_count - 1 && hidden_count == 0;
        let connector = if is_last { "└─" } else { "├─" };
        let child_prefix = if is_last {
            format!("{}   ", prefix)
        } else {
            format!("{}│  ", prefix)
        };

        if path.is_dir() {
            output.push(format!("{}{}📁 {}/", prefix, connector, name));
            *total_count += 1;

            // 递归扫描子目录
            if current_depth < max_depth {
                scan_tree(
                    &path,
                    output,
                    total_count,
                    current_depth + 1,
                    max_depth,
                    &child_prefix,
                )?;
            }
        } else {
            output.push(format!("{}{} {}", prefix, connector, name));
            *total_count += 1;
        }
    }

    // 显示隐藏的条目数量
    if hidden_count > 0 {
        output.push(format!("{}└─ ... (还有 {} 项)", prefix, hidden_count));
        *total_count += 1;
    }

    Ok(())
}
