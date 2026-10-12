mod runner;

use tauri::RunEvent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        // Opens link doors in the default browser and local paths with the OS handler.
        .plugin(tauri_plugin_opener::init())
        .manage(runner::Procs::default())
        .invoke_handler(tauri::generate_handler![
            runner::run_process,
            runner::kill_process,
            runner::wait_for_port,
            runner::read_text_file,
            runner::write_text_file,
            runner::scripts_dir,
            runner::data_file,
            runner::set_data_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building KOMA Home")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                runner::kill_all(app);
            }
        });
}
