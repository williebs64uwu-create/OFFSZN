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
// INICIALIZAR EMAILJS INMEDIATAMENTE
// ============================================
let emailJSInicializado = false;

function inicializarEmailJSInmediato() {
  if (emailJSInicializado) return;
  
  if (typeof window.emailjs !== 'undefined') {
    try {
      window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
      emailJSInicializado = true;
      console.log('✅ EmailJS inicializado al cargar');
    } catch (error) {
      console.error('❌ Error inicializando EmailJS:', error);
    }
  }
}

// Intentar inicializar inmediatamente
inicializarEmailJSInmediato();

// Intentar de nuevo cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarEmailJSInmediato);
} else {
  inicializarEmailJSInmediato();
}

// ============================================
// ESPERAR A QUE EMAILJS ESTÉ LISTO
// ============================================
function esperarEmailJS() {
  return new Promise((resolve, reject) => {
    // Si ya está inicializado
    if (emailJSInicializado && window.emailjs && window.emailjs.send) {
      resolve(true);
      return;
    }

    // Si emailjs existe pero no está inicializado
    if (window.emailjs && !emailJSInicializado) {
      try {
        window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
        emailJSInicializado = true;
        console.log('✅ EmailJS inicializado correctamente');
        resolve(true);
      } catch (error) {
        console.error('❌ Error inicializando EmailJS:', error);
        reject(error);
      }
      return;
    }

    // Esperar a que se cargue
    let intentos = 0;
    const maxIntentos = 50;
    
    console.log('⏳ Esperando a que EmailJS se cargue...');
    
    const intervalo = setInterval(() => {
      intentos++;
      
      if (window.emailjs) {
        clearInterval(intervalo);
        try {
          window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
          emailJSInicializado = true;
          console.log('✅ EmailJS inicializado correctamente');
          resolve(true);
        } catch (error) {
          console.error('❌ Error inicializando EmailJS:', error);
          reject(error);
        }
      } else if (intentos >= maxIntentos) {
        clearInterval(intervalo);
        const error = new Error('EmailJS no se cargó después de 5 segundos');
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

    await esperarEmailJS();

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

    await esperarEmailJS();

    const templateParams = {
      to_email: emailData.buyerEmail,
      to_name: emailData.buyerName,
      order_id: emailData.orderId,
      total: emailData.total.toFixed(2),
      products_list: emailData.products.map(p => 
        `${p.name} - ${p.license} ($${p.price})`
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
export function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function emailJSDisponible() {
  return emailJSInicializado && typeof window.emailjs !== 'undefined';
}

console.log('✅ Email Service cargado correctamente');
