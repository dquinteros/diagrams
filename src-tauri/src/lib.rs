pub mod commands;
pub mod error;
pub mod export;
pub mod parser;
pub mod sql;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::parse::parse_dbml,
            commands::sql_export::generate_sql,
            commands::file_ops::open_file,
            commands::file_ops::save_file,
            commands::file_ops::export_sql_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
