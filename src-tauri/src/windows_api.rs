use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{SetFileAttributesW, FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM, FILE_ATTRIBUTE_NORMAL};
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_UPDATEDIR, SHCNE_ASSOCCHANGED, SHCNF_PATHW, SHCNF_IDLIST};

fn to_pcwstr(path: &str) -> Vec<u16> {
    path.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn set_folder_readonly(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        SetFileAttributesW(PCWSTR(wide_path.as_ptr()), FILE_ATTRIBUTE_READONLY)
            .map_err(|e| e.to_string())
    }
}

pub fn set_hidden_system(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        SetFileAttributesW(PCWSTR(wide_path.as_ptr()), FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)
            .map_err(|e| e.to_string())
    }
}

/// 清除文件的特殊属性，设置为普通文件
pub fn clear_attributes(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        SetFileAttributesW(PCWSTR(wide_path.as_ptr()), FILE_ATTRIBUTE_NORMAL)
            .map_err(|e| e.to_string())
    }
}

/// 通知 Windows Shell 更新文件夹显示
pub fn notify_shell_update(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        // 先通知目录更新
        SHChangeNotify(
            SHCNE_UPDATEDIR,
            SHCNF_PATHW,
            Some(wide_path.as_ptr() as *const _),
            None,
        );

        // 再发送关联变更通知，强制刷新图标缓存
        SHChangeNotify(
            SHCNE_ASSOCCHANGED,
            SHCNF_IDLIST,
            None,
            None,
        );
    }
    Ok(())
}
