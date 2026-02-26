import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex) {
        console.warn('[Encryption] ENCRYPTION_KEY is not set. Data will be stored as-is.');
        return null;
    }
    if (keyHex.length !== 64) {
        console.error('[Encryption] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
        return null;
    }
    return Buffer.from(keyHex, 'hex');
}

export function isEncrypted(text) {
    if (!text || typeof text !== 'string') return false;
    // Pattern: 24 hex (IV) + ":" + 32 hex (AuthTag) + ":" + 1+ hex (Ciphertext)
    const pattern = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;
    return pattern.test(text);
}

export function encrypt(plaintext) {
    if (!plaintext) return "";

    const key = getKey();
    if (!key) return plaintext;

    try {
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag().toString('hex');

        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
        console.error('[Encryption] Encryption failed:', error.message);
        return plaintext;
    }
}

export function decrypt(ciphertext) {
    if (!ciphertext) return "";

    const key = getKey();
    if (!key) return ciphertext;

    if (!isEncrypted(ciphertext)) {
        return ciphertext;
    }

    try {
        const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('[Encryption] Decryption failed (tampered data or wrong key):', error.message);
        return "";
    }
}
