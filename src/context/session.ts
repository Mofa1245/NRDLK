type SessionData = {
  transcript: string;
  structured: Record<string, unknown>;
  state: Record<string, unknown>;
  lastUpdated: number;
};

const sessions = new Map<string, SessionData>();
const SESSION_TTL_MS = 15 * 60 * 1000;

export function getSession(id: string) {
  if (sessions.has(id)) {
    const s = sessions.get(id)!;
    if (Date.now() - s.lastUpdated > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  if (!sessions.has(id)) {
    sessions.set(id, {
      transcript: '',
      structured: {},
      state: {},
      lastUpdated: Date.now()
    });
  }
  const s = sessions.get(id)!;
  s.lastUpdated = Date.now();
  return s;
}

export function updateSession(id: string, updates: Partial<SessionData>) {
  const s = getSession(id);
  Object.assign(s, updates);
  s.lastUpdated = Date.now();
  return s;
}

export function clearSession(id: string) {
  sessions.delete(id);
}

export function getSessionsCount() {
  return sessions.size;
}
