use tauri::Manager;

#[tauri::command]
fn open_grok_window(app: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("grok") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create a new native webview window for grok.com
    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        "grok",
        tauri::WebviewUrl::External("https://grok.com".parse().unwrap()),
    )
    .title("Grok — xAI")
    .inner_size(1200.0, 800.0)
    .resizable(true)
    .center();

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_url_window(app: tauri::AppHandle, url: String, title: String) -> Result<(), String> {
    let label = format!("external-{}", url.len());
    
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let parsed_url: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    
    tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(parsed_url),
    )
    .title(&title)
    .inner_size(1100.0, 750.0)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![open_grok_window, open_url_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
