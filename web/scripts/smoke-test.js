import 'dotenv/config';
import { app } from '../index.js';
import http from 'http';

const PORT = 8089;
let server;

async function runTests() {
    console.log('--- Starting Smoke Test ---');

    // Start server
    server = app.listen(PORT);
    console.log(`Temp server started on port ${PORT}`);

    const tests = [
        { name: 'GET /privacy', path: '/privacy', method: 'GET', expectedStatus: 200, checkBody: 'Privacy Policy' },
        { name: 'GET /', path: '/', method: 'GET', expectedStatus: 200, checkBody: 'MetalSync' },
        { name: 'GET /api/debug/health', path: '/api/debug/health', method: 'GET', expectedStatus: 200, isJson: true },
        { name: 'POST /webhooks/customers/data_request', path: '/webhooks/customers/data_request', method: 'POST', expectedStatus: 401 },
        { name: 'POST /webhooks/customers/redact', path: '/webhooks/customers/redact', method: 'POST', expectedStatus: 401 },
        { name: 'POST /webhooks/shop/redact', path: '/webhooks/shop/redact', method: 'POST', expectedStatus: 401 },
        { name: 'POST /webhooks/app/uninstalled', path: '/webhooks/app/uninstalled', method: 'POST', expectedStatus: 401 },
    ];

    let allPassed = true;

    for (const test of tests) {
        try {
            const res = await makeRequest(test.method, test.path);
            const statusMatch = res.statusCode === test.expectedStatus;
            let bodyMatch = true;

            if (test.checkBody && !res.body.includes(test.checkBody)) {
                bodyMatch = false;
            }

            if (statusMatch && bodyMatch) {
                console.log(`✅ ${test.name} (Status: ${res.statusCode})`);
            } else {
                console.log(`❌ ${test.name} (Status: ${res.statusCode}, Expected: ${test.expectedStatus})`);
                if (!bodyMatch) console.log(`   Body missing expected string: "${test.checkBody}"`);
                allPassed = false;
            }
        } catch (err) {
            console.log(`❌ ${test.name} (Error: ${err.message})`);
            allPassed = false;
        }
    }

    // Close server
    server.close();
    console.log('--- Smoke Test Finished ---');

    process.exit(allPassed ? 0 : 1);
}

function makeRequest(method, path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: data });
            });
        });

        req.on('error', (err) => reject(err));
        if (method === 'POST') req.write(JSON.stringify({}));
        req.end();
    });
}

runTests().catch(err => {
    console.error('Fatal error during smoke test:', err);
    if (server) server.close();
    process.exit(1);
});
