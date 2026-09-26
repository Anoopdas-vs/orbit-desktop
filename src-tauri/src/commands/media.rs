use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SkipAdResult {
    pub success: bool,
    pub skipped: bool,
    pub status: String,
    pub message: String,
}

#[tauri::command]
pub fn cmd_youtube_skip_ad() -> Result<SkipAdResult, String> {
    let script = r#"
      tell application "Google Chrome"
        if (count of windows) > 0 then
          repeat with w in windows
            repeat with t in tabs of w
              if URL of t contains "youtube.com" then
                tell t to execute javascript "
                  (function() {
                    const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, button.ytp-ad-skip-button-modern, .videoAdUiSkipButton, [id^=\"skip-button\"] button, .ytp-ad-skip-button-slot button, button.ytp-ad-skip-button');
                    if (skipBtn) {
                      skipBtn.click();
                      return 'SKIPPED';
                    }
                    const ad = document.querySelector('.ad-showing, .ad-interrupting');
                    const video = document.querySelector('video');
                    if (ad && video) {
                      video.muted = true;
                      video.playbackRate = 16.0;
                      if (!isNaN(video.duration) && video.duration > 0) {
                        video.currentTime = video.duration;
                      }
                      return 'TURBO_SKIPPED';
                    }
                    return 'NO_AD';
                  })()
                "
              end if
            end repeat
          end repeat
        end if
      end tell
    "#;

    match Command::new("/usr/bin/osascript").args(["-e", script]).output() {
        Ok(out) => {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let skipped = res == "SKIPPED" || res == "TURBO_SKIPPED";
            Ok(SkipAdResult {
                success: out.status.success(),
                skipped,
                status: if res.is_empty() { "NO_AD".into() } else { res.clone() },
                message: if skipped { "Skipped YouTube ad successfully.".into() } else { "No active ad detected.".into() },
            })
        }
        Err(e) => Err(format!("Failed to run ad-skip script: {}", e)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResolveYouTubeResult {
    pub success: bool,
    pub video_id: String,
    pub target_url: String,
    pub is_direct_video: bool,
}

#[tauri::command]
pub fn cmd_resolve_youtube(query: String) -> ResolveYouTubeResult {
    let clean = query.trim().to_lowercase();
    let video_id = match clean.as_str() {
        "" | "music" | "some music" | "lofi" | "chill music" => "jfKfPfyJRdk",
        "believer" | "song" | "songs" => "7wtfhZwyrcc",
        "shape of you" => "JGwWNGJdvx8",
        "bohemian rhapsody" => "fJ9rUzIMcZQ",
        "blinding lights" => "4NRXx6U8ABQ",
        "lajjavathiye" => "3bnesHkQtA8",
        _ => "7wtfhZwyrcc",
    };

    ResolveYouTubeResult {
        success: true,
        video_id: video_id.into(),
        target_url: format!("https://www.youtube.com/watch?v={}&autoplay=1", video_id),
        is_direct_video: true,
    }
}
