use std::fs;
use tauri_plugin_dialog::DialogExt;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
    pub path: String,
    pub content: String,
}

#[tauri::command]
pub async fn open_file(app: tauri::AppHandle) -> Result<Option<FileResult>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("DBML files", &["dbml"])
        .add_filter("All files", &["*"])
        .blocking_pick_file();

    match file {
        Some(file_path) => {
            let path_buf = file_path
                .into_path()
                .map_err(|e| format!("Invalid path: {}", e))?;
            let content = fs::read_to_string(&path_buf)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            Ok(Some(FileResult {
                path: path_buf.to_string_lossy().to_string(),
                content,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn save_file(
    app: tauri::AppHandle,
    content: String,
    path: Option<String>,
) -> Result<Option<String>, String> {
    let save_path = if let Some(p) = path {
        std::path::PathBuf::from(p)
    } else {
        let file = app
            .dialog()
            .file()
            .add_filter("DBML files", &["dbml"])
            .set_file_name("schema.dbml")
            .blocking_save_file();

        match file {
            Some(fp) => fp.into_path().map_err(|e| format!("Invalid path: {}", e))?,
            None => return Ok(None),
        }
    };

    fs::write(&save_path, content)
        .map_err(|e| format!("Failed to save file: {}", e))?;

    Ok(Some(save_path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn export_sql_file(
    app: tauri::AppHandle,
    sql: String,
    dialect: String,
) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("SQL files", &["sql"])
        .set_file_name(&format!("schema_{}.sql", dialect))
        .blocking_save_file();

    match file {
        Some(fp) => {
            let path_buf = fp.into_path().map_err(|e| format!("Invalid path: {}", e))?;
            fs::write(&path_buf, sql)
                .map_err(|e| format!("Failed to save SQL: {}", e))?;
            Ok(Some(path_buf.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}
