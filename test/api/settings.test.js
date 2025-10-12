/**
 * @vitest-environment node
 */
import { IMemoryDb, newDb } from 'pg-mem';
import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';

// Mock the auth middleware before importing the handler
vi.mock('../middleware/auth.js', () => ({
  withAuth: (handler) => (req, res) => {
    // Mock user object for authenticated routes
    req.user = { sub: 'test-user-id' };
    return handler(req, res);
  },
}));

describe('Settings API', () => {
  let db;
  let queryMock;
  let settingsHandler;

  beforeEach(async () => {
    db = newDb();
    db.public.registerFunction({
      name: 'now',
      implementation: () => new Date(),
    });

    // Create a mock query function that uses the in-memory database
    queryMock = (sql, params) => db.public.query(sql, params);

    // Mock the db module to use our in-memory db
    vi.doMock('../api/db.js', () => ({
      query: queryMock,
    }));

    // Now, create the table in the in-memory database
    await queryMock(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        sub VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user' NOT NULL,
        google_id VARCHAR(255) UNIQUE,
        google_access_token TEXT,
        google_refresh_token TEXT,
        linkedin_access_token VARCHAR(2048),
        linkedin_access_token_expiry TIMESTAMPTZ,
        linkedin_refresh_token VARCHAR(1024),
        gemini_api_key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryMock(
        `INSERT INTO users (id, sub, email) VALUES (1, 'test-user-id', 'test@test.com');`
    );

    // Import the handler after the mocks are set up
    const module = await import('../../api/settings.js');
    settingsHandler = module.default;
  });

  afterEach(() => {
    // Unmock the db module after each test
    vi.doUnmock('../api/db.js');
    vi.resetModules();
  });

  it('should return empty object when no settings are found for a user', async () => {
    const req = { method: 'GET' };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ gemini_api_key: null });
  });

  it('should save and then retrieve settings for a user', async () => {
    const settingsData = { gemini_api_key: 'test-api-key-123' };

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
    expect(postRes.json).toHaveBeenCalledWith({ message: 'Settings updated successfully' });

    // Mock request for GET
    const getReq = { method: 'GET' };
    const getRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await settingsHandler(getReq, getRes);

    expect(getRes.status).toHaveBeenCalledWith(200);
    expect(getRes.json).toHaveBeenCalledWith({ gemini_api_key: 'test-api-key-123' });
  });
});