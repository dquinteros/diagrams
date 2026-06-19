/// Surface a frontend (webview) error in the dev terminal for debugging.
#[tauri::command]
pub fn report_error(message: String) {
    eprintln!("[webview-error] {message}");
}
