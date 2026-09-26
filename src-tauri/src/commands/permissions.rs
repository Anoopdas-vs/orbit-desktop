use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermissionStatus {
    pub accessibility_granted: bool,
    pub screen_recording_granted: bool,
    pub automation_granted: bool,
    pub microphone_granted: bool,
    pub message: String,
    pub action_required: Option<String>,
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[cfg(not(target_os = "macos"))]
fn AXIsProcessTrusted() -> bool {
    true
}

#[tauri::command]
pub fn cmd_check_permissions() -> PermissionStatus {
    let accessibility_granted = unsafe { AXIsProcessTrusted() };

    // Check Automation (System Events accessibility) via a lightweight probe
    let automation_granted = Command::new("/usr/bin/osascript")
        .args(["-e", "tell application \"System Events\" to get name of first process"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    // Screen recording probe via screencapture to /dev/null or temporary dry test
    let screen_recording_granted = Command::new("/usr/sbin/screencapture")
        .args(["-t", "jpg", "-x", "-R", "0,0,1,1", "/tmp/janki_perm_probe.jpg"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    let _ = std::fs::remove_file("/tmp/janki_perm_probe.jpg");

    let microphone_granted = true; // Handled primarily by WebRTC/AVFoundation in browser/webview

    let (message, action_required) = if !accessibility_granted {
        (
            "macOS Accessibility permission is NOT granted. Janki cannot click or inspect UI elements until permission is granted.".into(),
            Some("Open System Settings > Privacy & Security > Accessibility, and enable Janki.".into())
        )
    } else if !automation_granted {
        (
            "macOS Automation permission is required for System Events control.".into(),
            Some("Open System Settings > Privacy & Security > Automation, and allow Janki to control System Events.".into())
        )
    } else {
        (
            "All core macOS permissions are granted. Autonomous computer control is ready.".into(),
            None
        )
    };

    PermissionStatus {
        accessibility_granted,
        screen_recording_granted,
        automation_granted,
        microphone_granted,
        message,
        action_required,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_permission_structure() {
        let status = PermissionStatus {
            accessibility_granted: true,
            screen_recording_granted: true,
            automation_granted: true,
            microphone_granted: true,
            message: "All granted".into(),
            action_required: None,
        };
        assert!(status.accessibility_granted);
        assert!(status.action_required.is_none());
    }
}
