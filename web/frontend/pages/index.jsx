import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

export default function SettingsPage() {
  const appBridge = useAppBridge();
  const [shop, setShop] = useState("");
  const [goldApiKey, setGoldApiKey] = useState("");
  const [markupPercentage, setMarkupPercentage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const getShop = async () => {
      try {
        const response = await appBridge.getBoundedString("shop");
        setShop(response);
        fetchSettings();
      } catch (err) {
        console.error("Failed to get shop:", err);
      }
    };

    getShop();
  }, [appBridge]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/settings?shop=${shop}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setGoldApiKey(data.goldApiKey || "");
        setMarkupPercentage(data.markupPercentage || "");
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shop,
          goldApiKey,
          markupPercentage: parseFloat(markupPercentage) || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to save settings");
        setLoading(false);
        return;
      }

      setSuccess("Settings saved successfully!");
      setLoading(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "An error occurred while saving settings");
      setLoading(false);
    }
  };

  return (
    <Page title="Dynamic Metal Price Updater Settings">
      <Layout>
        <Layout.Section>
          {error && (
            <Banner title="Error" status="critical">
              {error}
            </Banner>
          )}
          {success && (
            <Banner title="Success" status="success">
              {success}
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <FormLayout>
              <TextField
                label="Gold API Key"
                type="password"
                value={goldApiKey}
                onChange={(value) => setGoldApiKey(value)}
                placeholder="Enter your Gold API key"
                autoComplete="off"
              />

              <TextField
                label="Markup Percentage"
                type="number"
                value={markupPercentage}
                onChange={(value) => setMarkupPercentage(value)}
                placeholder="Enter markup percentage"
                step="0.01"
              />

              <Button
                primary
                onClick={handleSave}
                loading={loading}
                disabled={!goldApiKey.trim()}
              >
                Save Settings
              </Button>
            </FormLayout>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
