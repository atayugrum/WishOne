// js/services/CurrencyService.js

export const CurrencyService = {
    // Hardcoded rates (approximate) - In a real app, fetch from an API
    rates: {
        TRY: 1,
        EUR: 35.5, // 1 EUR = 35.5 TRY
        USD: 33.0  // 1 USD = 33.0 TRY
    },

    // Convert any amount to the User's preferred currency
    convert(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) return amount;

        // Convert to Base (TRY)
        const amountInTRY = amount * this.rates[fromCurrency];

        // Convert to Target
        const result = amountInTRY / this.rates[toCurrency];
        
        return Math.ceil(result); // Round up for clean numbers
    },

    format(amount, currency) {
        return new Intl.NumberFormat('tr-TR', { 
            style: 'currency', 
            currency: currency,
            maximumFractionDigits: 0 
        }).format(amount);
    }
};