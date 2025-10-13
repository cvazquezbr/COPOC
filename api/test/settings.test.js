/**
 * @vitest-environment node
 */
import { IMemoryDb, newDb } from 'pg-mem';
import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';

vi.mock('../middleware/auth.js', () => ({
  withAuth: (handler) => (req, res) => {
    req.user = { sub: 'test-user-id' };
    return handler(req, res);
  },
}));

describe('Settings API', () => {
  let db;

  beforeEach(async () => {
    db = newDb();
    db.public.none(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        sub TEXT,
        name TEXT,
        email TEXT,
        password_hash TEXT,
        google_id TEXT,
        linkedin_access_token TEXT,
        linkedin_access_token_expiry TIMESTAMPTZ,
        linkedin_refresh_token TEXT,
        gemini_api_key TEXT,
        gemini_model TEXT
      );
    `);
    db.public.none(`INSERT INTO users (id, sub, email) VALUES (1, 'test-user-id', 'test@example.com');`);
  });

  it('should return empty object when no settings are found for a user', async () => {
    const { query } = await import('../db.js');
    vi.mock('../db.js', () => ({
      query: db.public.query.bind(db.public),
    }));

    const { default: settingsHandler } = await import('../settings.js?v=1');
    const req = { method: 'GET' };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ gemini_api_key: null, gemini_model: 'gemini-1.5-pro-latest' });
  });

  it('should save and then retrieve settings for a user', async () => {
    const { query } = await import('../db.js');
    vi.mock('../db.js', () => ({
      query: db.public.query.bind(db.public),
    }));

    const { default: settingsHandler } = await import('../settings.js?v=2');
    const settingsData = { gemini_api_key: 'test-api-key-123', gemini_model: 'gemini-pro' };

    // Mock request for POST
    const postReq = {
      method: 'POST',
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify(settingsData));
      },
    };
    const postRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(postReq, postRes);

    expect(postRes.status).toHaveBeenCalledWith(200);
    expect(postRes.json).toHaveBeenCalledWith({ message: 'Settings saved successfully.' });

    // Mock request for GET
    const getReq = { method: 'GET' };
    const getRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(getReq, getRes);

    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json).toHaveBeenCalledWith(settingsData);
  });

  it('should update existing settings for a user', async () => {
    const { query } = await import('../db.js');
    vi.mock('../db.js', () => ({
      query: db.public.query.bind(db.public),
    }));

    const { default: settingsHandler } = await import('../settings.js?v=3');
    const initialSettings = { gemini_api_key: 'initial-key', gemini_model: 'gemini-1.5-pro-latest' };
    const updatedSettings = { gemini_api_key: 'updated-key', gemini_model: 'gemini-pro' };

    // Insert initial settings
    await query(
        `UPDATE users SET settings_data = $1 WHERE sub = 'test-user-id'`,
        [initialSettings]
    );

    // Mock request for POST (update)
    const postReq = {
      method: 'POST',
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(JSON.stringify(updatedSettings));
      },
    };
    const postRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(postReq, postRes);

    expect(postRes.status).toHaveBeenCalledWith(200);

    // Mock request for GET to verify update
    const getReq = { method: 'GET' };
    const getRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(getReq, getRes);

    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json).toHaveBeenCalledWith(updatedSettings);
    expect(getRes.json).not.toHaveBeenCalledWith(initialSettings);
  });
});