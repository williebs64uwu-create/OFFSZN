/**
 * OFFSZN Global Currency Manager
 * Centralizes all currency conversion logic.
 * Supported: USD (base), PEN, EUR
 * 
 * Usage:
 *   window.CurrencyManager.format(29.99)         → "$29.99" or "S/113.96" or "€27.59"
 *   window.CurrencyManager.getCurrency()          → "USD" | "PEN" | "EUR"
 *   window.CurrencyManager.setCurrency("EUR")     → saves + dispatches event
 *   window.CurrencyManager.convert(29.99)         → 113.96 (if PEN) | 27.59 (if EUR) | 29.99 (if USD)
 *   window.CurrencyManager.formatFromString("$29") → "S/110.20" (if PEN)
 */
(function () {
    'use strict';

    // Fixed visual rates (approximate, for display only — real charges are always in USD)
    const RATES = {
        USD: 1,
        PEN: 3.80,
        EUR: 0.92
    };

    const SYMBOLS = {
        USD: '$',
        PEN: 'S/',
        EUR: '€'
    };

    const STORAGE_KEY = 'userCurrency';

    const CurrencyManager = {
        /**
         * Get the user's selected currency
         * @returns {'USD'|'PEN'|'EUR'}
         */
        getCurrency() {
            return localStorage.getItem(STORAGE_KEY) || 'PEN';
        },

        /**
         * Set the user's preferred currency
         * Dispatches 'currencyChanged' event for reactive UI updates
         * @param {'USD'|'PEN'|'EUR'} currency
         */
        setCurrency(currency) {
            if (!RATES[currency]) return;
            localStorage.setItem(STORAGE_KEY, currency);
            // Dispatch global event so pages can react
            window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency } }));
        },

        /**
         * Get the conversion rate for a currency
         * @param {'USD'|'PEN'|'EUR'} currency
         * @returns {number}
         */
        getRate(currency) {
            return RATES[currency] || 1;
        },

        /**
         * Get the symbol for a currency
         * @param {'USD'|'PEN'|'EUR'} currency
         * @returns {string}
         */
        getSymbol(currency) {
            return SYMBOLS[currency] || '$';
        },

        /**
         * Convert a USD amount to the user's selected currency
         * @param {number} amountUSD - Price in USD
         * @param {string} [currency] - Override currency (defaults to user's selection)
         * @returns {number}
         */
        convert(amountUSD, currency) {
            const curr = currency || this.getCurrency();
            const rate = RATES[curr] || 1;
            return amountUSD * rate;
        },

        /**
         * Format a USD amount as a display string in the user's currency
         * @param {number} amountUSD - Price in USD
         * @param {object} [opts] - Options
         * @param {string} [opts.currency] - Override currency
         * @param {boolean} [opts.showDecimals=true] - Show decimal places
         * @returns {string} e.g. "$29.99", "S/113.96", "€27.59"
         */
        format(amountUSD, opts = {}) {
            if (amountUSD === 0 || amountUSD === null || amountUSD === undefined) return 'Free';
            const curr = opts.currency || this.getCurrency();
            const converted = this.convert(amountUSD, curr);
            const symbol = SYMBOLS[curr] || '$';
            const decimals = opts.showDecimals !== false ? 2 : 0;
            return `${symbol}${converted.toFixed(decimals)}`;
        },

        /**
         * Parse a price string (like "$29.00" or "S/110.20") and re-format it
         * in the user's current currency. Assumes the input is always USD base.
         * @param {string} priceStr - e.g. "$29", "$29.00", "Free"
         * @param {object} [opts] - Same as format() opts
         * @returns {string}
         */
        formatFromString(priceStr, opts = {}) {
            if (!priceStr || priceStr === 'Free' || priceStr === 'Gratis') return 'Free';
            // Extract numeric value (strip any currency symbols)
            const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
            if (isNaN(num) || num === 0) return 'Free';
            return this.format(num, opts);
        },

        /**
         * Get all supported currencies with their info
         * @returns {Array<{code: string, symbol: string, rate: number}>}
         */
        getSupportedCurrencies() {
            return Object.keys(RATES).map(code => ({
                code,
                symbol: SYMBOLS[code],
                rate: RATES[code]
            }));
        },

        /**
         * Batch-update all elements with [data-price-usd] attribute on the page.
         * Call this after DOM is ready or after currency change.
         */
        updateAllPrices() {
            const curr = this.getCurrency();
            document.querySelectorAll('[data-price-usd]').forEach(el => {
                const usd = parseFloat(el.dataset.priceUsd);
                if (isNaN(usd) || usd === 0) {
                    el.textContent = 'Free';
                    return;
                }
                el.textContent = this.format(usd, { currency: curr });
            });
        }
    };

    // Expose globally
    window.CurrencyManager = CurrencyManager;

    // Auto-update prices when currency changes
    window.addEventListener('currencyChanged', () => {
        CurrencyManager.updateAllPrices();
    });
})();
