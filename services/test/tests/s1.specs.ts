import { test, expect } from '@playwright/test';

// Use a dynamic test user to avoid database collisions on multiple runs
const testUser = {
  name: 'Test User',
  email: `testuser_${Date.now()}@example.com`,
  password: 'Password123!',
  newPassword: 'NewPassword123!'
};

let resetToken = '';

test.describe.serial('S1 API Authentication & User Routes', () => {
  
  // Base URL setup - adjust this to match your local/CI environment
  test.use({ baseURL: 'http://localhost:3000/api' });

  test.describe('Public Auth Routes', () => {
    
    test('POST /register - Should create a new user', async ({ request }) => {
      const response = await request.post('/register', {
        data: {
          name: testUser.name,
          email: testUser.email,
          password: testUser.password
        }
      });
      
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user).toHaveProperty('id');
    });

    test('POST /logout - Should clear session', async ({ request }) => {
      // Assuming register automatically logged us in, let's log out
      const response = await request.post('/logout');
      expect(response.status()).toBe(200);
    });

    test('POST /login - Should authenticate and set cookies', async ({ request }) => {
      const response = await request.post('/login', {
        data: {
          email: testUser.email,
          password: testUser.password
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.user.email).toBe(testUser.email);
    });

    test('POST /forgot-password - Should generate reset token', async ({ request }) => {
      const response = await request.post('/forgot-password', {
        data: { email: testUser.email }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('resetToken');
      resetToken = body.resetToken; // Save for the next test
    });

    test('POST /reset-password - Should reset password with valid token', async ({ request }) => {
      const response = await request.post('/reset-password', {
        data: {
          resetToken: resetToken,
          newPassword: testUser.newPassword
        }
      });
      
      expect(response.status()).toBe(200);
    });
  });

  test.describe('Protected User Routes', () => {
    
    test.beforeAll(async ({ request }) => {
      // Re-authenticate with the NEW password to ensure session is valid
      await request.post('/login', {
        data: { email: testUser.email, password: testUser.newPassword }
      });
    });

    test('GET /me - Should return authenticated profile', async ({ request }) => {
      const response = await request.get('/me');
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user).toHaveProperty('proTokens');
      expect(body.user).toHaveProperty('plan');
    });

    test('PUT /me - Should update user profile', async ({ request }) => {
      const updatedName = 'Updated Test User';
      const response = await request.put('/me', {
        data: {
          name: updatedName,
          email: testUser.email
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.user.name).toBe(updatedName);
    });

    test('POST /change-password - Should update password while logged in', async ({ request }) => {
      const response = await request.post('/change-password', {
        data: {
          oldPassword: testUser.newPassword,
          newPassword: testUser.password // Switch it back
        }
      });
      
      expect(response.status()).toBe(200);
    });

    test('POST /check-subscription - Should return Stripe URL', async ({ request }) => {
      const response = await request.post('/check-subscription', {
        data: { plan: 'pro' }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('url');
      expect(body.url).toContain('stripe.com');
    });

    test('DELETE /cancel-subscription - Should cancel active plan', async ({ request }) => {
      const response = await request.delete('/cancel-subscription');
      expect(response.status()).toBe(200);
    });

    test('DELETE /me - Should delete account and cleanup', async ({ request }) => {
      const response = await request.delete('/me');
      expect(response.status()).toBe(200);
      
      // Verify account is gone by trying to access /me
      const checkResponse = await request.get('/me');
      expect(checkResponse.status()).toBe(401);
    });
  });

  test.describe('OAuth & Webhooks', () => {
    
    test('GET /google - Should redirect to Google consent screen', async ({ request }) => {
      // Set maxRedirects to 0 to capture the 302 instead of actually hitting Google
      const response = await request.get('/google', { maxRedirects: 0 });
      expect(response.status()).toBe(302);
      expect(response.headers()['location']).toContain('accounts.google.com');
    });

    test('POST /webhook - Should reject missing Stripe signature', async ({ request }) => {
      const response = await request.post('/webhook', {
        data: { id: 'evt_test_123', type: 'checkout.session.completed' }
      });
      
      // Should fail because we didn't provide a valid stripe-signature header
      expect(response.status()).toBe(400);
    });
  });
});