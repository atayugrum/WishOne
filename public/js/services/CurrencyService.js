// js/services/CurrencyService.js
import { apiCall } from '../config/api.js';

export const CurrencyService = {
    rates: {
        TRY: 1,
        EUR: 0.028, // Fallback
        USD: 0.030  // Fallback
    },

    async init() {
        try {
            // Try to get from localStorage first
            const cached = localStorage.getItem('currency_rates');
            const cachedTime = localStorage.getItem('currency_timestamp');
            const now = Date.now();

            if (cached && cachedTime && (now - cachedTime < 3600000)) { // 1 hour
                this.rates = JSON.parse(cached);
                console.log('Using cached currency rates');
                return;
            }

            // Fetch from backend
            console.log('Fetching fresh currency rates...');
            const rates = await apiCall('/api/currency/rates', 'GET');
            if (rates) {
                this.rates = rates;
                localStorage.setItem('currency_rates', JSON.stringify(rates));
                localStorage.setItem('currency_timestamp', now);
            }
        } catch (error) {
            console.warn('Failed to init currency service, using fallbacks:', error);
        }
    },

    // Convert any amount to the User's preferred currency (Target is usually TRY for dashboard)
    convert(amount, fromCurrency, toCurrency) {
        if (!amount) return 0;
        if (fromCurrency === toCurrency) return amount;

        // Rates are based on TRY (1 TRY = x Foreign)
        // Example: 1 TRY = 0.03 USD
        // To convert USD to TRY: Amount / Rate
        // To convert TRY to USD: Amount * Rate

        let amountInTRY;

        if (fromCurrency === 'TRY') {
            amountInTRY = amount;
        } else {
            // Convert Foreign to TRY (e.g. 100 USD / 0.03 = 3333 TRY)
            const rate = this.rates[fromCurrency];
            if (!rate) return amount; // Unknown currency
            amountInTRY = amount / rate;
        }

        if (toCurrency === 'TRY') {
            return Math.ceil(amountInTRY);
        }

        // Convert TRY to Target
        const targetRate = this.rates[toCurrency];
        return Math.ceil(amountInTRY * targetRate);
    },

    format(amount, currency) {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(amount);
    }
};

// Auto-init
CurrencyService.init();