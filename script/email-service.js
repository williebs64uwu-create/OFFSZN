// ============================================
// 📧 EMAIL SERVICE - EMAILJS
// ============================================

const EMAILJS_CONFIG = {
  PUBLIC_KEY: 'If_WAVcuXiGSPp2SB',
  SERVICE_ID: 'service_w50l62y',
  TEMPLATES: {
    COMPRA: 'template_dsmiidx',
    DESCARGA: 'template_bgp3zb5'
  }
};

// ============================================
// INICIALIZAR EMAILJS
// ============================================
function inicializarEmailJS() {
  return new Promise((resolve, reject) => {
    // Si ya está cargado
    if (window.emailjs) {
      try {
        window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        console.log('✅ EmailJS inicializado');
        resolve(true);
      } catch (error) {
        console.error('❌ Error inicializando EmailJS:', error);
        reject(error);
      }
      return;
    }

    // Si no está cargado, esperar hasta 5 segundos
    let intentos = 0;
    const maxIntentos = 50; // 5 segundos (50 x 100ms)
    
    console.log('⏳ Esperando a que EmailJS se cargue...');
    
    const intervalo = setInterval(() => {
      intentos++;
      
      if (window.emailjs) {
        clearInterval(intervalo);
        try {
          window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
          console.log('✅ EmailJS inicializado correctamente');
          resolve(true);
        } catch (error) {
          console.error('❌ Error inicializando EmailJS:', error);
          reject(error);
        }
      } else if (intentos >= maxIntentos) {
        clearInterval(intervalo);
        console.error('❌ EmailJS no se cargó después de 5 segundos');
        reject(new Error('EmailJS no se pudo cargar - Verifica que el SDK esté en el HTML'));
      }
    }, 100);
  });
}

// ============================================
// ENVIAR EMAIL DE COMPRA
// ============================================
export async function enviarEmailCompra(data) {
  try {
    // Esperar a que EmailJS esté listo
    await inicializarEmailJS();

    const templateParams = {
      to_email: data.buyerEmail,
      to_name: data.buyerName,
      order_id: data.orderId,
      total: data.total.toFixed(2),
      products_list: data.products.map(p => 
        `${p.name} - ${p.license} ($${p.price})`
      ).join('\n')
    };

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATES.COMPRA,
      templateParams
    );

    return { success: true, response };

  } catch (error) {
    console.error('Error enviando email de compra:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// ENVIAR EMAIL DE DESCARGA GRATIS
// ============================================
export async function enviarEmailDescargaGratis(data) {
  try {
    // Esperar a que EmailJS esté listo
    await inicializarEmailJS();

    const templateParams = {
      to_email: data.userEmail,
      to_name: data.userName,
      product_name: data.productName,
      producer_name: data.producerName,
      download_url: data.downloadUrl
    };

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATES.DESCARGA,
      templateParams
    );

    return { success: true, response };

  } catch (error) {
    console.error('Error enviando email de descarga:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// VERIFICAR SI EMAILJS ESTÁ DISPONIBLE
// ============================================
export function emailJSDisponible() {
  return typeof window.emailjs !== 'undefined';
}
