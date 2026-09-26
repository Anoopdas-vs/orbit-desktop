use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ControlResult {
    pub success: bool,
    pub action: String,
    pub target: Option<String>,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct WindowInfo {
    pub id: Option<String>,
    pub app_name: String,
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_minimized: bool,
    pub is_frontmost: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComputerStateInfo {
    pub active_app: String,
    pub active_window: String,
    pub running_apps: Vec<String>,
    pub volume: i32,
    pub is_muted: bool,
}

fn sanitize_applescript(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "")
        .replace('\n', " ")
        .replace('\t', " ")
        .chars()
        .take(1000)
        .collect()
}

fn run_osascript(script: &str) -> Result<String, String> {
    match Command::new("/usr/bin/osascript").args(["-e", script]).output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Err(if stderr.is_empty() { format!("osascript failed with code {:?}", out.status.code()) } else { stderr })
            }
        }
        Err(e) => Err(format!("Failed to execute /usr/bin/osascript: {}", e)),
    }
}

// -----------------------------------------------------------------------------
// Application Controls
// -----------------------------------------------------------------------------

pub fn activate_app(app_name: &str) -> ControlResult {
    let clean = sanitize_applescript(app_name);
    let script = format!("tell application \"{}\" to activate", clean);
    match run_osascript(&script) {
        Ok(out) => ControlResult {
            success: true,
            action: "activate_app".into(),
            target: Some(clean),
            output: Some(if out.is_empty() { "Application brought to front.".into() } else { out }),
            error: None,
        },
        Err(err) => {
            // Fallback to open -a
            let status = Command::new("/usr/bin/open").arg("-a").arg(&clean).status();
            match status {
                Ok(s) if s.success() => ControlResult {
                    success: true,
                    action: "activate_app".into(),
                    target: Some(clean),
                    output: Some("Application activated via open -a.".into()),
                    error: None,
                },
                _ => ControlResult {
                    success: false,
                    action: "activate_app".into(),
                    target: Some(clean),
                    output: None,
                    error: Some(err),
                },
            }
        }
    }
}

pub fn quit_app(app_name: &str, force: bool) -> ControlResult {
    let clean = sanitize_applescript(app_name);
    let script = if force {
        format!(
            "tell application \"System Events\" to do shell script \"killall -9 \\\"{}\\\"\"",
            clean
        )
    } else {
        format!("tell application \"{}\" to quit", clean)
    };

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "quit_app".into(),
            target: Some(clean),
            output: Some(format!("Application '{}' terminated.", app_name)),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "quit_app".into(),
            target: Some(clean),
            output: None,
            error: Some(e),
        },
    }
}

pub fn get_active_app() -> (String, String) {
    let script = r#"
      tell application "System Events"
        try
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp
          set winTitle to ""
          try
            if (count of windows of frontApp) > 0 then
              set winTitle to name of front window of frontApp
            end if
          end try
          return appName & "|||" & winTitle
        on error
          return "Finder|||"
        end try
      end tell
    "#;

    match run_osascript(script) {
        Ok(out) => {
            let parts: Vec<&str> = out.split("|||").collect();
            let app = parts.first().unwrap_or(&"").trim().to_string();
            let win = parts.get(1).unwrap_or(&"").trim().to_string();
            (app, win)
        }
        Err(_) => ("Finder".to_string(), "".to_string()),
    }
}

pub fn list_running_apps() -> Vec<String> {
    let script = r#"
      tell application "System Events"
        try
          return name of every process whose background only is false
        on error
          return ""
        end try
      end tell
    "#;

    match run_osascript(script) {
        Ok(out) => out
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        Err(_) => vec![],
    }
}

// -----------------------------------------------------------------------------
// Window Controls
// -----------------------------------------------------------------------------

pub fn focus_window(app_name: &str, window_title: Option<&str>) -> ControlResult {
    let clean_app = sanitize_applescript(app_name);
    let script = match window_title {
        Some(title) => {
            let clean_title = sanitize_applescript(title);
            format!(
                r#"
                tell application "System Events"
                  tell process "{}"
                    set frontmost to true
                    try
                      perform action "AXRaise" of (first window whose name contains "{}")
                    end try
                  end tell
                end tell
                "#,
                clean_app, clean_title
            )
        }
        None => {
            format!(
                r#"
                tell application "System Events"
                  tell process "{}"
                    set frontmost to true
                  end tell
                end tell
                "#,
                clean_app
            )
        }
    };

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "focus_window".into(),
            target: Some(format!("{}:{:?}", app_name, window_title)),
            output: Some("Window focused successfully.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "focus_window".into(),
            target: Some(format!("{}:{:?}", app_name, window_title)),
            output: None,
            error: Some(e),
        },
    }
}

pub fn minimize_window(app_name: &str) -> ControlResult {
    let clean = sanitize_applescript(app_name);
    let script = format!(
        r#"
        tell application "System Events"
          tell process "{}"
            if (count of windows) > 0 then
              set value of attribute "AXMinimized" of window 1 to true
            end if
          end tell
        end tell
        "#,
        clean
    );

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "minimize_window".into(),
            target: Some(clean),
            output: Some("Window minimized.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "minimize_window".into(),
            target: Some(clean),
            output: None,
            error: Some(e),
        },
    }
}

pub fn zoom_window(app_name: &str) -> ControlResult {
    let clean = sanitize_applescript(app_name);
    let script = format!(
        r#"
        tell application "System Events"
          tell process "{}"
            if (count of windows) > 0 then
              try
                click (first button of window 1 whose subrole is "AXZoomButton")
              end try
            end if
          end tell
        end tell
        "#,
        clean
    );

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "zoom_window".into(),
            target: Some(clean),
            output: Some("Window zoom toggled.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "zoom_window".into(),
            target: Some(clean),
            output: None,
            error: Some(e),
        },
    }
}

pub fn resize_and_move_window(app_name: &str, x: Option<i32>, y: Option<i32>, w: Option<i32>, h: Option<i32>) -> ControlResult {
    let clean = sanitize_applescript(app_name);
    let mut parts = Vec::new();
    if let (Some(px), Some(py)) = (x, y) {
        parts.push(format!("set position of window 1 to {{{}, {}}}", px, py));
    }
    if let (Some(pw), Some(ph)) = (w, h) {
        parts.push(format!("set size of window 1 to {{{}, {}}}", pw, ph));
    }

    let script = format!(
        r#"
        tell application "System Events"
          tell process "{}"
            if (count of windows) > 0 then
              {}
            end if
          end tell
        end tell
        "#,
        clean,
        parts.join("\n              ")
    );

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "resize_and_move_window".into(),
            target: Some(clean),
            output: Some("Window position and size updated.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "resize_and_move_window".into(),
            target: Some(clean),
            output: None,
            error: Some(e),
        },
    }
}

pub fn close_window(app_name: &str) -> ControlResult {
    let clean = sanitize_applescript(app_name);
    let script = format!(
        r#"
        tell application "System Events"
          tell process "{}"
            if (count of windows) > 0 then
              try
                click (first button of window 1 whose subrole is "AXCloseButton")
              on error
                keystroke "w" using command down
              end try
            end if
          end tell
        end tell
        "#,
        clean
    );

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "close_window".into(),
            target: Some(clean),
            output: Some("Window closed.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "close_window".into(),
            target: Some(clean),
            output: None,
            error: Some(e),
        },
    }
}

// -----------------------------------------------------------------------------
// Mouse Controls
// -----------------------------------------------------------------------------

pub fn mouse_click(x: Option<i32>, y: Option<i32>, button: Option<&str>, double_click: bool) -> ControlResult {
    let btn = button.unwrap_or("left");
    let script = match (x, y) {
        (Some(px), Some(py)) => {
            if btn == "right" {
                format!(
                    r#"
                    tell application "System Events"
                      -- Right click at coordinates
                      tell application "System Events" to click at {{{}, {}}} using control down
                    end tell
                    "#,
                    px, py
                )
            } else if double_click {
                format!(
                    r#"
                    tell application "System Events"
                      click at {{{}, {}}}
                      delay 0.1
                      click at {{{}, {}}}
                    end tell
                    "#,
                    px, py, px, py
                )
            } else {
                format!(
                    r#"
                    tell application "System Events"
                      click at {{{}, {}}}
                    end tell
                    "#,
                    px, py
                )
            }
        }
        (None, None) => {
            // Click at current cursor position
            format!(
                r#"
                tell application "System Events"
                  click
                end tell
                "#
            )
        }
        _ => return ControlResult {
            success: false,
            action: "mouse_click".into(),
            target: None,
            output: None,
            error: Some("Both x and y must be provided for coordinate clicks.".into()),
        },
    };

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: if double_click { "mouse_double_click".into() } else { "mouse_click".into() },
            target: Some(format!("x:{:?}, y:{:?}, btn:{}", x, y, btn)),
            output: Some("Mouse click performed.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "mouse_click".into(),
            target: Some(format!("x:{:?}, y:{:?}, btn:{}", x, y, btn)),
            output: None,
            error: Some(e),
        },
    }
}

pub fn mouse_scroll(delta_y: i32) -> ControlResult {
    // Scroll simulation using key codes (Page Up / Page Down or Arrow Up / Arrow Down with repeat)
    let keycode = if delta_y < 0 { 125 } else { 126 }; // Down or Up arrow
    let steps = delta_y.abs().clamp(1, 10);
    let script = format!(
        r#"
        tell application "System Events"
          repeat {} times
            key code {}
            delay 0.02
          end repeat
        end tell
        "#,
        steps, keycode
    );

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "mouse_scroll".into(),
            target: Some(format!("delta_y:{}", delta_y)),
            output: Some(format!("Scrolled {} steps.", steps)),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "mouse_scroll".into(),
            target: Some(format!("delta_y:{}", delta_y)),
            output: None,
            error: Some(e),
        },
    }
}

// -----------------------------------------------------------------------------
// Keyboard Controls
// -----------------------------------------------------------------------------

pub fn key_type(text: &str, app_name: Option<&str>) -> ControlResult {
    let clean_text = sanitize_applescript(text);
    let script = match app_name {
        Some(app) => {
            let clean_app = sanitize_applescript(app);
            format!(
                r#"
                tell application "System Events"
                  tell process "{}"
                    set frontmost to true
                    keystroke "{}"
                  end tell
                end tell
                "#,
                clean_app, clean_text
            )
        }
        None => {
            format!(
                r#"
                tell application "System Events"
                  keystroke "{}"
                end tell
                "#,
                clean_text
            )
        }
    };

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "key_type".into(),
            target: app_name.map(|s| s.to_string()),
            output: Some(format!("Typed {} characters.", text.len())),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "key_type".into(),
            target: app_name.map(|s| s.to_string()),
            output: None,
            error: Some(e),
        },
    }
}

pub fn key_press(key: &str, app_name: Option<&str>) -> ControlResult {
    let code: i32 = match key.to_lowercase().as_str() {
        "return" | "enter" => 36,
        "tab" => 48,
        "space" => 49,
        "escape" | "esc" => 53,
        "backspace" | "delete" => 51,
        "forward_delete" => 117,
        "left" => 123,
        "right" => 124,
        "down" => 125,
        "up" => 126,
        "home" => 115,
        "end" => 119,
        "pageup" => 116,
        "pagedown" => 121,
        _ => 36,
    };

    let script = match app_name {
        Some(app) => {
            let clean_app = sanitize_applescript(app);
            format!(
                r#"
                tell application "System Events"
                  tell process "{}"
                    set frontmost to true
                    key code {}
                  end tell
                end tell
                "#,
                clean_app, code
            )
        }
        None => {
            format!(
                r#"
                tell application "System Events"
                  key code {}
                end tell
                "#,
                code
            )
        }
    };

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "key_press".into(),
            target: Some(key.to_string()),
            output: Some(format!("Key code {} pressed.", code)),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "key_press".into(),
            target: Some(key.to_string()),
            output: None,
            error: Some(e),
        },
    }
}

pub fn key_shortcut(modifiers: &[String], key: &str, app_name: Option<&str>) -> ControlResult {
    let mut modifier_clauses = Vec::new();
    for m in modifiers {
        match m.to_lowercase().as_str() {
            "cmd" | "command" => modifier_clauses.push("command down"),
            "shift" => modifier_clauses.push("shift down"),
            "alt" | "option" => modifier_clauses.push("option down"),
            "ctrl" | "control" => modifier_clauses.push("control down"),
            _ => {}
        }
    }

    let mod_str = if modifier_clauses.is_empty() {
        "".to_string()
    } else {
        format!("using {{{}}}", modifier_clauses.join(", "))
    };

    let key_action = match key.to_lowercase().as_str() {
        "return" | "enter" => format!("key code 36 {}", mod_str),
        "tab" => format!("key code 48 {}", mod_str),
        "space" => format!("key code 49 {}", mod_str),
        "escape" | "esc" => format!("key code 53 {}", mod_str),
        "left" => format!("key code 123 {}", mod_str),
        "right" => format!("key code 124 {}", mod_str),
        "down" => format!("key code 125 {}", mod_str),
        "up" => format!("key code 126 {}", mod_str),
        _ => {
            let char_str = key.chars().next().unwrap_or('a').to_string();
            format!("keystroke \"{}\" {}", char_str, mod_str)
        }
    };

    let script = match app_name {
        Some(app) => {
            let clean_app = sanitize_applescript(app);
            format!(
                r#"
                tell application "System Events"
                  tell process "{}"
                    set frontmost to true
                    {}
                  end tell
                end tell
                "#,
                clean_app, key_action
            )
        }
        None => {
            format!(
                r#"
                tell application "System Events"
                  {}
                end tell
                "#,
                key_action
            )
        }
    };

    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "key_shortcut".into(),
            target: Some(format!("{}+{}", modifiers.join("+"), key)),
            output: Some("Shortcut executed.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "key_shortcut".into(),
            target: Some(format!("{}+{}", modifiers.join("+"), key)),
            output: None,
            error: Some(e),
        },
    }
}

// -----------------------------------------------------------------------------
// System Controls (Volume, Mute, Media)
// -----------------------------------------------------------------------------

pub fn get_system_audio() -> (i32, bool) {
    let script = r#"
      try
        set vol to output volume of (get volume settings)
        set muted to output muted of (get volume settings)
        return (vol as text) & "|||" & (muted as text)
      on error
        return "50|||false"
      end try
    "#;

    match run_osascript(script) {
        Ok(out) => {
            let parts: Vec<&str> = out.split("|||").collect();
            let vol = parts.first().unwrap_or(&"50").trim().parse::<i32>().unwrap_or(50);
            let muted = parts.get(1).unwrap_or(&"false").trim() == "true";
            (vol, muted)
        }
        Err(_) => (50, false),
    }
}

pub fn set_system_volume(level: i32) -> ControlResult {
    let clamped = level.clamp(0, 100);
    let script = format!("set volume output volume {}", clamped);
    match run_osascript(&script) {
        Ok(_) => ControlResult {
            success: true,
            action: "set_volume".into(),
            target: Some(format!("{}", clamped)),
            output: Some(format!("Volume set to {}%.", clamped)),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "set_volume".into(),
            target: Some(format!("{}", clamped)),
            output: None,
            error: Some(e),
        },
    }
}

pub fn toggle_system_mute() -> ControlResult {
    let script = "set volume output muted (not (output muted of (get volume settings)))";
    match run_osascript(script) {
        Ok(_) => {
            let (_, muted) = get_system_audio();
            ControlResult {
                success: true,
                action: "toggle_mute".into(),
                target: None,
                output: Some(format!("System audio is now {}.", if muted { "muted" } else { "unmuted" })),
                error: None,
            }
        }
        Err(e) => ControlResult {
            success: false,
            action: "toggle_mute".into(),
            target: None,
            output: None,
            error: Some(e),
        },
    }
}

pub fn media_control(action: &str) -> ControlResult {
    let clean = action.to_lowercase();
    // Dispatch via standard media apps or system key simulation
    let script = match clean.as_str() {
        "play" | "pause" | "playpause" => {
            r#"
            try
              tell application "Spotify" to playpause
            on error
              try
                tell application "Music" to playpause
              end try
            end try
            "#
        }
        "next" => {
            r#"
            try
              tell application "Spotify" to next track
            on error
              try
                tell application "Music" to next track
              end try
            end try
            "#
        }
        "previous" | "prev" => {
            r#"
            try
              tell application "Spotify" to previous track
            on error
              try
                tell application "Music" to previous track
              end try
            end try
            "#
        }
        _ => return ControlResult {
            success: false,
            action: "media_control".into(),
            target: Some(clean),
            output: None,
            error: Some("Supported media actions: playpause, next, previous".into()),
        },
    };

    match run_osascript(script) {
        Ok(_) => ControlResult {
            success: true,
            action: "media_control".into(),
            target: Some(clean),
            output: Some("Media command dispatched.".into()),
            error: None,
        },
        Err(e) => ControlResult {
            success: false,
            action: "media_control".into(),
            target: Some(clean),
            output: None,
            error: Some(e),
        },
    }
}

// -----------------------------------------------------------------------------
// Unified Tauri Command Handler
// -----------------------------------------------------------------------------

#[tauri::command]
pub fn cmd_control_action(
    action: String,
    app_name: Option<String>,
    window_title: Option<String>,
    text: Option<String>,
    key: Option<String>,
    modifiers: Option<Vec<String>>,
    x: Option<i32>,
    y: Option<i32>,
    width: Option<i32>,
    height: Option<i32>,
    delta_y: Option<i32>,
    volume_level: Option<i32>,
    force: Option<bool>,
) -> Result<ControlResult, String> {
    let app = app_name.as_deref().unwrap_or("System Events");

    let res = match action.as_str() {
        "activate_app" => activate_app(app),
        "quit_app" => quit_app(app, force.unwrap_or(false)),
        "focus_window" => focus_window(app, window_title.as_deref()),
        "minimize_window" => minimize_window(app),
        "zoom_window" => zoom_window(app),
        "close_window" => close_window(app),
        "resize_window" => resize_and_move_window(app, None, None, width, height),
        "move_window" => resize_and_move_window(app, x, y, None, None),
        "mouse_click" => mouse_click(x, y, Some("left"), false),
        "mouse_double_click" => mouse_click(x, y, Some("left"), true),
        "mouse_right_click" => mouse_click(x, y, Some("right"), false),
        "mouse_scroll" => mouse_scroll(delta_y.unwrap_or(3)),
        "key_type" => key_type(text.as_deref().unwrap_or(""), Some(app)),
        "key_press" => key_press(key.as_deref().unwrap_or("return"), Some(app)),
        "key_shortcut" => {
            let mods = modifiers.unwrap_or_else(|| vec!["cmd".into()]);
            key_shortcut(&mods, key.as_deref().unwrap_or("c"), Some(app))
        }
        "set_volume" => set_system_volume(volume_level.unwrap_or(50)),
        "toggle_mute" => toggle_system_mute(),
        "media_control" => media_control(text.as_deref().unwrap_or("playpause")),
        _ => return Err(format!("Unsupported control action: {}", action)),
    };

    Ok(res)
}

#[tauri::command]
pub fn cmd_get_computer_state() -> ComputerStateInfo {
    let (active_app, active_window) = get_active_app();
    let running_apps = list_running_apps();
    let (volume, is_muted) = get_system_audio();

    ComputerStateInfo {
        active_app,
        active_window,
        running_apps,
        volume,
        is_muted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_applescript() {
        let input = "hello\\world \"quotes\" \n test";
        let sanitized = sanitize_applescript(input);
        assert!(sanitized.contains("\\\\"));
        assert!(sanitized.contains("\\\""));
        assert!(!sanitized.contains('\n'));
    }

    #[test]
    fn test_volume_clamping() {
        let clamped_high = 150.clamp(0, 100);
        let clamped_low = (-20).clamp(0, 100);
        assert_eq!(clamped_high, 100);
        assert_eq!(clamped_low, 0);
    }
}
