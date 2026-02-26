import 'dotenv/config';
import { encrypt, decrypt } from '../utils/encryption.js';

async function runEncryptionTests() {
    console.log('--- Starting Encryption Tests ---');

    const testCases = [
        {
            name: 'Round-trip encryption',
            input: 'this is a secret',
            test: (inp) => {
                const encrypted = encrypt(inp);
                const decrypted = decrypt(encrypted);
                return inp === decrypted;
            }
        },
        {
            name: 'Non-encrypted string passthrough',
            input: 'plain_text_only',
            test: (inp) => {
                const decrypted = decrypt(inp);
                return inp === decrypted;
            }
        },
        {
            name: 'Empty string',
            input: '',
            test: (inp) => {
                const encrypted = encrypt(inp);
                const decrypted = decrypt(encrypted);
                return inp === decrypted;
            }
        },
        {
            name: 'Missing ENCRYPTION_KEY passthrough',
            input: 'some_data',
            test: (inp) => {
                const originalKey = process.env.ENCRYPTION_KEY;
                delete process.env.ENCRYPTION_KEY;
                const decrypted = decrypt(inp);
                process.env.ENCRYPTION_KEY = originalKey;
                return inp === decrypted;
            }
        }
    ];

    let allPassed = true;

    testCases.forEach(tc => {
        try {
            if (tc.test(tc.input)) {
                console.log(`✅ ${tc.name}`);
            } else {
                console.log(`❌ ${tc.name}`);
                allPassed = false;
            }
        } catch (err) {
            console.log(`❌ ${tc.name} (Error: ${err.message})`);
            allPassed = false;
        }
    });

    console.log('--- Encryption Tests Finished ---');
    process.exit(allPassed ? 0 : 1);
}

runEncryptionTests().catch(err => {
    console.error('Fatal error during encryption tests:', err);
    process.exit(1);
});
