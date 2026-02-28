// 绘诗成帖 - Tauri 应用入口
// 所有业务逻辑通过前端 React + TypeScript 实现
// Rust 端仅作为 Tauri 框架的宿主，负责插件初始化

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 禁用右键菜单 - 在窗口创建后执行
            let window = app.get_webview_window("main").unwrap();
            window.eval("document.addEventListener('contextmenu', e => e.preventDefault());").ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
