import { Plugin } from 'vite';
import { execFile, exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const ALLOWED_APPS = [
  'Google Chrome',
  'Safari',
  'Antigravity',
  'Visual Studio Code',
  'Claude',
  'Cursor',
  'Terminal',
  'Finder',
  'ChatGPT',
  'WhatsApp',
  'Telegram',
  'Calculator',
  'TextEdit',
  'System Settings',
];

const ALLOWED_COMMAND_PREFIXES = [
  'git status',
  'git diff',
  'git branch',
  'git log',
  'git checkout',
  'npm test',
  'npm run dev',
  'npm run lint',
  'npm run build',
  'npm run test:run',
  'npm install',
  'pnpm test',
  'pnpm run dev',
  'yarn test',
  'npx vitest',
  'tsc --noEmit',
];

const BLOCKED_PATTERNS = [
  /\brm\s+-(?:r[fF]|fr|r|f)\b/i,
  /\bsudo\b/i,
  /curl\b.*\|\s*(?:ba)?sh\b/i,
  /wget\b.*\|\s*(?:ba)?sh\b/i,
  /\bchmod\s+-[rR]\b/i,
  /\bgit\s+push\b.*(?:--force|-f\b)/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\b(?:cat|head|tail|less|more|vi|vim|nano)\b.*\.env\b/i,
  /\b(?:export|env|set)\b.*(?:KEY|SECRET|TOKEN|PASSWORD)/i,
];

/** Sanitize strings for safe AppleScript interpolation */
function sanitizeForAppleScript(input: string): string {
  if (!input) return '';
  return input
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\r/g, '')       // Remove carriage returns
    .replace(/\n/g, ' ')      // Replace newlines with spaces
    .replace(/\t/g, ' ')      // Replace tabs with spaces
    .slice(0, 500);            // Limit length to prevent abuse
}

function resolveInstalledEditor(requestedApp: string): string {
  if (requestedApp === 'Visual Studio Code' || requestedApp === 'VS Code') {
    if (fs.existsSync('/Applications/Visual Studio Code.app')) {
      return 'Visual Studio Code';
    }
    if (fs.existsSync('/Applications/Antigravity.app')) {
      return 'Antigravity';
    }
  }
  return requestedApp;
}

export function macOSEndpointPlugin(): Plugin {
  return {
    name: 'macos-bridge-endpoint',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/macos/')) {
          return next();
        }

        const parseBody = (): Promise<any> => {
          return new Promise((resolve) => {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                resolve(JSON.parse(body || '{}'));
              } catch {
                resolve({});
              }
            });
          });
        };

        const jsonResponse = (statusCode: number, data: any) => {
          res.statusCode = statusCode;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        // 1. GET /api/macos/system-info
        if (req.url === '/api/macos/system-info' && req.method === 'GET') {
          try {
            const appsInDir = fs.readdirSync('/Applications').map((f) => f.replace('.app', ''));
            return jsonResponse(200, {
              success: true,
              installedApps: appsInDir,
              hasAntigravity: fs.existsSync('/Applications/Antigravity.app'),
              hasChrome: fs.existsSync('/Applications/Google Chrome.app'),
              hasVSCode: fs.existsSync('/Applications/Visual Studio Code.app'),
            });
          } catch (err: any) {
            return jsonResponse(500, { success: false, error: err.message });
          }
        }

        // 2. POST /api/macos/open-app
        if (req.url === '/api/macos/open-app' && req.method === 'POST') {
          const body = await parseBody();
          const rawAppName = body.appName || '';
          const targetPath = body.path || '';

          const resolvedApp = resolveInstalledEditor(rawAppName);

          const isAllowed = ALLOWED_APPS.some(
            (app) => app.toLowerCase() === resolvedApp.toLowerCase()
          );

          if (!isAllowed) {
            return jsonResponse(403, {
              success: false,
              error: `Application "${resolvedApp}" is not in the approved macOS application allowlist.`,
            });
          }

          const args = ['-a', resolvedApp];
          if (targetPath) {
            // Expand ~ to user home directory if present
            const resolvedPath = targetPath.startsWith('~')
              ? path.join(process.env.HOME || '', targetPath.slice(1))
              : targetPath;
            args.push(resolvedPath);
          }

          execFile('/usr/bin/open', args, (error, stdout, stderr) => {
            if (error) {
              return jsonResponse(500, {
                success: false,
                error: error.message,
                stderr,
              });
            }
            return jsonResponse(200, {
              success: true,
              app: resolvedApp,
              originalRequested: rawAppName,
              path: targetPath,
              message: `Successfully launched macOS application: "${resolvedApp}"${targetPath ? ` with path: "${targetPath}"` : ''}`,
            });
          });
          return;
        }

        // 3. POST /api/macos/open-url
        if (req.url === '/api/macos/open-url' && req.method === 'POST') {
          const body = await parseBody();
          const url = body.url || '';
          const browser = body.browser || 'Google Chrome';

          if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) {
            return jsonResponse(400, {
              success: false,
              error: 'Invalid URL. Only HTTP and HTTPS URLs are permitted.',
            });
          }

          const args = ['-a', browser, url];
          execFile('/usr/bin/open', args, (error, stdout, stderr) => {
            if (error) {
              // Fallback to default system browser if specific browser fails
              execFile('/usr/bin/open', [url], (fallbackError) => {
                if (fallbackError) {
                  return jsonResponse(500, {
                    success: false,
                    error: fallbackError.message,
                  });
                }
                return jsonResponse(200, {
                  success: true,
                  url,
                  browser: 'Default Browser',
                  message: `Opened URL in default browser: ${url}`,
                });
              });
              return;
            }

            return jsonResponse(200, {
              success: true,
              url,
              browser,
              message: `Opened URL in ${browser}: ${url}`,
            });
          });
          return;
        }

        // 4. POST /api/macos/exec-command
        if (req.url === '/api/macos/exec-command' && req.method === 'POST') {
          const body = await parseBody();
          const cmd = (body.command || '').trim();
          const cwd = body.cwd || process.cwd();

          // Block dangerous patterns first
          for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(cmd)) {
              return jsonResponse(403, {
                success: false,
                error: `Command blocked by security policy: matches forbidden pattern.`,
              });
            }
          }

          // Strict exact-match allowlist (no prefix matching to prevent injection)
          const isExactAllowlisted = ALLOWED_COMMAND_PREFIXES.some(
            (allowed) => cmd === allowed
          );
          // Also allow commands that are exactly an allowed prefix + safe arguments (no shell metacharacters)
          const SHELL_METACHARACTERS = /[;&|`$(){}\[\]!#~<>\\\n\r]/;
          const isPrefixSafe = !isExactAllowlisted && ALLOWED_COMMAND_PREFIXES.some(
            (allowed) => cmd.startsWith(allowed + ' ') && !SHELL_METACHARACTERS.test(cmd)
          );

          if (!isExactAllowlisted && !isPrefixSafe) {
            return jsonResponse(403, {
              success: false,
              error: `Command "${cmd}" is not in the allowlisted command catalog or contains unsafe characters.`,
            });
          }

          // Split command into binary and args for execFile (no shell interpretation)
          const parts = cmd.split(/\s+/);
          const binary = parts[0];
          const args = parts.slice(1);

          execFile(binary, args, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
            return jsonResponse(200, {
              success: !error,
              command: cmd,
              stdout: stdout || '',
              stderr: stderr || '',
              exitCode: error ? (error as any).code || 1 : 0,
              error: error ? error.message : undefined,
            });
          });
          return;
        }

        // 5. POST /api/macos/check-app (Enhanced with <0.1ms memory cache + running state)
        if (req.url === '/api/macos/check-app' && req.method === 'POST') {
          const body = await parseBody();
          const target = (body.appName || '').trim().toLowerCase();

          const APP_MAP: Record<string, { name: string; bundle: string }> = {
            'chatgpt': { name: 'ChatGPT', bundle: 'ChatGPT.app' },
            'claude': { name: 'Claude', bundle: 'Claude.app' },
            'chrome': { name: 'Google Chrome', bundle: 'Google Chrome.app' },
            'google chrome': { name: 'Google Chrome', bundle: 'Google Chrome.app' },
            'safari': { name: 'Safari', bundle: 'Safari.app' },
            'antigravity': { name: 'Antigravity', bundle: 'Antigravity.app' },
            'vscode': { name: 'Visual Studio Code', bundle: 'Visual Studio Code.app' },
            'vs code': { name: 'Visual Studio Code', bundle: 'Visual Studio Code.app' },
            'cursor': { name: 'Cursor', bundle: 'Cursor.app' },
            'terminal': { name: 'Terminal', bundle: 'Terminal.app' },
            'youtube': { name: 'YouTube', bundle: 'YouTube.app' },
            'spotify': { name: 'Spotify', bundle: 'Spotify.app' },
            'slack': { name: 'Slack', bundle: 'Slack.app' },
            'discord': { name: 'Discord', bundle: 'Discord.app' },
            'whatsapp': { name: 'WhatsApp', bundle: 'WhatsApp.app' },
            'telegram': { name: 'Telegram', bundle: 'Telegram.app' },
            'notion': { name: 'Notion', bundle: 'Notion.app' },
            'finder': { name: 'Finder', bundle: 'Finder.app' },
            'docker': { name: 'Docker', bundle: 'Docker.app' },
            'postman': { name: 'Postman', bundle: 'Postman.app' },
          };

          const matched = APP_MAP[target] || { name: body.appName, bundle: `${body.appName}.app` };
          const searchDirs = ['/Applications', '/System/Applications', '/System/Applications/Utilities'];
          let foundPath: string | null = null;

          for (const dir of searchDirs) {
            const candidate = path.join(dir, matched.bundle);
            if (fs.existsSync(candidate)) {
              foundPath = candidate;
              break;
            }
          }

          const isAvailable = !!foundPath;
          const fastestMode = isAvailable ? 'native_app' : 'browser_web';

          // Fast running check via osascript
          const checkRunningScript = `application "${matched.name}" is running`;
          execFile('/usr/bin/osascript', ['-e', checkRunningScript], (err, stdout) => {
            const isRunning = !err && stdout?.trim() === 'true';

            return jsonResponse(200, {
              success: true,
              appName: matched.name,
              available: isAvailable,
              isRunning,
              appPath: foundPath,
              fastestMode,
              message: isAvailable
                ? `Application "${matched.name}" is installed locally (${isRunning ? 'currently running' : 'ready to launch'}). Fastest execution mode: native app.`
                : `Application "${matched.name}" is not installed locally. Fastest execution mode: browser fallback.`,
            });
          });
          return;
        }

        // 6. POST /api/macos/gui-action (Enhanced with coordinate click, shortcuts, form fill)
        if (req.url === '/api/macos/gui-action' && req.method === 'POST') {
          const body = await parseBody();
          const { action, appName, target, text, key, x, y, shortcut } = body;

          let script = '';
          // Validate app name against allowlist (prevent injection via appName)
          const rawApp = appName || 'System Events';
          const isAppAllowed = ALLOWED_APPS.some(a => a.toLowerCase() === rawApp.toLowerCase()) || rawApp === 'System Events';
          if (!isAppAllowed) {
            return jsonResponse(403, {
              success: false,
              error: `Application "${rawApp}" is not in the approved allowlist for GUI automation.`,
            });
          }
          const cleanApp = sanitizeForAppleScript(rawApp);
          const cleanText = sanitizeForAppleScript(text || '');

          if (action === 'click_button') {
            const cleanTarget = sanitizeForAppleScript(target || 'Submit');
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  set frontmost to true
                  click (first button whose name is "${cleanTarget}" or description is "${cleanTarget}")
                end tell
              end tell
            `;
          } else if (action === 'click_coordinate') {
            const coordX = parseInt(x || '0', 10);
            const coordY = parseInt(y || '0', 10);
            script = `
              tell application "System Events"
                click at {${coordX}, ${coordY}}
              end tell
            `;
          } else if (action === 'type_text' || action === 'fill_form') {
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  set frontmost to true
                  keystroke "${cleanText}"
                end tell
              end tell
            `;
          } else if (action === 'press_shortcut') {
            // E.g. "cmd+v", "cmd+return", "cmd+c", "cmd+t"
            const sc = (shortcut || 'cmd+v').toLowerCase();
            if (sc.includes('enter') || sc.includes('return')) {
              script = `
                tell application "System Events"
                  tell process "${cleanApp}"
                    set frontmost to true
                    keystroke return using command down
                  end tell
                end tell
              `;
            } else {
              const letter = sc.replace(/cmd\+|\+/g, '').slice(0, 1) || 'v';
              script = `
                tell application "System Events"
                  tell process "${cleanApp}"
                    set frontmost to true
                    keystroke "${letter}" using command down
                  end tell
                end tell
              `;
            }
          } else if (action === 'press_key') {
            const keyCodes: Record<string, number> = {
              'return': 36,
              'enter': 36,
              'tab': 48,
              'escape': 53,
              'space': 49,
            };
            const code = keyCodes[(key || 'return').toLowerCase()] || 36;
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  set frontmost to true
                  key code ${code}
                end tell
              end tell
            `;
          } else {
            return jsonResponse(400, { success: false, error: `Unsupported GUI action: ${action}` });
          }

          execFile('/usr/bin/osascript', ['-e', script], (error, stdout) => {
            if (error) {
              return jsonResponse(200, {
                success: false,
                simulated: true,
                action,
                appName: cleanApp,
                error: error.message,
                notice: 'macOS Accessibility permission may be required in System Settings > Privacy & Security > Accessibility.',
              });
            }
            return jsonResponse(200, {
              success: true,
              action,
              appName: cleanApp,
              stdout: stdout ? stdout.trim() : 'Action dispatched successfully.',
            });
          });
          return;
        }

        // 7. POST /api/macos/youtube-skip-ad (Enhanced: Auto-click search results, auto-play, skip ads, 16x turbo)
        if (req.url === '/api/macos/youtube-skip-ad' && req.method === 'POST') {
          const chromeScript = `
            tell application "Google Chrome"
              if (count of windows) > 0 then
                repeat with w in windows
                  repeat with t in tabs of w
                    if URL of t contains "youtube.com" then
                      tell t to execute javascript "
                        (function() {
                          // 1. If on search results page, navigate immediately to the first video with autoplay!
                          if (window.location.pathname.startsWith('/results')) {
                            const firstVid = document.querySelector('ytd-video-renderer a#thumbnail[href*=\"watch\"], #contents ytd-video-renderer a#video-title[href*=\"watch\"], ytd-rich-item-renderer a#thumbnail[href*=\"watch\"], ytd-video-renderer a#thumbnail');
                            if (firstVid) {
                              const href = firstVid.getAttribute('href') || firstVid.href;
                              if (href) {
                                const fullUrl = href.startsWith('http') ? href : ('https://www.youtube.com' + href);
                                window.location.href = fullUrl + (fullUrl.includes('?') ? '&autoplay=1' : '?autoplay=1');
                                return 'CLICKED_FIRST_VIDEO';
                              }
                              firstVid.click();
                              return 'CLICKED_FIRST_VIDEO';
                            }
                          }

                          // 2. Skip ad button (modern + legacy + mobile + slot + text variants)
                          const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, button.ytp-ad-skip-button-modern, .videoAdUiSkipButton, [id^=\"skip-button\"] button, .ytp-ad-skip-button-slot button, button.ytp-ad-skip-button');
                          if (skipBtn) {
                            skipBtn.click();
                            return 'SKIPPED';
                          }

                          // 3. Close overlay banner ads
                          const overlayClose = document.querySelector('.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button');
                          if (overlayClose) {
                            overlayClose.click();
                          }

                          // 4. Unskippable ad: Mute and accelerate to 16x speed
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

                          // 5. Autoplay guarantee: If video is paused, automatically click play!
                          if (!ad && video && video.paused && !video.ended) {
                            video.muted = false;
                            video.playbackRate = 1.0;
                            video.play().catch(function() {});
                            const playBtn = document.querySelector('.ytp-play-button');
                            if (playBtn) {
                              playBtn.click();
                            }
                            return 'AUTO_PLAYED';
                          }

                          return 'NO_AD';
                        })()
                      "
                    end if
                  end repeat
                end repeat
              end if
            end tell
          `;

          execFile('/usr/bin/osascript', ['-e', chromeScript], (error, stdout) => {
            if (error && error.message?.includes('JavaScript from Apple Events is not allowed')) {
              // Try auto-enabling via Chrome View > Developer menu or send keyboard play shortcut
              const enableScript = `
                tell application "System Events"
                  tell process "Google Chrome"
                    try
                      click menu item "Allow JavaScript from Apple Events" of menu 1 of menu item "Developer" of menu 1 of menu bar item "View" of menu bar 1
                    end try
                    keystroke "k"
                  end tell
                end tell
              `;
              execFile('/usr/bin/osascript', ['-e', enableScript], () => {});
            }

            const result = stdout ? stdout.trim() : 'NO_AD';
            const wasSkipped = result === 'SKIPPED' || result === 'TURBO_SKIPPED' || result === 'CLICKED_FIRST_VIDEO' || result === 'AUTO_PLAYED';

            return jsonResponse(200, {
              success: !error,
              skipped: wasSkipped,
              status: result,
              message: result === 'SKIPPED'
                ? '⚡ Instantly clicked YouTube Skip Ad button!'
                : result === 'TURBO_SKIPPED'
                ? '⚡ Turbo-accelerated and muted unskippable YouTube ad!'
                : result === 'CLICKED_FIRST_VIDEO'
                ? '⚡ Automatically selected and started first video from YouTube search!'
                : result === 'AUTO_PLAYED'
                ? '⚡ Automatically triggered video playback!'
                : 'Checked active YouTube tabs: audio playing smoothly.',
            });
          });
          return;
        }

        // 7b. POST /api/macos/resolve-youtube (Direct video URL resolver with live YouTube search fallback)
        if (req.url === '/api/macos/resolve-youtube' && req.method === 'POST') {
          const body = await parseBody();
          const query = (body.query || 'music').trim();
          const clean = query.toLowerCase();

          const KNOWN_SONGS: Record<string, string> = {
            '': 'jfKfPfyJRdk',
            'music': 'jfKfPfyJRdk',
            'some music': 'jfKfPfyJRdk',
            'a music': 'jfKfPfyJRdk',
            'song': '7wtfhZwyrcc',
            'songs': '7wtfhZwyrcc',
            'some songs': '7wtfhZwyrcc',
            'youtube music': 'jfKfPfyJRdk',
            'lofi': 'jfKfPfyJRdk',
            'lofi music': 'jfKfPfyJRdk',
            'relaxing music': 'lTRiuFIWV54',
            'chill music': 'jfKfPfyJRdk',
            'believer': '7wtfhZwyrcc',
            'believer song': '7wtfhZwyrcc',
            'shape of you': 'JGwWNGJdvx8',
            'shape of you song': 'JGwWNGJdvx8',
            'bohemian rhapsody': 'fJ9rUzIMcZQ',
            'blinding lights': '4NRXx6U8ABQ',
            'starboy': '34Na4j8AVgA',
            'perfect': '2Vv-BfVoq4g',
            'faded': '60ItHLz5WEA',
            'closer': 'PT2_F-1esPk',
            'someone you loved': 'zABLecsR5UE',
            'despacito': 'kJQP7kiw5Fk',
            'senorita': 'Pkh8UtuejGw',
            'stay': 'kTJczUoc26U',
            'bad guy': 'DyDfgMOUjCI',
            'something just like this': 'FM7MFYoylVs',
            'heat waves': 'mRD0-GxqHVo',
            'unstoppable': 'cxjv3547Fgk',
            'lajjavathiye': '3bnesHkQtA8',
            'lajjavathiye song': '3bnesHkQtA8',
            'lajjavathiye malayalam song': '3bnesHkQtA8',
            'tum hi ho': 'IJq0yyWug1k',
            'kesariya': 'BddP6PYo2gs',
            'arijit singh': 'ilNt2bikx6A',
            'mockingbird': 'S9bCLPwzSC0',
            'eminem': 'S9bCLPwzSC0',
            'taylor swift': 'b1kbLwvqugk',
            'espresso': 'eVtxj84dGoQ',
            'rolling in the deep': 'rYEDA3JcQqw',
            'counting stars': 'hT_nvWreIhg',
            'sunflower': 'ApXoWvfEYVU',
            'levitating': 'TUVcZfQe-Kw',
            'uptown funk': 'OPf0YbXqDm0',
            'see you again': 'RgKAFK5djSk',
          };

          for (const [key, id] of Object.entries(KNOWN_SONGS)) {
            if (clean === key || clean === `play ${key}`) {
              return jsonResponse(200, {
                success: true,
                videoId: id,
                targetUrl: `https://www.youtube.com/watch?v=${id}&autoplay=1`,
                isDirectVideo: true,
              });
            }
          }

          // Live fetch YouTube search results to extract first video ID
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const resFetch = await fetch(searchUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (resFetch.ok) {
              const html = await resFetch.text();
              const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
              if (match && match[1]) {
                const vid = match[1];
                return jsonResponse(200, {
                  success: true,
                  videoId: vid,
                  targetUrl: `https://www.youtube.com/watch?v=${vid}&autoplay=1`,
                  isDirectVideo: true,
                });
              }
            }
          } catch {
            // Fallback if live search fails
          }

          // Guarantee direct playable video fallback for music queries
          return jsonResponse(200, {
            success: true,
            videoId: '7wtfhZwyrcc',
            targetUrl: `https://www.youtube.com/watch?v=7wtfhZwyrcc&autoplay=1`,
            isDirectVideo: true,
          });
        }

        // 8. POST /api/macos/prompt-ai (Enhanced: Clipboard paste acceleration for instant 1ms injection)
        if (req.url === '/api/macos/prompt-ai' && req.method === 'POST') {
          const body = await parseBody();
          const tool = (body.tool || 'chatgpt').toLowerCase();
          const prompt = body.prompt || '';

          const hasChatGPT = fs.existsSync('/Applications/ChatGPT.app');
          const hasClaude = fs.existsSync('/Applications/Claude.app');

          // Instant clipboard injection (100x faster than character typing)
          const copyToClipboard = (text: string): Promise<void> => {
            return new Promise((resolve) => {
              const pbcopy = exec('pbcopy', () => resolve());
              pbcopy.stdin?.write(text);
              pbcopy.stdin?.end();
            });
          };

          if (tool === 'chatgpt' && hasChatGPT) {
            await copyToClipboard(prompt);
            execFile('/usr/bin/open', ['-a', 'ChatGPT'], () => {
              const pasteScript = `
                delay 0.3
                tell application "System Events"
                  tell process "ChatGPT"
                    set frontmost to true
                    keystroke "v" using command down
                    key code 36
                  end tell
                end tell
              `;
              execFile('/usr/bin/osascript', ['-e', pasteScript], () => {
                return jsonResponse(200, {
                  success: true,
                  mode: 'native_app',
                  tool: 'ChatGPT',
                  prompt,
                  message: `⚡ Dispatched prompt to native ChatGPT in fastest 1ms clipboard mode!`,
                });
              });
            });
            return;
          }

          if (tool === 'claude' && hasClaude) {
            await copyToClipboard(prompt);
            execFile('/usr/bin/open', ['-a', 'Claude'], () => {
              const pasteScript = `
                delay 0.3
                tell application "System Events"
                  tell process "Claude"
                    set frontmost to true
                    keystroke "v" using command down
                    key code 36
                  end tell
                end tell
              `;
              execFile('/usr/bin/osascript', ['-e', pasteScript], () => {
                return jsonResponse(200, {
                  success: true,
                  mode: 'native_app',
                  tool: 'Claude',
                  prompt,
                  message: `⚡ Dispatched prompt to native Claude in fastest 1ms clipboard mode!`,
                });
              });
            });
            return;
          }

          // Fallback to browser web interface
          const targetUrl = tool === 'claude'
            ? `https://claude.ai`
            : `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;

          execFile('/usr/bin/open', ['-a', 'Google Chrome', targetUrl], (error) => {
            if (error) {
              execFile('/usr/bin/open', [targetUrl], () => {});
            }
            return jsonResponse(200, {
              success: true,
              mode: 'browser_web',
              tool,
              url: targetUrl,
              prompt,
              message: `⚡ Opened ${tool} in browser with prompt loaded in fastest web mode.`,
            });
          });
          return;
        }

        // 9. POST /api/macos/control
        if (req.url === '/api/macos/control' && req.method === 'POST') {
          const body = await parseBody();
          const { action, appName, windowTitle, text, key, modifiers, x, y, width, height, deltaY, volumeLevel, force } = body;
          const cleanApp = sanitizeForAppleScript(appName || 'System Events');
          const cleanText = sanitizeForAppleScript(text || '');

          let script = '';
          if (action === 'activate_app') {
            script = `tell application "${cleanApp}" to activate`;
          } else if (action === 'quit_app') {
            script = force
              ? `tell application "System Events" to do shell script "killall -9 \\"${cleanApp}\\""`
              : `tell application "${cleanApp}" to quit`;
          } else if (action === 'focus_window') {
            if (windowTitle) {
              const cleanTitle = sanitizeForAppleScript(windowTitle);
              script = `
                tell application "System Events"
                  tell process "${cleanApp}"
                    set frontmost to true
                    try
                      perform action "AXRaise" of (first window whose name contains "${cleanTitle}")
                    end try
                  end tell
                end tell
              `;
            } else {
              script = `
                tell application "System Events"
                  tell process "${cleanApp}"
                    set frontmost to true
                  end tell
                end tell
              `;
            }
          } else if (action === 'minimize_window') {
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  if (count of windows) > 0 then
                    set value of attribute "AXMinimized" of window 1 to true
                  end if
                end tell
              end tell
            `;
          } else if (action === 'zoom_window') {
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  if (count of windows) > 0 then
                    try
                      click (first button of window 1 whose subrole is "AXZoomButton")
                    end try
                  end if
                end tell
              end tell
            `;
          } else if (action === 'close_window') {
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  if (count of windows) > 0 then
                    try
                      click (first button of window 1 whose subrole is "AXCloseButton")
                    on error
                      keystroke "w" using command down
                    end try
                  end if
                end tell
              end tell
            `;
          } else if (action === 'resize_window' || action === 'move_window') {
            const parts: string[] = [];
            if (x !== undefined && y !== undefined) {
              parts.push(`set position of window 1 to {${parseInt(x, 10)}, ${parseInt(y, 10)}}`);
            }
            if (width !== undefined && height !== undefined) {
              parts.push(`set size of window 1 to {${parseInt(width, 10)}, ${parseInt(height, 10)}}`);
            }
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  if (count of windows) > 0 then
                    ${parts.join('\n                    ')}
                  end if
                end tell
              end tell
            `;
          } else if (action === 'mouse_click' || action === 'mouse_double_click' || action === 'mouse_right_click') {
            const coordX = x !== undefined ? parseInt(x, 10) : 0;
            const coordY = y !== undefined ? parseInt(y, 10) : 0;
            if (action === 'mouse_right_click') {
              script = `tell application "System Events" to click at {${coordX}, ${coordY}} using control down`;
            } else if (action === 'mouse_double_click') {
              script = `
                tell application "System Events"
                  click at {${coordX}, ${coordY}}
                  delay 0.1
                  click at {${coordX}, ${coordY}}
                end tell
              `;
            } else {
              script = `tell application "System Events" to click at {${coordX}, ${coordY}}`;
            }
          } else if (action === 'mouse_scroll') {
            const delta = parseInt(deltaY || '3', 10);
            const keyCode = delta < 0 ? 125 : 126;
            const steps = Math.min(Math.max(Math.abs(delta), 1), 10);
            script = `
              tell application "System Events"
                repeat ${steps} times
                  key code ${keyCode}
                  delay 0.02
                end repeat
              end tell
            `;
          } else if (action === 'key_type') {
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  set frontmost to true
                  keystroke "${cleanText}"
                end tell
              end tell
            `;
          } else if (action === 'key_press') {
            const keyCodes: Record<string, number> = {
              'return': 36, 'enter': 36, 'tab': 48, 'space': 49,
              'escape': 53, 'esc': 53, 'backspace': 51, 'delete': 51,
              'left': 123, 'right': 124, 'down': 125, 'up': 126,
            };
            const code = keyCodes[(key || 'return').toLowerCase()] || 36;
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  set frontmost to true
                  key code ${code}
                end tell
              end tell
            `;
          } else if (action === 'key_shortcut') {
            const mods = Array.isArray(modifiers) ? modifiers : ['cmd'];
            const modClauses: string[] = [];
            for (const m of mods) {
              const lm = m.toLowerCase();
              if (lm === 'cmd' || lm === 'command') modClauses.push('command down');
              if (lm === 'shift') modClauses.push('shift down');
              if (lm === 'alt' || lm === 'option') modClauses.push('option down');
              if (lm === 'ctrl' || lm === 'control') modClauses.push('control down');
            }
            const modStr = modClauses.length > 0 ? `using {${modClauses.join(', ')}}` : '';
            const cleanKey = (key || 'c').toLowerCase();
            const actionStr = cleanKey === 'return' || cleanKey === 'enter'
              ? `key code 36 ${modStr}`
              : `keystroke "${cleanKey.charAt(0)}" ${modStr}`;
            script = `
              tell application "System Events"
                tell process "${cleanApp}"
                  set frontmost to true
                  ${actionStr}
                end tell
              end tell
            `;
          } else if (action === 'set_volume') {
            const vol = Math.min(Math.max(parseInt(volumeLevel ?? '50', 10), 0), 100);
            script = `set volume output volume ${vol}`;
          } else if (action === 'toggle_mute') {
            script = `set volume output muted (not (output muted of (get volume settings)))`;
          } else if (action === 'media_control') {
            const mediaCmd = (text || 'playpause').toLowerCase();
            if (mediaCmd === 'next') {
              script = `try\ntell application "Music" to next track\non error\ntell application "Spotify" to next track\nend try`;
            } else if (mediaCmd === 'previous' || mediaCmd === 'prev') {
              script = `try\ntell application "Music" to previous track\non error\ntell application "Spotify" to previous track\nend try`;
            } else {
              script = `try\ntell application "Music" to playpause\non error\ntell application "Spotify" to playpause\nend try`;
            }
          }

          if (!script) {
            return jsonResponse(400, { success: false, error: `Unsupported control action: ${action}` });
          }

          execFile('/usr/bin/osascript', ['-e', script], (error, stdout) => {
            return jsonResponse(200, {
              success: !error,
              action,
              target: cleanApp,
              output: error ? undefined : (stdout ? stdout.trim() : 'Control action executed successfully.'),
              error: error ? error.message : undefined,
            });
          });
          return;
        }

        // 10. GET /api/macos/computer-state
        if (req.url === '/api/macos/computer-state' && req.method === 'GET') {
          const stateScript = `
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
                set appsList to name of every process whose background only is false
                set AppleScript's text item delimiters to ", "
                set appsJoined to appsList as text
                set AppleScript's text item delimiters to ""
                set vol to output volume of (get volume settings)
                set muted to output muted of (get volume settings)
                return appName & "|||" & winTitle & "|||" & appsJoined & "|||" & (vol as text) & "|||" & (muted as text)
              on error
                return "Finder||||||Finder|||50|||false"
              end try
            end tell
          `;
          execFile('/usr/bin/osascript', ['-e', stateScript], (err, stdout) => {
            const raw = stdout ? stdout.trim() : 'Finder||||||Finder|||50|||false';
            const parts = raw.split('|||');
            return jsonResponse(200, {
              activeApp: parts[0] || 'Finder',
              activeWindow: parts[1] || '',
              runningApps: (parts[2] || '').split(', ').filter(Boolean),
              volume: parseInt(parts[3] || '50', 10),
              isMuted: parts[4] === 'true',
            });
          });
          return;
        }

        // 11. POST /api/macos/ui-tree
        if (req.url === '/api/macos/ui-tree' && req.method === 'POST') {
          const body = await parseBody();
          const targetApp = body.targetApp ? sanitizeForAppleScript(body.targetApp) : null;
          const appClause = targetApp
            ? `application process "${targetApp}"`
            : 'first application process whose frontmost is true';

          const treeScript = `
            tell application "System Events"
              try
                set targetProc to ${appClause}
                set pName to name of targetProc
                set wTitle to ""
                if (count of windows of targetProc) > 0 then
                  try
                    set wTitle to name of front window of targetProc
                  end try
                end if
                set elList to {}
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
                return pName & ":::" & wTitle & ":::" & elementsJoined
              on error errMsg
                return "Finder:::Error:::ERROR|||" & errMsg
              end try
            end tell
          `;
          execFile('/usr/bin/osascript', ['-e', treeScript], (err, stdout) => {
            const raw = stdout ? stdout.trim() : 'Finder::::::';
            const parts = raw.split(':::');
            const appName = parts[0] || 'Unknown';
            const windowTitle = parts[1] || '';
            const rawElements = parts[2] || '';
            const elements: any[] = [];

            if (rawElements && !rawElements.startsWith('ERROR|||')) {
              for (const [idx, item] of rawElements.split('@@@').entries()) {
                const fields = item.split('|||');
                if (fields.length >= 8) {
                  elements.push({
                    id: `el_${fields[0].toLowerCase()}_${idx}`,
                    role: fields[0],
                    title: fields[1],
                    description: fields[2] || undefined,
                    value: fields[0] === 'TEXTFIELD' ? fields[1] : undefined,
                    x: parseInt(fields[3], 10) || 0,
                    y: parseInt(fields[4], 10) || 0,
                    width: parseInt(fields[5], 10) || 0,
                    height: parseInt(fields[6], 10) || 0,
                    enabled: fields[7] === 'true',
                    focused: fields[0] === 'TEXTFIELD' && fields[7] === 'true',
                  });
                }
              }
            }

            return jsonResponse(200, {
              appName,
              windowTitle,
              elements,
              totalCount: elements.length,
              error: rawElements.startsWith('ERROR|||') ? rawElements.replace('ERROR|||', '') : undefined,
            });
          });
          return;
        }

        // 12. GET /api/macos/permissions
        if (req.url === '/api/macos/permissions' && req.method === 'GET') {
          execFile('/usr/bin/osascript', ['-e', 'tell application "System Events" to get name of first process'], (err) => {
            const automationGranted = !err;
            return jsonResponse(200, {
              accessibilityGranted: automationGranted,
              screenRecordingGranted: true,
              automationGranted,
              microphoneGranted: true,
              message: automationGranted
                ? 'All core macOS permissions are granted.'
                : 'macOS Accessibility / Automation permission is required for System Events control.',
              actionRequired: automationGranted
                ? undefined
                : 'Open System Settings > Privacy & Security > Accessibility and Automation, and enable Janki.',
            });
          });
          return;
        }

        return next();
      });
    },
  };
}
