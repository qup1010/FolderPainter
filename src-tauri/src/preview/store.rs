//! 预览存储模块
//!
//! 使用 SQLite 存储预览会话、文件夹和版本信息

use rusqlite::{Connection, params};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use uuid::Uuid;

use super::{
    FolderPreview, IconVersion, PreviewSession, SessionStatus, SessionSummary, VersionStatus,
};

/// 预览存储管理器
pub struct PreviewStore {
    conn: Connection,
}

impl PreviewStore {
    /// 获取数据库路径 (与 history.db 共用)
    fn db_path() -> Result<PathBuf, String> {
        let app_data =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 路径".to_string())?;

        let data_dir = PathBuf::from(app_data).join("FolderPainter");

        if !data_dir.exists() {
            fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
        }

        Ok(data_dir.join("history.db"))
    }

    /// 获取预览图存储目录
    fn previews_dir() -> Result<PathBuf, String> {
        let app_data =
            std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 路径".to_string())?;

        let dir = PathBuf::from(app_data)
            .join("FolderPainter")
            .join("previews");

        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("创建预览目录失败: {}", e))?;
        }

        Ok(dir)
    }

    /// 生成文件夹哈希 (用于存储路径)
    fn folder_hash(folder_path: &str) -> String {
        let mut hasher = DefaultHasher::new();
        folder_path.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// 创建新的预览存储管理器
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path()?;
        let conn =
            Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

        // 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON", [])
            .map_err(|e| format!("启用外键失败: {}", e))?;

        // 创建表
        Self::init_tables(&conn)?;

        Ok(Self { conn })
    }

    /// 初始化数据库表
    fn init_tables(conn: &Connection) -> Result<(), String> {
        // 预览会话表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS preview_sessions (
                id TEXT PRIMARY KEY,
                status TEXT DEFAULT 'active',
                chat_history TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|e| format!("创建 preview_sessions 表失败: {}", e))?;

        // 文件夹预览表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS preview_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                folder_path TEXT NOT NULL,
                folder_name TEXT NOT NULL,
                display_index INTEGER NOT NULL,
                current_version_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES preview_sessions(id) ON DELETE CASCADE,
                UNIQUE (session_id, folder_path)
            )",
            [],
        )
        .map_err(|e| format!("创建 preview_folders 表失败: {}", e))?;

        // 图标版本表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS preview_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folder_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                prompt TEXT NOT NULL,
                image_path TEXT NOT NULL,
                thumbnail_base64 TEXT,
                status TEXT DEFAULT 'ready',
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (folder_id) REFERENCES preview_folders(id) ON DELETE CASCADE
            )",
            [],
        )
        .map_err(|e| format!("创建 preview_versions 表失败: {}", e))?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_preview_folders_session
             ON preview_folders(session_id)",
            [],
        )
        .map_err(|e| format!("创建索引失败: {}", e))?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_preview_versions_folder
             ON preview_versions(folder_id)",
            [],
        )
        .map_err(|e| format!("创建索引失败: {}", e))?;

        Ok(())
    }

    // ============ 会话操作 ============

    /// 创建新会话
    pub fn create_session(&self, folder_paths: &[String]) -> Result<PreviewSession, String> {
        let session_id = Uuid::new_v4().to_string();
        let now = current_timestamp();

        self.conn
            .execute(
                "INSERT INTO preview_sessions (id, status, created_at, updated_at)
                 VALUES (?1, 'active', ?2, ?2)",
                params![session_id, now],
            )
            .map_err(|e| format!("创建会话失败: {}", e))?;

        // 添加文件夹
        let folders = self.add_folders(&session_id, folder_paths)?;

        Ok(PreviewSession {
            id: session_id,
            folders,
            status: SessionStatus::Active,
            chat_history: None,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    /// 加载会话
    pub fn load_session(&self, session_id: &str) -> Result<PreviewSession, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, status, chat_history, created_at, updated_at
                 FROM preview_sessions WHERE id = ?1",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let session = stmt
            .query_row(params![session_id], |row| {
                let status_str: String = row.get(1)?;
                Ok(PreviewSession {
                    id: row.get(0)?,
                    folders: Vec::new(), // 稍后加载
                    status: status_str.parse().unwrap_or(SessionStatus::Active),
                    chat_history: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| format!("加载会话失败: {}", e))?;

        // 加载文件夹
        let folders = self.load_folders(session_id)?;

        Ok(PreviewSession { folders, ..session })
    }

    /// 获取会话列表
    pub fn list_sessions(&self) -> Result<Vec<SessionSummary>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT s.id, s.status, s.created_at, s.updated_at,
                        (SELECT COUNT(*) FROM preview_folders WHERE session_id = s.id) as folder_count
                 FROM preview_sessions s
                 WHERE s.status = 'active'
                 ORDER BY s.updated_at DESC",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let sessions = stmt
            .query_map([], |row| {
                let status_str: String = row.get(1)?;
                Ok(SessionSummary {
                    id: row.get(0)?,
                    status: status_str.parse().unwrap_or(SessionStatus::Active),
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    folder_count: row.get(4)?,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for s in sessions {
            if let Ok(session) = s {
                result.push(session);
            }
        }

        Ok(result)
    }

    /// 删除会话
    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        // 删除预览图文件
        let previews_dir = Self::previews_dir()?;
        let session_dir = previews_dir.join(session_id);
        if session_dir.exists() {
            let _ = fs::remove_dir_all(&session_dir);
        }

        // 删除数据库记录 (级联删除)
        self.conn
            .execute(
                "DELETE FROM preview_sessions WHERE id = ?1",
                params![session_id],
            )
            .map_err(|e| format!("删除会话失败: {}", e))?;

        Ok(())
    }

    /// 更新会话状态
    pub fn update_session_status(
        &self,
        session_id: &str,
        status: SessionStatus,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE preview_sessions SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params![status.to_string(), current_timestamp(), session_id],
            )
            .map_err(|e| format!("更新会话状态失败: {}", e))?;

        Ok(())
    }

    /// 保存聊天历史
    pub fn save_chat_history(&self, session_id: &str, chat_json: &str) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE preview_sessions SET chat_history = ?1, updated_at = ?2 WHERE id = ?3",
                params![chat_json, current_timestamp(), session_id],
            )
            .map_err(|e| format!("保存聊天历史失败: {}", e))?;

        Ok(())
    }

    // ============ 文件夹操作 ============

    /// 添加文件夹到会话
    pub fn add_folders(
        &self,
        session_id: &str,
        folder_paths: &[String],
    ) -> Result<Vec<FolderPreview>, String> {
        // 获取当前最大编号
        let max_index: i32 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(display_index), 0) FROM preview_folders WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let mut folders = Vec::new();

        for (i, path) in folder_paths.iter().enumerate() {
            let folder_name = std::path::Path::new(path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());

            let display_index = max_index + i as i32 + 1;

            // 检查是否已存在
            let exists: bool = self
                .conn
                .query_row(
                    "SELECT 1 FROM preview_folders WHERE session_id = ?1 AND folder_path = ?2",
                    params![session_id, path],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if exists {
                continue; // 跳过已存在的文件夹
            }

            self.conn
                .execute(
                    "INSERT INTO preview_folders (session_id, folder_path, folder_name, display_index)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![session_id, path, folder_name, display_index],
                )
                .map_err(|e| format!("添加文件夹失败: {}", e))?;

            let folder_id = self.conn.last_insert_rowid();

            folders.push(FolderPreview {
                id: folder_id,
                folder_path: path.clone(),
                folder_name,
                display_index,
                versions: Vec::new(),
                current_version_id: None,
            });
        }

        // 更新会话时间
        self.conn
            .execute(
                "UPDATE preview_sessions SET updated_at = ?1 WHERE id = ?2",
                params![current_timestamp(), session_id],
            )
            .map_err(|e| format!("更新会话时间失败: {}", e))?;

        Ok(folders)
    }

    /// 加载会话的所有文件夹
    fn load_folders(&self, session_id: &str) -> Result<Vec<FolderPreview>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, folder_path, folder_name, display_index, current_version_id
                 FROM preview_folders WHERE session_id = ?1 ORDER BY display_index",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let folders = stmt
            .query_map(params![session_id], |row| {
                Ok(FolderPreview {
                    id: row.get(0)?,
                    folder_path: row.get(1)?,
                    folder_name: row.get(2)?,
                    display_index: row.get(3)?,
                    versions: Vec::new(), // 稍后加载
                    current_version_id: row.get(4)?,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for folder in folders {
            if let Ok(mut f) = folder {
                // 加载版本
                f.versions = self.load_versions(f.id)?;
                result.push(f);
            }
        }

        Ok(result)
    }

    /// 获取单个文件夹
    pub fn get_folder(&self, session_id: &str, folder_path: &str) -> Result<FolderPreview, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, folder_path, folder_name, display_index, current_version_id
                 FROM preview_folders WHERE session_id = ?1 AND folder_path = ?2",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let mut folder = stmt
            .query_row(params![session_id, folder_path], |row| {
                Ok(FolderPreview {
                    id: row.get(0)?,
                    folder_path: row.get(1)?,
                    folder_name: row.get(2)?,
                    display_index: row.get(3)?,
                    versions: Vec::new(),
                    current_version_id: row.get(4)?,
                })
            })
            .map_err(|e| format!("获取文件夹失败: {}", e))?;

        folder.versions = self.load_versions(folder.id)?;

        Ok(folder)
    }

    /// 从会话移除文件夹
    pub fn remove_folder(&self, session_id: &str, folder_path: &str) -> Result<(), String> {
        // 获取文件夹信息以删除预览图
        let folder = self.get_folder(session_id, folder_path)?;

        // 删除预览图文件
        let previews_dir = Self::previews_dir()?;
        let folder_hash = Self::folder_hash(folder_path);
        let folder_dir = previews_dir.join(session_id).join(&folder_hash);
        if folder_dir.exists() {
            let _ = fs::remove_dir_all(&folder_dir);
        }

        // 删除数据库记录
        self.conn
            .execute(
                "DELETE FROM preview_folders WHERE id = ?1",
                params![folder.id],
            )
            .map_err(|e| format!("删除文件夹失败: {}", e))?;

        Ok(())
    }

    /// 清空会话中的所有文件夹
    pub fn clear_folders(&self, session_id: &str) -> Result<(), String> {
        // 删除该会话下的所有预览图目录
        let previews_dir = Self::previews_dir()?;
        let session_dir = previews_dir.join(session_id);
        if session_dir.exists() {
            let _ = fs::remove_dir_all(&session_dir);
        }

        // 删除数据库记录（preview_versions 由外键级联删除）
        self.conn
            .execute(
                "DELETE FROM preview_folders WHERE session_id = ?1",
                params![session_id],
            )
            .map_err(|e| format!("清空文件夹失败: {}", e))?;

        // 更新会话时间
        self.conn
            .execute(
                "UPDATE preview_sessions SET updated_at = ?1 WHERE id = ?2",
                params![current_timestamp(), session_id],
            )
            .map_err(|e| format!("更新会话时间失败: {}", e))?;

        Ok(())
    }

    /// 重新排序文件夹编号
    pub fn reindex_folders(&self, session_id: &str) -> Result<(), String> {
        let folders = self.load_folders(session_id)?;

        for (i, folder) in folders.iter().enumerate() {
            let new_index = i as i32 + 1;
            if folder.display_index != new_index {
                self.conn
                    .execute(
                        "UPDATE preview_folders SET display_index = ?1 WHERE id = ?2",
                        params![new_index, folder.id],
                    )
                    .map_err(|e| format!("重新排序失败: {}", e))?;
            }
        }

        Ok(())
    }

    // ============ 版本操作 ============

    /// 加载文件夹的所有版本
    fn load_versions(&self, folder_id: i64) -> Result<Vec<IconVersion>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, version_number, prompt, image_path, thumbnail_base64,
                        status, error_message, created_at
                 FROM preview_versions WHERE folder_id = ?1 ORDER BY version_number",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let versions = stmt
            .query_map(params![folder_id], |row| {
                let status_str: String = row.get(5)?;
                Ok(IconVersion {
                    id: row.get(0)?,
                    version_number: row.get(1)?,
                    prompt: row.get(2)?,
                    image_path: row.get(3)?,
                    thumbnail_base64: row.get(4)?,
                    status: status_str.parse().unwrap_or(VersionStatus::Ready),
                    error_message: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for v in versions {
            if let Ok(version) = v {
                result.push(version);
            }
        }

        Ok(result)
    }

    /// 获取单个版本
    pub fn get_version(&self, version_id: i64) -> Result<IconVersion, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, version_number, prompt, image_path, thumbnail_base64,
                        status, error_message, created_at
                 FROM preview_versions WHERE id = ?1",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        stmt.query_row(params![version_id], |row| {
            let status_str: String = row.get(5)?;
            Ok(IconVersion {
                id: row.get(0)?,
                version_number: row.get(1)?,
                prompt: row.get(2)?,
                image_path: row.get(3)?,
                thumbnail_base64: row.get(4)?,
                status: status_str.parse().unwrap_or(VersionStatus::Ready),
                error_message: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("获取版本失败: {}", e))
    }

    /// 创建新版本
    pub fn create_version(
        &self,
        folder_id: i64,
        version_number: i32,
        prompt: &str,
        image_path: &str,
        status: VersionStatus,
    ) -> Result<i64, String> {
        self.conn
            .execute(
                "INSERT INTO preview_versions (folder_id, version_number, prompt, image_path, status)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![folder_id, version_number, prompt, image_path, status.to_string()],
            )
            .map_err(|e| format!("创建版本失败: {}", e))?;

        Ok(self.conn.last_insert_rowid())
    }

    /// 更新版本状态
    pub fn update_version_status(
        &self,
        version_id: i64,
        status: VersionStatus,
        error_message: Option<&str>,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE preview_versions SET status = ?1, error_message = ?2 WHERE id = ?3",
                params![status.to_string(), error_message, version_id],
            )
            .map_err(|e| format!("更新版本状态失败: {}", e))?;

        Ok(())
    }

    /// 更新版本状态和缩略图
    pub fn update_version_with_thumbnail(
        &self,
        version_id: i64,
        status: VersionStatus,
        thumbnail: &str,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE preview_versions SET status = ?1, thumbnail_base64 = ?2 WHERE id = ?3",
                params![status.to_string(), thumbnail, version_id],
            )
            .map_err(|e| format!("更新版本失败: {}", e))?;

        Ok(())
    }

    /// 设置当前版本
    pub fn set_current_version(&self, folder_id: i64, version_id: i64) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE preview_folders SET current_version_id = ?1 WHERE id = ?2",
                params![version_id, folder_id],
            )
            .map_err(|e| format!("设置当前版本失败: {}", e))?;

        Ok(())
    }

    /// 删除版本
    pub fn delete_version(&self, version_id: i64) -> Result<(), String> {
        // 获取版本信息
        let version = self.get_version(version_id)?;

        // 删除图像文件
        let image_path = std::path::Path::new(&version.image_path);
        if image_path.exists() {
            let _ = fs::remove_file(image_path);
        }

        // 删除数据库记录
        self.conn
            .execute("DELETE FROM preview_versions WHERE id = ?1", params![version_id])
            .map_err(|e| format!("删除版本失败: {}", e))?;

        Ok(())
    }

    // ============ 文件操作 ============

    /// 获取版本图像存储路径
    pub fn get_version_image_path(
        &self,
        session_id: &str,
        folder_path: &str,
        version_number: i32,
    ) -> Result<PathBuf, String> {
        let base = Self::previews_dir()?;
        let folder_hash = Self::folder_hash(folder_path);
        let version_dir = base.join(session_id).join(&folder_hash);

        if !version_dir.exists() {
            fs::create_dir_all(&version_dir)
                .map_err(|e| format!("创建版本目录失败: {}", e))?;
        }

        Ok(version_dir.join(format!("v{}.png", version_number)))
    }

    /// 保存图像文件
    pub fn save_image(&self, path: &PathBuf, image_bytes: &[u8]) -> Result<(), String> {
        fs::write(path, image_bytes).map_err(|e| format!("保存图像失败: {}", e))
    }

    /// 生成缩略图 base64
    pub fn generate_thumbnail(&self, image_bytes: &[u8]) -> Result<String, String> {
        use image::ImageReader;
        use std::io::Cursor;

        let img = ImageReader::new(Cursor::new(image_bytes))
            .with_guessed_format()
            .map_err(|e| format!("读取图像失败: {}", e))?
            .decode()
            .map_err(|e| format!("解码图像失败: {}", e))?;

        // 缩放到 64x64
        let thumbnail = img.thumbnail(64, 64);

        let mut buffer = Vec::new();
        thumbnail
            .write_to(
                &mut Cursor::new(&mut buffer),
                image::ImageFormat::Png,
            )
            .map_err(|e| format!("生成缩略图失败: {}", e))?;

        use base64::Engine;
        let base64_data = base64::engine::general_purpose::STANDARD.encode(&buffer);

        Ok(format!("data:image/png;base64,{}", base64_data))
    }
}

/// 获取当前时间戳 (ISO 8601 格式)
fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();

    let secs = duration.as_secs();
    // 转换为简单的 ISO 格式: YYYY-MM-DD HH:MM:SS
    let days_since_epoch = secs / 86400;
    let remaining_secs = secs % 86400;
    let hours = remaining_secs / 3600;
    let minutes = (remaining_secs % 3600) / 60;
    let seconds = remaining_secs % 60;

    // 简单的日期计算 (从 1970-01-01 开始)
    let (year, month, day) = days_to_ymd(days_since_epoch);

    format!("{:04}-{:02}-{:02} {:02}:{:02}:{:02}", year, month, day, hours, minutes, seconds)
}

/// 将天数转换为年月日
fn days_to_ymd(days: u64) -> (u32, u32, u32) {
    let mut remaining_days = days as i64;
    let mut year = 1970i32;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let days_in_months: [i64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1u32;
    for days_in_month in days_in_months.iter() {
        if remaining_days < *days_in_month {
            break;
        }
        remaining_days -= *days_in_month;
        month += 1;
    }

    let day = remaining_days as u32 + 1;

    (year as u32, month, day)
}

/// 检查是否为闰年
fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}
