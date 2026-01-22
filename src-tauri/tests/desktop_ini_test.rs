use std::fs;
use tauri_app_lib::desktop_ini;

#[test]
fn test_create_desktop_ini() {
    let temp_dir = std::env::temp_dir().join("folder_painter_test");
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).unwrap();
    }
    fs::create_dir_all(&temp_dir).unwrap();

    let folder_path = temp_dir.to_str().unwrap();
    let icon_name = "test_icon.ico";

    // Attempt to create desktop.ini
    let result = desktop_ini::create(folder_path, icon_name);
    assert!(result.is_ok(), "Failed to create desktop.ini");

    let ini_path = temp_dir.join("desktop.ini");
    assert!(ini_path.exists(), "desktop.ini was not created");

    let content = fs::read_to_string(ini_path).unwrap();

    // Check for required content
    assert!(
        content.contains("[.ShellClassInfo]"),
        "Missing [.ShellClassInfo]"
    );
    assert!(
        content.contains(&format!("IconResource={},0", icon_name)),
        "Missing IconResource"
    );
    assert!(content.contains("[ViewState]"), "Missing [ViewState]");
    assert!(
        content.contains("FolderType=Generic"),
        "Missing FolderType=Generic"
    );

    // Cleanup
    fs::remove_dir_all(temp_dir).unwrap();
}
