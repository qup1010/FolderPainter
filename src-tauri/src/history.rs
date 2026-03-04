use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// 历史记录条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub folder_path: String,
    pub icon_type: String,           // "ai"
    pub icon_param: String,          // 提示词
    pub backup_path: Option<String>, // 备份文件夹路径
    pub timestamp: String,
    pub can_restore: bool, // 是否可以还原
}

/// 历史记录管理器
pub struct HistoryManager {
    conn: Connection,
}

impl HistoryManager {
    /// 获取数据库路径
    fn db_path() -> Result<PathBuf, String> {
        let app_data = std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 路径".to_string())?;

        let data_dir = PathBuf::from(app_data).join("FolderPainter");

        if !data_dir.exists() {
            fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
        }

        Ok(data_dir.join("history.db"))
    }

    /// 获取备份目录
    fn backup_dir() -> Result<PathBuf, String> {
        let app_data = std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 路径".to_string())?;

        let backup_dir = PathBuf::from(app_data)
            .join("FolderPainter")
            .join("backups");

        if !backup_dir.exists() {
            fs::create_dir_all(&backup_dir).map_err(|e| format!("创建备份目录失败: {}", e))?;
        }

        Ok(backup_dir)
    }

    /// 创建新的历史管理器
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path()?;
        let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

        // 创建表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_path TEXT NOT NULL,
                icon_type TEXT NOT NULL,
                icon_param TEXT NOT NULL,
                backup_path TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                can_restore INTEGER DEFAULT 1
            )",
            [],
        )
        .map_err(|e| format!("创建表失败: {}", e))?;

        Ok(Self { conn })
    }

    /// 备份文件夹的原始图标文件
    pub fn backup_folder(&self, folder_path: &str) -> Result<Option<String>, String> {
        let folder = Path::new(folder_path);
        let icon_path = folder.join(crate::icon_storage::LOCAL_ICON_FILE_NAME);
        let ini_path = folder.join("desktop.ini");

        if !icon_path.exists() && !ini_path.exists() {
            return Ok(None);
        }

        let timestamp = chrono_lite_timestamp();
        let backup_name = format!(
            "{}_{}",
            folder.file_name().unwrap_or_default().to_string_lossy(),
            timestamp
        );

        let backup_dir = Self::backup_dir()?;
        let backup_folder = backup_dir.join(&backup_name);
        fs::create_dir_all(&backup_folder)
            .map_err(|e| format!("鍒涘缓澶囦唤鏂囦欢澶瑰け璐? {}", e))?;

        let mut icon_backed_up = false;

        if ini_path.exists() {
            if let Ok(ini_content) = fs::read_to_string(&ini_path) {
                if let Some(icon_resource) = crate::desktop_ini::parse_icon_resource(&ini_content) {
                    let resolved_icon = crate::desktop_ini::resolve_icon_path(folder_path, &icon_resource);
                    if resolved_icon.exists() {
                        let _ = crate::windows_api::clear_attributes(&resolved_icon.to_string_lossy());
                        let dest = backup_folder.join(crate::icon_storage::LOCAL_ICON_FILE_NAME);
                        fs::copy(&resolved_icon, &dest)
                            .map_err(|e| format!("Backup icon failed: {}", e))?;
                        icon_backed_up = true;
                    }
                }
            }
        }

        if !icon_backed_up && icon_path.exists() {
            let dest = backup_folder.join(crate::icon_storage::LOCAL_ICON_FILE_NAME);
            fs::copy(&icon_path, &dest).map_err(|e| format!("澶囦唤 icon.ico 澶辫触: {}", e))?;
        }

        if ini_path.exists() {
            let _ = crate::windows_api::clear_attributes(&ini_path.to_string_lossy());
            let dest = backup_folder.join("desktop.ini");
            fs::copy(&ini_path, &dest).map_err(|e| format!("澶囦唤 desktop.ini 澶辫触: {}", e))?;
        }

        Ok(Some(backup_folder.to_string_lossy().to_string()))
    }
    /// 添加历史记录
    pub fn add_entry(
        &self,
        folder_path: &str,
        icon_type: &str,
        icon_param: &str,
        backup_path: Option<&str>,
    ) -> Result<i64, String> {
        self.conn
            .execute(
                "INSERT INTO history (folder_path, icon_type, icon_param, backup_path)
             VALUES (?1, ?2, ?3, ?4)",
                [
                    folder_path,
                    icon_type,
                    icon_param,
                    backup_path.unwrap_or(""),
                ],
            )
            .map_err(|e| format!("添加历史记录失败: {}", e))?;

        Ok(self.conn.last_insert_rowid())
    }

    /// 获取文件夹的历史记录
    pub fn get_folder_history(&self, folder_path: &str) -> Result<Vec<HistoryEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, folder_path, icon_type, icon_param, backup_path, timestamp, can_restore
             FROM history WHERE folder_path = ?1 ORDER BY timestamp DESC",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let entries = stmt
            .query_map([folder_path], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    folder_path: row.get(1)?,
                    icon_type: row.get(2)?,
                    icon_param: row.get(3)?,
                    backup_path: row.get::<_, String>(4).ok().filter(|s| !s.is_empty()),
                    timestamp: row.get(5)?,
                    can_restore: row.get::<_, i32>(6)? == 1,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for entry in entries {
            if let Ok(e) = entry {
                result.push(e);
            }
        }

        Ok(result)
    }

    /// 获取所有有历史记录的文件夹
    pub fn get_all_folders(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT DISTINCT folder_path FROM history ORDER BY MAX(timestamp) DESC")
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let folders = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for folder in folders {
            if let Ok(f) = folder {
                result.push(f);
            }
        }

        Ok(result)
    }

    /// 获取最近的历史记录
    pub fn get_recent_history(&self, limit: usize) -> Result<Vec<HistoryEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, folder_path, icon_type, icon_param, backup_path, timestamp, can_restore
             FROM history ORDER BY timestamp DESC LIMIT ?1",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let entries = stmt
            .query_map([limit as i64], |row| {
                Ok(HistoryEntry {
                    id: row.get(0)?,
                    folder_path: row.get(1)?,
                    icon_type: row.get(2)?,
                    icon_param: row.get(3)?,
                    backup_path: row.get::<_, String>(4).ok().filter(|s| !s.is_empty()),
                    timestamp: row.get(5)?,
                    can_restore: row.get::<_, i32>(6)? == 1,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for entry in entries {
            if let Ok(e) = entry {
                result.push(e);
            }
        }

        Ok(result)
    }

    /// 还原文件夹到原始状态
    pub fn restore_folder(&self, folder_path: &str) -> Result<String, String> {
        let history = self.get_folder_history(folder_path)?;

        let entry = history
            .iter()
            .find(|e| e.backup_path.is_some() && e.can_restore)
            .ok_or("娌℃湁鍙繕鍘熺殑澶囦唤")?;

        let backup_path = entry.backup_path.as_ref().unwrap();
        let backup_folder = Path::new(backup_path);
        let target_folder = Path::new(folder_path);

        if !backup_folder.exists() {
            return Err("澶囦唤鏂囦欢澶逛笉瀛樺湪".to_string());
        }

        let current_icon = target_folder.join(crate::icon_storage::LOCAL_ICON_FILE_NAME);
        let current_ini = target_folder.join("desktop.ini");
        let managed_icon_to_cleanup = if current_ini.exists() {
            fs::read_to_string(&current_ini)
                .ok()
                .and_then(|content| crate::desktop_ini::parse_icon_resource(&content))
                .map(|resource| crate::desktop_ini::resolve_icon_path(folder_path, &resource))
                .filter(|path| crate::icon_storage::is_managed_centralized_icon(path))
        } else {
            None
        };

        let _ = crate::windows_api::clear_attributes(folder_path);
        if current_ini.exists() {
            let _ = crate::windows_api::clear_attributes(&current_ini.to_string_lossy());
        }
        if current_icon.exists() {
            let _ = crate::windows_api::clear_attributes(&current_icon.to_string_lossy());
        }
        if let Some(path) = managed_icon_to_cleanup.as_ref() {
            if path.exists() {
                let _ = crate::windows_api::clear_attributes(&path.to_string_lossy());
            }
        }

        if current_icon.exists() {
            fs::remove_file(&current_icon).map_err(|e| format!("鍒犻櫎褰撳墠鍥炬爣澶辫触: {}", e))?;
        }
        if current_ini.exists() {
            fs::remove_file(&current_ini)
                .map_err(|e| format!("鍒犻櫎褰撳墠 desktop.ini 澶辫触: {}", e))?;
        }
        if let Some(path) = managed_icon_to_cleanup.as_ref() {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|e| format!("Failed to remove centralized icon file: {}", e))?;
            }
        }

        let backup_icon = backup_folder.join(crate::icon_storage::LOCAL_ICON_FILE_NAME);
        let backup_ini = backup_folder.join("desktop.ini");

        if backup_icon.exists() {
            fs::copy(&backup_icon, &current_icon)
                .map_err(|e| format!("杩樺師 icon.ico 澶辫触: {}", e))?;

            let _ = crate::windows_api::set_hidden_system(&current_icon.to_string_lossy());
            crate::desktop_ini::create(folder_path, crate::icon_storage::LOCAL_ICON_FILE_NAME)
                .map_err(|e| format!("Failed to recreate desktop.ini: {}", e))?;
            let _ = crate::windows_api::set_hidden_system(&current_ini.to_string_lossy());
        } else if backup_ini.exists() {
            fs::copy(&backup_ini, &current_ini)
                .map_err(|e| format!("杩樺師 desktop.ini 澶辫触: {}", e))?;
            let _ = crate::windows_api::set_hidden_system(&current_ini.to_string_lossy());
        }

        if current_ini.exists() {
            let _ = crate::windows_api::set_folder_readonly(folder_path);
        } else {
            let _ = crate::windows_api::clear_attributes(folder_path);
        }

        let _ = crate::windows_api::notify_shell_update(folder_path);

        self.conn
            .execute(
                "UPDATE history SET can_restore = 0 WHERE id = ?1",
                [entry.id],
            )
            .map_err(|e| format!("鏇存柊鍘嗗彶璁板綍澶辫触: {}", e))?;

        Ok(format!("宸茶繕鍘熸枃浠跺す: {}", folder_path))
    }
    /// 清除文件夹图标 (恢复默认)
    pub fn clear_folder_icon(&self, folder_path: &str) -> Result<String, String> {
        let folder = Path::new(folder_path);
        let icon_path = folder.join(crate::icon_storage::LOCAL_ICON_FILE_NAME);
        let ini_path = folder.join("desktop.ini");

        let managed_icon_to_cleanup = if ini_path.exists() {
            fs::read_to_string(&ini_path)
                .ok()
                .and_then(|content| crate::desktop_ini::parse_icon_resource(&content))
                .map(|resource| crate::desktop_ini::resolve_icon_path(folder_path, &resource))
                .filter(|path| crate::icon_storage::is_managed_centralized_icon(path))
        } else {
            None
        };

        let _ = crate::windows_api::clear_attributes(folder_path);
        if ini_path.exists() {
            let _ = crate::windows_api::clear_attributes(&ini_path.to_string_lossy());
        }
        if icon_path.exists() {
            let _ = crate::windows_api::clear_attributes(&icon_path.to_string_lossy());
        }
        if let Some(path) = managed_icon_to_cleanup.as_ref() {
            if path.exists() {
                let _ = crate::windows_api::clear_attributes(&path.to_string_lossy());
            }
        }

        if icon_path.exists() {
            fs::remove_file(&icon_path).map_err(|e| format!("鍒犻櫎鍥炬爣澶辫触: {}", e))?;
        }
        if ini_path.exists() {
            fs::remove_file(&ini_path).map_err(|e| format!("鍒犻櫎 desktop.ini 澶辫触: {}", e))?;
        }
        if let Some(path) = managed_icon_to_cleanup.as_ref() {
            if path.exists() {
                fs::remove_file(path)
                    .map_err(|e| format!("Failed to remove centralized icon file: {}", e))?;
            }
        }

        let _ = crate::windows_api::notify_shell_update(folder_path);

        Ok(format!("宸叉竻闄ゆ枃浠跺す鍥炬爣: {}", folder_path))
    }
}

/// 简单的时间戳生成 (不依赖 chrono)
fn chrono_lite_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    format!("{}", duration.as_secs())
}

// ============ Tauri Commands ============

/// 获取文件夹的历史记录
#[tauri::command]
pub async fn get_folder_history(folder_path: String) -> Result<Vec<HistoryEntry>, String> {
    let manager = HistoryManager::new()?;
    manager.get_folder_history(&folder_path)
}

/// 获取最近的历史记录
#[tauri::command]
pub async fn get_recent_history(limit: Option<usize>) -> Result<Vec<HistoryEntry>, String> {
    let manager = HistoryManager::new()?;
    manager.get_recent_history(limit.unwrap_or(20))
}

/// 还原文件夹图标
#[tauri::command]
pub async fn restore_folder_icon(folder_path: String) -> Result<String, String> {
    let manager = HistoryManager::new()?;
    manager.restore_folder(&folder_path)
}

/// 清除文件夹图标
#[tauri::command]
pub async fn clear_folder_icon(folder_path: String) -> Result<String, String> {
    let manager = HistoryManager::new()?;
    manager.clear_folder_icon(&folder_path)
}

/// 检查文件夹是否可还原
#[tauri::command]
pub async fn can_restore_folder(folder_path: String) -> Result<bool, String> {
    let manager = HistoryManager::new()?;
    let history = manager.get_folder_history(&folder_path)?;
    Ok(history
        .iter()
        .any(|e| e.backup_path.is_some() && e.can_restore))
}
