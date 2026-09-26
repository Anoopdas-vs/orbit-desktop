use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub extension: String,
    pub is_protected: bool,
}

const FORBIDDEN_PATH_SEGMENTS: &[&str] = &[
    "/system",
    "/library",
    "/usr",
    "/bin",
    "/sbin",
    "/var",
    "/etc",
    "/private",
    "/.ssh",
    "/.gnupg",
    "/.aws",
    "/.config",
    "/.git",
    "/node_modules",
];

pub fn is_path_forbidden(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();

    for forbidden in FORBIDDEN_PATH_SEGMENTS {
        if path_str.contains(forbidden) {
            return true;
        }
    }

    if let Some(file_name) = path.file_name() {
        let name = file_name.to_string_lossy().to_lowercase();
        if name.starts_with(".env") || name == ".git" {
            return true;
        }
    }

    false
}

pub fn resolve_path(input_path: &str) -> PathBuf {
    let clean = input_path.trim();
    if clean.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return Path::new(&home).join(&clean[2..]);
        }
    }
    PathBuf::from(clean)
}

#[tauri::command]
pub fn cmd_get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let resolved = resolve_path(&path);
    if is_path_forbidden(&resolved) {
        return Err(format!("Access to path \"{}\" is forbidden by safety policy.", path));
    }

    let meta = fs::metadata(&resolved).map_err(|e| e.to_string())?;
    let name = resolved
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = resolved
        .extension()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(FileMetadata {
        path: resolved.to_string_lossy().to_string(),
        name,
        is_dir: meta.is_dir(),
        size_bytes: meta.len(),
        extension: ext,
        is_protected: false,
    })
}

#[tauri::command]
pub fn cmd_read_file(path: String, max_bytes: Option<usize>) -> Result<String, String> {
    let resolved = resolve_path(&path);
    if is_path_forbidden(&resolved) {
        return Err(format!("Access to path \"{}\" is forbidden by safety policy.", path));
    }

    let content = fs::read_to_string(&resolved).map_err(|e| e.to_string())?;
    let limit = max_bytes.unwrap_or(100_000); // 100KB default limit

    if content.len() > limit {
        Ok(content[..limit].to_string())
    } else {
        Ok(content)
    }
}

#[tauri::command]
pub fn cmd_create_file(path: String, content: String, overwrite: Option<bool>) -> Result<bool, String> {
    let resolved = resolve_path(&path);
    if is_path_forbidden(&resolved) {
        return Err(format!("Cannot create file in protected location \"{}\"", path));
    }

    if resolved.exists() && !overwrite.unwrap_or(false) {
        return Err(format!("File \"{}\" already exists and overwrite is false", path));
    }

    if let Some(parent) = resolved.parent() {
        let _ = fs::create_dir_all(parent);
    }

    fs::write(&resolved, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn cmd_move_to_trash(path: String) -> Result<bool, String> {
    let resolved = resolve_path(&path);
    if is_path_forbidden(&resolved) {
        return Err(format!("Cannot trash protected path \"{}\"", path));
    }

    if !resolved.exists() {
        return Err(format!("File does not exist: \"{}\"", path));
    }

    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let trash_dir = Path::new(&home).join(".Trash");
    let file_name = resolved
        .file_name()
        .ok_or_else(|| "Invalid file name".to_string())?;
    let target = trash_dir.join(file_name);

    fs::rename(&resolved, &target).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_rejects_forbidden_system_paths() {
        assert!(is_path_forbidden(Path::new("/System/Library/CoreServices")));
        assert!(is_path_forbidden(Path::new("/usr/bin/python")));
        assert!(is_path_forbidden(Path::new("/etc/hosts")));
        assert!(is_path_forbidden(Path::new("/Users/test/.ssh/id_rsa")));
        assert!(is_path_forbidden(Path::new("/Users/test/project/.env")));
        assert!(is_path_forbidden(Path::new("/Users/test/project/.env.local")));
        assert!(is_path_forbidden(Path::new("/Users/test/project/node_modules/pkg")));
    }

    #[test]
    fn test_allows_safe_user_paths() {
        assert!(!is_path_forbidden(Path::new("/Users/test/Documents/report.txt")));
        assert!(!is_path_forbidden(Path::new("/Users/test/Downloads/data.csv")));
        assert!(!is_path_forbidden(Path::new("/Users/test/Desktop/notes.md")));
    }
}
