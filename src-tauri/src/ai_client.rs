use crate::config::{AIModelConfig, AppConfig};
use crate::error::AppError;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 全局共享的 HTTP Client (复用连接池)
pub static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(100))
        .pool_idle_timeout(Duration::from_secs(300))
        .pool_max_idle_per_host(10)
        .build()
        .expect("Failed to create global HTTP client")
});

/// 获取全局 HTTP Client
pub fn get_http_client() -> &'static Client {
    &HTTP_CLIENT
}

/// OpenAI DALL-E 请求结构 (图像生成)
#[derive(Serialize)]
struct DallERequest {
    model: String,
    prompt: String,
    n: u32,
    size: String,
    response_format: String,
}

/// OpenAI DALL-E 响应结构
#[derive(Deserialize)]
struct DallEResponse {
    data: Vec<DallEImageData>,
}

#[derive(Deserialize)]
struct DallEImageData {
    b64_json: Option<String>,
    #[allow(dead_code)]
    url: Option<String>,
}

// ============ ModelScope 异步模式结构体 ============

/// ModelScope 异步任务发起响应 (官方格式: {"task_id": "xxx"})
#[derive(Deserialize, Debug)]
struct ModelScopeAsyncResponse {
    #[allow(dead_code)]
    request_id: Option<String>,
    task_id: Option<String>,
}

/// ModelScope 任务状态查询响应
#[derive(Deserialize, Debug)]
struct ModelScopeTaskResponse {
    #[allow(dead_code)]
    request_id: Option<String>,
    task_id: Option<String>,
    task_status: Option<String>,
    /// 生成成功后的图像 URL 列表
    output_images: Option<Vec<String>>,
}

/// 检测是否为 ModelScope/DashScope 端点
fn is_modelscope_endpoint(endpoint: &str) -> bool {
    let lower = endpoint.to_lowercase();
    lower.contains("modelscope") || lower.contains("dashscope")
}

/// AI 客户端 (图像生成)
pub struct AIClient {
    pub http_client: &'static Client,
}

impl AIClient {
    pub fn new() -> Self {
        Self {
            http_client: get_http_client(),
        }
    }

    pub async fn generate_icon_with_config(
        &self,
        config: &AIModelConfig,
        prompt: &str,
    ) -> Result<Vec<u8>, AppError> {
        let api_key = config.api_key.as_deref();
        let endpoint = &config.endpoint;
        let model = &config.model;
        let size = &config.size;

        if endpoint.is_empty() {
            return Err(AppError::Config("图像模型未配置 Endpoint".to_string()));
        }

        self.generate_with_openai_compatible(api_key, prompt, model, endpoint, size)
            .await
    }

    /// 使用 OpenAI 兼容 API 生成图像
    async fn generate_with_openai_compatible(
        &self,
        api_key: Option<&str>,
        prompt: &str,
        model: &str,
        endpoint: &str,
        size: &str,
    ) -> Result<Vec<u8>, AppError> {
        // 检测是否为 ModelScope 端点
        if is_modelscope_endpoint(endpoint) {
            println!("[检测到 ModelScope 端点] 使用异步模式...");
            return self
                .generate_with_modelscope_async(api_key, prompt, model, endpoint, size)
                .await;
        }

        // 原有同步模式逻辑
        let icon_prompt = prompt.to_string();
        println!("==> 准备生成图像 (同步模式)");
        println!("    Endpoint: {}", endpoint);
        println!("    Model: {}", model);
        println!("    Prompt: {}", icon_prompt);

        let request = DallERequest {
            model: model.to_string(),
            prompt: icon_prompt,
            n: 1,
            size: size.to_string(),
            response_format: "b64_json".to_string(),
        };

        let url = endpoint;

        let mut request_builder = self.http_client.post(url);

        if let Some(key) = api_key {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", key));
        }

        println!("    正在发送请求到服务器，请耐心等待...");
        let start_time = std::time::Instant::now();

        let response = request_builder
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(AppError::Network)?;

        println!("<== 收到响应 Header (耗时: {:?})", start_time.elapsed());
        println!("    状态码: {}", response.status());

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            println!("[ERROR] API 返回错误内容: {}", error_text);
            return Err(AppError::Ai(format!("图像生成 API 错误: {}", error_text)));
        }

        println!("    正在读取响应 Body (如果返回 Base64，这一步会比较慢)...");
        let body_text = response.text().await.map_err(AppError::Network)?;
        println!("    读取 Body 完成 (大小: {} bytes)", body_text.len());

        let dalle_response: DallEResponse = serde_json::from_str(&body_text).map_err(|e| {
            println!("[ERROR] JSON 解析失败: {}", e);
            AppError::Json(e)
        })?;

        let image_data = dalle_response.data.first().ok_or_else(|| {
            println!("[ERROR] API 返回的 data 列表为空");
            AppError::Ai("未返回图像数据".to_string())
        })?;

        let b64_data = if let Some(b64) = &image_data.b64_json {
            println!("成功获取 Base64 数据 (长度: {})", b64.len());
            b64
        } else if let Some(url) = &image_data.url {
            println!("接收到的是 URL 格式: {}", url);
            return Err(AppError::Ai(
                "当前后端仅支持 Base64 返回格式，但 API 返回了 URL".to_string(),
            ));
        } else {
            println!("[ERROR] image_data 中既没有 b64_json 也没有 url");
            return Err(AppError::Ai("API 返回数据中缺少图像内容".to_string()));
        };

        use base64::Engine;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(b64_data)
            .map_err(|e| {
                println!("[ERROR] Base64 解码失败: {}", e);
                AppError::System(format!("解码 base64 失败: {}", e))
            })?;

        Ok(bytes)
    }

    /// ModelScope 异步模式生成图像
    async fn generate_with_modelscope_async(
        &self,
        api_key: Option<&str>,
        prompt: &str,
        model: &str,
        endpoint: &str,
        size: &str,
    ) -> Result<Vec<u8>, AppError> {
        let icon_prompt = prompt.to_string();
        println!("==> 准备生成图像 (ModelScope 异步模式)");
        println!("    Endpoint: {}", endpoint);
        println!("    Model: {}", model);
        println!("    Prompt: {}", icon_prompt);

        // 构建请求体 (OpenAI 兼容格式，ModelScope /v1/images/generations 也使用此格式)
        let request_body = serde_json::json!({
            "model": model,
            "prompt": icon_prompt,
            "n": 1,
            "size": size
        });

        let mut request_builder = self.http_client.post(endpoint);

        if let Some(key) = api_key {
            request_builder = request_builder.header("Authorization", format!("Bearer {}", key));
        }

        // 添加异步模式 header (官方格式)
        request_builder = request_builder
            .header("Content-Type", "application/json")
            .header("X-ModelScope-Async-Mode", "true");

        println!("    发送异步请求...");
        let start_time = std::time::Instant::now();

        let response = request_builder
            .json(&request_body)
            .send()
            .await
            .map_err(AppError::Network)?;

        println!("<== 收到响应 (耗时: {:?})", start_time.elapsed());
        println!("    状态码: {}", response.status());

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            println!("[ERROR] API 返回错误: {}", error_text);
            return Err(AppError::Ai(format!("ModelScope API 错误: {}", error_text)));
        }

        let body_text = response.text().await.map_err(AppError::Network)?;
        println!("    响应内容: {}", &body_text[..body_text.len().min(500)]);

        let async_response: ModelScopeAsyncResponse =
            serde_json::from_str(&body_text).map_err(|e| {
                println!("[ERROR] JSON 解析失败: {}", e);
                AppError::Json(e)
            })?;

        // 获取 task_id (官方格式: 顺层 task_id)
        let task_id = async_response
            .task_id
            .ok_or_else(|| AppError::Ai("未获取到 task_id".to_string()))?;

        println!("    获取到 task_id: {}", task_id);

        // 构建轮询 URL
        // ModelScope 任务查询 URL 格式: 基础 URL + /tasks/{task_id}
        let base_url = endpoint.trim_end_matches("/images/generations");
        let task_url = format!("{}/tasks/{}", base_url, task_id);
        println!("    轮询 URL: {}", task_url);

        // 轮询任务状态 (最多 120 秒，每 5 秒一次)
        let max_attempts = 24;
        let poll_interval = Duration::from_secs(5);

        for attempt in 1..=max_attempts {
            println!("    轮询任务状态 ({}/{})...", attempt, max_attempts);
            tokio::time::sleep(poll_interval).await;

            let mut poll_builder = self.http_client.get(&task_url);
            if let Some(key) = api_key {
                poll_builder = poll_builder.header("Authorization", format!("Bearer {}", key));
            }
            // 添加任务类型 header (官方要求)
            poll_builder = poll_builder.header("X-ModelScope-Task-Type", "image_generation");

            let poll_response = poll_builder.send().await.map_err(AppError::Network)?;

            if !poll_response.status().is_success() {
                let error_text = poll_response.text().await.unwrap_or_default();
                println!("[WARN] 轮询失败: {}", error_text);
                continue;
            }

            let poll_body = poll_response.text().await.map_err(AppError::Network)?;
            println!("    轮询响应: {}", &poll_body[..poll_body.len().min(300)]);

            let task_response: ModelScopeTaskResponse =
                serde_json::from_str(&poll_body).map_err(|e| {
                    println!("[WARN] 解析轮询响应失败: {}", e);
                    AppError::Json(e)
                })?;

            let status = task_response.task_status.as_deref().unwrap_or("UNKNOWN");
            println!("    任务状态: {}", status);

            match status {
                "SUCCEED" => {
                    // 获取图像 URL
                    if let Some(output_images) = &task_response.output_images {
                        if let Some(image_url) = output_images.first() {
                            println!("    下载图像: {}", image_url);
                            let img_response = self
                                .http_client
                                .get(image_url)
                                .send()
                                .await
                                .map_err(AppError::Network)?;
                            let img_bytes =
                                img_response.bytes().await.map_err(AppError::Network)?;
                            return Ok(img_bytes.to_vec());
                        }
                    }
                    return Err(AppError::Ai("任务成功但未获取到图像 URL".to_string()));
                }
                "FAILED" => {
                    return Err(AppError::Ai("ModelScope 任务执行失败".to_string()));
                }
                "PENDING" | "RUNNING" => {
                    // 继续轮询
                    continue;
                }
                _ => {
                    println!("[WARN] 未知状态: {}", status);
                    continue;
                }
            }
        }

        Err(AppError::Ai("ModelScope 任务超时 (120秒)".to_string()))
    }
}

// ============ Tauri Commands ============

/// 使用 AI 生成图标 (使用图像模型配置)
#[tauri::command]
pub async fn generate_ai_icon(prompt: String) -> Result<Vec<u8>, AppError> {
    let config = AppConfig::load().map_err(|e| AppError::Config(e.to_string()))?;

    if !config.is_image_model_configured() {
        return Err(AppError::Config("请先配置图像模型 API Key".to_string()));
    }

    let client = AIClient::new();
    client
        .generate_icon_with_config(&config.image_model, &prompt)
        .await
}

/// 测试图像模型 API 连接
#[tauri::command]
pub async fn test_api_connection(
    api_key: String,
    endpoint: String,
    model: String,
) -> Result<String, AppError> {
    // 创建临时配置用于测试
    let test_config = AIModelConfig {
        endpoint: endpoint.clone(),
        api_key: if api_key.is_empty() {
            None
        } else {
            Some(api_key)
        },
        model: model.clone(),
        size: "1024x1024".to_string(),
        use_custom_endpoint: true,
    };

    let client = AIClient::new();

    // 简单判断：如果 Endpoint 包含 "chat/completions"，发送文本请求
    if endpoint.contains("chat/completions") {
        // Text Model Test
        let request_body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": "hi"}],
            "max_tokens": 1
        });

        let mut builder = client.http_client.post(&endpoint);
        if let Some(key) = test_config.api_key {
            builder = builder.header("Authorization", format!("Bearer {}", key));
        }

        let response = builder
            .json(&request_body)
            .send()
            .await
            .map_err(AppError::Network)?;

        if response.status().is_success() {
            Ok("Connection OK (Text Model)".to_string())
        } else {
            Err(AppError::Ai(format!(
                "Connection failed (HTTP {})",
                response.status()
            )))
        }
    } else {
        // Image Model Test
        let request_body = serde_json::json!({
             "model": model,
        });

        let mut builder = client.http_client.post(&endpoint);
        if let Some(key) = test_config.api_key {
            builder = builder.header("Authorization", format!("Bearer {}", key));
        }

        let response = builder
            .json(&request_body)
            .send()
            .await
            .map_err(AppError::Network)?;

        if response.status() == 400 {
            Ok("Connection OK (Image Endpoint Reached)".to_string())
        } else if response.status().is_success() {
            Ok("Connection OK".to_string())
        } else {
            let status = response.status();
            let _text = response.text().await.unwrap_or_default();
            Err(AppError::Ai(format!("API 响应错误: {}", status)))
        }
    }
}

/// 预览生成图标 (返回 base64 编码的 PNG 图像)
#[tauri::command]
pub async fn preview_ai_icon(prompt: String) -> Result<String, AppError> {
    let config = AppConfig::load().map_err(|e| AppError::Config(e.to_string()))?;

    if !config.is_image_model_configured() {
        return Err(AppError::Config("请先配置图像模型 API Key".to_string()));
    }

    let client = AIClient::new();
    let image_bytes = client
        .generate_icon_with_config(&config.image_model, &prompt)
        .await?;

    use base64::Engine;
    let base64_data = base64::engine::general_purpose::STANDARD.encode(&image_bytes);

    Ok(format!("data:image/png;base64,{}", base64_data))
}
