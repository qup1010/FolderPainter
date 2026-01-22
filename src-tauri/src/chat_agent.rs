//! 聊天代理模块
//! 实现 LLM 智能工具调用交互架构

use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::config::{AIModelConfig, AppConfig};
use crate::error::AppError;
use crate::text_ai::{scan_folder_files, TextAIClient};

// ============ 数据结构 ============

/// 工具调用
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub name: String,
    pub params: Value,
}

/// Agent 响应 (LLM 返回的结构)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub response: String,
    pub tools: Vec<ToolCall>,
}

/// 工具执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResult {
    pub tool_name: String,
    pub success: bool,
    pub data: Option<Value>,
    pub error: Option<String>,
}

/// 会话上下文中的文件夹信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderContext {
    pub index: usize,
    pub path: String,
    pub name: String,
    pub prompt: Option<String>,
    pub has_icon: bool,
}

/// 聊天上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub folders: Vec<FolderContext>,
    pub prompts: HashMap<String, String>, // folder_path -> prompt
}

impl Default for ChatContext {
    fn default() -> Self {
        Self {
            folders: Vec::new(),
            prompts: HashMap::new(),
        }
    }
}

/// Agent 处理结果 (返回给前端)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProcessResult {
    /// LLM 的自然语言回复
    pub response: String,
    /// 工具执行结果列表
    pub tool_results: Vec<ToolResult>,
    /// 更新后的提示词映射
    pub updated_prompts: HashMap<String, String>,
}

// ============ 聊天代理 ============

/// 聊天代理
pub struct ChatAgent {
    http_client: &'static Client,
    text_ai: TextAIClient,
}

impl ChatAgent {
    pub fn new() -> Self {
        Self {
            http_client: crate::ai_client::get_http_client(),
            text_ai: TextAIClient::new(),
        }
    }

    /// 构建工具定义的 System Prompt
    fn build_system_prompt(&self, context: &ChatContext) -> String {
        let folders_desc = if context.folders.is_empty() {
            "当前没有文件夹。".to_string()
        } else {
            let list: Vec<String> = context
                .folders
                .iter()
                .map(|f| {
                    let prompt_info = context
                        .prompts
                        .get(&f.path)
                        .map(|p| format!(", 提示词: \"{}\"", p))
                        .unwrap_or_default();
                    format!("[{}] {} ({}{})", f.index, f.name, f.path, prompt_info)
                })
                .collect();
            format!("当前文件夹列表:\n{}", list.join("\n"))
        };

        crate::prompts::AGENT_SYSTEM_PROMPT_TEMPLATE.replace("{}", &folders_desc)
    }

    /// 调用 LLM 获取工具调用决策
    async fn call_llm(
        &self,
        config: &AIModelConfig,
        system_prompt: &str,
        user_message: &str,
    ) -> Result<AgentResponse, AppError> {
        if config.endpoint.is_empty() {
            return Err(AppError::Config("文本模型未配置 Endpoint".to_string()));
        }

        #[derive(Serialize)]
        struct ChatMessage {
            role: String,
            content: String,
        }

        #[derive(Serialize)]
        struct ChatRequest {
            model: String,
            messages: Vec<ChatMessage>,
            max_tokens: u32,
            temperature: f32,
        }

        #[derive(Deserialize)]
        struct ChatChoice {
            message: ChatMessageResponse,
        }

        #[derive(Deserialize)]
        struct ChatMessageResponse {
            content: String,
        }

        #[derive(Deserialize)]
        struct ChatResponse {
            choices: Vec<ChatChoice>,
        }

        let request = ChatRequest {
            model: config.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_message.to_string(),
                },
            ],
            max_tokens: 2000,
            temperature: 0.3,
        };

        let mut request_builder = self.http_client.post(&config.endpoint);

        if let Some(key) = &config.api_key {
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
            return Err(AppError::Ai(format!("API 错误: {}", error_text)));
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
        self.parse_agent_response(&content)
    }

    /// 解析 LLM 返回的 Agent 响应
    fn parse_agent_response(&self, content: &str) -> Result<AgentResponse, AppError> {
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

        serde_json::from_str(json_str).map_err(|e| {
            AppError::Json(e)
            // format!(
            //     "解析 Agent 响应失败: {} - 原始内容: {}",
            //     e,
            //     &content[..content.len().min(500)]
            // )
        })
    }

    /// 执行单个工具
    async fn execute_tool(
        &self,
        tool: &ToolCall,
        context: &mut ChatContext,
        config: &AppConfig,
    ) -> ToolResult {
        match tool.name.as_str() {
            "analyze_folders" => self.tool_analyze_folders(tool, context, config).await,
            "show_prompts" => self.tool_show_prompts(context),
            "update_prompt" => self.tool_update_prompt(tool, context, config).await,
            "generate_icons" => self.tool_generate_icons(tool, context),
            "apply_icons" => self.tool_apply_icons(tool, context),
            _ => ToolResult {
                tool_name: tool.name.clone(),
                success: false,
                data: None,
                error: Some(format!("未知工具: {}", tool.name)),
            },
        }
    }

    /// 工具: 分析文件夹
    async fn tool_analyze_folders(
        &self,
        tool: &ToolCall,
        context: &mut ChatContext,
        config: &AppConfig,
    ) -> ToolResult {
        // 获取要分析的文件夹索引
        let folder_indices: Vec<usize> = tool
            .params
            .get("folder_indices")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        // 确定要分析的文件夹
        let target_folders: Vec<&FolderContext> = if folder_indices.is_empty() {
            context.folders.iter().collect()
        } else {
            context
                .folders
                .iter()
                .filter(|f| folder_indices.contains(&f.index))
                .collect()
        };

        if target_folders.is_empty() {
            return ToolResult {
                tool_name: "analyze_folders".to_string(),
                success: false,
                data: None,
                error: Some("没有找到要分析的文件夹".to_string()),
            };
        }

        let mut results: Vec<Value> = Vec::new();
        let mut errors: Vec<String> = Vec::new();

        for folder in target_folders {
            // 扫描文件夹内容
            let files = scan_folder_files(&folder.path, 2)
                .map_err(|e| e.to_string())
                .unwrap_or_default();

            match self
                .text_ai
                .analyze_folder(&config.text_model, &folder.path, &folder.name, &files)
                .await
            {
                Ok(analysis) => {
                    // 保存提示词到上下文
                    context
                        .prompts
                        .insert(folder.path.clone(), analysis.suggested_prompt.clone());

                    results.push(json!({
                        "folder_index": folder.index,
                        "folder_name": folder.name,
                        "folder_path": folder.path,
                        "category": analysis.category,
                        "visual_subject": analysis.visual_subject,
                        "suggested_prompt": analysis.suggested_prompt,
                        "summary": analysis.summary,
                    }));
                }
                Err(e) => {
                    errors.push(format!("[{}] {}: {}", folder.index, folder.name, e));
                }
            }
        }

        if results.is_empty() && !errors.is_empty() {
            return ToolResult {
                tool_name: "analyze_folders".to_string(),
                success: false,
                data: None,
                error: Some(errors.join("; ")),
            };
        }

        ToolResult {
            tool_name: "analyze_folders".to_string(),
            success: true,
            data: Some(json!({
                "analyses": results,
                "errors": errors,
            })),
            error: None,
        }
    }

    /// 工具: 展示提示词
    fn tool_show_prompts(&self, context: &ChatContext) -> ToolResult {
        let prompts: Vec<Value> = context
            .folders
            .iter()
            .map(|f| {
                json!({
                    "folder_index": f.index,
                    "folder_name": f.name,
                    "folder_path": f.path,
                    "prompt": context.prompts.get(&f.path).cloned().unwrap_or_default(),
                })
            })
            .collect();

        ToolResult {
            tool_name: "show_prompts".to_string(),
            success: true,
            data: Some(json!({ "prompts": prompts })),
            error: None,
        }
    }

    /// 工具: 更新提示词
    async fn tool_update_prompt(
        &self,
        tool: &ToolCall,
        context: &mut ChatContext,
        config: &AppConfig,
    ) -> ToolResult {
        let folder_index: Option<usize> = tool
            .params
            .get("folder_index")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize);

        let new_prompt: Option<String> = tool
            .params
            .get("prompt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // 如果提供的是风格描述而非完整提示词，需要优化
        let style_instruction: Option<String> = tool
            .params
            .get("style")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        match (folder_index, new_prompt.or(style_instruction)) {
            (Some(idx), Some(instruction)) => {
                // 找到对应文件夹
                let folder = context.folders.iter().find(|f| f.index == idx);

                if let Some(folder) = folder {
                    let folder_path = folder.path.clone();
                    let folder_name = folder.name.clone();

                    // 获取当前提示词
                    let current_prompt = context
                        .prompts
                        .get(&folder_path)
                        .cloned()
                        .unwrap_or_else(|| format!("folder icon for {}", folder_name));

                    // 调用 AI 优化提示词
                    let refined_prompt = if config.text_model.is_configured() {
                        self.text_ai
                            .refine_prompt(&config.text_model, &current_prompt, &instruction)
                            .await
                            .unwrap_or_else(|_| {
                                // 如果 AI 调用失败，使用简单拼接
                                format!(
                                    "A folder icon featuring {}, modern minimalist design, single centered object, isolated on solid white background",
                                    instruction
                                )
                            })
                    } else {
                        format!(
                            "A folder icon featuring {}, modern minimalist design, single centered object, isolated on solid white background",
                            instruction
                        )
                    };

                    context
                        .prompts
                        .insert(folder_path.clone(), refined_prompt.clone());

                    ToolResult {
                        tool_name: "update_prompt".to_string(),
                        success: true,
                        data: Some(json!({
                            "folder_index": idx,
                            "folder_name": folder_name,
                            "folder_path": folder_path,
                            "new_prompt": refined_prompt,
                        })),
                        error: None,
                    }
                } else {
                    ToolResult {
                        tool_name: "update_prompt".to_string(),
                        success: false,
                        data: None,
                        error: Some(format!("找不到编号为 {} 的文件夹", idx)),
                    }
                }
            }
            _ => ToolResult {
                tool_name: "update_prompt".to_string(),
                success: false,
                data: None,
                error: Some("缺少必要参数: folder_index 和 prompt/style".to_string()),
            },
        }
    }

    /// 工具: 生成图标 (返回生成指令，由前端执行实际生成)
    fn tool_generate_icons(&self, tool: &ToolCall, context: &ChatContext) -> ToolResult {
        let folder_indices: Vec<usize> = tool
            .params
            .get("folder_indices")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        // 确定要生成的文件夹
        let target_folders: Vec<Value> = if folder_indices.is_empty() {
            context
                .folders
                .iter()
                .map(|f| {
                    json!({
                        "folder_index": f.index,
                        "folder_path": f.path,
                        "folder_name": f.name,
                        "prompt": context.prompts.get(&f.path).cloned().unwrap_or_default(),
                    })
                })
                .collect()
        } else {
            context
                .folders
                .iter()
                .filter(|f| folder_indices.contains(&f.index))
                .map(|f| {
                    json!({
                        "folder_index": f.index,
                        "folder_path": f.path,
                        "folder_name": f.name,
                        "prompt": context.prompts.get(&f.path).cloned().unwrap_or_default(),
                    })
                })
                .collect()
        };

        if target_folders.is_empty() {
            return ToolResult {
                tool_name: "generate_icons".to_string(),
                success: false,
                data: None,
                error: Some("没有找到要生成图标的文件夹".to_string()),
            };
        }

        // 返回生成任务列表，由前端执行
        ToolResult {
            tool_name: "generate_icons".to_string(),
            success: true,
            data: Some(json!({
                "action": "generate",
                "targets": target_folders,
            })),
            error: None,
        }
    }

    /// 工具: 应用图标 (返回应用指令，由前端执行实际应用)
    fn tool_apply_icons(&self, tool: &ToolCall, context: &ChatContext) -> ToolResult {
        let folder_indices: Vec<usize> = tool
            .params
            .get("folder_indices")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        // 确定要应用的文件夹
        let target_folders: Vec<Value> = if folder_indices.is_empty() {
            context
                .folders
                .iter()
                .map(|f| {
                    json!({
                        "folder_index": f.index,
                        "folder_path": f.path,
                        "folder_name": f.name,
                    })
                })
                .collect()
        } else {
            context
                .folders
                .iter()
                .filter(|f| folder_indices.contains(&f.index))
                .map(|f| {
                    json!({
                        "folder_index": f.index,
                        "folder_path": f.path,
                        "folder_name": f.name,
                    })
                })
                .collect()
        };

        if target_folders.is_empty() {
            return ToolResult {
                tool_name: "apply_icons".to_string(),
                success: false,
                data: None,
                error: Some("没有找到要应用图标的文件夹".to_string()),
            };
        }

        ToolResult {
            tool_name: "apply_icons".to_string(),
            success: true,
            data: Some(json!({
                "action": "apply",
                "targets": target_folders,
            })),
            error: None,
        }
    }

    /// 主入口: 处理用户消息
    pub async fn process_message(
        &self,
        user_message: &str,
        context: &mut ChatContext,
    ) -> Result<AgentProcessResult, AppError> {
        let config = AppConfig::load().map_err(|e| AppError::Config(e.to_string()))?;

        if !config.text_model.is_configured() {
            return Err(AppError::Config(
                "请先配置文本模型 (Endpoint 和 Model)".to_string(),
            ));
        }

        // 构建 system prompt
        let system_prompt = self.build_system_prompt(context);

        // 调用 LLM
        let agent_response = self
            .call_llm(&config.text_model, &system_prompt, user_message)
            .await?;

        // 执行工具调用
        let mut tool_results = Vec::new();
        for tool in &agent_response.tools {
            let result = self.execute_tool(tool, context, &config).await;
            tool_results.push(result);
        }

        Ok(AgentProcessResult {
            response: agent_response.response,
            tool_results,
            updated_prompts: context.prompts.clone(),
        })
    }
}

// ============ Tauri Commands ============

/// 与 Agent 对话
#[tauri::command]
pub async fn chat_with_agent(
    user_message: String,
    context_json: String,
) -> Result<AgentProcessResult, AppError> {
    // 调试：打印收到的 context
    eprintln!(
        "[Agent] Received context_json: {}",
        &context_json[..context_json.len().min(500)]
    );

    // 解析上下文
    let mut context: ChatContext = serde_json::from_str(&context_json).map_err(AppError::Json)?;

    eprintln!("[Agent] Parsed {} folders", context.folders.len());

    let agent = ChatAgent::new();
    agent.process_message(&user_message, &mut context).await
}
