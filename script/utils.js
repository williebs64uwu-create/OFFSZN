// Tasa fija para visualización (debe coincidir aprox con la del backend)
const TASA_VISUAL = 3.80;

function cambiarMonedaGlobal(monedaDestino) {
    // Guardar preferencia
    localStorage.setItem('user_currency', monedaDestino);

    // Buscar todos los elementos de precio
    const precios = document.querySelectorAll('.product-price, .cart-item-price');

    precios.forEach(el => {
        // Asumimos que el elemento tiene un atributo data-price-usd="20"
        const precioBaseUSD = parseFloat(el.dataset.priceUsd);

        if (!precioBaseUSD) return;

        if (monedaDestino === 'PEN') {
            el.textContent = `S/ ${(precioBaseUSD * TASA_VISUAL).toFixed(2)}`;
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
            console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
        return Promise.resolve();
    }
    return navigator.clipboard.writeText(text);
};

// Al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const pref = localStorage.getItem('user_currency') || 'PEN';
    const selector = document.getElementById('currencySelector');
    if (selector) selector.value = pref;
    // (Aquí llamarías a cambiarMonedaGlobal si los productos ya se renderizaron)
});