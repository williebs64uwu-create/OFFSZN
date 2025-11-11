import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// CARGAR CARRITO EN PÁGINA
// ============================================
function cargarCarrito() {
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

  // Calcular total
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  // Renderizar items
  const itemsHTML = cart.map((item, index) => `
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

  // Renderizar resumen con PayPal
  const summaryHTML = `
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
      
      <!-- BOTÓN PAYPAL -->
      <div id="paypal-button-container" style="margin-top: 1.5rem;"></div>
      
      <div style="text-align: center; margin-top: 1rem;">
        <a href="/index.html" style="color: #999; text-decoration: none; font-size: 0.875rem;">
          <i class="bi bi-arrow-left"></i> Continuar comprando
        </a>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="cart-items">${itemsHTML}</div>
    ${summaryHTML}
  `;

  // Inicializar PayPal después de renderizar
  inicializarPayPal(cart, total);
}

// ============================================
// INICIALIZAR PAYPAL
// ============================================
function inicializarPayPal(cart, total) {
  // Cargar SDK de PayPal
  if (!window.paypal) {
    const script = document.createElement('script');
    // REEMPLAZA 'TU_CLIENT_ID' con tu Client ID real de PayPal
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
    
    // Crear orden
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

    // Cuando se aprueba el pago
    onApprove: async function(data, actions) {
      const order = await actions.order.capture();
      await procesarCompra(order, cart);
    },

    // Si hay error
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
      window.location.href = '/pages/login';
      return;
    }

    // Guardar cada compra en la base de datos
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

    // Limpiar carrito
    localStorage.removeItem('offszn_cart');

    // Redirigir a página de éxito
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
