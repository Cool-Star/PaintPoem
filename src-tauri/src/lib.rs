// 绘诗成帖 - Tauri 应用入口
// 所有业务逻辑通过前端 React + TypeScript 实现
// Rust 端仅作为 Tauri 框架的宿主，负责插件初始化

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            // 禁用右键菜单
            if let tauri::WindowEvent::WebviewReady = event {
                window.eval("document.addEventListener('contextmenu', e => e.preventDefault());").ok();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
