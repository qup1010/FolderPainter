use crate::config::IconStorage;
use std::path::{Path, PathBuf};

pub const LOCAL_ICON_FILE_NAME: &str = "icon.ico";

fn app_data_dir() -> Result<PathBuf, String> {
    let app_data =
        std::env::var("APPDATA").map_err(|_| "Failed to read APPDATA environment variable".to_string())?;
    Ok(PathBuf::from(app_data).join("FolderPainter"))
}

fn managed_icon_dir_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("icons"))
}

fn ensure_managed_icon_dir() -> Result<PathBuf, String> {
    let dir = managed_icon_dir_path()?;
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create centralized icon directory: {}", e))?;
    }
    Ok(dir)
}

fn stable_folder_hash(folder_path: &str) -> u64 {
    // Deterministic FNV-1a hash so one folder always maps to one icon file.
    const OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const PRIME: u64 = 0x100000001b3;

    let mut hash = OFFSET_BASIS;
    for byte in folder_path.to_ascii_lowercase().as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(PRIME);
    }
    hash
}

fn managed_icon_filename(folder_path: &str) -> String {
    format!("folder_{:016x}.ico", stable_folder_hash(folder_path))
}

pub fn resolve_icon_target(
    folder_path: &str,
    storage_mode: &IconStorage,
) -> Result<(PathBuf, String), String> {
    match storage_mode {
        IconStorage::InFolder => {
            let icon_path = Path::new(folder_path).join(LOCAL_ICON_FILE_NAME);
            Ok((icon_path, LOCAL_ICON_FILE_NAME.to_string()))
        }
        IconStorage::Centralized => {
            let icon_path = ensure_managed_icon_dir()?.join(managed_icon_filename(folder_path));
            let icon_resource = icon_path.to_string_lossy().to_string();
            Ok((icon_path, icon_resource))
        }
    }
}

pub fn is_managed_centralized_icon(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }

    let Ok(dir) = managed_icon_dir_path() else {
        return false;
    };

    path.starts_with(dir)
}
