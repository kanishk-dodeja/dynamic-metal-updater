import "dotenv/config";
import { shopifyApp } from "@shopify/shopify-app-express";
import { shopifyApi, ApiVersion } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import express from "express";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { updatePricesForShop } from "./services/priceUpdater.js";
import * as shopifyService from "./services/shopifyService.js";
import path from "path";
import { fileURLToPath } from "url";
import { fetchMetalPrice } from "./services/metalService.js";
import { verifyWebhook } from "./middleware/verifyWebhook.js";
import { encrypt, decrypt } from "./utils/encryption.js";
import { validateFormulaConfig } from "./services/formulaEngine.js";
import { parseProductConfigCSV, generateProductConfigCSV, generateTemplateCSV } from "./services/csvService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES?.split(","),
    hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, ""),
    apiVersion: ApiVersion.July24,
    isEmbeddedApp: false,
  },
  sessionStorage: new PrismaSessionStorage(prisma),
});

// GDPR Webhooks MUST be placed before express.json() because they require the raw request body for HMAC verification.
const rawParser = express.raw({ type: 'application/json' });

app.post('/webhooks/customers/data_request', rawParser, verifyWebhook, (req, res) => {
  console.log(`[GDPR] Customer data request from shop: ${req.webhookBody.shop_domain}`);
  res.status(200).json({ received: true });
});

app.post('/webhooks/customers/redact', rawParser, verifyWebhook, (req, res) => {
  console.log(`[GDPR] Customer redact request from shop: ${req.webhookBody.shop_domain}`);
  res.status(200).json({ received: true });
});

app.post('/webhooks/shop/redact', rawParser, verifyWebhook, async (req, res) => {
  const shop_domain = req.webhookBody.shop_domain;

  if (!shop_domain) {
    return res.status(400).json({ error: 'Missing shop_domain in webhook body' });
  }

  try {
    // Must logically delete child records before parents
    await prisma.syncLog.deleteMany({
      where: { shop: shop_domain },
    });

    await prisma.merchantSettings.deleteMany({
      where: { shop: shop_domain },
    });

    await prisma.session.deleteMany({
      where: { shop: shop_domain },
    });

    console.log(`[GDPR] Shop redact completed for: ${shop_domain}`);
  } catch (error) {
    console.error(`[GDPR] Shop redact failed for: ${shop_domain}`, error);
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

app.post('/webhooks/app/uninstalled', rawParser, verifyWebhook, async (req, res) => {
  const shop = req.webhookBody.myshopify_domain || req.get('X-Shopify-Shop-Domain');

  if (!shop) {
    return res.status(400).json({ error: 'Missing shop domain' });
  }

  try {
    // Must logically delete child records before parents
    await prisma.syncLog.deleteMany({
      where: { shop },
    });

    await prisma.merchantSettings.deleteMany({
      where: { shop },
    });

    await prisma.session.deleteMany({
      where: { shop },
    });

    console.log(`[UNINSTALL] App uninstalled and data cleaned for: ${shop}`);
  } catch (error) {
    console.error(`[UNINSTALL] Failed to clean data for: ${shop}`, error);
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

app.use(express.json());

app.get("/api/debug/health", async (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    status: "unknown",
    checks: {
      database: {
        status: "unknown",
        message: "",
        latency: 0,
      },
      goldapi: {
        status: "unknown",
        message: "",
        latency: 0,
      },
      shopify: {
        status: "unknown",
        message: "",
        latency: 0,
      },
    },
  };

  try {
    // 1. Database Connection Check
    const dbStartTime = Date.now();
    try {
      const dbCheck = await prisma.$queryRaw`SELECT 1`;
      health.checks.database.status = "healthy";
      health.checks.database.message = "Database connection successful";
      health.checks.database.latency = Date.now() - dbStartTime;
    } catch (dbError) {
      health.checks.database.status = "unhealthy";
      health.checks.database.message = dbError.message || "Database connection failed";
      health.checks.database.latency = Date.now() - dbStartTime;
    }

    // 2. GoldAPI Connection Check
    const apiStartTime = Date.now();
    try {
      const apiResult = await fetchMetalPrice("XAU");

      if (apiResult && apiResult.success === true) {
        health.checks.goldapi.status = "healthy";
        health.checks.goldapi.message = `Successfully fetched XAU price: $${apiResult.data.pricePerOunce}/oz`;
      } else {
        health.checks.goldapi.status = "unhealthy";
        health.checks.goldapi.message = `API returned error: ${apiResult.error}`;
      }

      health.checks.goldapi.latency = Date.now() - apiStartTime;
    } catch (apiError) {
      health.checks.goldapi.status = "unhealthy";
      health.checks.goldapi.message = apiError.message || "GoldAPI connection failed";
      health.checks.goldapi.latency = Date.now() - apiStartTime;
    }

    // 3. Shopify GraphQL Connection Check
    const shopifyStartTime = Date.now();
    try {
      const testSession = await prisma.session.findFirst();

      if (!testSession) {
        health.checks.shopify.status = "unknown";
        health.checks.shopify.message =
          "No active sessions found; cannot test Shopify connection";
        health.checks.shopify.latency = Date.now() - shopifyStartTime;
      } else {
        try {
          const client = new shopify.api.clients.Graphql({
            session: testSession,
          });

          const testQuery = `
            query {
              shop {
                name
              }
            }
          `;

          const response = await client.graphql(testQuery);

          if (
            response &&
            response.body &&
            response.body.data &&
            response.body.data.shop
          ) {
            health.checks.shopify.status = "healthy";
            health.checks.shopify.message = `Successfully connected to Shopify shop: ${response.body.data.shop.name}`;
          } else {
            health.checks.shopify.status = "unhealthy";
            health.checks.shopify.message = "Unexpected Shopify GraphQL response format";
          }

          health.checks.shopify.latency = Date.now() - shopifyStartTime;
        } catch (graphqlError) {
          health.checks.shopify.status = "unhealthy";
          health.checks.shopify.message =
            graphqlError.message || "Shopify GraphQL query failed";
          health.checks.shopify.latency = Date.now() - shopifyStartTime;
        }
      }
    } catch (shopifyError) {
      health.checks.shopify.status = "unhealthy";
      health.checks.shopify.message =
        shopifyError.message || "Shopify connection check failed";
      health.checks.shopify.latency = Date.now() - shopifyStartTime;
    }

    // Determine overall status
    const allStatuses = Object.values(health.checks).map((c) => c.status);
    if (allStatuses.every((s) => s === "healthy")) {
      health.status = "healthy";
    } else if (allStatuses.some((s) => s === "unhealthy")) {
      health.status = "degraded";
    } else {
      health.status = "unknown";
    }

    res.json(health);
  } catch (error) {
    health.status = "error";
    health.error = error.message;
    res.status(500).json(health);
  }
});

// Set up Shopify authentication routes
app.get("/api/auth", shopify.auth.begin());
app.get(
  "/api/auth/callback",
  shopify.auth.callback(),
  async (req, res, next) => {
    const session = res.locals.shopify.session;
    const shop = session.shop;

    try {
      // 1. Create default settings if they don't exist
      await prisma.merchantSettings.upsert({
        where: { shop },
        update: {},
        create: {
          shop,
          goldApiKey: process.env.GOLD_API_KEY || "",
          markupPercentage: 0,
        },
      });

      // 2. Ensure metafields are defined immediately
      const client = new shopify.api.clients.Graphql({ session });
      await shopifyService.ensureMetafieldDefinitions(client);

      // 3. Register app/uninstalled webhook
      try {
        const webhookCheckQuery = `{
          webhookSubscriptions(first: 10, topics: APP_UNINSTALLED) {
            edges { node { id callbackUrl } }
          }
        }`;
        const existingWebhooks = await client.graphql(webhookCheckQuery);
        const edges = existingWebhooks.body.data.webhookSubscriptions.edges;
        const callbackUrl = `${process.env.SHOPIFY_APP_URL}/webhooks/app/uninstalled`;

        const alreadyRegistered = edges.some(e => e.node.callbackUrl === callbackUrl);

        if (!alreadyRegistered) {
          const registerMutation = `
            mutation {
              webhookSubscriptionCreate(
                topic: APP_UNINSTALLED
                webhookSubscription: { callbackUrl: "${callbackUrl}", format: JSON }
              ) {
                webhookSubscription { id }
                userErrors { field message }
              }
            }
          `;
          await client.graphql(registerMutation);
          console.log(`[AUTH] Registered APP_UNINSTALLED webhook for ${shop}`);
        }
      } catch (webhookError) {
        console.error(`[AUTH] Failed to register webhook for ${shop}:`, webhookError.message);
        // Non-fatal — don't block auth flow
      }
    } catch (error) {
      console.error(`Error in post-auth setup for ${shop}:`, error);
    }

    next();
  },
  shopify.redirectToShopifyOrAppRoot()
);

app.use("/api/*", shopify.validateAuthenticatedSession());

app.get("/api/products", async (req, res) => {
  const session = res.locals.shopify.session;
  const { cursor, limit = 25, search, tag } = req.query;

  try {
    const client = new shopify.api.clients.Graphql({ session });

    let queryParts = [];
    if (search) queryParts.push(`title:*${search}*`);
    if (tag) queryParts.push(`tag:${tag}`);

    const graphqlQuery = `
      query GetProducts($first: Int!, $query: String, $cursor: String) {
        products(first: $first, after: $cursor, query: $query) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              handle
              tags
              featuredImage {
                url
                altText
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    sku
                  }
                }
              }
              metal_type: metafield(namespace: "custom", key: "metal_type") { value }
              metal_purity: metafield(namespace: "custom", key: "metal_purity") { value }
              weight_grams: metafield(namespace: "custom", key: "weight_grams") { value }
              making_charge: metafield(namespace: "custom", key: "making_charge") { value }
            }
          }
        }
      }
    `;

    const response = await client.graphql(graphqlQuery, {
      variables: {
        first: Math.min(parseInt(limit), 50),
        query: queryParts.length > 0 ? queryParts.join(" AND ") : null,
        cursor: cursor || null,
      },
    });

    const products = response.body.data.products.edges.map((edge) => edge.node);
    const pageInfo = response.body.data.products.pageInfo;

    res.json({ products, pageInfo });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products/configure", async (req, res) => {
  const session = res.locals.shopify.session;
  const { productId, metalType, metalPurity, weightGrams, makingCharge = 0, addTag = true } = req.body;

  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: "productId is required" });
  }

  const allowedMetals = ["XAU", "XAG", "XPT", "XPD"];
  if (!allowedMetals.includes(metalType)) {
    return res.status(400).json({ error: `Invalid metalType. Allowed: ${allowedMetals.join(", ")}` });
  }

  if (typeof metalPurity !== 'number' || metalPurity <= 0) {
    return res.status(400).json({ error: "metalPurity must be a positive number" });
  }

  if (typeof weightGrams !== 'number' || weightGrams <= 0) {
    return res.status(400).json({ error: "weightGrams must be a positive number" });
  }

  if (typeof makingCharge !== 'number' || makingCharge < 0) {
    return res.status(400).json({ error: "makingCharge must be a non-negative number" });
  }

  try {
    const client = new shopify.api.clients.Graphql({ session });

    // 1. Set Metafields
    const metafieldsMutation = `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key value }
          userErrors { field message }
        }
      }
    `;

    const metafieldsResponse = await client.graphql(metafieldsMutation, {
      variables: {
        metafields: [
          { ownerId: productId, namespace: "custom", key: "metal_type", type: "single_line_text_field", value: metalType },
          { ownerId: productId, namespace: "custom", key: "metal_purity", type: "number_decimal", value: String(metalPurity) },
          { ownerId: productId, namespace: "custom", key: "weight_grams", type: "number_decimal", value: String(weightGrams) },
          { ownerId: productId, namespace: "custom", key: "making_charge", type: "number_decimal", value: String(makingCharge) },
        ],
      },
    });

    const metafieldErrors = metafieldsResponse.body.data.metafieldsSet.userErrors;
    if (metafieldErrors.length > 0) {
      return res.status(400).json({ error: "Failed to set metafields", userErrors: metafieldErrors });
    }

    // 2. Add Tag if requested
    if (addTag) {
      const tagMutation = `
        mutation AddTag($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            node { id }
            userErrors { field message }
          }
        }
      `;
      await client.graphql(tagMutation, {
        variables: { id: productId, tags: ["auto_price_update"] },
      });
    }

    // 3. Upsert into ProductConfig for consistency
    const configData = {
      shopifyProductId: productId,
      shopifyVariantId: null, // Product-level config
      metalType,
      metalPurity,
      weightGrams,
      makingCharge,
      shop: session.shop
    };

    await prisma.productConfig.upsert({
      where: {
        shopifyProductId_shopifyVariantId: {
          shopifyProductId: productId,
          shopifyVariantId: "", // Prisma @unique on specific combination
        },
      },
      update: configData,
      create: configData,
    });

    res.json({ success: true, productId });
  } catch (error) {
    console.error("Error configuring product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products/configure-bulk", async (req, res) => {
  const session = res.locals.shopify.session;
  const { products } = req.body;

  if (!Array.isArray(products)) {
    return res.status(400).json({ error: "products must be an array" });
  }

  if (products.length > 50) {
    return res.status(400).json({ error: "Maximum 50 products per bulk request" });
  }

  const results = { configured: 0, errors: [] };
  const client = new shopify.api.clients.Graphql({ session });

  for (const config of products) {
    const { productId, metalType, metalPurity, weightGrams, makingCharge = 0, addTag = true } = config;

    // Basic internal validation
    const allowedMetals = ["XAU", "XAG", "XPT", "XPD"];
    if (!productId || !allowedMetals.includes(metalType) || metalPurity <= 0 || weightGrams <= 0) {
      results.errors.push({ productId, error: "Invalid input parameters" });
      continue;
    }

    try {
      // 1. Set Metafields
      const metafieldsMutation = `
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { message }
          }
        }
      `;
      const mfRes = await client.graphql(metafieldsMutation, {
        variables: {
          metafields: [
            { ownerId: productId, namespace: "custom", key: "metal_type", type: "single_line_text_field", value: metalType },
            { ownerId: productId, namespace: "custom", key: "metal_purity", type: "number_decimal", value: String(metalPurity) },
            { ownerId: productId, namespace: "custom", key: "weight_grams", type: "number_decimal", value: String(weightGrams) },
            { ownerId: productId, namespace: "custom", key: "making_charge", type: "number_decimal", value: String(makingCharge) },
          ],
        },
      });

      if (mfRes.body.data.metafieldsSet.userErrors.length > 0) {
        results.errors.push({ productId, error: mfRes.body.data.metafieldsSet.userErrors[0].message });
        continue;
      }

      // 2. Add Tag
      if (addTag) {
        const tagMutation = `mutation AddTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`;
        await client.graphql(tagMutation, { variables: { id: productId, tags: ["auto_price_update"] } });
      }

      // 3. Upsert local record
      const configData = { shopifyProductId: productId, shopifyVariantId: "", metalType, metalPurity, weightGrams, makingCharge, shop: session.shop };
      await prisma.productConfig.upsert({
        where: { shopifyProductId_shopifyVariantId: { shopifyProductId: productId, shopifyVariantId: "" } },
        update: configData,
        create: configData,
      });

      results.configured++;
    } catch (err) {
      results.errors.push({ productId, error: err.message });
    }
  }

  res.json(results);
});

app.post("/api/settings", async (req, res) => {
  const shop = res.locals.shopify?.session?.shop;
  const {
    goldApiKey,
    markupPercentage,
    stopLossXAU,
    stopLossXAG,
    stopLossXPT,
    stopLossXPD,
    syncFrequencyMin,
    showPriceBreakup
  } = req.body;

  if (!shop) {
    return res.status(401).json({ error: "Unauthorized: Missing session shop" });
  }

  // Validation
  if (markupPercentage !== undefined && (typeof markupPercentage !== 'number' || isNaN(markupPercentage))) {
    return res.status(400).json({ error: "markupPercentage must be a valid number" });
  }

  if (goldApiKey !== undefined && (!goldApiKey || goldApiKey.trim() === '')) {
    return res.status(400).json({ error: "goldApiKey is required" });
  }

  const validateStopLoss = (val) => val === null || val === undefined || (typeof val === 'number' && val >= 0);
  if (![stopLossXAU, stopLossXAG, stopLossXPT, stopLossXPD].every(validateStopLoss)) {
    return res.status(400).json({ error: "Stop-loss values must be positive numbers or null" });
  }

  if (syncFrequencyMin !== undefined) {
    if (!Number.isInteger(syncFrequencyMin) || syncFrequencyMin < 15 || syncFrequencyMin > 1440) {
      return res.status(400).json({ error: "syncFrequencyMin must be an integer between 15 and 1440" });
    }
  }

  if (showPriceBreakup !== undefined && typeof showPriceBreakup !== 'boolean') {
    return res.status(400).json({ error: "showPriceBreakup must be a boolean" });
  }

  try {
    const updateData = {};
    if (goldApiKey !== undefined) updateData.goldApiKey = encrypt(goldApiKey.trim());
    if (markupPercentage !== undefined) updateData.markupPercentage = markupPercentage;
    if (stopLossXAU !== undefined) updateData.stopLossXAU = stopLossXAU || null;
    if (stopLossXAG !== undefined) updateData.stopLossXAG = stopLossXAG || null;
    if (stopLossXPT !== undefined) updateData.stopLossXPT = stopLossXPT || null;
    if (stopLossXPD !== undefined) updateData.stopLossXPD = stopLossXPD || null;
    if (syncFrequencyMin !== undefined) updateData.syncFrequencyMin = syncFrequencyMin;
    if (showPriceBreakup !== undefined) updateData.showPriceBreakup = showPriceBreakup;

    const settings = await prisma.merchantSettings.upsert({
      where: { shop },
      update: updateData,
      create: {
        shop,
        ...updateData,
        goldApiKey: updateData.goldApiKey || "", // Ensure required field for create
      },
    });

    res.json(settings);
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/settings", async (req, res) => {
  const shop = res.locals.shopify.session.shop;

  try {
    const settings = await prisma.merchantSettings.findUnique({
      where: { shop },
    });

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }

    // Decrypt the API key before sending it to the frontend
    settings.goldApiKey = decrypt(settings.goldApiKey);

    // Ensure metafields and currency are set up when settings are fetched
    const session = await prisma.session.findFirst({
      where: { shop },
    });

    if (session) {
      const client = new shopify.api.clients.Graphql({ session });
      await shopifyService.ensureMetafieldDefinitions(client);

      const currency = await shopifyService.getShopCurrency(client);
      if (currency && currency !== settings.storeCurrency) {
        await prisma.merchantSettings.update({
          where: { shop },
          data: { storeCurrency: currency }
        });
        settings.storeCurrency = currency;
      }
    }

    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sync", async (req, res) => {
  const shop = res.locals.shopify.session.shop;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  try {
    const merchant = await prisma.merchantSettings.findUnique({
      where: { shop },
    });

    if (!merchant) {
      return res.status(404).json({ error: "Merchant settings not found. Please save settings first." });
    }

    const session = await prisma.session.findFirst({
      where: { shop },
    });

    if (!session) {
      return res.status(401).json({ error: "No active session" });
    }

    const client = new shopify.api.clients.Graphql({ session });

    const decryptedApiKey = decrypt(merchant.goldApiKey);

    const stopLossConfig = {};
    if (merchant.stopLossXAU) stopLossConfig.XAU = merchant.stopLossXAU;
    if (merchant.stopLossXAG) stopLossConfig.XAG = merchant.stopLossXAG;
    if (merchant.stopLossXPT) stopLossConfig.XPT = merchant.stopLossXPT;
    if (merchant.stopLossXPD) stopLossConfig.XPD = merchant.stopLossXPD;

    // Create log entry (try/catch in case migration hasn't run)
    let syncLog;
    try {
      syncLog = await prisma.syncLog.create({
        data: {
          shop,
          status: "IN_PROGRESS",
          message: "Manual sync started",
        }
      });
    } catch (e) {
      console.warn("Could not create sync log, skipping log step:", e.message);
    }

    const result = await updatePricesForShop(
      client,
      merchant.markupPercentage,
      merchant.storeCurrency,
      decryptedApiKey,
      false,
      stopLossConfig
    );

    if (syncLog) {
      try {
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: result.success ? "SUCCESS" : "FAILED",
            message: result.success ? "Sync completed successfully" : "Sync failed during update",
            itemsUpdated: result.itemsUpdated,
            completedAt: new Date(),
          }
        });
      } catch (logUpdateError) {
        console.warn("Could not update sync log:", logUpdateError.message);
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Error during manual sync:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/logs", async (req, res) => {
  const shop = res.locals.shopify.session.shop;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  try {
    const logs = await prisma.syncLog.findMany({
      where: { shop },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
    res.json(logs);
  } catch (error) {
    res.json([]); // Return empty if table doesn't exist yet
  }
});

app.get("/api/formulas", async (req, res) => {
  const shop = res.locals.shopify.session.shop;
  try {
    const formulas = await prisma.pricingFormula.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });
    res.json(formulas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/formulas", async (req, res) => {
  const shop = res.locals.shopify.session.shop;
  const { id, name, formulaConfig, applyToTags, isDefault } = req.body;

  if (!name || !formulaConfig) {
    return res.status(400).json({ error: "Name and formulaConfig are required" });
  }

  let parsedConfig;
  try {
    parsedConfig = typeof formulaConfig === 'string' ? JSON.parse(formulaConfig) : formulaConfig;
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON in formulaConfig" });
  }

  const validation = validateFormulaConfig(parsedConfig);
  if (!validation.valid) {
    return res.status(400).json({ error: "Invalid formula configuration", details: validation.errors });
  }

  try {
    if (isDefault) {
      await prisma.pricingFormula.updateMany({
        where: { shop, isDefault: true },
        data: { isDefault: false },
      });
    }

    const data = {
      shop,
      name,
      formulaConfig: JSON.stringify(parsedConfig),
      applyToTags,
      isDefault: !!isDefault,
    };

    let formula;
    if (id) {
      formula = await prisma.pricingFormula.update({
        where: { id, shop }, // Security: ensure it belongs to shop
        data,
      });
    } else {
      formula = await prisma.pricingFormula.create({ data });
    }

    res.json(formula);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/formulas/:id", async (req, res) => {
  const shop = res.locals.shopify.session.shop;
  const { id } = req.params;

  try {
    await prisma.pricingFormula.delete({
      where: { id, shop }, // Security: ensures only owner can delete
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/csv/import", async (req, res) => {
  const shop = res.locals.shopify.session.shop;
  const { csvData } = req.body;

  if (!csvData) {
    return res.status(400).json({ error: "Missing csvData" });
  }

  try {
    const { valid, errors } = parseProductConfigCSV(csvData);

    let importedCount = 0;
    for (const item of valid) {
      const data = {
        shop,
        shopifyProductId: item.shopifyProductId,
        shopifyVariantId: item.shopifyVariantId || "",
        metalType: item.metalType,
        metalPurity: item.metalPurity,
        weightGrams: item.weightGrams,
        makingCharge: item.makingCharge,
      };

      await prisma.productConfig.upsert({
        where: {
          shopifyProductId_shopifyVariantId: {
            shopifyProductId: item.shopifyProductId,
            shopifyVariantId: item.shopifyVariantId || "",
          },
        },
        update: data,
        create: data,
      });
      importedCount++;
    }

    res.json({ imported: importedCount, errors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/csv/export", async (req, res) => {
  const shop = res.locals.shopify.session.shop;

  try {
    const configs = await prisma.productConfig.findMany({
      where: { shop },
    });

    const csv = generateProductConfigCSV(configs);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=product_configs_${shop}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/csv/template", async (req, res) => {
  try {
    const template = generateTemplateCSV();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=product_config_template.csv");
    res.send(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function runPriceUpdateJob() {
  try {
    const activeMerchants = await prisma.merchantSettings.findMany({
      where: { isCronActive: true },
    });

    for (const merchant of activeMerchants) {
      try {
        const session = await prisma.session.findFirst({
          where: { shop: merchant.shop },
        });

        if (!session) continue;

        const client = new shopify.api.clients.Graphql({ session });

        const decryptedApiKey = decrypt(merchant.goldApiKey);

        const stopLossConfig = {};
        if (merchant.stopLossXAU) stopLossConfig.XAU = merchant.stopLossXAU;
        if (merchant.stopLossXAG) stopLossConfig.XAG = merchant.stopLossXAG;
        if (merchant.stopLossXPT) stopLossConfig.XPT = merchant.stopLossXPT;
        if (merchant.stopLossXPD) stopLossConfig.XPD = merchant.stopLossXPD;

        // Create log entry for cron sync
        let syncLog;
        try {
          syncLog = await prisma.syncLog.create({
            data: {
              shop: merchant.shop,
              status: "IN_PROGRESS",
              message: "Automated cron sync started",
            }
          });
        } catch (e) {
          console.warn(`[CRON] Could not create sync log for ${merchant.shop}`);
        }

        // Sync logic
        const result = await updatePricesForShop(
          client,
          merchant.markupPercentage,
          merchant.storeCurrency,
          decryptedApiKey,
          false,
          stopLossConfig
        );

        if (syncLog) {
          try {
            await prisma.syncLog.update({
              where: { id: syncLog.id },
              data: {
                status: result.success ? "SUCCESS" : "FAILED",
                message: result.success ? "Automated sync completed" : "Automated sync failed",
                itemsUpdated: result.itemsUpdated,
                completedAt: new Date(),
              }
            });
          } catch (logUpdateError) {
            console.warn(`[CRON] Could not update sync log for ${merchant.shop}:`, logUpdateError.message);
          }
        }
      } catch (error) {
        console.error(`Error processing shop ${merchant.shop}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in price update job:", error);
  }
}

cron.schedule("0 */6 * * *", runPriceUpdateJob);

// Serve static frontend AFTER all API/auth routes
const distPath = path.resolve(__dirname, "frontend", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});


const PORT = process.env.PORT || 8081;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
