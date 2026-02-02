// Use the global client initialized by auth-utils.js
const supabase = window.supabaseClient;

// Safety check
if (!supabase) {
  console.error("Critical: Global Supabase not found. Ensure auth-utils.js is loaded.");
}

// ============================================
// 📧 EMAILJS CONFIG
// ============================================
const EMAILJS_CONFIG = {
  PUBLIC_KEY: 'If_WAVcuXiGSPp2SB',
  SERVICE_ID: 'service_w50l62y',
  TEMPLATE_COMPRA: 'template_dsmiidx',
  TEMPLATE_DESCARGA: 'template_bgp3zb5'
};

// ============================================
// 📧 INICIALIZAR EMAILJS CON RETRY
// ============================================
function inicializarEmailJS() {
  return new Promise((resolve) => {
    console.log('🔍 Verificando EmailJS...');

    if (typeof window.emailjs !== 'undefined') {
      if (!window.emailjsInicializado) {
        try {
          window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
          window.emailjsInicializado = true;
          console.log('✅ EmailJS inicializado correctamente');
        } catch (error) {
          console.error('❌ Error inicializando EmailJS:', error);
        }
      }
      resolve(true);
      return;
    }

    console.log('⏳ Esperando a que EmailJS se cargue...');
    let intentos = 0;
    const maxIntentos = 50;

    const intervalo = setInterval(() => {
      intentos++;

      if (window.emailjs) {
        clearInterval(intervalo);
        try {
          window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
          window.emailjsInicializado = true;
          console.log(`✅ EmailJS cargado después de ${intentos} intentos`);
          resolve(true);
        } catch (error) {
          console.error('❌ Error inicializando EmailJS:', error);
          resolve(false);
        }
      } else if (intentos >= maxIntentos) {
        clearInterval(intervalo);
        console.error('❌ EmailJS no se cargó después de 5 segundos');
        resolve(false);
      }
    }, 100);
  });
}

// ============================================
// 📧 ENVIAR EMAIL DE COMPRA
// ============================================
export async function enviarEmailCompra(emailData) {
  try {
    console.log('');
    console.log('╔═══════════════════════════════════════╗');
    console.log('📧 INICIANDO ENVÍO DE EMAIL DE COMPRA');
    console.log('╚═══════════════════════════════════════╝');
    console.log('📬 Destinatario:', emailData.buyerEmail);
    console.log('👤 Nombre:', emailData.buyerName);
    console.log('🆔 Orden:', emailData.orderId);
    console.log('💰 Total:', `$${emailData.total.toFixed(2)}`);
    console.log('📦 Productos:', emailData.products.length);
    console.log('');

    // Paso 1: Verificar que EmailJS esté listo
    console.log('🔍 Paso 1: Verificando EmailJS...');
    const emailJSReady = await inicializarEmailJS();

    if (!emailJSReady) {
      throw new Error('EmailJS no está disponible');
    }
    console.log('✅ EmailJS está listo');

    // Paso 2: Preparar parámetros del template
    console.log('');
    console.log('🔍 Paso 2: Preparando parámetros...');
    const templateParams = {
      to_email: emailData.buyerEmail,
      to_name: emailData.buyerName,
      order_id: emailData.orderId,
      total: emailData.total.toFixed(2),
      products_list: emailData.products.map(p =>
        `${p.name} - ${p.license} ($${p.price})`
      ).join('\n')
    };

    console.log('📋 Parámetros del template:');
    console.log(JSON.stringify(templateParams, null, 2));

    // Paso 3: Enviar email
    console.log('');
    console.log('📤 Paso 3: Enviando email...');
    console.log('🏢 Service ID:', EMAILJS_CONFIG.SERVICE_ID);
    console.log('📧 Template ID:', EMAILJS_CONFIG.TEMPLATE_COMPRA);

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_COMPRA,
      templateParams
    );

    console.log('');
    console.log('✅ EMAIL ENVIADO EXITOSAMENTE');
    console.log('📬 Respuesta de EmailJS:', response);
    console.log('╚═══════════════════════════════════════╝');
    console.log('');

    return { success: true, response };

  } catch (error) {
    console.log('');
    console.log('❌ ERROR AL ENVIAR EMAIL');
    console.log('╚═══════════════════════════════════════╝');
    console.error('🔻 Tipo de error:', error.name);
    console.error('🔻 Mensaje:', error.message);
    console.error('🔻 Stack:', error.stack);

    if (error.text) {
      console.error('🔻 Texto del error:', error.text);
    }

    console.log('╚═══════════════════════════════════════╝');
    console.log('');

    return { success: false, error: error.message || error };
  }
}

// ============================================
// 📧 ENVIAR EMAIL DE DESCARGA GRATIS
// ============================================
export async function enviarEmailDescargaGratis(emailData) {
  try {
    console.log('📧 Enviando email de descarga gratis...');

    const emailJSReady = await inicializarEmailJS();
    if (!emailJSReady) {
      throw new Error('EmailJS no está disponible');
    }

    const templateParams = {
      user_name: emailData.userName,
      to_email: emailData.userEmail,
      product_name: emailData.productName,
      producer_name: emailData.producerName,
      download_url: emailData.downloadUrl
    };

    const response = await window.emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_DESCARGA,
      templateParams
    );

    console.log('✅ Email de descarga enviado');
    return { success: true, response };

  } catch (error) {
    console.error('❌ Error enviando email de descarga:', error);
    return { success: false, error: error.message || error };
  }
}
