// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod ai_client;
pub mod bg_removal;
pub mod chat_agent;
pub mod commands;
pub mod config;
pub mod desktop_ini;
pub mod error;
pub mod history;
pub mod icon_gen;
pub mod preview;
pub mod prompts;
pub mod templates;
pub mod text_ai;
pub mod windows_api;

use ai_client::{generate_ai_icon, preview_ai_icon, test_api_connection};
use bg_removal::{test_bg_removal_connection, test_bg_removal_with_config};
use chat_agent::chat_with_agent;
use commands::{
    apply_multiple_preview_icons, apply_preview_icon, get_file_base64, scan_subfolders,
    set_folder_icon, set_folder_icon_with_ai, set_multiple_folder_icons,
    set_multiple_folder_icons_with_ai,
};
use config::{
    delete_model_preset, get_config, is_api_configured, list_model_presets, save_config,
    save_model_preset, set_ai_provider, set_api_key,
};
use history::{
    can_restore_folder, clear_folder_icon, get_folder_history, get_recent_history,
    restore_folder_icon,
};
use preview::{
    add_folders_to_session, apply_all_previews, apply_folder_preview, create_preview_session,
    delete_preview_session, delete_preview_version, generate_preview_version, list_active_sessions,
    load_preview_session, remove_folder_from_session, remove_background_for_version,
    remove_background_all, save_session_chat, set_current_version,
};
use templates::{
    create_template, delete_template, delete_template_category, export_user_templates,
    get_template, import_templates, list_template_categories, list_templates,
    list_templates_by_category, rename_template_category, update_template,
};
use text_ai::{analyze_folder_content, analyze_multiple_folders, refine_prompt_with_ai};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            // 初始化模板存储 (仅运行一次)
            use templates::store::TemplateStore;
            if let Err(e) = TemplateStore::init() {
                eprintln!("Failed to initialize templates: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_folder_icon,
            set_multiple_folder_icons,
            scan_subfolders,
            get_file_base64,
            // AI 图标生成命令
            set_folder_icon_with_ai,
            set_multiple_folder_icons_with_ai,
            apply_preview_icon,
            apply_multiple_preview_icons,
            // 配置相关命令
            get_config,
            save_config,
            set_api_key,
            set_ai_provider,
            is_api_configured,
            // 预设管理命令
            save_model_preset,
            delete_model_preset,
            list_model_presets,
            // AI 相关命令
            generate_ai_icon,
            test_api_connection,
            preview_ai_icon,
            // 历史记录命令
            get_folder_history,
            get_recent_history,
            restore_folder_icon,
            clear_folder_icon,
            can_restore_folder,
            // 智能分析命令
            analyze_folder_content,
            analyze_multiple_folders,
            refine_prompt_with_ai,
            // 预览会话命令
            create_preview_session,
            load_preview_session,
            list_active_sessions,
            delete_preview_session,
            save_session_chat,
            add_folders_to_session,
            remove_folder_from_session,
            generate_preview_version,
            delete_preview_version,
            set_current_version,
            apply_folder_preview,
            apply_all_previews,
            // 背景移除命令
            remove_background_for_version,
            remove_background_all,
            test_bg_removal_connection,
            test_bg_removal_with_config,
            // 模板管理命令
            list_templates,
            get_template,
            create_template,
            update_template,
            delete_template,
            list_templates_by_category,
            list_template_categories,
            rename_template_category,
            delete_template_category,
            export_user_templates,
            import_templates,
            // Agent 对话命令
            chat_with_agent
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
