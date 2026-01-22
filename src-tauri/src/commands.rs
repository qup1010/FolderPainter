use crate::ai_client::AIClient;
use crate::config::AppConfig;
use crate::desktop_ini;
use crate::error::AppError;
use crate::history::HistoryManager;
use crate::icon_gen;
use crate::windows_api;
use std::path::Path;

/// 设置文件夹图标的完整流程 (纯色)
///
/// # Arguments
/// * `folder_path` - 目标文件夹的绝对路径
/// * `color` - 十六进制颜色值 (如 "#FF0000")
#[tauri::command]
pub async fn set_folder_icon(folder_path: String, color: String) -> Result<String, AppError> {
    let folder = Path::new(&folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err(AppError::System(format!("文件夹不存在: {}", folder_path)));
    }

    // 备份原有图标
    let history = HistoryManager::new()?;
    let backup_path = history.backup_folder(&folder_path)?;

    let icon_path = folder.join("icon.ico");
    let icon_path_str = icon_path.to_string_lossy().to_string();
    let ini_path = folder.join("desktop.ini");
    let ini_path_str = ini_path.to_string_lossy().to_string();

    // 清除旧属性
    let _ = windows_api::clear_attributes(&folder_path);
    if ini_path.exists() {
        let _ = windows_api::clear_attributes(&ini_path_str);
    }
    if icon_path.exists() {
        let _ = windows_api::clear_attributes(&icon_path_str);
    }

    // 生成纯色图标
    icon_gen::generate_icon_from_hex(&icon_path_str, &color)
        .map_err(|e| AppError::System(format!("生成图标失败: {}", e)))?;

    // 应用图标
    apply_icon_to_folder(&folder_path, &icon_path_str, &ini_path_str)?;

    // 记录历史
    history.add_entry(&folder_path, "color", &color, backup_path.as_deref())?;

    Ok(format!("成功设置文件夹图标: {}", folder_path))
}

/// 使用 AI 生成的图标设置文件夹
#[tauri::command]
pub async fn set_folder_icon_with_ai(
    folder_path: String,
    prompt: String,
) -> Result<String, AppError> {
    let folder = Path::new(&folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err(AppError::System(format!("文件夹不存在: {}", folder_path)));
    }

    // 备份原有图标
    let history = HistoryManager::new()?;
    let backup_path = history.backup_folder(&folder_path)?;

    // 获取配置
    let config = AppConfig::load()?;

    if !config.is_image_model_configured() {
        return Err(AppError::Config(
            "请先在设置中配置图像模型 API Key".to_string(),
        ));
    }

    // 调用 AI 生成图像
    let client = AIClient::new();
    let image_bytes = client
        .generate_icon_with_config(&config.image_model, &prompt)
        .await?;

    let icon_path = folder.join("icon.ico");
    let icon_path_str = icon_path.to_string_lossy().to_string();
    let ini_path = folder.join("desktop.ini");
    let ini_path_str = ini_path.to_string_lossy().to_string();

    // 清除旧属性
    let _ = windows_api::clear_attributes(&folder_path);
    if ini_path.exists() {
        let _ = windows_api::clear_attributes(&ini_path_str);
    }
    if icon_path.exists() {
        let _ = windows_api::clear_attributes(&icon_path_str);
    }

    // 将 AI 图像转换为 ICO
    icon_gen::create_icon_from_ai_image(&image_bytes, &icon_path_str)?;

    // 应用图标
    apply_icon_to_folder(&folder_path, &icon_path_str, &ini_path_str)?;

    // 记录历史
    history.add_entry(&folder_path, "ai", &prompt, backup_path.as_deref())?;

    Ok(format!("成功设置 AI 生成的文件夹图标: {}", folder_path))
}

/// 批量使用 AI 设置多个文件夹的图标
#[tauri::command]
pub async fn set_multiple_folder_icons_with_ai(
    folder_paths: Vec<String>,
    prompts: Vec<String>,
) -> Result<Vec<String>, AppError> {
    if folder_paths.len() != prompts.len() {
        return Err(AppError::System("文件夹数量与提示词数量不匹配".to_string()));
    }

    let mut results = Vec::new();

    for (path, prompt) in folder_paths.iter().zip(prompts.iter()) {
        match set_folder_icon_with_ai(path.clone(), prompt.clone()).await {
            Ok(msg) => results.push(msg),
            Err(e) => results.push(format!("失败 [{}]: {}", path, e)),
        }
    }

    Ok(results)
}

/// 使用已生成的图像数据设置文件夹图标 (用于预览后应用)
#[tauri::command]
pub async fn apply_preview_icon(
    folder_path: String,
    image_base64: String,
) -> Result<String, AppError> {
    let folder = Path::new(&folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err(AppError::System(format!("文件夹不存在: {}", folder_path)));
    }

    // 备份原有图标
    let history = HistoryManager::new()?;
    let backup_path = history.backup_folder(&folder_path)?;

    // 解码 base64 图像数据
    // 移除 data:image/png;base64, 前缀
    let base64_data = if image_base64.contains(",") {
        image_base64.split(",").nth(1).unwrap_or(&image_base64)
    } else {
        &image_base64
    };

    use base64::Engine;
    let image_bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| AppError::System(format!("解码图像数据失败: {}", e)))?;

    let icon_path = folder.join("icon.ico");
    let icon_path_str = icon_path.to_string_lossy().to_string();
    let ini_path = folder.join("desktop.ini");
    let ini_path_str = ini_path.to_string_lossy().to_string();

    // 清除旧属性
    let _ = windows_api::clear_attributes(&folder_path);
    if ini_path.exists() {
        let _ = windows_api::clear_attributes(&ini_path_str);
    }
    if icon_path.exists() {
        let _ = windows_api::clear_attributes(&icon_path_str);
    }

    // 将图像转换为 ICO
    icon_gen::create_icon_from_ai_image(&image_bytes, &icon_path_str)?;

    // 应用图标
    apply_icon_to_folder(&folder_path, &icon_path_str, &ini_path_str)?;

    // 记录历史
    history.add_entry(
        &folder_path,
        "ai_preview",
        "from preview",
        backup_path.as_deref(),
    )?;

    Ok(format!("成功应用预览图标: {}", folder_path))
}

/// 批量应用预览图标
#[tauri::command]
pub async fn apply_multiple_preview_icons(
    folder_paths: Vec<String>,
    image_base64s: Vec<String>,
) -> Result<Vec<String>, AppError> {
    if folder_paths.len() != image_base64s.len() {
        return Err(AppError::System("文件夹数量与图像数量不匹配".to_string()));
    }

    let mut results = Vec::new();

    for (path, image_data) in folder_paths.iter().zip(image_base64s.iter()) {
        match apply_preview_icon(path.clone(), image_data.clone()).await {
            Ok(msg) => results.push(msg),
            Err(e) => results.push(format!("失败 [{}]: {}", path, e)),
        }
    }

    Ok(results)
}

/// 应用图标到文件夹的通用逻辑
fn apply_icon_to_folder(folder_path: &str, _icon_path: &str, ini_path: &str) -> Result<(), String> {
    // 创建 desktop.ini
    desktop_ini::create(folder_path, "icon.ico")
        .map_err(|e| format!("创建 desktop.ini 失败: {}", e))?;

    // 设置 desktop.ini 属性 (Hidden + System)
    windows_api::set_hidden_system(ini_path)
        .map_err(|e| format!("设置 desktop.ini 属性失败: {}", e))?;

    // 设置文件夹属性 (ReadOnly)
    windows_api::set_folder_readonly(folder_path)
        .map_err(|e| format!("设置文件夹属性失败: {}", e))?;

    // 通知 Shell 刷新
    windows_api::notify_shell_update(folder_path)
        .map_err(|e| format!("通知 Shell 刷新失败: {}", e))?;

    Ok(())
}

/// 批量设置多个文件夹的图标 (纯色)
#[tauri::command]
pub async fn set_multiple_folder_icons(
    folder_paths: Vec<String>,
    color: String,
) -> Result<Vec<String>, AppError> {
    let mut results = Vec::new();

    for path in folder_paths {
        match set_folder_icon(path.clone(), color.clone()).await {
            Ok(msg) => results.push(msg),
            Err(e) => results.push(format!("失败 [{}]: {}", path, e)),
        }
    }

    Ok(results)
}

/// 扫描文件夹获取子文件夹列表
#[tauri::command]
pub async fn scan_subfolders(parent_path: String) -> Result<Vec<String>, AppError> {
    let parent = Path::new(&parent_path);

    if !parent.exists() || !parent.is_dir() {
        return Err(AppError::System(format!("文件夹不存在: {}", parent_path)));
    }

    let mut subfolders = Vec::new();

    let entries = std::fs::read_dir(parent).map_err(AppError::Io)?;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    let name_str = name.to_string_lossy();
                    if !name_str.starts_with('.') {
                        subfolders.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    Ok(subfolders)
}

/// 读取本地文件并转换为 Base64 (用于预览高清大图)
#[tauri::command]
pub async fn get_file_base64(file_path: String) -> Result<String, AppError> {
    use base64::Engine;
    use std::io::Read;

    let path = Path::new(&file_path);
    if !path.exists() || !path.is_file() {
        return Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("文件不存在: {}", file_path),
        )));
    }

    let mut file = std::fs::File::open(path).map_err(AppError::Io)?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(AppError::Io)?;

    let base64_data = base64::engine::general_purpose::STANDARD.encode(&buffer);

    // 假设是 PNG，添加前缀 (前端通常需要)
    // 如果文件扩展名不是 png，可能需要做简单判断，但目前我们主要处理生成的 PNG/ICO
    // 这里只返回 raw base64，由前端决定怎么用，或者前端自己拼接 data URI scheme
    Ok(base64_data)
}
