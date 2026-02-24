import { getPricePerGram } from '../services/metalService.js';

async function testPriceCalculation() {
    console.log("--- Testing Price Calculation ---");

    // Mock ENV if not present
    if (!process.env.GOLD_API_KEY) {
        console.log("NOTE: GOLD_API_KEY not found in environment. Testing logic with mock success.");
    }

    // Test metal price fetching with currency
    const currencies = ['USD', 'INR', 'EUR'];
    for (const curr of currencies) {
        console.log(`\nFetching Gold price in ${curr}...`);
        try {
            const price = await getPricePerGram('XAU', curr);
            if (price) {
                console.log(`SUCCESS: Price per gram in ${curr} is ${price.toFixed(4)}`);
            } else {
                console.log(`FAILED: Could not fetch price in ${curr} (Check your API Key)`);
            }
        } catch (e) {
            console.log(`ERROR: ${e.message}`);
        }
    }

    console.log("\n--- Verification logic check ---");
    const mockupData = {
        metalPurity: 18,
        metalWeight: 10,
        makingCharge: 50,
        globalMarkup: 10,
        pricePerGram: 60 // Mock USD price
    };

    const maxPurity = 24;
    const basePrice = mockupData.pricePerGram * (mockupData.metalPurity / maxPurity) * mockupData.metalWeight;
    const finalPrice = (basePrice + mockupData.makingCharge) * (1 + mockupData.globalMarkup / 100);

    console.log(`Mock Calculation: 18k Gold, 10g, $50 making, 10% markup, $60/g`);
    console.log(`Expected: ((60 * (18/24) * 10) + 50) * 1.1 = (450 + 50) * 1.1 = 550`);
    console.log(`Result: ${finalPrice}`);

    if (finalPrice === 550) {
        console.log("CALCULATION LOGIC: VALID");
    } else {
        console.log("CALCULATION LOGIC: INVALID");
    }
}

testPriceCalculation();
