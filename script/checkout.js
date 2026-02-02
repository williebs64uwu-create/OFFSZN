
/**
 * CHECKOUT MANAGER
 * Handles Order Summary, Commission Calculation, and PayPal Integration.
 */

const CheckoutManager = {
  // CONFIGURATION
  currency: 'USD',

  init: async function () {
    // Define API_URL based on environment
    this.API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000/api'
      : 'https://offszn-oc7c.onrender.com/api';

    console.log("Checkout Manager Initialized");

    // Wait for CartManager to be ready (it loads async)
    await this.waitForCart();

    this.renderOrderSummary();
    this.initPayPal();
  },

  waitForCart: async function () {
    return new Promise(resolve => {
      const check = () => {
        if (window.CartManager && window.CartManager.state.items) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  // --- LOGIC: COMMISSION & TOTALS ---
  // Keep this for UI display, but backend will re-calculate for security
  calculateTotals: function () {
    const items = CartManager.state.items;
    let subtotal = 0;
    let serviceFee = 0;
    let total = 0;

    const processedItems = items.map(item => {
      // FIX: Use variant_price (License Price) if available
      const price = parseFloat(item.variant_price) > 0
        ? parseFloat(item.variant_price)
        : (parseFloat(item.product.price_basic) || 0);

      let commission = 0;

      if (price > 0) {
        if (price < 20) {
          commission = 1.00;
        } else {
          commission = price * 0.05;
        }
      }

      subtotal += price;
      serviceFee += commission;

      return {
        ...item,
        price: price,
        commission: commission,
        lineTotal: price + commission
      };
    });

    total = subtotal + serviceFee;

    return {
      items: processedItems,
      subtotal: subtotal.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      total: total.toFixed(2)
    };
  },

  // --- UI: RENDER SUMMARY ---
  renderOrderSummary: function () {
    const container = document.getElementById('checkout-order-summary');
    if (!container) return;

    const { items, subtotal, serviceFee, total } = this.calculateTotals();

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-cart-msg" style="text-align: center; padding: 40px; color: #666;">Tu carrito está vacío. <a href="explorar.html" style="color: #8b5cf6;">Ir a explorar</a></div>`;
      return;
    }

    let itemsHtml = items.map(item => `
            <div class="checkout-item">
                <div class="checkout-item-img">
                    <img src="${item.product.image_url || '/images/default-cover.png'}" alt="Cover">
                </div>
                <div class="checkout-item-details">
                    <div class="checkout-item-name">${item.product.name}</div>
                    <div class="checkout-item-meta">${item.license_name || item.product.product_type}</div>
                </div>
                <div class="checkout-item-price">
                    <div class="price-breakdown">
                        <span>$${item.price.toFixed(2)}</span>
                        <span class="fee-tag">+ $${item.commission.toFixed(2)} fee</span>
                    </div>
                </div>
            </div>
        `).join('');

    const html = `
            <div class="checkout-items-list">
                ${itemsHtml}
            </div>
            
            <div class="checkout-totals">
                <div class="total-row">
                    <span>Subtotal (Productores)</span>
                    <span>$${subtotal}</span>
                </div>
                <div class="total-row">
                    <span>Tarifa de Servicio (Plataforma)</span>
                    <span>$${serviceFee}</span>
                </div>
                <div class="total-row grand-total">
                    <span>TOTAL A PAGAR</span>
                    <span>$${total}</span>
                </div>
            </div>
        `;

    container.innerHTML = html;
  },

  // --- PAYPAL INTEGRATION ---
  initPayPal: function () {
    if (!window.paypal) {
      console.error("PayPal SDK not loaded.");
      return;
    }

    const self = this;

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay'
      },

      createOrder: function (data, actions) {
        const body = {};
        if (!CartManager.state.user) {
          body.cartItems = CartManager.state.items;
        }

        return window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
          return fetch(`${self.API_URL}/orders/paypal/create`, {
            method: 'post',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session ? `Bearer ${session.access_token}` : ''
            },
            body: JSON.stringify(body)
          });
        }).then(async function (res) {
          const orderData = await res.json();
          if (orderData.error === 'MISSING_PRODUCER_PAYPAL') {
            self.handleBlockedOrder(orderData.details);
            throw new Error('Some producers have no payment method.');
          }
          if (orderData.error) throw new Error(orderData.error);
          return orderData.id;
        });
      },

      onApprove: function (data, actions) {
        self.showProcessingState(true);

        const body = { orderID: data.orderID };
        if (!CartManager.state.user) {
          body.cartItems = CartManager.state.items;
        }

        return window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
          return fetch(`${self.API_URL}/orders/paypal/capture`, {
            method: 'post',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': session ? `Bearer ${session.access_token}` : ''
            },
            body: JSON.stringify(body)
          });
        }).then(function (res) {
          return res.json();
        }).then(function (details) {
          if (details.error) throw new Error(details.error);
          self.handleSuccess(details.supabaseOrder?.id);
        }).catch(err => {
          console.error(err);
          alert("Error al procesar el pago: " + err.message);
          self.showProcessingState(false);
        });
      },

      onError: function (err) {
        console.error(err);
        alert("Ocurrió un error con PayPal. Intenta nuevamente.");
      }
    }).render('#paypal-button-container');
  },

  showProcessingState: function (isLoading) {
    const overlay = document.getElementById('checkout-processing-overlay');
    if (overlay) overlay.style.display = isLoading ? 'flex' : 'none';
  },

  handleBlockedOrder: function (blockedItems) {
    console.warn("Blocked items detected:", blockedItems);
    this.blockedItems = blockedItems;
    this.renderOrderSummary();
  },

  renderOrderSummary: function () {
    const container = document.getElementById('checkout-order-summary');
    if (!container) return;

    const { items, subtotal, serviceFee, total } = this.calculateTotals();

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-cart-msg" style="text-align: center; padding: 40px; color: #666;">Tu carrito está vacío. <a href="explorar.html" style="color: #8b5cf6;">Ir a explorar</a></div>`;
      return;
    }

    let itemsHtml = items.map(item => {
      const isBlocked = this.blockedItems?.some(b => b.productId == item.product.id);

      return `
            <div class="checkout-item ${isBlocked ? 'blocked' : ''}">
                <div class="checkout-item-img">
                    <img src="${item.product.image_url || '/images/default-cover.png'}" alt="Cover">
                </div>
                <div class="checkout-item-details">
                    <div class="checkout-item-name">${item.product.name}</div>
                    <div class="checkout-item-meta">${item.license_name || item.product.product_type}</div>
                    ${isBlocked ? `
                        <div class="blocked-warning" style="color: #ef4444; font-size: 0.75rem; margin-top: 8px; font-weight: 500;">
                            <i class="bi bi-exclamation-triangle-fill"></i> No puedes comprar este producto aún porque el productor no ha activado su método de pago.
                        </div>
                    ` : ''}
                </div>
                <div class="checkout-item-price">
                    ${isBlocked ? `
                        <button onclick="CheckoutManager.contactProducer('${item.product.id}', '${item.product.name}', '${item.product.producer_id}')" 
                                style="background: rgba(139, 92, 246, 0.1); border: 1px solid #8b5cf6; color: #8b5cf6; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; cursor: pointer; font-weight: 600;">
                            Contactar Productor
                        </button>
                    ` : `
                        <div class="price-breakdown">
                            <span>$${item.price.toFixed(2)}</span>
                            <span class="fee-tag">+ $${item.commission.toFixed(2)} fee</span>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');

    const html = `
            <div class="checkout-items-list">
                ${itemsHtml}
            </div>
            
            <div class="checkout-totals">
                <div class="total-row">
                    <span>Subtotal (Productores)</span>
                    <span>$${subtotal}</span>
                </div>
                <div class="total-row">
                    <span>Tarifa de Servicio (Plataforma)</span>
                    <span>$${serviceFee}</span>
                </div>
                <div class="total-row grand-total">
                    <span>TOTAL A PAGAR</span>
                    <span>$${total}</span>
                </div>
            </div>
        `;

    container.innerHTML = html;
  },

  contactProducer: function (prodId, prodName, producerId) {
    const link = `${window.location.origin}/producto.html?id=${prodId}`;
    const text = `Hola, quería comprar tu producto "${prodName}" (${link}) pero me sale que necesitas activar tus métodos de pago para recibir el dinero.`;

    // Check if Messenger is available
    if (window.ChatManager && window.ChatManager.openConversationWith) {
      window.ChatManager.openConversationWith(producerId, text);
    } else {
      // Fallback to clipboard or simple alert for now
      navigator.clipboard.writeText(text);
      alert("Mensaje copiado al portapapeles. Contacta al productor para avisarle.");
    }
  },

  handleSuccess: function (orderId) {
    if (window.CartManager) {
      CartManager.clearCart();
    }
    window.location.href = `/pages/success.html${orderId ? '?order_id=' + orderId : ''}`;
  }
};

// Auto-Init
document.addEventListener('DOMContentLoaded', () => {
  CheckoutManager.init();
});
