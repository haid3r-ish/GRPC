import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

let currentBatchId = '';

test.describe.serial('S2 OCR Service & Document Lifecycle', () => {
  
  test.use({ baseURL: 'http://localhost:3000/api' });

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/auth/login', {
      data: { email: 'testuser@example.com', password: 'Password123!' }
    });
    expect(response.status()).toBe(200);
  });

  test('POST /process - Should upload document and deduct credits', async ({ request }) => {
    const dummyFilePath = path.join(__dirname, 'test-sample.pdf');
    if (!fs.existsSync(dummyFilePath)) {
      fs.writeFileSync(dummyFilePath, 'dummy pdf content for testing');
    }

    const response = await request.post('/process', {
      multipart: {
        documents: {
          name: 'test-sample.pdf',
          mimeType: 'application/pdf',
          buffer: fs.readFileSync(dummyFilePath),
        }
      }
    });

    expect(response.status()).toBe(202); 
    const body = await response.json();
    
    expect(body).toHaveProperty('batchId');
    expect(body.stats).toHaveProperty('remainingCredits');
    currentBatchId = body.batchId;
  });

  test('GET / - Should list the new batch as unfetched', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    const foundBatch = body.data.find((doc: any) => doc.batchId === currentBatchId);
    expect(foundBatch).toBeDefined();
    expect(foundBatch.files).toContain('test-sample.pdf');
  });

  test('POST /internal/notify - Should trigger SSE completion event', async ({ request }) => {
    const notifyResponse = await request.post('/internal/notify', {
      data: { batchId: currentBatchId }
    });
    
    expect(notifyResponse.status()).toBe(200);
  });

  test('GET /:batchId (First Fetch) - Should return Base64 images and mark as fetched', async ({ request }) => {
    const response = await request.get(`/${currentBatchId}`);
    expect(response.status()).toBe(200);
    
    const body = await response.json();

    expect(body.message).toContain('First fetch complete');
    expect(body.data.isFirstFetch).toBe(true);
    expect(body.data.batchId).toBe(currentBatchId);
    
    const firstResult = body.data.results[0];
    expect(firstResult).toHaveProperty('imageSrc');
  });

  test('GET /:batchId (Second Fetch) - Should return text but NO images', async ({ request }) => {
    const response = await request.get(`/${currentBatchId}`);
    expect(response.status()).toBe(200);
    
    const body = await response.json();

    expect(body.data.isFirstFetch).toBe(false);
    
    const firstResult = body.data.results[0];
    expect(firstResult.imageSrc).toBeFalsy(); 
  });

  test('GET /history - Should show document as completely fetched', async ({ request }) => {
    const response = await request.get('/history');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    
    const historyDoc = body.data.find((doc: any) => doc.batchId === currentBatchId);
    
    expect(historyDoc).toBeDefined();
    expect(historyDoc.isFetched).toContain('Fetched (files already retrieved and deleted)');
  });
});