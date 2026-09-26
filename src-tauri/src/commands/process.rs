use serde::{Deserialize, Serialize};
use std::process::Command;

const ALLOWED_COMMAND_PREFIXES: &[&str] = &[
    "git status",
    "git diff",
    "git branch",
    "git log",
    "git checkout",
    "npm test",
    "npm run dev",
    "npm run lint",
    "npm run build",
    "npm run test:run",
    "npm install",
    "pnpm test",
    "pnpm run dev",
    "yarn test",
    "npx vitest",
    "tsc --noEmit",
];

const BLOCKED_PATTERNS: &[&str] = &[
    "rm -rf",
    "rm -fr",
    "sudo",
    "curl",
    "wget",
    "chmod -R",
    "git push --force",
    "git push -f",
    "git reset --hard",
    ".env",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecCommandResult {
    pub success: bool,
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub error: Option<String>,
}

#[tauri::command]
pub fn cmd_exec_command(command: String, cwd: Option<String>) -> Result<ExecCommandResult, String> {
    let trimmed = command.trim();

    // Check blocked dangerous patterns
    for pat in BLOCKED_PATTERNS {
        if trimmed.contains(pat) {
            return Err(format!("Command blocked by security policy: matches forbidden pattern '{}'.", pat));
        }
    }

    // Check shell metacharacters
    let shell_meta = [';', '&', '|', '`', '$', '(', ')', '{', '}', '[', ']', '!', '#', '<', '>', '\\', '\n', '\r'];
    if trimmed.chars().any(|c| shell_meta.contains(&c)) {
        return Err("Command blocked: contains forbidden shell metacharacters.".into());
    }

    // Check allowlist
    let is_exact = ALLOWED_COMMAND_PREFIXES.iter().any(|&p| trimmed == p);
    let is_prefix = ALLOWED_COMMAND_PREFIXES.iter().any(|&p| trimmed.starts_with(&format!("{} ", p)));

    if !is_exact && !is_prefix {
        return Err(format!("Command '{}' is not in the allowlisted command catalog.", trimmed));
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command.".into());
    }

    let binary = parts[0];
    let args = &parts[1..];

    let mut cmd = Command::new(binary);
    cmd.args(args);

    if let Some(ref dir) = cwd {
        cmd.current_dir(dir);
    }

    match cmd.output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            let exit_code = out.status.code().unwrap_or(if out.status.success() { 0 } else { 1 });
            Ok(ExecCommandResult {
                success: out.status.success(),
                command: command.clone(),
                stdout,
                stderr,
                exit_code,
                error: if out.status.success() { None } else { Some(format!("Process exited with code {}", exit_code)) },
            })
        }
        Err(e) => Err(format!("Failed to spawn process '{}': {}", binary, e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blocks_dangerous_patterns() {
        assert!(cmd_exec_command("rm -rf /".into(), None).is_err());
        assert!(cmd_exec_command("sudo rm something".into(), None).is_err());
        assert!(cmd_exec_command("curl http://evil.com".into(), None).is_err());
        assert!(cmd_exec_command("cat .env".into(), None).is_err());
    }

    #[test]
    fn test_blocks_shell_metacharacters() {
        assert!(cmd_exec_command("git status; ls".into(), None).is_err());
        assert!(cmd_exec_command("git status && echo bad".into(), None).is_err());
        assert!(cmd_exec_command("git status | grep a".into(), None).is_err());
        assert!(cmd_exec_command("git status `whoami`".into(), None).is_err());
        assert!(cmd_exec_command("git status $(id)".into(), None).is_err());
    }

    #[test]
    fn test_blocks_unauthorized_commands() {
        assert!(cmd_exec_command("python3 hack.py".into(), None).is_err());
        assert!(cmd_exec_command("bash script.sh".into(), None).is_err());
        assert!(cmd_exec_command("shutdown -h now".into(), None).is_err());
    }

    #[test]
    fn test_allows_valid_command() {
        let res = cmd_exec_command("git status".into(), None);
        assert!(res.is_ok());
        let val = res.unwrap();
        assert!(val.success);
        assert!(val.stdout.contains("branch") || val.stdout.contains("HEAD"));
    }
}
