DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN undefined_file OR insufficient_privilege THEN
    RAISE NOTICE 'pgvector extension is not available; continuing without vector support';
END $$;
