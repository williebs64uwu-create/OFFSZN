import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// 📧 EMAILJS CONFIG
// ============================================
const EMAILJS_CONFIG = {
  PUBLIC_KEY: 'If_WAVcuXiGSPp2SB',
  SERVICE_ID: 'service_w50l62y',
  TEMPLATE_COMPRA: 'template_dsmiidx'
};

// ============================================
// 🔧 INICIALIZAR EMAILJS CON RETRY
// ============================================
function inicializarEmailJS() {
  return new Promise((resolve) => {
    console.log('🔍 Verificando EmailJS...');
    console.log('📍 window.emailjs existe?', typeof window.emailjs !== 'undefined');
    
    if (typeof window.emailjs !== 'undefined') {
      if (!window.emailjsInicializado) {
        try {
          window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
          window.emailjsInicializado = true;
          console.log('✅ EmailJS inicializado correctamente');
          console.log('🔑 Public Key:', EMAILJS_CONFIG.PUBLIC_KEY);
          console.log('🏢 Service ID:', EMAILJS_CONFIG.SERVICE_ID);
          console.log('📧 Template ID:', EMAILJS_CONFIG.TEMPLATE_COMPRA);
        } catch (error) {
          console.error('❌ Error inicializando EmailJS:', error);
        }
      } else {
        console.log('ℹ️ EmailJS ya estaba inicializado');
      }
      resolve(true);
      return;
    }

    // Si no existe, esperar a que se cargue
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
        console.error('💡 Verifica que el script esté en el HTML: <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>');
        resolve(false);
      } else if (intentos % 10 === 0) {
        console.log(`⏳ Intento ${intentos}/${maxIntentos}...`);
      }
    }, 100);
  });
}

// ============================================
// 📧 ENVIAR EMAIL DE COMPRA
// ============================================
async function enviarEmailCompraLocal(emailData) {
  try {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📧 INICIANDO ENVÍO DE EMAIL DE COMPRA');
    console.log('═══════════════════════════════════════');
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
      throw new Error('EmailJS no está disponible después de esperar');
    }
    console.log('✅ EmailJS está listo');

    // Paso 2: Preparar parámetros del template
    console.log('');
    console.log('📝 Paso 2: Preparando parámetros...');
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
    console.log('═══════════════════════════════════════');
    console.log('');

    return { success: true, response };

  } catch (error) {
    console.log('');
    console.log('❌ ERROR AL ENVIAR EMAIL');
    console.log('═══════════════════════════════════════');
    console.error('📛 Tipo de error:', error.name);
    console.error('📛 Mensaje:', error.message);
    console.error('📛 Stack:', error.stack);
    
    if (error.text) {
      console.error('📛 Texto del error:', error.text);
    }
    
    console.log('═══════════════════════════════════════');
    console.log('');
    
    return { success: false, error: error.message || error };
  }
}

// ============================================
// CARGAR CARRITO EN PÁGINA
// ============================================
async function cargarCarrito() {
  const cart = JSON.parse(localStorage.getItem('offszn_cart') || '[]');
  const container = document.getElementById('cartContent');
  const subtitle = document.getElementById('cartSubtitle');

  subtitle.textContent = `${cart.length} ${cart.length === 1 ? 'producto' : 'productos'} en tu carrito`;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon">
          <i class="bi bi-cart-x"></i>
        </div>
        <h2 class="empty-title">Tu carrito está vacío</h2>
        <p class="empty-text">Explora nuestro marketplace y encuentra beats increíbles</p>
        <a href="/index.html" class="btn-continue">
          <i class="bi bi-arrow-left"></i>
          Continuar comprando
        </a>
      </div>
    `;
    return;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    container.innerHTML = `
      <div class="cart-items">${renderCartItems(cart)}</div>
      <div class="cart-summary">
        <h3 class="summary-title">Resumen del pedido</h3>
        <div class="summary-row">
          <span>Subtotal</span>
          <span>$${calculateTotal(cart).toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Impuestos</span>
          <span>$0.00</span>
        </div>
        <div class="summary-row total">
          <span>Total</span>
          <span>$${calculateTotal(cart).toFixed(2)}</span>
        </div>
        
        <div style="background: rgba(114, 9, 183, 0.1); border: 1px solid rgba(114, 9, 183, 0.3); border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; text-align: center;">
          <i class="bi bi-person-plus" style="font-size: 2.5rem; color: #7209b7; display: block; margin-bottom: 0.75rem;"></i>
          <h4 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.125rem; font-weight: 700;">Crea tu cuenta para continuar</h4>
          <p style="color: #999; font-size: 0.875rem; margin-bottom: 1.25rem;">Es gratis y toma menos de 1 minuto</p>
          <a href="/pages/register?redirect=carrito" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1.5rem; background: linear-gradient(135deg, #7209b7, #560bad); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; transition: all 0.3s; margin-bottom: 1rem;">
            <i class="bi bi-person-plus"></i>
            Crear cuenta gratis
          </a>
          <p style="color: #666; font-size: 0.8125rem; margin-top: 1rem;">¿Ya tienes cuenta? <a href="/pages/login?redirect=carrito" style="color: #7209b7; text-decoration: none; font-weight: 600;">Iniciar sesión</a></p>
        </div>
        
        <div style="text-align: center; margin-top: 1rem;">
          <a href="/index.html" style="color: #999; text-decoration: none; font-size: 0.875rem;">
            <i class="bi bi-arrow-left"></i> Continuar comprando
          </a>
        </div>
      </div>
    `;
    return;
  }

  const total = calculateTotal(cart);

  container.innerHTML = `
    <div class="cart-items">${renderCartItems(cart)}</div>
    <div class="cart-summary">
      <h3 class="summary-title">Resumen del pedido</h3>
      <div class="summary-row">
        <span>Subtotal</span>
        <span>$${total.toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span>Impuestos</span>
        <span>$0.00</span>
      </div>
      <div class="summary-row total">
        <span>Total</span>
        <span>$${total.toFixed(2)}</span>
      </div>
      
      <div style="background: rgba(12, 188, 135, 0.1); border: 1px solid rgba(12, 188, 135, 0.3); border-radius: 8px; padding: 1rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <i class="bi bi-check-circle" style="color: #0cbc87; font-size: 1.25rem;"></i>
        <div style="flex: 1;">
          <div style="font-size: 0.875rem; color: #0cbc87; font-weight: 600;">Sesión iniciada</div>
          <div style="font-size: 0.8125rem; color: #999;">${user.email}</div>
        </div>
      </div>
      
      <div id="paypal-button-container" style="margin-top: 1.5rem;"></div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <a href="/index.html" style="color: #999; text-decoration: none; font-size: 0.875rem;">
          <i class="bi bi-arrow-left"></i> Continuar comprando
        </a>
      </div>
    </div>
  `;

  inicializarPayPal(cart, total);
}

function calculateTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price, 0);
}

function renderCartItems(cart) {
  return cart.map((item, index) => `
    <div class="cart-item">
      <div class="item-image">
        <img src="${item.productImage || 'https://ui-avatars.com/api/?name=Music&size=200&background=7209b7&color=ffffff&bold=true'}" alt="${item.productName}">
      </div>
      <div class="item-info">
        <div class="item-title">${item.productName}</div>
        <div class="item-license">${item.licenseName}</div>
        <div class="item-producer">
          <i class="bi bi-person-circle"></i>
          ${item.producerName}
        </div>
      </div>
      <div class="item-actions">
        <div class="item-price">$${item.price.toFixed(2)}</div>
        <button class="btn-remove" onclick="eliminarDelCarrito(${index})">
          <i class="bi bi-trash"></i>
          Eliminar
        </button>
      </div>
    </div>
  `).join('');
}

// ============================================
// INICIALIZAR PAYPAL
// ============================================
function inicializarPayPal(cart, total) {
  if (!window.paypal) {
    const script = document.createElement('script');
    script.src = 'https://www.paypal.com/sdk/js?client-id=AWlu0poB0pM31ozZz7Cg8Tc2-2PSdq9lyjWQfGg-0Ckk0s-v3BZknJo6qM8RdTcMuX0bZkZ0qkseYFDV&currency=USD';
    script.onload = () => renderPayPalButton(cart, total);
    document.head.appendChild(script);
  } else {
    renderPayPalButton(cart, total);
  }
}

function renderPayPalButton(cart, total) {
  paypal.Buttons({
    style: {
      layout: 'vertical',
      color: 'blue',
      shape: 'rect',
      label: 'pay'
    },
    
    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: total.toFixed(2),
            currency_code: 'USD'
          },
          description: `OFFSZN - ${cart.length} producto(s)`,
          custom_id: JSON.stringify({
            cart: cart.map(item => ({
              productId: item.productId,
              licenseId: item.licenseId,
              price: item.price
            }))
          })
        }]
      });
    },

    onApprove: async function(data, actions) {
      const order = await actions.order.capture();
      await procesarCompra(order, cart);
    },

    onError: function(err) {
      console.error('Error de PayPal:', err);
      if (window.toast) {
        window.toast.error('Error al procesar el pago. Intenta de nuevo.');
      }
    }
  }).render('#paypal-button-container');
}

// ============================================
// 🔧 PROCESAR COMPRA EXITOSA + EMAIL
// ============================================
async function procesarCompra(order, cart) {
  try {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('💰 INICIANDO PROCESO DE COMPRA');
    console.log('═══════════════════════════════════════');
    console.log('🆔 Order ID:', order.id);
    console.log('💵 Monto:', order.purchase_units[0].amount.value);
    console.log('');

    // Paso 1: Verificar usuario
    console.log('👤 Paso 1: Verificando usuario...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Error obteniendo usuario:', userError);
      throw userError;
    }
    
    if (!user) {
      console.error('❌ No hay usuario logueado');
      if (window.toast) {
        window.toast.error('Debes iniciar sesión para completar la compra');
      }
      window.location.href = '/pages/login?redirect=carrito';
      return;
    }

    console.log('✅ Usuario verificado:', user.email);
    console.log('📧 Email:', user.email);
    console.log('🆔 User ID:', user.id);

    // Paso 2: Guardar compras en DB
    console.log('');
    console.log('💾 Paso 2: Guardando en base de datos...');
    const purchases = cart.map(item => ({
      user_id: user.id,
      product_id: item.productId,
      license_type: item.licenseId,
      amount: item.price,
      paypal_transaction_id: order.id,
      status: 'completed'
    }));

    console.log(`📦 Insertando ${purchases.length} compras...`);
    console.log('📋 Datos a insertar:', JSON.stringify(purchases, null, 2));

    const { data: insertedData, error: dbError } = await supabase
      .from('purchases')
      .insert(purchases)
      .select();

    if (dbError) {
      console.error('❌ Error en base de datos:', dbError);
      throw dbError;
    }

    console.log('✅ Compras guardadas exitosamente');
    if (insertedData) {
      console.log('📊 Datos insertados:', insertedData);
    }

    // Paso 3: Enviar email
    console.log('');
    console.log('📧 Paso 3: Enviando email de confirmación...');
    
    try {
      const buyerName = user.user_metadata?.full_name || 
                       `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                       user.email.split('@')[0];

      const emailData = {
        buyerEmail: user.email,
        buyerName: buyerName,
        orderId: order.id,
        total: calculateTotal(cart),
        products: cart.map(item => ({
          name: item.productName,
          license: item.licenseName,
          price: item.price.toFixed(2)
        }))
      };

      const emailResult = await enviarEmailCompraLocal(emailData);
      
      if (emailResult.success) {
        console.log('✅ Email enviado correctamente');
      } else {
        console.warn('⚠️ Email no se pudo enviar:', emailResult.error);
        console.warn('⚠️ La compra se completó, pero el email falló');
      }

    } catch (emailError) {
      console.warn('⚠️ Error en proceso de email (no crítico):', emailError);
      console.warn('⚠️ La compra está completa, solo falló la notificación');
    }

    // Paso 4: Limpiar carrito y redirigir
    console.log('');
    console.log('🧹 Paso 4: Limpiando carrito...');
    localStorage.removeItem('offszn_cart');
    console.log('✅ Carrito limpiado');

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎉 ¡COMPRA COMPLETADA EXITOSAMENTE!');
    console.log('═══════════════════════════════════════');
    console.log('🔄 Redirigiendo a página de éxito...');
    console.log('');

    // Pequeño delay para que se vean los logs
    setTimeout(() => {
      window.location.href = `/pages/purchase-success.html?order=${order.id}`;
    }, 1000);

  } catch (error) {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.error('❌ ERROR EN PROCESO DE COMPRA');
    console.log('═══════════════════════════════════════');
    console.error('📛 Tipo:', error.name);
    console.error('📛 Mensaje:', error.message);
    console.error('📛 Stack:', error.stack);
    console.log('═══════════════════════════════════════');
    console.log('');
    
    if (window.toast) {
      window.toast.error('Error al guardar la compra. Contacta a soporte.');
    }
  }
}

// ============================================
// ELIMINAR DEL CARRITO
// ============================================
window.eliminarDelCarrito = function(index) {
  if (!confirm('¿Eliminar este producto del carrito?')) return;
  
  let cart = JSON.parse(localStorage.getItem('offszn_cart') || '[]');
  cart.splice(index, 1);
  localStorage.setItem('offszn_cart', JSON.stringify(cart));
  cargarCarrito();
};

// ============================================
// INICIALIZAR
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('🚀 CHECKOUT.JS INICIALIZADO');
  console.log('═══════════════════════════════════════');
  console.log('📅 Fecha:', new Date().toISOString());
  console.log('🌐 URL:', window.location.href);
  console.log('');
  
  // Pre-verificar EmailJS
  console.log('🔍 Verificación inicial de EmailJS...');
  const emailJSReady = await inicializarEmailJS();
  
  if (emailJSReady) {
    console.log('✅ EmailJS está listo para usar');
  } else {
    console.error('❌ EmailJS NO está disponible');
    console.error('💡 SOLUCIÓN: Verifica que el script esté en carrito.html');
  }
  
  console.log('');
  console.log('📦 Cargando carrito...');
  cargarCarrito();
  
  console.log('═══════════════════════════════════════');
  console.log('');
});
