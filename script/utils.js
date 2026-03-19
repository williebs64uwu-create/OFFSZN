// Tasa fija para visualización (legacy - prefer CurrencyManager)
const TASA_VISUAL = 3.80;

function cambiarMonedaGlobal(monedaDestino) {
    // Use CurrencyManager if available
    if (window.CurrencyManager) {
        window.CurrencyManager.setCurrency(monedaDestino);
        window.CurrencyManager.updateAllPrices();
        return;
    }

    // Legacy fallback
    localStorage.setItem('OFFSZN_CURRENCY', monedaDestino);
    const precios = document.querySelectorAll('.product-price, .cart-item-price');

    precios.forEach(el => {
        const precioBaseUSD = parseFloat(el.dataset.priceUsd);
        if (!precioBaseUSD) return;

        if (monedaDestino === 'PEN') {
            el.textContent = `S/ ${(precioBaseUSD * TASA_VISUAL).toFixed(2)}`;
        } else if (monedaDestino === 'EUR') {
            el.textContent = `€${(precioBaseUSD * 0.92).toFixed(2)}`;
        } else {
            el.textContent = `$ ${precioBaseUSD.toFixed(2)}`;
        }
    });
}

// Copiar al portapapeles con fallback
window.copyToClipboard = function (text) {
    if (!navigator.clipboard) {
        // Fallback para navegadores antiguos
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            // Silent fail
        }
        document.body.removeChild(textArea);
        return Promise.resolve();
    }
    return navigator.clipboard.writeText(text);
};

// Al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const pref = (window.CurrencyManager ? window.CurrencyManager.getCurrency() : localStorage.getItem('OFFSZN_CURRENCY')) || 'USD';
    const selector = document.getElementById('currencySelector');
    if (selector) selector.value = pref;
});
