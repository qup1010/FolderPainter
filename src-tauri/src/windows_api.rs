use windows::core::PCWSTR;
use windows::Win32::Storage::FileSystem::{SetFileAttributesW, FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM, FILE_ATTRIBUTE_NORMAL};
use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_UPDATEDIR, SHCNE_ASSOCCHANGED, SHCNF_PATHW, SHCNF_IDLIST};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Security::{
    GetSidSubAuthority, GetSidSubAuthorityCount, GetTokenInformation, TokenElevation,
    TokenIntegrityLevel, TOKEN_ELEVATION, TOKEN_MANDATORY_LABEL, TOKEN_QUERY,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

#[derive(serde::Serialize, Clone)]
pub struct RuntimeDiagnostics {
    pub is_elevated: bool,
    pub integrity_level: String,
    pub integrity_rid: u32,
}

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

pub fn get_runtime_diagnostics() -> Result<RuntimeDiagnostics, String> {
    unsafe {
        let mut token = HANDLE::default();
        OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).map_err(|e| e.to_string())?;

        let mut elevation = TOKEN_ELEVATION::default();
        let mut ret_len = 0u32;
        GetTokenInformation(
            token,
            TokenElevation,
            Some((&mut elevation as *mut TOKEN_ELEVATION).cast()),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut ret_len,
        )
        .map_err(|e| e.to_string())?;

        let mut il_buf = vec![0u8; 256];
        GetTokenInformation(
            token,
            TokenIntegrityLevel,
            Some(il_buf.as_mut_ptr().cast()),
            il_buf.len() as u32,
            &mut ret_len,
        )
        .map_err(|e| e.to_string())?;

        let tml = &*(il_buf.as_ptr() as *const TOKEN_MANDATORY_LABEL);
        let sid = tml.Label.Sid;
        let count = *GetSidSubAuthorityCount(sid) as usize;
        let rid = if count == 0 {
            0
        } else {
            *GetSidSubAuthority(sid, (count - 1) as u32)
        };

        let integrity_level = match rid {
            0x0000 => "Untrusted",
            0x1000 => "Low",
            0x2000 => "Medium",
            0x2100 => "MediumPlus",
            0x3000 => "High",
            0x4000 => "System",
            0x5000 => "ProtectedProcess",
            _ => "Unknown",
        }
        .to_string();

        Ok(RuntimeDiagnostics {
            is_elevated: elevation.TokenIsElevated != 0,
            integrity_level,
            integrity_rid: rid,
        })
    }
}
