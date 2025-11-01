// Contenedor donde se insertará el embed
const presetsContainer = document.getElementById('presets');

// Crear el div del embed
const embedDiv = document.createElement('div');
embedDiv.className = 'payhip-embed-page';
embedDiv.setAttribute('data-key', 'gjuQZ'); // ID de tu producto en Payhip

// Insertar el embed en el contenedor
presetsContainer.appendChild(embedDiv);

// Cargar el script de Payhip
const payhipScript = document.createElement('script');
payhipScript.type = 'text/javascript';
payhipScript.src = 'https://payhip.com/embed-page.js?v=24u68984';
document.body.appendChild(payhipScript);
