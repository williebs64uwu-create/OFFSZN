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

// Al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const pref = localStorage.getItem('user_currency') || 'PEN';
    const selector = document.getElementById('currencySelector');
    if(selector) selector.value = pref;
    // (Aquí llamarías a cambiarMonedaGlobal si los productos ya se renderizaron)
});