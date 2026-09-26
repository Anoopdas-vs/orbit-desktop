use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckAppResult {
    pub app_name: String,
    pub available: bool,
    pub is_running: bool,
    pub app_path: Option<String>,
    pub fastest_mode: String,
    pub message: String,
}

#[tauri::command]
pub fn cmd_check_app(app_name: String) -> CheckAppResult {
    let lower = app_name.trim().to_lowercase();
    let (standard_name, bundle) = match lower.as_str() {
        "chatgpt" => ("ChatGPT", "ChatGPT.app"),
        "claude" => ("Claude", "Claude.app"),
        "chrome" | "google chrome" => ("Google Chrome", "Google Chrome.app"),
        "safari" => ("Safari", "Safari.app"),
        "antigravity" => ("Antigravity", "Antigravity.app"),
        "vscode" | "vs code" | "visual studio code" => ("Visual Studio Code", "Visual Studio Code.app"),
        "cursor" => ("Cursor", "Cursor.app"),
        "terminal" => ("Terminal", "Terminal.app"),
        "finder" => ("Finder", "Finder.app"),
        "spotify" => ("Spotify", "Spotify.app"),
        "slack" => ("Slack", "Slack.app"),
        "discord" => ("Discord", "Discord.app"),
        "whatsapp" => ("WhatsApp", "WhatsApp.app"),
        "telegram" => ("Telegram", "Telegram.app"),
        _ => (app_name.as_str(), ""),
    };

    let bundle_name = if bundle.is_empty() {
        format!("{}.app", app_name)
    } else {
        bundle.to_string()
    };

    let search_dirs = [
        "/Applications",
        "/System/Applications",
        "/System/Applications/Utilities",
        "/System/Library/CoreServices",
    ];

    let mut found_path: Option<String> = None;
    for dir in search_dirs {
        let p = Path::new(dir).join(&bundle_name);
        if p.exists() {
            found_path = Some(p.to_string_lossy().to_string());
            break;
        }
    }

    let is_available = found_path.is_some();
    let fastest_mode = if is_available { "native_app" } else { "browser_web" };

    // Check if running via osascript
    let check_script = format!("application \"{}\" is running", standard_name);
    let is_running = Command::new("/usr/bin/osascript")
        .args(["-e", &check_script])
        .output()
        .map(|out| String::from_utf8_lossy(&out.stdout).trim() == "true")
        .unwrap_or(false);

    let message = if is_available {
        format!(
            "Application \"{}\" is installed locally ({}). Fastest execution mode: native app.",
            standard_name,
            if is_running { "currently running" } else { "ready to launch" }
        )
    } else {
        format!(
            "Application \"{}\" is not installed locally. Fastest execution mode: browser fallback.",
            standard_name
        )
    };

    CheckAppResult {
        app_name: standard_name.to_string(),
        available: is_available,
        is_running,
        app_path: found_path,
        fastest_mode: fastest_mode.to_string(),
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_app_detection() {
        let finder = cmd_check_app("Finder".into());
        assert!(finder.available);
        assert_eq!(finder.fastest_mode, "native_app");

        let terminal = cmd_check_app("Terminal".into());
        assert!(terminal.available);
        assert_eq!(terminal.fastest_mode, "native_app");
    }

    #[test]
    fn test_nonexistent_app_handling() {
        let fake = cmd_check_app("DefinitelyFakeAppXYZ123".into());
        assert!(!fake.available);
        assert_eq!(fake.fastest_mode, "browser_web");
    }
}
