#[cfg(target_os = "windows")]
#[test]
fn test_set_folder_readonly() {
    use std::fs;
    use tauri_app_lib::windows_api;

    let test_dir = "test_folder_readonly";
    if fs::metadata(test_dir).is_ok() {
        fs::remove_dir_all(test_dir).unwrap();
    }
    fs::create_dir(test_dir).unwrap();

    let result = windows_api::set_folder_readonly(test_dir);
    
    assert!(result.is_ok(), "Failed to set folder readonly: {:?}", result.err());

    // Cleanup
    // fs::remove_dir_all(test_dir).unwrap(); // Keep it for inspection if failed? No, clean up.
    let _ = fs::remove_dir_all(test_dir);
}

#[cfg(target_os = "windows")]
#[test]
fn test_set_hidden_system() {
    use std::fs;
    use tauri_app_lib::windows_api;

    let test_dir = "test_folder_hidden";
    if fs::metadata(test_dir).is_ok() {
        fs::remove_dir_all(test_dir).unwrap();
    }
    fs::create_dir(test_dir).unwrap();
    
    let file_path = format!("{}/desktop.ini", test_dir);
    fs::write(&file_path, "[.ShellClassInfo]\nIconResource=icon.ico,0").unwrap();

    let result = windows_api::set_hidden_system(&file_path);
    
    assert!(result.is_ok(), "Failed to set hidden/system: {:?}", result.err());

    // Cleanup
    let _ = fs::remove_dir_all(test_dir);
}
