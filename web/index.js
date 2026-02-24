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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const app = express();
// Serve static frontend in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "frontend", "dist");
  app.use(express.static(distPath));

  // Route all unhandled GET requests to index.html (for React Router)
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

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
      const testSession = await prisma.session.findFirst({
        where: { isOnline: true },
      });

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
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
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
    } catch (error) {
      console.error(`Error in post-auth setup for ${shop}:`, error);
    }

    next();
  },
  shopify.redirectToShopifyOrAppRoot()
);

app.use("/api/*", shopify.validateAuthenticatedRequest());

app.post("/api/settings", async (req, res) => {
  const { shop, goldApiKey, markupPercentage } = req.body;

  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  if (typeof markupPercentage !== 'number' || isNaN(markupPercentage)) {
    return res.status(400).json({ error: "markupPercentage must be a valid number" });
  }

  if (!goldApiKey || goldApiKey.trim() === '') {
    return res.status(400).json({ error: "goldApiKey is required" });
  }

  const trimmedApiKey = goldApiKey.trim();

  try {
    const settings = await prisma.merchantSettings.upsert({
      where: { shop },
      update: {
        goldApiKey: trimmedApiKey,
        markupPercentage,
      },
      create: {
        shop,
        goldApiKey: trimmedApiKey,
        markupPercentage,
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

    // Ensure metafields and currency are set up when settings are fetched
    const session = await prisma.session.findFirst({
      where: { shop },
    });

    if (session) {
      const client = new shopify.api.clients.Graphql({ session });
      await shopifyService.ensureMetafieldDefinitions(client);

      const currency = await shopifyService.getShopCurrency(client);
      if (currency !== settings.storeCurrency) {
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
      return res.status(404).json({ error: "Merchant not found" });
    }

    const session = await prisma.session.findFirst({
      where: { shop },
    });

    if (!session) {
      return res.status(401).json({ error: "No active session" });
    }

    const client = new shopify.api.clients.Graphql({ session });

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
      console.warn("Could not create sync log, migration probably not run yet");
    }

    const { success, itemsUpdated } = await updatePricesForShop(
      client,
      merchant.markupPercentage,
      merchant.storeCurrency,
      merchant.goldApiKey
    );

    if (syncLog) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: success ? "SUCCESS" : "FAILED",
          message: success ? "Sync completed successfully" : "Sync failed during update",
          itemsUpdated,
          completedAt: new Date(),
        }
      });
    }

    res.json({ success, itemsUpdated });
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
        const { success, itemsUpdated } = await updatePricesForShop(
          client,
          merchant.markupPercentage,
          merchant.storeCurrency,
          merchant.goldApiKey
        );

        if (syncLog) {
          await prisma.syncLog.update({
            where: { id: syncLog.id },
            data: {
              status: success ? "SUCCESS" : "FAILED",
              message: success ? "Automated sync completed" : "Automated sync failed",
              itemsUpdated,
              completedAt: new Date(),
            }
          });
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


const PORT = process.env.PORT || 8081;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
