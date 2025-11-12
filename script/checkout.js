import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// 📧 CONFIGURACIÓN EMAILJS
const EMAILJS_CONFIG = {
  publicKey: 'If_WAVcuXiGSPp2SB',
  serviceId: 'service_w50l62y',
  templateCompra: 'template_dsmiidx'
};

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

  cargarEmailJS();
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
// 📧 CARGAR SDK DE EMAILJS
// ============================================
function cargarEmailJS() {
  if (window.emailjs) {
    console.log('📧 EmailJS ya cargado');
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  script.onload = () => {
    emailjs.init(EMAILJS_CONFIG.publicKey);
    console.log('✅ EmailJS inicializado');
  };
  script.onerror = () => {
    console.error('❌ Error cargando EmailJS');
  };
  document.head.appendChild(script);
}

// ============================================
// 📧 ENVIAR EMAIL DE COMPRA
// ============================================
async function enviarEmailCompra(emailData) {
  try {
    console.log('📧 Enviando email de compra...', emailData);

    // Formatear productos para el template
    const productosHTML = emailData.products.map((p, i) => 
      `${i + 1}. ${p.name} - ${p.license} ($${p.price})`
    ).join('\n');

    const templateParams = {
      to_email: emailData.buyerEmail,
      buyer_name: emailData.buyerName,
      order_id: emailData.orderId,
      purchase_date: new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      products_list: productosHTML,
      total_amount: `$${emailData.total.toFixed(2)}`,
      products_count: emailData.products.length
    };

    console.log('📧 Parámetros del template:', templateParams);

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateCompra,
      templateParams
    );

    console.log('✅ Email enviado correctamente:', response);
    return { success: true, data: response };

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return { success: false, error: error.message };
  }
}

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
      console.error('❌ Error de PayPal:', err);
      window.toast?.error('Error al procesar el pago. Intenta de nuevo.');
    }
  }).render('#paypal-button-container');
}

// ============================================
// 🔥 PROCESAR COMPRA EXITOSA + EMAIL
// ============================================
async function procesarCompra(order, cart) {
  try {
    console.log('💰 Procesando compra...', order.id);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      window.toast?.error('Debes iniciar sesión para completar la compra');
      window.location.href = '/pages/login?redirect=carrito';
      return;
    }

    console.log('👤 Usuario:', user.email);

    // 1️⃣ Guardar compras en DB
    const purchases = cart.map(item => ({
      user_id: user.id,
      product_id: item.productId,
      license_type: item.licenseId,
      amount: item.price,
      paypal_transaction_id: order.id,
      status: 'completed'
    }));

    console.log('💾 Guardando en DB...', purchases.length, 'productos');

    const { error: dbError } = await supabase
      .from('purchases')
      .insert(purchases);

    if (dbError) {
      console.error('❌ Error DB:', dbError);
      throw dbError;
    }

    console.log('✅ Compras guardadas en DB');

    // 2️⃣ ENVIAR EMAIL DE COMPRA CON EMAILJS
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
          price: item.price.toFixed(2),
          producer: item.producerName || 'Willie Inspired'
        }))
      };

      console.log('📧 Datos para email:', {
        destinatario: emailData.buyerEmail,
        nombre: emailData.buyerName,
        orden: emailData.orderId,
        productos: emailData.products.length,
        total: emailData.total
      });

      const emailResult = await enviarEmailCompra(emailData);

      if (emailResult.success) {
        console.log('✅ Email de compra enviado correctamente');
      } else {
        console.warn('⚠️ Email no enviado:', emailResult.error);
      }

    } catch (emailError) {
      console.warn('⚠️ Error al enviar email (no crítico):', emailError);
      // NO bloqueamos la compra si falla el email
    }

    // 3️⃣ Limpiar carrito y redirigir
    console.log('🧹 Limpiando carrito...');
    localStorage.removeItem('offszn_cart');
    
    console.log('🎉 ¡Compra completada! Redirigiendo...');
    window.location.href = `/pages/purchase-success.html?order=${order.id}`;

  } catch (error) {
    console.error('❌ Error guardando compra:', error);
    window.toast?.error('Error al guardar la compra. Contacta a soporte.');
  }
}

window.eliminarDelCarrito = function(index) {
  if (!confirm('¿Eliminar este producto del carrito?')) return;
  
  let cart = JSON.parse(localStorage.getItem('offszn_cart') || '[]');
  cart.splice(index, 1);
  localStorage.setItem('offszn_cart', JSON.stringify(cart));
  cargarCarrito();
};

document.addEventListener('DOMContentLoaded', cargarCarrito);
