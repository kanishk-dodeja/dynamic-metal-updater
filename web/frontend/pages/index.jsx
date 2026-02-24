import { useEffect, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  DataTable,
  Text,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function SettingsPage() {
  const appBridge = useAppBridge();
  const [shop, setShop] = useState("");
  const [goldApiKey, setGoldApiKey] = useState("");
  const [markupPercentage, setMarkupPercentage] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logs, setLogs] = useState([]);

  const fetchSettings = useCallback(async (shopName) => {
    try {
      const response = await fetch(`/api/settings?shop=${shopName}`);
      if (response.ok) {
        const data = await response.json();
        setGoldApiKey(data.goldApiKey || "");
        setMarkupPercentage(data.markupPercentage?.toString() || "0");
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  const fetchLogs = useCallback(async (shopName) => {
    try {
      const response = await fetch(`/api/logs?shop=${shopName}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, []);

  useEffect(() => {
    const getShop = async () => {
      try {
        const response = await appBridge.getBoundedString("shop");
        setShop(response);
        fetchSettings(response);
        fetchLogs(response);
      } catch (err) {
        console.error("Failed to get shop:", err);
      }
    };

    getShop();
  }, [appBridge, fetchSettings, fetchLogs]);

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          goldApiKey,
          markupPercentage: parseFloat(markupPercentage) || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      setSuccess("Settings saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Sync failed");
      }

      const result = await response.json();
      setSuccess(`Sync completed! Updated ${result.itemsUpdated} products.`);
      fetchLogs(shop);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const logRows = logs.map((log) => [
    new Date(log.startedAt).toLocaleString(),
    <Badge tone={log.status === "SUCCESS" ? "success" : log.status === "FAILED" ? "critical" : "attention"}>
      {log.status}
    </Badge>,
    log.itemsUpdated.toString(),
    log.message || "-",
  ]);

  return (
    <Page title="Dynamic Metal Price Updater">
      <Layout>
        <Layout.Section>
          {error && <Banner title="Error" tone="critical">{error}</Banner>}
          {success && <Banner title="Success" tone="success">{success}</Banner>}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Base Configuration</Text>
              <FormLayout>
                <TextField
                  label="Gold API Key"
                  type="password"
                  value={goldApiKey}
                  onChange={setGoldApiKey}
                  placeholder="Enter your Gold API key"
                  autoComplete="off"
                  helpText="Get your key from goldapi.io"
                />
                <TextField
                  label="Markup Percentage"
                  type="number"
                  value={markupPercentage}
                  onChange={setMarkupPercentage}
                  placeholder="e.g. 5.5"
                  suffix="%"
                />
                <InlineStack align="start" gap="200">
                  <Button variant="primary" onClick={handleSave} loading={loading} disabled={!goldApiKey.trim()}>
                    Save Settings
                  </Button>
                  <Button onClick={handleSync} loading={syncing} disabled={!goldApiKey.trim()}>
                    Sync Now
                  </Button>
                </InlineStack>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Recent Activity</Text>
              {logs.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text"]}
                  headings={["Date", "Status", "Items", "Message"]}
                  rows={logRows}
                />
              ) : (
                <Text color="subdued">No recent activity found.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
