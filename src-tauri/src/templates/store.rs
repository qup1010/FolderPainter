//! 模板存储模块
//!
//! 使用 SQLite 存储模板信息

use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;

use super::{CreateTemplateRequest, IconTemplate, UpdateTemplateRequest};

/// 模板存储管理器
pub struct TemplateStore {
    conn: Connection,
}

impl TemplateStore {
    /// 获取数据库路径 (与其他数据共用 history.db)
    fn db_path() -> Result<PathBuf, String> {
        let app_data = std::env::var("APPDATA").map_err(|_| "无法获取 APPDATA 路径".to_string())?;

        let data_dir = PathBuf::from(app_data).join("FolderPainter");

        if !data_dir.exists() {
            fs::create_dir_all(&data_dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
        }

        Ok(data_dir.join("history.db"))
    }

    /// 创建新的模板存储管理器
    pub fn new() -> Result<Self, String> {
        let db_path = Self::db_path()?;
        let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

        // 确保表存在
        Self::init_tables(&conn)?;

        Ok(Self { conn })
    }

    /// 初始化 (仅在应用启动时调用)
    pub fn init() -> Result<(), String> {
        let store = Self::new()?;
        store.init_builtin_templates_internal()
    }

    /// 初始化数据库表
    fn init_tables(conn: &Connection) -> Result<(), String> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS icon_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                preset_id TEXT,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                prompt TEXT NOT NULL,
                cover_image TEXT,
                category TEXT NOT NULL DEFAULT 'general',
                is_builtin INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )
        .map_err(|e| format!("创建 icon_templates 表失败: {}", e))?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_templates_category ON icon_templates(category)",
            [],
        )
        .map_err(|e| format!("创建索引失败: {}", e))?;

        // 尝试添加 preset_id 列（已存在的数据库升级）
        let _ = conn.execute("ALTER TABLE icon_templates ADD COLUMN preset_id TEXT", []);

        Ok(())
    }

    /// 初始化内置模板 (仅在表为空时插入，不再每次重置)
    fn init_builtin_templates_internal(&self) -> Result<(), String> {
        // 检查模板表是否为空（首次运行）
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM icon_templates", [], |row| row.get(0))
            .map_err(|e| format!("查询模板数量失败: {}", e))?;

        // 如果已有模板，不做任何操作（保留用户修改）
        if count > 0 {
            println!("[模板] 已有 {} 个模板，跳过初始化", count);
            return Ok(());
        }

        println!("[模板] 首次运行，插入内置模板...");

        // 内置模板列表 (使用 preset_id 标识，用于多语言和封面图)
        // 格式: (preset_id, prompt, category_id)
        // name 和 description 将通过前端翻译文件获取
        let builtin_templates = vec![
            (
                "3d_clay",
                "cute 3D claymorphism style, soft pastel colors, rounded edges, plasticine texture, studio lighting, playful vibe",
                "3d_style"
            ),
            (
                "glassmorphism",
                "glassmorphism style, frosted glass texture, translucent layers, soft blur, vibrant gradients underneath, modern UI design",
                "modern_ui"
            ),
            (
                "cyberpunk",
                "cyberpunk style, glowing neon lines, dark background, futuristic vibes, cyan and magenta color palette, high contrast",
                "scifi"
            ),
            (
                "low_poly",
                "low poly style, geometric facets, sharp edges, minimalist, faceted 3D art, vibrant flat colors",
                "3d_style"
            ),
            (
                "paper_cut",
                "paper cutout art style, layered paper texture, deep shadows, craft paper aesthetic, subtle gradients, dimensional look",
                "artistic"
            ),
            (
                "pixel_art",
                "pixel art style, 8-bit retro game aesthetic, sharp pixels, vibrant palette, nostalgic",
                "retro"
            ),
            (
                "watercolor",
                "watercolor painting style, soft edges, artistic splashes, hand-painted texture, on white paper background",
                "artistic"
            ),
            (
                "minimalist_line",
                "minimalist line art, continuous black line drawing on white background, abstract, clean, elegant",
                "artistic"
            ),
            (
                "ukiyo_e",
                "Ukiyo-e style, traditional Japanese woodblock print, bold outlines, flat perspective, textured paper",
                "artistic"
            ),
            (
                "vaporwave",
                "vaporwave aesthetic, retro 80s style, glitched effects, statue busts, palm trees, pink and blue gradients",
                "retro"
            ),
            (
                "industrial_metal",
                "industrial metal style, brushed steel texture, metallic reflections, bolts and rivets, heavy machinery look",
                "realistic"
            ),
            (
                "pop_art",
                "Pop Art style, comic book aesthetic, halftones, bold black outlines, vibrant primary colors, Andy Warhol vibe",
                "artistic"
            ),
        ];

        for (preset_id, prompt, category) in builtin_templates {
            self.conn.execute(
                "INSERT INTO icon_templates (preset_id, name, description, prompt, category, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
                params![preset_id, preset_id, "", prompt, category],
            )
            .map_err(|e| format!("插入内置模板失败: {}", e))?;
        }

        Ok(())
    }

    // ============ CRUD 操作 ============

    /// 获取所有模板
    pub fn list_templates(&self) -> Result<Vec<IconTemplate>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, preset_id, name, description, prompt, cover_image, category, is_builtin, created_at, updated_at
                 FROM icon_templates ORDER BY is_builtin DESC, category, name",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let templates = stmt
            .query_map([], |row| {
                Ok(IconTemplate {
                    id: row.get(0)?,
                    preset_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    prompt: row.get(4)?,
                    cover_image: row.get(5)?,
                    category: row.get(6)?,
                    is_builtin: row.get::<_, i32>(7)? == 1,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for t in templates {
            if let Ok(template) = t {
                result.push(template);
            }
        }

        Ok(result)
    }

    /// 按分类获取模板
    pub fn list_templates_by_category(&self, category: &str) -> Result<Vec<IconTemplate>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, preset_id, name, description, prompt, cover_image, category, is_builtin, created_at, updated_at
                 FROM icon_templates WHERE category = ?1 ORDER BY is_builtin DESC, name",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let templates = stmt
            .query_map(params![category], |row| {
                Ok(IconTemplate {
                    id: row.get(0)?,
                    preset_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    prompt: row.get(4)?,
                    cover_image: row.get(5)?,
                    category: row.get(6)?,
                    is_builtin: row.get::<_, i32>(7)? == 1,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for t in templates {
            if let Ok(template) = t {
                result.push(template);
            }
        }

        Ok(result)
    }

    /// 获取所有分类
    pub fn list_categories(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT DISTINCT category FROM icon_templates ORDER BY category")
            .map_err(|e| format!("准备查询失败: {}", e))?;

        let categories = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("查询失败: {}", e))?;

        let mut result = Vec::new();
        for c in categories {
            if let Ok(category) = c {
                result.push(category);
            }
        }

        Ok(result)
    }

    /// 获取单个模板
    pub fn get_template(&self, template_id: i64) -> Result<IconTemplate, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, preset_id, name, description, prompt, cover_image, category, is_builtin, created_at, updated_at
                 FROM icon_templates WHERE id = ?1",
            )
            .map_err(|e| format!("准备查询失败: {}", e))?;

        stmt.query_row(params![template_id], |row| {
            Ok(IconTemplate {
                id: row.get(0)?,
                preset_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                prompt: row.get(4)?,
                cover_image: row.get(5)?,
                category: row.get(6)?,
                is_builtin: row.get::<_, i32>(7)? == 1,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("获取模板失败: {}", e))
    }

    /// 创建模板
    pub fn create_template(&self, request: &CreateTemplateRequest) -> Result<IconTemplate, String> {
        let now = current_timestamp();

        self.conn
            .execute(
                "INSERT INTO icon_templates (name, description, prompt, cover_image, category, is_builtin, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)",
                params![
                    request.name,
                    request.description,
                    request.prompt,
                    request.cover_image,
                    request.category,
                    now
                ],
            )
            .map_err(|e| format!("创建模板失败: {}", e))?;

        let template_id = self.conn.last_insert_rowid();
        self.get_template(template_id)
    }

    /// 更新模板 (内置模板也可以修改，但仅限于描述等非核心字段)
    pub fn update_template(
        &self,
        template_id: i64,
        request: &UpdateTemplateRequest,
    ) -> Result<IconTemplate, String> {
        let template = self.get_template(template_id)?;

        let now = current_timestamp();

        // 构建更新 SQL
        let mut updates = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(name) = &request.name {
            updates.push("name = ?");
            values.push(Box::new(name.clone()));
        }
        if let Some(description) = &request.description {
            updates.push("description = ?");
            values.push(Box::new(description.clone()));
        }
        if let Some(prompt) = &request.prompt {
            updates.push("prompt = ?");
            values.push(Box::new(prompt.clone()));
        }
        if let Some(cover_image) = &request.cover_image {
            updates.push("cover_image = ?");
            values.push(Box::new(cover_image.clone()));
        }
        if let Some(category) = &request.category {
            updates.push("category = ?");
            values.push(Box::new(category.clone()));
        }

        if updates.is_empty() {
            return Ok(template);
        }

        updates.push("updated_at = ?");
        values.push(Box::new(now));

        let sql = format!(
            "UPDATE icon_templates SET {} WHERE id = ?",
            updates.join(", ")
        );

        values.push(Box::new(template_id));

        // 执行更新
        let params: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();
        self.conn
            .execute(&sql, params.as_slice())
            .map_err(|e| format!("更新模板失败: {}", e))?;

        self.get_template(template_id)
    }

    /// 删除模板 (包括内置模板)
    pub fn delete_template(&self, template_id: i64) -> Result<(), String> {
        // 验证模板存在
        let _template = self.get_template(template_id)?;

        self.conn
            .execute(
                "DELETE FROM icon_templates WHERE id = ?1",
                params![template_id],
            )
            .map_err(|e| format!("删除模板失败: {}", e))?;

        Ok(())
    }
    /// 重命名分类
    pub fn rename_category(&self, old_name: &str, new_name: &str) -> Result<(), String> {
        if old_name == new_name {
            return Ok(());
        }

        // 更新所有匹配的行
        self.conn
            .execute(
                "UPDATE icon_templates SET category = ?1, updated_at = ?2 WHERE category = ?3",
                params![new_name, current_timestamp(), old_name],
            )
            .map_err(|e| format!("重命名分类失败: {}", e))?;

        Ok(())
    }

    /// 删除分类 (将该分类下的模板移动到"general")
    pub fn delete_category_by_name(&self, category: &str) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE icon_templates SET category = 'general', updated_at = ?1 WHERE category = ?2",
                params![current_timestamp(), category],
            )
            .map_err(|e| format!("删除分类失败: {}", e))?;

        Ok(())
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

    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, hours, minutes, seconds
    )
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
