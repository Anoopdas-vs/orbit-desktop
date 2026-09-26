use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UiElement {
    pub id: String,
    pub role: String,
    pub title: String,
    pub description: Option<String>,
    pub value: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub enabled: bool,
    pub focused: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerceptionResult {
    pub app_name: String,
    pub window_title: String,
    pub window_x: i32,
    pub window_y: i32,
    pub window_width: i32,
    pub window_height: i32,
    pub elements: Vec<UiElement>,
    pub total_count: usize,
    pub error: Option<String>,
}

fn sanitize_applescript(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "")
        .replace('\n', " ")
        .chars()
        .take(500)
        .collect()
}

pub fn inspect_ui_tree(target_app: Option<&str>) -> PerceptionResult {
    let app_clause = match target_app {
        Some(name) => format!("application process \"{}\"", sanitize_applescript(name)),
        None => "first application process whose frontmost is true".to_string(),
    };

    let script = format!(
        r#"
        tell application "System Events"
          try
            set targetProc to {}
            set pName to name of targetProc
            set wTitle to ""
            set wX to 0
            set wY to 0
            set wW to 0
            set wH to 0

            if (count of windows of targetProc) > 0 then
              set frontWin to front window of targetProc
              try
                set wTitle to name of frontWin
              end try
              try
                set wPos to position of frontWin
                set wX to item 1 of wPos
                set wY to item 2 of wPos
              end try
              try
                set wSize to size of frontWin
                set wW to item 1 of wSize
                set wH to item 2 of wSize
              end try
            end if

            -- Query interactive UI elements (buttons, text fields, menu buttons, check boxes, links)
            set elList to {{}}
            try
              repeat with btn in (buttons of front window of targetProc)
                try
                  set bName to name of btn
                  set bDesc to description of btn
                  set bPos to position of btn
                  set bSize to size of btn
                  set bEnabled to enabled of btn
                  set end of elList to ("BUTTON|||" & bName & "|||" & bDesc & "|||" & (item 1 of bPos) & "|||" & (item 2 of bPos) & "|||" & (item 1 of bSize) & "|||" & (item 2 of bSize) & "|||" & bEnabled)
                end try
              end repeat
            end try

            try
              repeat with tf in (text fields of front window of targetProc)
                try
                  set tVal to value of tf
                  set tDesc to description of tf
                  set tPos to position of tf
                  set tSize to size of tf
                  set tFocused to focused of tf
                  set end of elList to ("TEXTFIELD|||" & (tVal as text) & "|||" & tDesc & "|||" & (item 1 of tPos) & "|||" & (item 2 of tPos) & "|||" & (item 1 of tSize) & "|||" & (item 2 of tSize) & "|||" & tFocused)
                end try
              end repeat
            end try

            set AppleScript's text item delimiters to "@@@"
            set elementsJoined to elList as text
            set AppleScript's text item delimiters to ""

            return pName & ":::" & wTitle & ":::" & wX & ":::" & wY & ":::" & wW & ":::" & wH & ":::" & elementsJoined
          on error errMsg
            return "Finder:::Error:::0:::0:::0:::0:::ERROR|||" & errMsg
          end try
        end tell
        "#,
        app_clause
    );

    match Command::new("/usr/bin/osascript").args(["-e", &script]).output() {
        Ok(out) => {
            let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let parts: Vec<&str> = raw.split(":::").collect();
            if parts.len() < 7 {
                return PerceptionResult {
                    app_name: target_app.unwrap_or("Unknown").to_string(),
                    window_title: "".to_string(),
                    window_x: 0,
                    window_y: 0,
                    window_width: 0,
                    window_height: 0,
                    elements: vec![],
                    total_count: 0,
                    error: Some("Failed to parse accessibility response.".into()),
                };
            }

            let app_name = parts[0].to_string();
            let window_title = parts[1].to_string();
            let window_x = parts[2].parse::<i32>().unwrap_or(0);
            let window_y = parts[3].parse::<i32>().unwrap_or(0);
            let window_width = parts[4].parse::<i32>().unwrap_or(0);
            let window_height = parts[5].parse::<i32>().unwrap_or(0);
            let raw_elements = parts[6];

            let mut elements = Vec::new();
            if !raw_elements.is_empty() && !raw_elements.starts_with("ERROR|||") {
                for (idx, item) in raw_elements.split("@@@").enumerate() {
                    let fields: Vec<&str> = item.split("|||").collect();
                    if fields.len() >= 8 {
                        let role = fields[0].to_string();
                        let title = fields[1].to_string();
                        let description = if fields[2].is_empty() { None } else { Some(fields[2].to_string()) };
                        let x = fields[3].parse::<i32>().unwrap_or(0);
                        let y = fields[4].parse::<i32>().unwrap_or(0);
                        let width = fields[5].parse::<i32>().unwrap_or(0);
                        let height = fields[6].parse::<i32>().unwrap_or(0);
                        let flag = fields[7] == "true";

                        elements.push(UiElement {
                            id: format!("el_{}_{}", role.to_lowercase(), idx),
                            role: role.clone(),
                            title: title.clone(),
                            description,
                            value: if role == "TEXTFIELD" { Some(title) } else { None },
                            x,
                            y,
                            width,
                            height,
                            enabled: if role == "BUTTON" { flag } else { true },
                            focused: if role == "TEXTFIELD" { flag } else { false },
                        });
                    }
                }
            }

            let total_count = elements.len();
            PerceptionResult {
                app_name,
                window_title,
                window_x,
                window_y,
                window_width,
                window_height,
                elements,
                total_count,
                error: if raw_elements.starts_with("ERROR|||") {
                    Some(raw_elements.replace("ERROR|||", ""))
                } else {
                    None
                },
            }
        }
        Err(e) => PerceptionResult {
            app_name: target_app.unwrap_or("Unknown").to_string(),
            window_title: "".to_string(),
            window_x: 0,
            window_y: 0,
            window_width: 0,
            window_height: 0,
            elements: vec![],
            total_count: 0,
            error: Some(format!("Failed to execute perception script: {}", e)),
        },
    }
}

#[tauri::command]
pub fn cmd_get_ui_tree(target_app: Option<String>) -> PerceptionResult {
    inspect_ui_tree(target_app.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ui_element_parsing_structure() {
        let el = UiElement {
            id: "el_button_0".into(),
            role: "BUTTON".into(),
            title: "Submit".into(),
            description: Some("Submit Form".into()),
            value: None,
            x: 100,
            y: 200,
            width: 80,
            height: 32,
            enabled: true,
            focused: false,
        };
        assert_eq!(el.title, "Submit");
        assert_eq!(el.role, "BUTTON");
        assert!(el.enabled);
    }
}
