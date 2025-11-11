import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

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

  // ============================================
  // 🔐 VERIFICAR USUARIO LOGUEADO ANTES DE MOSTRAR PAYPAL
  // ============================================
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    // Usuario NO logueado - Mostrar mensaje
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
        
        <!-- MENSAJE PARA CREAR CUENTA -->
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

  // ============================================
  // Usuario SÍ está logueado - Mostrar PayPal normal
  // ============================================
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
      
      <!-- Usuario logueado: Mostrar info -->
      <div style="background: rgba(12, 188, 135, 0.1); border: 1px solid rgba(12, 188, 135, 0.3); border-radius: 8px; padding: 1rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem;">
        <i class="bi bi-check-circle" style="color: #0cbc87; font-size: 1.25rem;"></i>
        <div style="flex: 1;">
          <div style="font-size: 0.875rem; color: #0cbc87; font-weight: 600;">Sesión iniciada</div>
          <div style="font-size: 0.8125rem; color: #999;">${user.email}</div>
        </div>
      </div>
      
      <!-- BOTÓN PAYPAL -->
      <div id="paypal-button-container" style="margin-top: 1.5rem;"></div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <a href="/index.html" style="color: #999; text-decoration: none; font-size: 0.875rem;">
          <i class="bi bi-arrow-left"></i> Continuar comprando
        </a>
      </div>
    </div>
  `;

  // Inicializar PayPal después de renderizar
  inicializarPayPal(cart, total);
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================
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
      alert('❌ Error al procesar el pago. Intenta de nuevo.');
    }
  }).render('#paypal-button-container');
}

// ============================================
// PROCESAR COMPRA EXITOSA
// ============================================
async function procesarCompra(order, cart) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Debes iniciar sesión para completar la compra');
      window.location.href = '/pages/login?redirect=carrito';
      return;
    }

    const purchases = cart.map(item => ({
      user_id: user.id,
      product_id: item.productId,
      license_type: item.licenseId,
      amount: item.price,
      paypal_transaction_id: order.id,
      status: 'completed'
    }));

    const { error } = await supabase
      .from('purchases')
      .insert(purchases);

    if (error) throw error;

    localStorage.removeItem('offszn_cart');
    window.location.href = `/pages/purchase-success.html?order=${order.id}`;

  } catch (error) {
    console.error('Error guardando compra:', error);
    alert('❌ Error al guardar la compra. Contacta a soporte.');
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
document.addEventListener('DOMContentLoaded', cargarCarrito);
