use serde::{Deserialize, Serialize};
use std::process::Command;

const ALLOWED_APPS: &[&str] = &[
    "Google Chrome",
    "Safari",
    "Antigravity",
    "Visual Studio Code",
    "Claude",
    "Cursor",
    "Terminal",
    "Finder",
    "ChatGPT",
    "WhatsApp",
    "Telegram",
    "Calculator",
    "TextEdit",
    "System Settings",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenAppResult {
    pub success: bool,
    pub app: String,
    pub path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn cmd_open_app(app_name: String, path: Option<String>) -> Result<OpenAppResult, String> {
    let is_allowed = ALLOWED_APPS.iter().any(|&a| a.eq_ignore_ascii_case(&app_name));
    if !is_allowed {
        return Err(format!("Application '{}' is not in the approved application allowlist.", app_name));
    }

    let mut cmd = Command::new("/usr/bin/open");
    cmd.arg("-a").arg(&app_name);

    if let Some(ref p) = path {
        let expanded = if p.starts_with('~') {
            if let Ok(home) = std::env::var("HOME") {
                format!("{}{}", home, &p[1..])
            } else {
                p.clone()
            }
        } else {
            p.clone()
        };
        cmd.arg(&expanded);
    }

    match cmd.status() {
        Ok(status) if status.success() => Ok(OpenAppResult {
            success: true,
            app: app_name.clone(),
            path,
            message: format!("Successfully launched macOS application: '{}'", app_name),
        }),
        Ok(status) => Err(format!("open command exited with status: {}", status)),
        Err(e) => Err(format!("Failed to execute open: {}", e)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenUrlResult {
    pub success: bool,
    pub url: String,
    pub browser: String,
    pub message: String,
}

#[tauri::command]
pub fn cmd_open_url(url: String, browser: Option<String>) -> Result<OpenUrlResult, String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Invalid URL. Only HTTP and HTTPS URLs are permitted.".into());
    }

    let target_browser = browser.unwrap_or_else(|| "Google Chrome".into());
    let mut cmd = Command::new("/usr/bin/open");
    cmd.arg("-a").arg(&target_browser).arg(&url);

    match cmd.status() {
        Ok(status) if status.success() => Ok(OpenUrlResult {
            success: true,
            url: url.clone(),
            browser: target_browser.clone(),
            message: format!("Opened URL in {}: {}", target_browser, url),
        }),
        _ => {
            // Fallback to default system browser
            let mut fallback = Command::new("/usr/bin/open");
            fallback.arg(&url);
            match fallback.status() {
                Ok(st) if st.success() => Ok(OpenUrlResult {
                    success: true,
                    url: url.clone(),
                    browser: "Default Browser".into(),
                    message: format!("Opened URL in default browser: {}", url),
                }),
                Ok(st) => Err(format!("Failed to open URL with status: {}", st)),
                Err(e) => Err(format!("Failed to execute open for URL: {}", e)),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rejects_unapproved_apps() {
        assert!(cmd_open_app("MaliciousApp".into(), None).is_err());
        assert!(cmd_open_app("RandomPayload.sh".into(), None).is_err());
    }

    #[test]
    fn test_allows_approved_app_names() {
        assert!(ALLOWED_APPS.contains(&"Google Chrome"));
        assert!(ALLOWED_APPS.contains(&"Visual Studio Code"));
        assert!(ALLOWED_APPS.contains(&"Terminal"));
        assert!(ALLOWED_APPS.contains(&"Finder"));
        assert!(ALLOWED_APPS.contains(&"Calculator"));
        assert!(ALLOWED_APPS.contains(&"TextEdit"));
        assert!(ALLOWED_APPS.contains(&"System Settings"));
    }

    #[test]
    fn test_rejects_invalid_url_schemes() {
        assert!(cmd_open_url("file:///etc/passwd".into(), None).is_err());
        assert!(cmd_open_url("javascript:alert(1)".into(), None).is_err());
        assert!(cmd_open_url("ftp://example.com".into(), None).is_err());
    }
}
