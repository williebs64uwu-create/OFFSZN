// Entrega de STAR CHAIN después de la compra (correo de PayPal, correo de Yape).
// El modal de compra del sitio (script/plugin-checkout.js) lleva su propia copia de estos dos links: si cambias uno, cambia los tres sitios.
//   STAR_DOWNLOAD_URL (variable de Vercel) manda sobre el link escrito aquí.

// Instalador de Windows (archivo en Google Drive, carpeta WILLIE INSPIRED / STAR CHAIN).
const STAR_WIN_DEFAULT = 'https://drive.google.com/file/d/1j6hqZKsaRL0aJ7RvSuTj7nWjABX0jViT/view?usp=sharing';

// macOS: todavía no hay instalador automático; el cliente lo pide por WhatsApp y Willie se lo envía.
export const STAR_MAC_URL = 'https://wa.me/51993525005?text=' + encodeURIComponent('Compré el STAR CHAIN, quiero que me envíen el instalador de MAC');

export const STAR_WIN_URL = process.env.STAR_DOWNLOAD_URL || STAR_WIN_DEFAULT || 'https://offszn.lat/mis-compras';
