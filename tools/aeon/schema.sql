CREATE TABLE IF NOT EXISTS jobs (
 id text PRIMARY KEY, objective text NOT NULL, priority int NOT NULL DEFAULT 0,
 base_sha text NOT NULL, candidate_sha text, state text NOT NULL DEFAULT 'queued',
 created timestamptz DEFAULT now(), updated timestamptz DEFAULT now(),
 calls int NOT NULL DEFAULT 0, max_calls int NOT NULL DEFAULT 4,
 timeout_seconds int NOT NULL DEFAULT 1800, attempts int NOT NULL DEFAULT 0,
 inject_failure boolean DEFAULT false, result jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS tasks (
 job text REFERENCES jobs(id), role text, state text NOT NULL DEFAULT 'pending',
 attempts int NOT NULL DEFAULT 0, evidence jsonb NOT NULL DEFAULT '{}',
 PRIMARY KEY(job,role)
);
CREATE TABLE IF NOT EXISTS events (
 id bigserial PRIMARY KEY, job text, at timestamptz DEFAULT now(),
 kind text NOT NULL, detail jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
 id bigserial PRIMARY KEY, job text, role text, cause text,
 recovery text, outcome text DEFAULT 'open', created timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS knowledge (
 path text PRIMARY KEY, sha256 text NOT NULL, category text NOT NULL,
 text_content text NOT NULL, metadata jsonb NOT NULL, vector real[],
 indexed timestamptz DEFAULT now(), search tsvector GENERATED ALWAYS AS
 (to_tsvector('english', path || ' ' || text_content)) STORED
);
CREATE INDEX IF NOT EXISTS knowledge_search ON knowledge USING gin(search);
CREATE TABLE IF NOT EXISTS approvals (
 job text REFERENCES jobs(id), candidate_sha text, evidence_sha text,
 action text, actor text, created timestamptz DEFAULT now(), PRIMARY KEY(job,action)
);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS parent_job text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS repair_count int NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS resume_count int NOT NULL DEFAULT 0;
