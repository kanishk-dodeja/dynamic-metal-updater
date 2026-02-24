import { shopifyApp } from "@shopify/shopify-app-express";
import { ApiVersion } from "@shopify/shopify-api";

const shopify = shopifyApp({
    api: {
        apiKey: 'test',
        apiSecretKey: 'test',
        scopes: ['read_products'],
        hostName: 'test.com',
        apiVersion: ApiVersion.October24,
        isEmbeddedApp: false,
    }
});

try {
    const rawSession = {
        id: "test",
        shop: "test.myshopify.com",
        state: "test",
        isOnline: false,
        accessToken: "test_token",
        scope: "read_products"
    };
    const client = new shopify.api.clients.Graphql({ session: rawSession });
    console.log("Success! Accepts raw object.");
} catch (e) {
    console.log("Failed:", e.message);
}
