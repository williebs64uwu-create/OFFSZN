// ============================================
// 📧 EMAIL SERVICE - EMAILJS INTEGRATION
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
    // Si ya está cargado e inicializado
    if (window.emailjs && window.emailjs.send) {
      console.log('✅ EmailJS ya está inicializado');
      resolve(true);
      return;
    }

    // Si emailjs existe pero no está inicializado
    if (window.emailjs) {
      try {
        window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        console.log('✅ EmailJS inicializado correctamente');
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
        const error = new Error('EmailJS no se cargó después de 5 segundos. Verifica que el SDK esté en el HTML.');
        console.error('❌', error.message);
        reject(error);
      }
    }, 100);
  });
}

// ============================================
// 📧 ENVIAR EMAIL DE DESCARGA GRATIS
// ============================================
export async function enviarEmailDescargaGratis(emailData) {
  try {
    console.log('📧 Enviando email de descarga gratis...', emailData);

    // Esperar a que EmailJS esté listo
    await inicializarEmailJS();

    const templateParams = {
      to_email: emailData.userEmail,
      user_name: emailData.userName,
      product_name: emailData.productName,
      producer_name: emailData.producerName,
      download_url: emailData.downloadUrl
    };

    console.log('📤 Parámetros del template:', templateParams);

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATES.DESCARGA,
      templateParams
    );

    console.log('✅ Email de descarga enviado correctamente', response);
    return { success: true, response };

  } catch (error) {
    console.error('❌ Error enviando email de descarga:', error);
    return { success: false, error: error.message || error };
  }
}

// ============================================
// 📧 ENVIAR EMAIL DE COMPRA CONFIRMADA
// ============================================
export async function enviarEmailCompra(emailData) {
  try {
    console.log('📧 Enviando email de compra confirmada...', emailData);

    // Esperar a que EmailJS esté listo
    await inicializarEmailJS();

    const templateParams = {
      to_email: emailData.buyerEmail,
      to_name: emailData.buyerName,
      order_id: emailData.orderId,
      total: emailData.total.toFixed(2),
      products_list: emailData.products.map(p => 
        `${p.name} - ${p.license} (${p.price})`
      ).join('\n')
    };

    console.log('📤 Parámetros del template:', templateParams);

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATES.COMPRA,
      templateParams
    );

    console.log('✅ Email de compra enviado correctamente', response);
    return { success: true, response };

  } catch (error) {
    console.error('❌ Error enviando email de compra:', error);
    return { success: false, error: error.message || error };
  }
}

// ============================================
// 🛠️ UTILITIES
// ============================================

// Formatear lista de productos para email
export function formatearListaProductos(cartItems) {
  return cartItems.map(item => `
    <div style="margin-bottom: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
      <strong>${item.productName}</strong><br>
      Licencia: ${item.licenseName}<br>
      Precio: ${item.price.toFixed(2)}
    </div>
  `).join('');
}

// Validar email
export function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Verificar si EmailJS está disponible
export function emailJSDisponible() {
  return typeof window.emailjs !== 'undefined';
}

console.log('✅ Email Service cargado correctamente');
