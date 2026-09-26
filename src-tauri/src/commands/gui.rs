use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

fn sanitize_for_applescript(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "")
        .replace('\n', " ")
        .replace('\t', " ")
        .chars()
        .take(500)
        .collect()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GuiActionResult {
    pub success: bool,
    pub action: String,
    pub app_name: String,
    pub stdout: String,
    pub error: Option<String>,
}

#[tauri::command]
pub fn cmd_gui_action(
    action: String,
    app_name: Option<String>,
    target: Option<String>,
    text: Option<String>,
    key: Option<String>,
    shortcut: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<GuiActionResult, String> {
    let clean_app = sanitize_for_applescript(app_name.as_deref().unwrap_or("System Events"));
    let clean_text = sanitize_for_applescript(text.as_deref().unwrap_or(""));

    let script = match action.as_str() {
        "click_button" => {
            let clean_target = sanitize_for_applescript(target.as_deref().unwrap_or("Submit"));
            format!(
                "tell application \"System Events\"\n  tell process \"{}\"\n    set frontmost to true\n    click (first button whose name is \"{}\" or description is \"{}\")\n  end tell\nend tell",
                clean_app, clean_target, clean_target
            )
        }
        "click_coordinate" => {
            let coord_x = x.unwrap_or(0);
            let coord_y = y.unwrap_or(0);
            format!(
                "tell application \"System Events\"\n  click at {{{}, {}}}\nend tell",
                coord_x, coord_y
            )
        }
        "type_text" | "fill_form" => {
            format!(
                "tell application \"System Events\"\n  tell process \"{}\"\n    set frontmost to true\n    keystroke \"{}\"\n  end tell\nend tell",
                clean_app, clean_text
            )
        }
        "press_shortcut" => {
            let sc = shortcut.unwrap_or_else(|| "cmd+v".into()).to_lowercase();
            if sc.contains("enter") || sc.contains("return") {
                format!(
                    "tell application \"System Events\"\n  tell process \"{}\"\n    set frontmost to true\n    keystroke return using command down\n  end tell\nend tell",
                    clean_app
                )
            } else {
                let letter = sc.replace("cmd+", "").replace('+', "").chars().next().unwrap_or('v');
                format!(
                    "tell application \"System Events\"\n  tell process \"{}\"\n    set frontmost to true\n    keystroke \"{}\" using command down\n  end tell\nend tell",
                    clean_app, letter
                )
            }
        }
        "press_key" => {
            let k = key.unwrap_or_else(|| "return".into()).to_lowercase();
            let code = match k.as_str() {
                "return" | "enter" => 36,
                "tab" => 48,
                "escape" => 53,
                "space" => 49,
                _ => 36,
            };
            format!(
                "tell application \"System Events\"\n  tell process \"{}\"\n    set frontmost to true\n    key code {}\n  end tell\nend tell",
                clean_app, code
            )
        }
        _ => return Err(format!("Unsupported GUI action: {}", action)),
    };

    match Command::new("/usr/bin/osascript").args(["-e", &script]).output() {
        Ok(out) => {
            let success = out.status.success();
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
            Ok(GuiActionResult {
                success,
                action,
                app_name: clean_app,
                stdout: if stdout.is_empty() { "Action dispatched successfully.".into() } else { stdout },
                error: if success { None } else { Some(stderr) },
            })
        }
        Err(e) => Err(format!("Failed to execute osascript: {}", e)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PromptAiResult {
    pub success: bool,
    pub tool: String,
    pub mode: String,
    pub message: String,
}

#[tauri::command]
pub fn cmd_prompt_ai(tool: String, prompt: String, _use_clipboard: Option<bool>) -> Result<PromptAiResult, String> {
    let lower_tool = tool.to_lowercase();
    let app_name = if lower_tool.contains("claude") { "Claude" } else { "ChatGPT" };
    let app_exists = Path::new(&format!("/Applications/{}.app", app_name)).exists();

    if app_exists {
        // Safe clipboard paste: pbcopy
        use std::io::Write;
        if let Ok(mut child) = Command::new("/usr/bin/pbcopy").stdin(std::process::Stdio::piped()).spawn() {
            if let Some(mut stdin) = child.stdin.take() {
                let _ = stdin.write_all(prompt.as_bytes());
            }
            let _ = child.wait();
        }

        let _ = Command::new("/usr/bin/open").arg("-a").arg(app_name).status();
        let paste_script = format!(
            "delay 0.3\ntell application \"System Events\"\n  tell process \"{}\"\n    set frontmost to true\n    keystroke \"v\" using command down\n    key code 36\n  end tell\nend tell",
            app_name
        );
        let _ = Command::new("/usr/bin/osascript").args(["-e", &paste_script]).status();

        Ok(PromptAiResult {
            success: true,
            tool: app_name.to_string(),
            mode: "native_app".into(),
            message: format!("Dispatched prompt to native {} via clipboard.", app_name),
        })
    } else {
        let url = if lower_tool.contains("claude") {
            "https://claude.ai".to_string()
        } else {
            format!("https://chatgpt.com/?q={}", urlencoding_simple(&prompt))
        };
        let _ = Command::new("/usr/bin/open").arg("-a").arg("Google Chrome").arg(&url).status();

        Ok(PromptAiResult {
            success: true,
            tool,
            mode: "browser_web".into(),
            message: "Dispatched prompt via browser fallback.".into(),
        })
    }
}

fn urlencoding_simple(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~' {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}
