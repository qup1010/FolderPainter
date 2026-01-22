//! 背景移除模块
//!
//! 调用 Hugging Face Gradio Space API 进行图像背景移除
//! 支持 Gradio v4+ 的队列机制

use crate::ai_client::get_http_client;
use crate::config::{AppConfig, BackgroundRemovalConfig, BgRemovalApiType};
use crate::error::AppError;
use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::multipart;
use serde::Deserialize;
use serde_json::{json, Value};

/// 背景移除客户端
pub struct BgRemovalClient;

/// 文件上传响应
#[derive(Debug, Deserialize)]
struct UploadResponse(Vec<String>);

impl BgRemovalClient {
    /// 移除图像背景
    pub async fn remove_background(
        config: &BackgroundRemovalConfig,
        image_bytes: &[u8],
    ) -> Result<Vec<u8>, AppError> {
        if !config.enabled {
            return Ok(image_bytes.to_vec());
        }

        // 统一使用 Gradio API
        Self::call_gradio_api(config, image_bytes).await
    }

    /// 构建 Space 的基础 URL
    fn build_base_url(model_id: &str) -> Result<String, AppError> {
        if model_id.starts_with("http") {
            Ok(model_id.trim_end_matches('/').to_string())
        } else {
            let parts: Vec<&str> = model_id.split('/').collect();
            if parts.len() == 2 {
                let user = parts[0].replace('.', "-");
                let space = parts[1].replace('.', "-");
                Ok(format!("https://{}-{}.hf.space", user, space))
            } else {
                Err(AppError::Config(format!("无效的 Space ID: {}", model_id)))
            }
        }
    }

    /// 从模板中提取 api_name
    fn extract_api_name(template_str: &str) -> &str {
        if template_str.contains(r#""api_name": "/image""#) {
            "/image"
        } else if template_str.contains(r#""api_name": "/png""#) {
            "/png"
        } else if template_str.contains(r#""api_name": "/inference""#) {
            "/inference"
        } else {
            "/predict"
        }
    }

    /// 上传文件到 Gradio Space
    async fn upload_file(
        client: &reqwest::Client,
        base_url: &str,
        image_bytes: &[u8],
        api_token: Option<&str>,
    ) -> Result<String, AppError> {
        let upload_url = format!("{}/upload", base_url);

        eprintln!("[BgRemoval] 上传文件到: {}", upload_url);

        // 创建 multipart form
        let part = multipart::Part::bytes(image_bytes.to_vec())
            .file_name("image.png")
            .mime_str("image/png")
            .map_err(|e| AppError::Api(format!("创建上传数据失败: {}", e)))?;

        let form = multipart::Form::new().part("files", part);

        let mut request = client.post(&upload_url).multipart(form);

        if let Some(token) = api_token {
            if !token.is_empty() {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::Api(format!("上传文件失败: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!(
                "上传文件失败 {}: {}",
                status, error_text
            )));
        }

        // 解析响应，获取临时文件路径
        let upload_result: Vec<String> = response
            .json()
            .await
            .map_err(|e| AppError::Api(format!("解析上传响应失败: {}", e)))?;

        if upload_result.is_empty() {
            return Err(AppError::Api("上传响应为空".to_string()));
        }

        eprintln!("[BgRemoval] 文件已上传: {}", upload_result[0]);
        Ok(upload_result[0].clone())
    }

    /// 调用 Gradio Space API (支持 v4+ 队列机制)
    async fn call_gradio_api(
        config: &BackgroundRemovalConfig,
        image_bytes: &[u8],
    ) -> Result<Vec<u8>, AppError> {
        let base_url = Self::build_base_url(&config.model_id)?;
        let client = get_http_client();

        let template_str = config
            .payload_template
            .as_deref()
            .unwrap_or(r#"{"data": ["{{IMAGE}}"], "api_name": "/image"}"#);

        let api_name = Self::extract_api_name(template_str);

        eprintln!(
            "[BgRemoval] 调用 Gradio Space: {} (api: {})",
            base_url, api_name
        );

        // Step 1: 上传文件
        let uploaded_path =
            Self::upload_file(&client, &base_url, image_bytes, config.api_token.as_deref()).await?;

        // 生成 session_hash
        let session_hash = format!("{:x}", rand::random::<u64>());

        // Step 2: 加入队列
        let queue_join_url = format!("{}/queue/join", base_url);

        // 构建文件对象（Gradio 期望的格式）
        let file_obj = json!({
            "path": uploaded_path,
            "meta": {"_type": "gradio.FileData"}
        });

        let join_payload = json!({
            "data": [file_obj],
            "fn_index": 0,
            "session_hash": session_hash,
            "trigger_id": rand::random::<u32>()
        });

        eprintln!("[BgRemoval] 加入队列...");

        let mut request = client
            .post(&queue_join_url)
            .header("Content-Type", "application/json")
            .json(&join_payload);

        if let Some(ref token) = config.api_token {
            if !token.is_empty() {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::Api(format!("加入队列失败: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!(
                "加入队列失败 {}: {}",
                status, error_text
            )));
        }

        let join_resp: Value = response
            .json()
            .await
            .map_err(|e| AppError::Api(format!("解析队列响应失败: {}", e)))?;

        let event_id = join_resp
            .get("event_id")
            .and_then(|e| e.as_str())
            .unwrap_or("unknown");
        eprintln!("[BgRemoval] 已加入队列, event_id: {}", event_id);

        // Step 3: 轮询队列状态 (SSE 方式)
        let queue_data_url = format!("{}/queue/data?session_hash={}", base_url, session_hash);

        let result =
            Self::poll_queue_sse(&client, &queue_data_url, &base_url, config.api_token.as_deref()).await?;

        Ok(result)
    }

    /// 通过 SSE 轮询队列获取结果
    async fn poll_queue_sse(
        client: &reqwest::Client,
        url: &str,
        base_url: &str,
        api_token: Option<&str>,
    ) -> Result<Vec<u8>, AppError> {
        let mut request = client.get(url);

        if let Some(token) = api_token {
            if !token.is_empty() {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
        }

        let response = request
            .send()
            .await
            .map_err(|e| AppError::Api(format!("获取队列状态失败: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::Api(format!(
                "获取队列状态失败 {}: {}",
                status, error_text
            )));
        }

        // 读取 SSE 流
        let body = response
            .text()
            .await
            .map_err(|e| AppError::Api(format!("读取 SSE 流失败: {}", e)))?;

        // 解析 SSE 事件
        for line in body.lines() {
            if line.starts_with("data: ") {
                let data_str = &line[6..];
                if let Ok(data) = serde_json::from_str::<Value>(data_str) {
                    let msg = data.get("msg").and_then(|m| m.as_str()).unwrap_or("");

                    match msg {
                        "process_completed" => {
                            eprintln!("[BgRemoval] 处理完成");

                            // 提取输出数据
                            if let Some(output) = data.get("output") {
                                if let Some(output_data) = output.get("data").and_then(|d| d.as_array())
                                {
                                    for item in output_data {
                                        if let Some(img_bytes) =
                                            Self::extract_image_from_value(item, base_url).await
                                        {
                                            return Ok(img_bytes);
                                        }
                                    }
                                }
                            }

                            return Err(AppError::Api(
                                "未在响应中找到有效的图像数据".to_string(),
                            ));
                        }
                        "process_starts" => {
                            eprintln!("[BgRemoval] 开始处理...");
                        }
                        "estimation" => {
                            if let Some(rank) = data.get("rank") {
                                eprintln!("[BgRemoval] 队列位置: {}", rank);
                            }
                        }
                        "heartbeat" => {
                            // 忽略心跳
                        }
                        _ => {
                            eprintln!("[BgRemoval] SSE 消息: {}", msg);
                        }
                    }
                }
            }
        }

        Err(AppError::Api("SSE 流结束但未收到完成消息".to_string()))
    }

    /// 从 JSON Value 中提取图像数据 (支持 URL, Base64, Object)
    async fn extract_image_from_value(v: &Value, base_url: &str) -> Option<Vec<u8>> {
        // Case 1: 字符串，可能是 Base64 或 URL
        if let Some(s) = v.as_str() {
            if s.starts_with("data:image") {
                // data:image/png;base64,....
                let parts: Vec<&str> = s.split(',').collect();
                if parts.len() == 2 {
                    if let Ok(bytes) = STANDARD.decode(parts[1]) {
                        return Some(bytes);
                    }
                }
            } else if s.starts_with("http") {
                // 完整 URL，直接下载
                if let Ok(bytes) = Self::download_url(s).await {
                    return Some(bytes);
                }
            } else if s.starts_with("/") {
                // 相对路径，拼接 base_url
                let full_url = format!("{}/file={}", base_url, s);
                eprintln!("[BgRemoval] 下载文件: {}", full_url);
                if let Ok(bytes) = Self::download_url(&full_url).await {
                    return Some(bytes);
                }
            }
        }

        // Case 2: 对象 {"url": "...", "path": "...", ...}
        if let Some(obj) = v.as_object() {
            // 优先尝试 url 字段
            if let Some(url) = obj.get("url").and_then(|u| u.as_str()) {
                let full_url = if url.starts_with("http") {
                    url.to_string()
                } else {
                    format!("{}{}", base_url, url)
                };
                eprintln!("[BgRemoval] 下载 URL: {}", full_url);
                if let Ok(bytes) = Self::download_url(&full_url).await {
                    return Some(bytes);
                }
            }

            // 尝试 path 字段
            if let Some(path) = obj.get("path").and_then(|p| p.as_str()) {
                let full_url = if path.starts_with("http") {
                    path.to_string()
                } else {
                    // Gradio 文件访问格式: /file=<path>
                    format!("{}/file={}", base_url, path)
                };
                eprintln!("[BgRemoval] 下载 path: {}", full_url);
                if let Ok(bytes) = Self::download_url(&full_url).await {
                    return Some(bytes);
                }
            }
        }

        // Case 3: 嵌套数组 (如 ImageSlider 组件返回 [[img1, img2], output])
        if let Some(arr) = v.as_array() {
            for item in arr {
                if let Some(bytes) = Box::pin(Self::extract_image_from_value(item, base_url)).await {
                    return Some(bytes);
                }
            }
        }

        None
    }

    async fn download_url(url: &str) -> Result<Vec<u8>, AppError> {
        let client = get_http_client();
        let resp = client
            .get(url)
            .send()
            .await
            .map_err(|e| AppError::Api(format!("下载结果图像失败: {}", e)))?;

        if !resp.status().is_success() {
            return Err(AppError::Api(format!(
                "下载结果图像失败: {}",
                resp.status()
            )));
        }

        resp.bytes()
            .await
            .map_err(|e| AppError::Api(format!("读取图像字节失败: {}", e)))
            .map(|b| b.to_vec())
    }

    async fn handle_binary_response(response: reqwest::Response) -> Result<Vec<u8>, AppError> {
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();

            if status.as_u16() == 503 && error_text.contains("loading") {
                return Err(AppError::Api(
                    "模型正在加载中，请稍后重试 (约 20-60 秒)".to_string(),
                ));
            }

            return Err(AppError::Api(format!(
                "API 返回错误 {}: {}",
                status, error_text
            )));
        }

        response
            .bytes()
            .await
            .map_err(|e| AppError::Api(format!("读取响应失败: {}", e)))
            .map(|b| b.to_vec())
    }

    /// 测试背景移除 API 连接
    pub async fn test_connection(config: &BackgroundRemovalConfig) -> Result<String, AppError> {
        let test_image = Self::create_test_png();
        let mut test_config = config.clone();
        test_config.enabled = true;

        match Self::remove_background(&test_config, &test_image).await {
            Ok(result) => {
                if result.len() > 0 {
                    Ok(format!(
                        "✅ Connection OK! Model: {}, returned {} bytes",
                        config.model_id,
                        result.len()
                    ))
                } else {
                    Err(AppError::Api("Returned empty data".to_string()))
                }
            }
            Err(e) => Err(e),
        }
    }

    /// 创建一个用于测试的最小 PNG 图像 (10x10 白色)
    fn create_test_png() -> Vec<u8> {
        use image::{ImageFormat, RgbaImage};
        use std::io::Cursor;

        let img = RgbaImage::from_fn(10, 10, |_, _| image::Rgba([255, 255, 255, 255]));

        let mut buffer = Cursor::new(Vec::new());
        img.write_to(&mut buffer, ImageFormat::Png).unwrap();
        buffer.into_inner()
    }
}

// ============ Tauri Commands ============

/// 测试背景移除 API 连接
#[tauri::command]
pub async fn test_bg_removal_connection(
    api_type: String,
    model_id: String,
    payload_template: Option<String>,
    api_token: Option<String>,
) -> Result<String, AppError> {
    let api_type_enum = match api_type.as_str() {
        "InferenceApi" => BgRemovalApiType::InferenceApi,
        "Gradio" => BgRemovalApiType::Gradio,
        _ => BgRemovalApiType::Gradio, // Default
    };

    let config = BackgroundRemovalConfig {
        enabled: true,
        api_type: api_type_enum,
        model_id,
        payload_template,
        api_token,
    };
    BgRemovalClient::test_connection(&config).await
}

/// 使用当前配置测试背景移除
#[tauri::command]
pub async fn test_bg_removal_with_config() -> Result<String, AppError> {
    let config = AppConfig::load()?;
    if !config.bg_removal.enabled {
        return Err(AppError::Config("背景移除功能未启用".to_string()));
    }
    BgRemovalClient::test_connection(&config.bg_removal).await
}
