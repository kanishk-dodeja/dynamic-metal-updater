/**
 * USAGE: node web/debug-trigger.js
 * Or with environment override: SHOP=myshop.myshopify.com node web/debug-trigger.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { shopifyApp } = require('@shopify/shopify-api');
const { SQLiteSessionStorage } = require('@shopify/shopify-api/adapters/sqlite');
const { updatePricesForShop } = require('./services/priceUpdater.js');

const prisma = new PrismaClient();

async function main() {
  console.log('[DEBUG-TRIGGER] Starting dry-run price update job at', new Date().toISOString());

  // Validate required environment variables
  const requiredEnvVars = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_APP_URL', 'GOLD_API_KEY', 'DATABASE_URL'];
  const missingEnvVars = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingEnvVars.push(envVar);
    }
  }

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }

  // Get target shop from environment or command line
  const targetShop = process.env.SHOP;

  if (!targetShop || typeof targetShop !== 'string') {
    throw new Error('SHOP environment variable is required. Usage: SHOP=myshop.myshopify.com node web/debug-trigger.js');
  }

  console.log(`[DEBUG-TRIGGER] Target shop: ${targetShop}`);

  // Verify database connection
  console.log('[DEBUG-TRIGGER] Checking database connection...');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DEBUG-TRIGGER] Database connection successful');
  } catch (dbError) {
    throw new Error(`Database connection failed: ${dbError.message}`);
  }

  // Fetch or create session for the target shop
  console.log('[DEBUG-TRIGGER] Looking up session for shop...');
  const session = await prisma.session.findFirst({
    where: { shop: targetShop },
  });

  if (!session) {
    throw new Error(
      `No session found for shop: ${targetShop}. Please ensure the app has been installed and the shop has an active session.`,
    );
  }

  console.log('[DEBUG-TRIGGER] Session found:', {
    shop: session.shop,
    isOnline: session.isOnline,
  });

  // Initialize Shopify app
  const shopify = shopifyApp({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecret: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || 'write_products,read_products').split(','),
    host: process.env.SHOPIFY_APP_URL,
    isEmbeddedApp: false,
    sessionStorage: new SQLiteSessionStorage({
      db: prisma.$client,
    }),
  });

  // Create GraphQL client
  const client = new shopify.clients.Graphql({
    session,
  });

  console.log('[DEBUG-TRIGGER] GraphQL client created');

  // Fetch merchant settings
  console.log('[DEBUG-TRIGGER] Fetching merchant settings...');
  const merchantSettings = await prisma.merchantSettings.findUnique({
    where: { shop: targetShop },
  });

  if (!merchantSettings) {
    throw new Error(`No settings found for shop: ${targetShop}`);
  }

  const { markupPercentage, isCronActive } = merchantSettings;

  console.log('[DEBUG-TRIGGER] Merchant settings:', {
    markupPercentage,
    isCronActive,
  });

  if (!isCronActive) {
    throw new Error(`Price updates are disabled for shop: ${targetShop}. Enable via app settings.`);
  }

  // Run price updater in dry-run mode
  console.log('[DEBUG-TRIGGER] Running price updater in DRY-RUN mode...');
  console.log('================================================================================');

  const success = await updatePricesForShop(client, markupPercentage, true);

  console.log('================================================================================');

  if (success) {
    console.log('[DEBUG-TRIGGER] Dry-run completed successfully at', new Date().toISOString());
  } else {
    throw new Error('Dry-run failed: See logs above for details');
  }
}

// Execute with global error handling
main()
  .catch((error) => {
    console.error('[DEBUG-TRIGGER] FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
