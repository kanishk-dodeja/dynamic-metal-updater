import { shopifyApp } from "@shopify/shopify-api";
import { SQLiteSessionStorage } from "@shopify/shopify-api/adapters/sqlite";
import express from "express";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { updatePricesForShop } from "./services/priceUpdater.js";

const prisma = new PrismaClient();
const path = require("path");
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
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecret: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(","),
  host: process.env.SHOPIFY_APP_URL,
  isEmbeddedApp: false,
  sessionStorage: new SQLiteSessionStorage({
    db: prisma.$client,
  }),
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
      const { fetchMetalPrice } = require("./services/metalService.js");
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
          const client = new shopify.clients.Graphql({
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

app.use("/api/*", shopify.validateAuthenticatedRequest());

app.post("/api/settings", async (req, res) => {
  const { shop, goldApiKey, markupPercentage } = req.body;

  try {
    const settings = await prisma.merchantSettings.upsert({
      where: { shop },
      update: {
        goldApiKey,
        markupPercentage,
      },
      create: {
        shop,
        goldApiKey,
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
  const { shop } = req.query;

  try {
    const settings = await prisma.merchantSettings.findUnique({
      where: { shop },
    });

    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }

    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: error.message });
  }
});

async function runPriceUpdateJob() {
  console.log("Starting price update cron job at", new Date().toISOString());

  try {
    const activeMerchants = await prisma.merchantSettings.findMany({
      where: { isCronActive: true },
    });

    console.log(`Found ${activeMerchants.length} active merchants`);

    for (const merchant of activeMerchants) {
      try {
        const session = await prisma.session.findFirst({
          where: { shop: merchant.shop },
        });

        if (!session) {
          console.warn(`No session found for shop: ${merchant.shop}`);
          continue;
        }

        const client = new shopify.clients.Graphql({
          session,
        });

        const success = await updatePricesForShop(client, merchant.markupPercentage);

        if (success) {
          console.log(`Successfully updated prices for ${merchant.shop}`);
        } else {
          console.error(`Failed to update prices for ${merchant.shop}`);
        }
      } catch (error) {
        console.error(`Error processing shop ${merchant.shop}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in price update job:", error);
  }

  console.log("Price update cron job completed at", new Date().toISOString());
}

cron.schedule("0 */6 * * *", runPriceUpdateJob);


const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
