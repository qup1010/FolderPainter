#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use windows::Win32::Storage::FileSystem::{SetFileAttributesW, FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM, FILE_ATTRIBUTE_NORMAL};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_UPDATEDIR, SHCNE_ASSOCCHANGED, SHCNF_PATHW, SHCNF_IDLIST};

#[cfg(target_os = "windows")]
fn to_pcwstr(path: &str) -> Vec<u16> {
    path.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(target_os = "windows")]
pub fn set_folder_readonly(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        SetFileAttributesW(PCWSTR(wide_path.as_ptr()), FILE_ATTRIBUTE_READONLY)
            .map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "windows")]
pub fn set_hidden_system(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        SetFileAttributesW(PCWSTR(wide_path.as_ptr()), FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)
            .map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "windows")]
/// 清除文件的特殊属性，设置为普通文件
pub fn clear_attributes(path: &str) -> Result<(), String> {
    let wide_path = to_pcwstr(path);
    unsafe {
        SetFileAttributesW(PCWSTR(wide_path.as_ptr()), FILE_ATTRIBUTE_NORMAL)
            .map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "windows")]
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

// Mock implementations for non-Windows platforms

#[cfg(not(target_os = "windows"))]
pub fn set_folder_readonly(_path: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn set_hidden_system(_path: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn clear_attributes(_path: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn notify_shell_update(_path: &str) -> Result<(), String> {
    Ok(())
}
