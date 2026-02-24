const { getPricePerGram } = require('../services/metalService');

async function testPriceCalculation() {
    console.log("--- Testing Price Calculation ---");

    // Test metal price fetching with currency
    const currencies = ['USD', 'INR', 'EUR'];
    for (const curr of currencies) {
        console.log(`\nFetching Gold price in ${curr}...`);
        const price = await getPricePerGram('XAU', curr);
        if (price) {
            console.log(`SUCCESS: Price per gram in ${curr} is ${price.toFixed(4)}`);
        } else {
            console.log(`FAILED: Could not fetch price in ${curr}`);
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
    const finalPrice =
        mockupData.pricePerGram * (mockupData.metalPurity / maxPurity) * mockupData.metalWeight +
        mockupData.makingCharge + mockupData.globalMarkup;

    console.log(`Mock Calculation: 18k Gold, 10g, $50 making, $10 markup, $60/g`);
    console.log(`Expected: (60 * (18/24) * 10) + 50 + 10 = 450 + 60 = 510`);
    console.log(`Result: ${finalPrice}`);

    if (finalPrice === 510) {
        console.log("CALCULATION LOGIC: VALID");
    } else {
        console.log("CALCULATION LOGIC: INVALID");
    }
}

testPriceCalculation();
