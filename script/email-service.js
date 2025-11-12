// script/email-service.js
// Sistema de emails usando EmailJS (no requiere backend)

// ============================================
// CONFIGURACIÓN - OFFSZN
// ============================================
const EMAILJS_CONFIG = {
  publicKey: 'If_WAVcuXiGSPp2SB',
  serviceId: 'service_w50l62y',
  templates: {
    freeDownload: 'template_bgp3zb5',     // Descarga gratis
    purchaseConfirm: 'template_dsmiidx'   // Compra confirmada
  }
};

// ============================================
// INICIALIZAR EMAILJS
// ============================================
function initEmailJS() {
  if (typeof emailjs === 'undefined') {
    console.error('❌ EmailJS no está cargado');
    return false;
  }
  
  emailjs.init(EMAILJS_CONFIG.publicKey);
  console.log('✅ EmailJS inicializado');
  return true;
}

// ============================================
// 1. EMAIL DE DESCARGA GRATIS
// ============================================
export async function enviarEmailDescargaGratis(data) {
  try {
    if (!initEmailJS()) {
      throw new Error('EmailJS no disponible');
    }

    const templateParams = {
      to_email: data.email,
      product_name: data.productName,
      producer_name: data.producerName,
      download_url: data.downloadUrl,
      product_image: data.productImage || '',
      user_name: data.email.split('@')[0]
    };

    console.log('📧 Enviando email de descarga gratis...', templateParams);

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.freeDownload,
      templateParams
    );

    console.log('✅ Email enviado:', response);
    return { success: true, data: response };

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 2. EMAIL DE CONFIRMACIÓN DE COMPRA
// ============================================
export async function enviarEmailCompra(data) {
  try {
    if (!initEmailJS()) {
      throw new Error('EmailJS no disponible');
    }

    // Formatear lista de productos
    const productsList = data.products.map((p, i) => 
      `${i + 1}. ${p.name} - ${p.license} ($${p.price})`
    ).join('\n');

    const templateParams = {
      to_email: data.buyerEmail,
      buyer_name: data.buyerName,
      order_id: data.orderId,
      order_date: new Date().toLocaleDateString('es-ES'),
      total_amount: data.total,
      products_list: productsList,
      my_purchases_url: `https://offszn.com/pages/my-purchases.html`
    };

    console.log('📧 Enviando email de compra...', templateParams);

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.purchaseConfirm,
      templateParams
    );

    console.log('✅ Email de compra enviado:', response);
    return { success: true, data: response };

  } catch (error) {
    console.error('❌ Error enviando email de compra:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// 3. EMAIL DE NUEVA VENTA (AL PRODUCTOR)
// ============================================
export async function enviarEmailNuevaVenta(data) {
  try {
    if (!initEmailJS()) {
      throw new Error('EmailJS no disponible');
    }

    const templateParams = {
      to_email: data.producerEmail,
      producer_name: data.producerName,
      product_name: data.productName,
      license_name: data.licenseName,
      sale_amount: data.amount,
      buyer_name: data.buyerName || 'Cliente',
      sale_date: new Date().toLocaleDateString('es-ES'),
      dashboard_url: 'https://offszn.com/dashboard/ventas'
    };

    console.log('📧 Enviando email de nueva venta...', templateParams);

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templates.newSale,
      templateParams
    );

    console.log('✅ Email de venta enviado:', response);
    return { success: true, data: response };

  } catch (error) {
    console.error('❌ Error enviando email de venta:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// FUNCIÓN GENÉRICA PARA ENVIAR EMAILS
// ============================================
export async function enviarEmail(type, data) {
  switch (type) {
    case 'free_download':
      return await enviarEmailDescargaGratis(data);
    
    case 'purchase_confirmation':
      return await enviarEmailCompra(data);
    
    case 'new_sale':
      return await enviarEmailNuevaVenta(data);
    
    default:
      console.error('❌ Tipo de email desconocido:', type);
      return { success: false, error: 'Tipo de email no válido' };
  }
}

// Exportar configuración para debugging
export { EMAILJS_CONFIG };
