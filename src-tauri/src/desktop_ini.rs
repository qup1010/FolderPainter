use std::fs::File;
use std::io::Write;
use std::path::Path;

/// 创建 desktop.ini 文件，用于设置文件夹图标
///
/// # Arguments
/// * `folder_path` - 目标文件夹路径
/// * `icon_name` - 图标文件名（相对于文件夹的路径）
///
/// # Returns
/// * `Ok(())` - 成功创建
/// * `Err` - IO 错误
pub fn create(folder_path: &str, icon_name: &str) -> std::io::Result<()> {
    let ini_path = Path::new(folder_path).join("desktop.ini");

    // Windows 换行符 \r\n
    let content = format!(
        "[.ShellClassInfo]\r\nIconResource={},0\r\n[ViewState]\r\nMode=\r\nVid=\r\nFolderType=Generic\r\n",
        icon_name
    );

    let mut file = File::create(ini_path)?;
    file.write_all(content.as_bytes())?;
    Ok(())
}

/// 读取现有的 desktop.ini 内容（用于撤销功能）
pub fn read_existing(folder_path: &str) -> Option<String> {
    let ini_path = Path::new(folder_path).join("desktop.ini");
    std::fs::read_to_string(ini_path).ok()
}

/// 删除 desktop.ini 文件
pub fn remove(folder_path: &str) -> std::io::Result<()> {
    let ini_path = Path::new(folder_path).join("desktop.ini");
    if ini_path.exists() {
        std::fs::remove_file(ini_path)?;
    }
    Ok(())
}
