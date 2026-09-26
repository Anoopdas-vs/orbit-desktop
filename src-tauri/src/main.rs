// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::{
    cmd_check_app, cmd_check_permissions, cmd_control_action, cmd_exec_command,
    cmd_get_computer_state, cmd_get_ui_tree, cmd_gui_action, cmd_open_app, cmd_open_url,
    cmd_prompt_ai, cmd_resolve_youtube, cmd_youtube_skip_ad,
    cmd_get_file_metadata, cmd_read_file, cmd_create_file, cmd_move_to_trash,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            cmd_open_app,
            cmd_open_url,
            cmd_check_app,
            cmd_exec_command,
            cmd_gui_action,
            cmd_prompt_ai,
            cmd_youtube_skip_ad,
            cmd_resolve_youtube,
            cmd_control_action,
            cmd_get_computer_state,
            cmd_get_ui_tree,
            cmd_check_permissions,
            cmd_get_file_metadata,
            cmd_read_file,
            cmd_create_file,
            cmd_move_to_trash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running janki application");
}
