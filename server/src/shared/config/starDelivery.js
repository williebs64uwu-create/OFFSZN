// Entrega de STAR CHAIN después de la compra (correo de PayPal, correo de Yape).
// El modal de compra del sitio (script/plugin-checkout.js) lleva su propia copia de estos dos links: si cambias uno, cambia los tres sitios.
//   STAR_DOWNLOAD_URL / STAR_MAC_DOWNLOAD_URL (variables de Vercel) mandan sobre los links escritos aquí.

// Instalador de Windows (archivo en Google Drive, carpeta WILLIE INSPIRED / STAR CHAIN).
const STAR_WIN_DEFAULT = 'https://drive.google.com/file/d/1j6hqZKsaRL0aJ7RvSuTj7nWjABX0jViT/view?usp=sharing';

// macOS: instalador .pkg (comprimido en .rar) en Google Drive. Ayuda por WhatsApp si no abre.
export const STAR_MAC_URL = process.env.STAR_MAC_DOWNLOAD_URL || 'https://drive.google.com/file/d/1NVbjGu79A48eSMkJcY-NxEeNqW4q-ZIr/view?usp=sharing';
export const STAR_HELP_WA = 'https://wa.me/51993525005?text=' + encodeURIComponent('Compré el STAR CHAIN y necesito ayuda con el instalador de MAC');

export const STAR_WIN_URL = process.env.STAR_DOWNLOAD_URL || STAR_WIN_DEFAULT || 'https://offszn.lat/mis-compras';
