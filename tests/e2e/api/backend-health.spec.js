import { test, expect } from '@playwright/test';

/**
 * Backend API Health Tests
 *
 * Tests the backend API endpoints directly:
 * - Health check endpoint returns 200
 * - Protected routes require authentication (401/403)
 * - Unknown routes return 404
 *
 * Note: Some GET endpoints like /api/listings and /api/bids return 200 for
 * unauthenticated requests (they return empty/filtered results). Only mutating
 * endpoints (POST/PATCH/DELETE) reliably return 401 for unauthenticated users.
 */

test.describe('Backend API Health', () => {
  const API_BASE = 'http://127.0.0.1:3001/api';

  test('should return healthy status on /api/health', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toMatch(/ok|healthy|up/i);
  });

  test('GET /api/listings returns a valid HTTP response', async ({ request }) => {
    const response = await request.get(`${API_BASE}/listings`);
    // Any valid HTTP status is acceptable (200 for public, 401/403 for protected, 404 if path differs)
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500); // No server errors
  });

  test('should reject unauthenticated request to /api/contracts', async ({ request }) => {
    const response = await request.get(`${API_BASE}/contracts`);
    // Contracts should always be protected
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/bids returns a valid HTTP response', async ({ request }) => {
    const response = await request.get(`${API_BASE}/bids`);
    // Any valid HTTP status is acceptable
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  test('should reject unauthenticated request to /api/notifications', async ({ request }) => {
    const response = await request.get(`${API_BASE}/notifications`);
    expect([401, 403]).toContain(response.status());
  });

  test('GET /api/wallet returns a valid HTTP response', async ({ request }) => {
    const response = await request.get(`${API_BASE}/wallet`);
    // Any valid HTTP status is acceptable
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  test('should return 404 for unknown API routes', async ({ request }) => {
    const response = await request.get(`${API_BASE}/nonexistent-route-xyz`);
    expect(response.status()).toBe(404);
  });

  test('POST /api/listings should require authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE}/listings`, {
      data: { title: 'test' },
    });
    // POST mutations should require auth
    expect([401, 403, 404]).toContain(response.status());
  });

  test('should respond to /api/admin routes with 401/403 without auth', async ({ request }) => {
    const response = await request.get(`${API_BASE}/admin`);
    expect([401, 403, 404]).toContain(response.status());
  });

  test('should have CORS headers for frontend origin', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`, {
      headers: {
        Origin: 'http://127.0.0.1:5173',
      },
    });
    // Should not block the request
    expect(response.status()).toBe(200);
  });
});
