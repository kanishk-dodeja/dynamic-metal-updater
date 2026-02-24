import axios from 'axios';

const GOLD_API_BASE = 'https://www.goldapi.io/api';
const AXIOS_TIMEOUT = 5000;

async function fetchMetalPrice(metalCode, currency = 'USD') {
  try {
    const apiKey = process.env.GOLD_API_KEY;
    if (!apiKey || typeof apiKey !== 'string') {
      console.error('GOLD_API_KEY not configured or invalid');
      return {
        success: false,
        error: 'GOLD_API_KEY_NOT_CONFIGURED',
      };
    }

    if (!metalCode || typeof metalCode !== 'string') {
      console.error('Invalid metalCode provided');
      return {
        success: false,
        error: 'INVALID_METAL_CODE',
      };
    }

    const response = await axios.get(`${GOLD_API_BASE}/${metalCode}/${currency}`, {
      headers: {
        'x-access-token': apiKey,
      },
      timeout: AXIOS_TIMEOUT,
    });

    if (response.status !== 200) {
      console.error(`Unexpected response status ${response.status}`);
      return {
        success: false,
        error: `HTTP_STATUS_${response.status}`,
      };
    }

    const { data } = response;

    if (
      !data ||
      typeof data !== 'object' ||
      data.price === null ||
      data.price === undefined ||
      typeof data.price !== 'number'
    ) {
      console.error(`Missing or invalid price field in API response for ${metalCode}`);
      return {
        success: false,
        error: 'INVALID_API_RESPONSE',
      };
    }

    if (data.price <= 0) {
      console.error(`Invalid price value (${data.price}) for ${metalCode}`);
      return {
        success: false,
        error: 'INVALID_PRICE_VALUE',
      };
    }

    return {
      success: true,
      data: {
        metalCode: data.metal || metalCode,
        pricePerOunce: data.price,
        currency: data.currency || currency,
        timestamp: data.timestamp,
      },
    };
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
      `Failed to fetch metal price for ${metalCode}: [${errorReason}] ${error.message}`,
    );

    return {
      success: false,
      error: errorReason,
    };
  }
}

async function getPricePerGram(metalCode, currency = 'USD') {
  const troyOunceToGram = 31.1035;

  const result = await fetchMetalPrice(metalCode, currency);

  if (!result.success) {
    console.warn(`getPricePerGram skipped for ${metalCode} (${currency}): ${result.error}`);
    return null;
  }

  const pricePerGram = result.data.pricePerOunce / troyOunceToGram;

  if (typeof pricePerGram !== 'number' || pricePerGram <= 0) {
    console.error(
      `Invalid price per gram calculation for ${metalCode}: ${pricePerGram}`,
    );
    return null;
  }

  return pricePerGram;
}

export {
  fetchMetalPrice,
  getPricePerGram,
};
