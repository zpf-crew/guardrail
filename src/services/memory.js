import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
`;

export function createMemoryService(dbPath = process.env.DB_PATH || './data/chat.db') {
  const db = new Database(dbPath);
  db.exec(SCHEMA);

  const insertThread = db.prepare('INSERT INTO threads (id) VALUES (?)');
  const insertMessage = db.prepare('INSERT INTO messages (thread_id, role, content) VALUES (?, ?, ?)');
  const selectMessages = db.prepare('SELECT role, content, timestamp FROM messages WHERE thread_id = ? ORDER BY timestamp ASC');
  const threadExists = db.prepare('SELECT 1 FROM threads WHERE id = ?');

  function createThread() {
    const id = crypto.randomUUID();
    insertThread.run(id);
    return id;
  }

  function addMessage(threadId, role, content) {
    // Ensure thread exists before adding message
    const exists = threadExists.get(threadId);
    if (!exists) {
      throw new Error(`Thread ${threadId} does not exist`);
    }
    insertMessage.run(threadId, role, content);
  }

  function getMessages(threadId) {
    return selectMessages.all(threadId);
  }

  return {
    createThread,
    addMessage,
    getMessages,
  };
}
