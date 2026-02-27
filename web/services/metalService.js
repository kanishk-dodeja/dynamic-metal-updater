import axios from 'axios';

const METALS_DEV_API_BASE = 'https://api.metals.dev/v1/latest';
const AXIOS_TIMEOUT = 10000;

let priceCache = { data: null, currency: null, timestamp: 0, TTL: 60000 }; // 1 min TTL

const metalKeyMap = {
  XAU: 'gold',
  XAG: 'silver',
  XPT: 'platinum',
  XPD: 'palladium'
};

async function fetchAllMetalPrices(currency = 'USD', apiKey = null) {
  try {
    let finalApiKey = (apiKey || process.env.METALS_DEV_API_KEY || process.env.GOLD_API_KEY || "").trim();

    // Robust cleanup: remove quotes, "Key:", or spaces
    finalApiKey = finalApiKey.replace(/^["'](.+)["']$/, '$1')
      .replace(/^api_key\s*:\s*/i, '')
      .replace(/^key\s*:\s*/i, '')
      .trim();

    if (!finalApiKey) {
      console.error('API Key not provided and METALS_DEV_API_KEY not configured');
      return {
        success: false,
        error: 'API_KEY_NOT_CONFIGURED',
      };
    }

    if (
      priceCache.data &&
      priceCache.currency === currency &&
      (Date.now() - priceCache.timestamp) < priceCache.TTL
    ) {
      return { success: true, data: priceCache.data };
    }

    const response = await axios.get(METALS_DEV_API_BASE, {
      params: {
        api_key: finalApiKey,
        currency,
        unit: 'g'
      },
      timeout: AXIOS_TIMEOUT,
    });

    if (response.data && response.data.status === 'success' && response.data.metals) {
      priceCache = {
        data: response.data.metals,
        currency,
        timestamp: Date.now(),
        TTL: 60000
      };

      return {
        success: true,
        data: response.data.metals
      };
    } else {
      console.error(`Unexpected API response from Metals.Dev: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: 'INVALID_API_RESPONSE',
      };
    }

  } catch (error) {
    let errorReason = 'UNKNOWN_ERROR';

    if (error.code === 'ECONNABORTED') {
      errorReason = 'REQUEST_TIMEOUT';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorReason = 'CONNECTION_FAILED';
    } else if (error.response && error.response.status === 401) {
      errorReason = 'UNAUTHORIZED';
    } else if (error.response && error.response.status === 429) {
      errorReason = 'RATE_LIMITED';
    } else if (error.message) {
      errorReason = error.message.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
    }

    console.error(
      `Failed to fetch all metal prices: [${errorReason}] ${error.message}`,
    );

    return {
      success: false,
      error: errorReason,
    };
  }
}

async function getPricePerGram(metalCode, currency = 'USD', apiKey = null) {
  const result = await fetchAllMetalPrices(currency, apiKey);

  if (!result.success) {
    console.warn(`getPricePerGram skipped for ${metalCode} (${currency}): ${result.error}`);
    return null;
  }

  const mappedKey = metalKeyMap[metalCode];
  if (!mappedKey) {
    console.error(`Invalid metalCode provided: ${metalCode}`);
    return null;
  }

  const pricePerGram = result.data[mappedKey];

  if (typeof pricePerGram !== 'number' || pricePerGram <= 0) {
    console.error(
      `Invalid price per gram calculation for ${metalCode}: ${pricePerGram}`,
    );
    return null;
  }

  return pricePerGram;
}

async function fetchMetalPrice(metalCode, currency = 'USD', apiKey = null) {
  if (!metalCode || typeof metalCode !== 'string') {
    console.error('Invalid metalCode provided');
    return {
      success: false,
      error: 'INVALID_METAL_CODE',
    };
  }

  const result = await fetchAllMetalPrices(currency, apiKey);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  const mappedKey = metalKeyMap[metalCode];
  if (!mappedKey) {
    console.error(`Invalid metalCode provided: ${metalCode}`);
    return {
      success: false,
      error: 'INVALID_METAL_CODE',
    };
  }

  const pricePerGram = result.data[mappedKey];

  if (typeof pricePerGram !== 'number' || pricePerGram <= 0) {
    console.error(`Invalid price value (${pricePerGram}) for ${metalCode}`);
    return {
      success: false,
      error: 'INVALID_PRICE_VALUE',
    };
  }

  const troyOunceToGram = 31.1035;
  const pricePerOunce = pricePerGram * troyOunceToGram;

  return {
    success: true,
    data: {
      metalCode,
      pricePerOunce,
      currency,
      timestamp: priceCache.timestamp || Date.now(),
    },
  };
}

async function getAllPricesPerGram(currency = 'USD', apiKey = null) {
  const result = await fetchAllMetalPrices(currency, apiKey);

  if (!result.success) {
    console.warn(`getAllPricesPerGram skipped (${currency}): ${result.error}`);
    return null;
  }

  const prices = {};
  for (const [code, mappedKey] of Object.entries(metalKeyMap)) {
    const price = result.data[mappedKey];
    if (typeof price === 'number' && price > 0) {
      prices[code] = price;
    }
  }

  return Object.keys(prices).length > 0 ? prices : null;
}

export {
  fetchMetalPrice,
  fetchAllMetalPrices,
  getPricePerGram,
  getAllPricesPerGram,
};
