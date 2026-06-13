CREATE TABLE IF NOT EXISTS onboarding_scan_results (
  repo_id uuid PRIMARY KEY REFERENCES repos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary jsonb NOT NULL,
  logs jsonb NOT NULL,
  dashboard_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_scan_results_user_id_idx ON onboarding_scan_results(user_id);
