import { shopifyApp } from "@shopify/shopify-app-express";
import { ApiVersion } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const shopify = shopifyApp({
    api: {
        apiKey: 'test',
        apiSecretKey: 'test',
        scopes: ['read_products'],
        hostName: 'test.com',
        apiVersion: ApiVersion.October24,
        isEmbeddedApp: false,
    },
    sessionStorage: new PrismaSessionStorage(prisma),
});

console.log("shopify keys:", Object.keys(shopify));
if (shopify.clients) {
    console.log("shopify.clients exists!");
} else if (shopify.api && shopify.api.clients) {
    console.log("shopify.api.clients exists!");
} else {
    console.log("Neither shopify.clients nor shopify.api.clients exists.");
}
