export function getPrivacyPolicyHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Privacy Policy - MetalSync</title>
      <style>
        :root {
          --primary-color: #008060;
          --text-color: #202223;
          --bg-color: #f6f6f7;
          --card-bg: #ffffff;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: var(--text-color);
          background-color: var(--bg-color);
          margin: 0;
          padding: 40px 20px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: var(--card-bg);
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        h1 { color: var(--primary-color); border-bottom: 2px solid var(--bg-color); padding-bottom: 10px; }
        h2 { margin-top: 30px; font-size: 1.25rem; }
        p, li { margin-bottom: 15px; }
        .footer { margin-top: 50px; font-size: 0.9rem; color: #6d7175; text-align: center; border-top: 1px solid var(--bg-color); padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Privacy Policy</h1>
        <p>Last updated: February 26, 2026</p>
        
        <p>MetalSync ("we", "us", "our") is committed to protecting the privacy of merchants who use our application. This policy outlines how we handle data.</p>

        <h2>1. Data Collection</h2>
        <p>To provide our services, we collect the following data:</p>
        <ul>
          <li><strong>Merchant Configuration:</strong> Metal pricing markup percentages, sync frequency, and custom pricing formulas.</li>
          <li><strong>API Credentials:</strong> Your Metals.Dev API key (required to fetch market prices). This is stored using AES-256 encryption.</li>
          <li><strong>Product IDs:</strong> Shopify product and variant IDs that you configure for automated updates.</li>
        </ul>

        <h2>2. Data We Do NOT Collect</h2>
        <p>We believe in data minimization. We do <strong>NOT</strong> collect or store:</p>
        <ul>
          <li>Customer personal data (name, email, address, etc.).</li>
          <li>Customer payment information.</li>
          <li>Merchant billing information (handled by Shopify).</li>
        </ul>

        <h2>3. Data Usage & Protection</h2>
        <p>Data is used exclusively for automating metal price updates on your storefront. We use industry-standard PostgreSQL databases and encrypt sensitive API keys at rest using a 64-character master encryption key.</p>

        <h2>4. Data Retention & Deletion</h2>
        <p>All merchant settings, configurations, and encrypted API keys are automatically deleted from our servers when you uninstall the MetalSync app from your Shopify store, as per Shopify's "Shop Redact" requirements.</p>

        <h2>5. GDPR Compliance</h2>
        <p>We comply with GDPR requirements regarding data portability and the right to be forgotten. Merchants can request a copy of their stored configuration or immediate deletion of their account data at any time.</p>

        <h2>6. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy or your data, please contact us at: <strong>support@codejainfotech.com</strong></p>

        <div class="footer">
          &copy; 2026 MetalSync. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}
