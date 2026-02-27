import crypto from 'crypto';

export function verifyWebhook(req, res, next) {
    const secret = process.env.SHOPIFY_API_SECRET;

    if (!secret) {
        console.error('[GDPR Webhook] Error: SHOPIFY_API_SECRET is not set');
        return res.status(500).json({ error: 'Internal Server Error' });
    }

    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    if (!hmacHeader) {
        console.error('[GDPR Webhook] Error: Missing X-Shopify-Hmac-Sha256 header');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const rawBody = req.body;

    if (!rawBody) {
        console.error('[GDPR Webhook] Error: Missing raw body');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const generatedHash = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('base64');

    let hashEquals = false;
    try {
        const generatedBuffer = Buffer.from(generatedHash, 'base64');
        const hmacBuffer = Buffer.from(hmacHeader, 'base64');

        if (generatedBuffer.length === hmacBuffer.length) {
            hashEquals = crypto.timingSafeEqual(generatedBuffer, hmacBuffer);
        } else {
            console.error('[GDPR Webhook] Error: HMAC length mismatch');
        }
    } catch (e) {
        console.error('[GDPR Webhook] Error during HMAC comparison:', e.message);
        hashEquals = false;
    }

    if (!hashEquals) {
        console.error('[GDPR Webhook] Error: HMAC verification failed');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        req.webhookBody = JSON.parse(rawBody.toString('utf8'));
        next();
    } catch (e) {
        console.error('[GDPR Webhook] Error: Could not parse JSON body');
        return res.status(400).json({ error: 'Bad Request' });
    }
}
