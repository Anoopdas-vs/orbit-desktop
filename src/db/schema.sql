-- ============================================================================
-- Orbit macOS Desktop Assistant - SQLite Database Schema
-- Version 1.0 (Append-Only Audit & Persistent Local State)
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  framework TEXT,
  package_scripts TEXT, -- JSON serialized
  instructions TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_allowed_commands (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  command_pattern TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registered_apps (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL UNIQUE,
  bundle_id TEXT,
  is_default_allowed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS registered_domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  is_allowed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS command_requests (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  source TEXT NOT NULL, -- 'voice' | 'text' | 'system'
  raw_command TEXT NOT NULL,
  transcription_confidence REAL,
  interpreted_intent TEXT NOT NULL,
  overall_risk TEXT NOT NULL,
  has_redactions INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS action_plans (
  id TEXT PRIMARY KEY,
  command_request_id TEXT,
  created_at TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  interpreted_intent TEXT NOT NULL,
  overall_risk TEXT NOT NULL,
  is_dry_run INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  serialized_actions TEXT NOT NULL, -- JSON serialized ActionItem[]
  clarification_needed TEXT,
  FOREIGN KEY (command_request_id) REFERENCES command_requests(id)
);

CREATE TABLE IF NOT EXISTS approval_events (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  action_id TEXT,
  risk_level TEXT NOT NULL,
  decision TEXT NOT NULL, -- 'APPROVE' | 'REJECT' | 'AUTO_APPROVE' | 'KILL_SWITCH_ABORT'
  decided_at TEXT NOT NULL,
  typed_phrase_entered TEXT,
  rejection_reason TEXT,
  FOREIGN KEY (plan_id) REFERENCES action_plans(id)
);

CREATE TABLE IF NOT EXISTS execution_logs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  command_executed TEXT,
  stdout TEXT,
  stderr TEXT,
  exit_code INTEGER,
  status TEXT NOT NULL, -- 'SUCCESS' | 'ERROR' | 'DRY_RUN' | 'ABORTED'
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  error TEXT,
  FOREIGN KEY (plan_id) REFERENCES action_plans(id)
);

CREATE TABLE IF NOT EXISTS coding_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  status TEXT NOT NULL,
  agent_adapter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS coding_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  prompt_sent TEXT NOT NULL,
  files_changed TEXT, -- JSON array
  test_output TEXT,
  build_output TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES coding_tasks(id)
);

CREATE TABLE IF NOT EXISTS git_operations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  branch TEXT NOT NULL,
  commit_hash TEXT,
  pr_url TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS deployment_operations (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  target TEXT NOT NULL,
  environment TEXT NOT NULL,
  revision TEXT NOT NULL,
  status TEXT NOT NULL,
  url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trading_settings (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL, -- 'OFF' | 'READ_ONLY' | 'PAPER_TRADING' | 'LIVE_SPOT_CONFIRMATION_REQUIRED'
  max_order_inr REAL NOT NULL DEFAULT 1000.0,
  daily_cumulative_limit_inr REAL NOT NULL DEFAULT 5000.0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  allowed_pairs TEXT NOT NULL DEFAULT 'BTCUSDT,ETHUSDT',
  api_key_configured INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trading_requests (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  inr_amount REAL NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trading_orders (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  inr_amount REAL NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  is_paper INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES trading_requests(id)
);

CREATE TABLE IF NOT EXISTS trade_journal (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  inr_amount REAL NOT NULL,
  is_paper INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  exchange_order_id TEXT,
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES trading_orders(id)
);

CREATE TABLE IF NOT EXISTS kill_switch_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  active_processes_killed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indices for performance and audit lookups
CREATE INDEX IF NOT EXISTS idx_action_plans_created_at ON action_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_execution_logs_plan_id ON execution_logs(plan_id);
CREATE INDEX IF NOT EXISTS idx_approval_events_plan_id ON approval_events(plan_id);
CREATE INDEX IF NOT EXISTS idx_trade_journal_timestamp ON trade_journal(timestamp);
CREATE INDEX IF NOT EXISTS idx_kill_switch_timestamp ON kill_switch_events(timestamp);
