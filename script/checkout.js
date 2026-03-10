
/**
 * CHECKOUT MANAGER
 * Handles Order Summary, Commission Calculation, and PayPal Integration.
 */

const CheckoutManager = {
  // CONFIGURATION
  currency: 'USD',

  // STATE
  discount: 0,
  discountType: 'percent', // 'percent' or 'amount'
  appliedCoupon: null,
  couponData: null,
  negotiateData: null, // For negotiation-based checkout
  producerPlans: {}, // New: cache for producer plans

  init: async function () {
    // Define API_URL based on environment
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.API_URL = window.OFFSZN_CONFIG?.API_BASE_URL
      ? `${window.OFFSZN_CONFIG.API_BASE_URL}/api`
      : (isLocal ? 'http://localhost:3000/api' : 'https://offszn.lat/api');

    console.log("Checkout Manager Initialized");

    // Check for negotiation token
    const urlParams = new URLSearchParams(window.location.search);
    const negotiateToken = urlParams.get('negotiate_token');

    if (negotiateToken) {
      await this.initNegotiateCheckout(negotiateToken);
      return; // Skip normal cart flow
    }

    // Load persisted coupon from localStorage
    const savedCoupon = localStorage.getItem('offszn_applied_coupon');
    const savedData = localStorage.getItem('offszn_coupon_data');
    if (savedCoupon) {
      this.appliedCoupon = savedCoupon;
      if (savedData) {
        this.couponData = JSON.parse(savedData);
      } else if (savedCoupon.startsWith('OFFSZN-')) {
        this.discount = 10;
        this.couponData = { valid: true, discount_percent: 10, applies_to: 'all' };
      }
    }

    // Wait for CartManager to be ready (it loads async)
    await this.waitForCart();

    // Load producer plans AND payment status for correct commission display + blocking
    await this.loadProducerPlans();

    this.renderOrderSummary();

    // Check if order is blocked BEFORE rendering PayPal buttons
    if (this.blockedItems && this.blockedItems.length > 0) {
      this.updatePayPalButtonsVisibility();
    } else {
      this.initPayPal();
    }

    if (this.appliedCoupon) {
      this.updateCouponUI(true);
    }
  },

  // --- NEGOTIATE CHECKOUT MODE ---
  initNegotiateCheckout: async function (token) {
    try {
      const res = await fetch(`${this.API_URL}/negotiate/validate-token?token=${token}`);
      const data = await res.json();

      if (!data.valid) {
        this.renderNegotiateError(data.error || 'Token inválido');
        return;
      }

      this.negotiateData = { ...data, token };

      // Hide coupon section for negotiate checkout
      const couponSection = document.querySelector('.coupon-section, #coupon-section');
      if (couponSection) couponSection.style.display = 'none';

      this.renderNegotiateOrderSummary();
      this.initNegotiatePayPal();

    } catch (err) {
      console.error('Negotiate checkout error:', err);
      this.renderNegotiateError('Error al verificar el token de compra');
    }
  },

  renderNegotiateOrderSummary: function () {
    const container = document.getElementById('checkout-order-summary');
    if (!container) return;

    const d = this.negotiateData;
    const img = d.productImage || '/images/default-cover.png';
    const savings = d.originalPrice ? (d.originalPrice - d.agreedPrice).toFixed(2) : null;

    // Commission
    const plan = d.producerPlan || 'free';
    let commission = 0;
    if (d.agreedPrice > 0) {
      if (plan === 'pro') {
        commission = 0;
      } else if (plan === 'starter') {
        commission = d.agreedPrice < 20 ? 0.50 : d.agreedPrice * 0.03;
      } else {
        // Free
        commission = d.agreedPrice < 20 ? 1.00 : d.agreedPrice * 0.05;
      }
    }
    const total = (d.agreedPrice + commission).toFixed(2);

    const imgId = `negotiate-img-${d.productId}`;

    container.innerHTML = `
      <div style="margin-bottom:24px; padding:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px;">
        <div style="display:flex; align-items:center; gap:8px; color:#bbb; font-weight:600; font-size:0.85rem; font-family: 'Plus Jakarta Sans', sans-serif;">
          <i class="bi bi-shield-lock" style="font-size:1rem; color: #888;"></i>
          OFERTA ACEPTADA — Precio exclusivo
        </div>
      </div>

      <div class="checkout-items-list" style="margin-bottom: 24px;">
        <div class="checkout-item" style="padding:16px 0; display:flex; gap:16px; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 24px;">
          <div class="checkout-item-img">
            <img id="${imgId}" src="/images/portada-default.png" style="width:64px; height:64px; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.08);">
          </div>
          <div class="checkout-item-details" style="flex:1;">
            <div style="font-size:1rem; font-weight:600; color:#eee; margin-bottom:6px; font-family: 'Plus Jakarta Sans', sans-serif;">"${d.productName}"</div>
            <div style="font-size:0.75rem; color:#777; text-transform:uppercase; letter-spacing:0.5px; font-weight: 500;">${d.licenseName} • Negociado</div>
          </div>
          <div class="checkout-item-price" style="text-align:right;">
            <div style="font-size:1.05rem; font-weight:700; color:#fff; font-family: 'Plus Jakarta Sans', sans-serif;">$${d.agreedPrice.toFixed(2)}</div>
            ${d.originalPrice ? `<div style="font-size:0.8rem; color:#666; text-decoration:line-through;">$${d.originalPrice}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="checkout-totals" style="padding-top:12px;">
        <div class="total-row" style="display:flex; justify-content:space-between; color:#888; font-size:0.95rem; margin-bottom:12px;">
          <span>Subtotal</span>
          <span style="color: #ccc;">$${d.agreedPrice.toFixed(2)}</span>
        </div>
        ${savings && parseFloat(savings) > 0 ? `
        <div class="total-row" style="display:flex; justify-content:space-between; color:#4ade80; font-size:0.9rem; margin-bottom:12px; font-weight:500;">
          <span>Ahorro aplicado</span>
          <span>-$${savings}</span>
        </div>
        ` : ''}
        <div class="total-row" style="display:flex; justify-content:space-between; color:#888; font-size:0.95rem; margin-bottom:24px;">
          <span>Tarifa de servicio</span>
          <span style="color: #ccc;">$${commission.toFixed(2)}</span>
        </div>
        <div class="total-row grand-total" style="display:flex; justify-content:space-between; align-items: center; color:#fff; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1); font-family:'Plus Jakarta Sans', sans-serif;">
          <span style="font-size: 1.1rem; font-weight: 600;">Total</span>
          <span style="font-size: 1.6rem; font-weight: 800;">$${total}</span>
        </div>
      </div>
    `;

    // Authorized URL for image
    if (window.getAuthorizedUrl && d.productImage) {
      window.getAuthorizedUrl(d.productImage).then(url => {
        const imgEl = document.getElementById(imgId);
        if (imgEl && url) {
          imgEl.src = url;
        }
      });
    }
  },

  initNegotiatePayPal: function () {
    const merchantIds = new Set(['MXV5F6X8JXG4S']); // Platform fee recipient

    if (this.negotiateData && this.negotiateData.producerPaypalEmail) {
      merchantIds.add(this.negotiateData.producerPaypalEmail);
    }

    const merchantIdArr = Array.from(merchantIds);
    const merchantIdString = merchantIdArr.join(',');
    const clientId = 'ATPgFaKnGSf4hJZEN_lkw82QVO2sNc6O9d6QX7GcWBny9tqchRoXpZ89UxkUtD1U2ZWsbv9uAkwruu2B';

    // Check if PayPal is already loaded
    const existingScript = document.getElementById('paypal-sdk-script');
    if (existingScript) {
      if (existingScript.getAttribute('data-merchant-id-string') === merchantIdString && window.paypal) {
        this.renderNegotiatePayPalButtons();
        return;
      } else {
        existingScript.remove();
        delete window.paypal;
        const container = document.getElementById('paypal-button-container');
        if (container) container.innerHTML = '';
      }
    }

    const script = document.createElement('script');
    script.id = 'paypal-sdk-script';

    // Dynamic merchant string handling
    if (merchantIdArr.length > 1) {
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&merchant-id=*`;
      script.setAttribute('data-merchant-id', merchantIdString);
    } else if (merchantIdArr.length === 1) {
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&merchant-id=${merchantIdArr[0]}`;
    } else {
      // Fallback
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    }
    script.setAttribute('data-merchant-id-string', merchantIdString); // Track for caching

    script.onload = () => {
      this.renderNegotiatePayPalButtons();
    };
    script.onerror = () => console.error("Failed to load PayPal SDK in negotiate checkout");
    document.head.appendChild(script);
  },

  renderNegotiatePayPalButtons: function () {
    if (!window.paypal) return;

    const self = this;

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay'
      },

      createOrder: function (data, actions) {
        const body = {
          negotiateToken: self.negotiateData.token,
          isNegotiation: true
        };

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
          if (orderData.error) throw new Error(orderData.error);
          return orderData.id;
        });
      },

      onApprove: function (data, actions) {
        self.showProcessingState(true);

        const body = {
          orderID: data.orderID,
          negotiateToken: self.negotiateData.token,
          isNegotiation: true
        };

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

  renderNegotiateError: function (msg) {
    const container = document.getElementById('checkout-order-summary');
    if (!container) return;
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px;">
        <i class="bi bi-exclamation-triangle-fill" style="font-size:48px; color:#EF4444; display:block; margin-bottom:20px;"></i>
        <h3 style="color:#fff; font-size:1.2rem; margin-bottom:10px;">${msg}</h3>
        <p style="color:#888; font-size:0.9rem;">Este enlace de compra puede haber expirado o no ser válido.</p>
        <a href="/cuenta/negociar" style="display:inline-block; margin-top:20px; background:#8B5CF6; color:#fff; padding:12px 24px; border-radius:10px; text-decoration:none; font-weight:700;">Volver a Negociaciones</a>
      </div>
    `;
    const paypalContainer = document.getElementById('paypal-button-container');
    if (paypalContainer) paypalContainer.style.display = 'none';
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
  calculateTotals: function () {
    const items = CartManager.state.items;
    let subtotal = 0;
    let serviceFee = 0;
    let total = 0;

    const processedItems = items.map(item => {
      const price = parseFloat(item.variant_price) > 0
        ? parseFloat(item.variant_price)
        : (parseFloat(item.product.price_basic) || 0);

      const producerId = item.product.producer_id;
      const plan = this.producerPlans[producerId] || 'free';

      let commission = 0;
      if (price > 0) {
        if (plan === 'pro') {
          commission = 0;
        } else if (plan === 'starter') {
          commission = price < 20 ? 0.50 : price * 0.03;
        } else {
          // Free
          commission = price < 20 ? 1.00 : price * 0.05;
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

    // Apply Discount if any
    let discountAmount = 0;
    if (this.couponData) {
      if (this.couponData.applies_to === 'all' || !this.couponData.applies_to) {
        if (this.couponData.discount_percent) {
          discountAmount = subtotal * (this.couponData.discount_percent / 100);
        } else if (this.couponData.discount_amount) {
          discountAmount = this.couponData.discount_amount;
        }
      } else if (this.couponData.applies_to === 'product' && this.couponData.specific_products) {
        const targetIds = Array.isArray(this.couponData.specific_products) ? this.couponData.specific_products : [this.couponData.specific_products];
        processedItems.forEach(item => {
          if (targetIds.includes(item.product.id)) {
            if (this.couponData.discount_percent) {
              discountAmount += item.price * (this.couponData.discount_percent / 100);
            }
          }
        });
        if (this.couponData.discount_amount && discountAmount === 0) {
          if (processedItems.some(i => targetIds.includes(i.product.id))) discountAmount = this.couponData.discount_amount;
        }
      }
    } else if (this.discount > 0) {
      // Legacy fallback (welcome coupons)
      discountAmount = subtotal * (this.discount / 100);
    }

    // Cap discount
    if (discountAmount > subtotal) discountAmount = subtotal;

    total = (subtotal - discountAmount) + serviceFee;

    return {
      items: processedItems,
      subtotal: subtotal,
      discountAmount: discountAmount,
      serviceFee: serviceFee,
      total: total
    };
  },

  loadProducerPlans: async function () {
    const items = CartManager.state.items;
    if (!items || items.length === 0) return;

    const producerIds = [...new Set(items.map(item => item.product.producer_id))];

    try {
      // Fetch payment_methods from users table
      const { data, error } = await window.supabaseClient
        .from('users')
        .select('id, payment_methods')
        .in('id', producerIds);

      if (error) throw error;

      // Fetch plan + username from profiles for commission display + bio links
      const { data: profiles, error: pError } = await window.supabaseClient
        .from('profiles')
        .select('id, plan, username')
        .in('id', producerIds);

      if (pError) throw pError;

      this.producerData = {};
      data.forEach(u => {
        const profile = profiles.find(p => p.id === u.id);
        this.producerData[u.id] = {
          plan: profile?.plan || 'free',
          username: profile?.username || null,
          hasPayPal: !!(u.payment_methods?.paypal && u.payment_methods.paypal.includes('@')),
          paypalEmail: u.payment_methods?.paypal || null
        };
        // Backwards compatibility for calculateTotals
        this.producerPlans[u.id] = profile?.plan || 'free';
      });

      console.log("[CheckoutManager] Producer data loaded:", this.producerData);

      this.checkBlockedStatus();
    } catch (err) {
      console.warn("Failed to load producer data for checkout", err);
    }
  },

  checkBlockedStatus: function () {
    const items = CartManager.state.items;
    this.blockedItems = [];

    items.forEach(item => {
      const pData = this.producerData?.[item.product.producer_id];
      if (pData && !pData.hasPayPal) {
        // Avoid duplicates for the same producer
        if (!this.blockedItems.find(b => b.producerId === item.product.producer_id)) {
          this.blockedItems.push({
            productId: item.product.id,
            productName: item.product.name,
            producerId: item.product.producer_id,
            username: pData.username
          });
        }
      }
    });

    if (this.blockedItems.length > 0) {
      console.warn("[CheckoutManager] Order blocked due to missing producer PayPal:", this.blockedItems);
      this.renderOrderSummary();
      this.updatePayPalButtonsVisibility();
    }
  },

  updatePayPalButtonsVisibility: function () {
    const container = document.getElementById('paypal-button-container');
    const warning = document.getElementById('checkout-blocked-warning');

    if (!container) return;

    if (this.blockedItems && this.blockedItems.length > 0) {
      container.style.display = 'none';

      // Build producer links
      const producerLinks = this.blockedItems.map(b => {
        const displayName = b.username || 'Productor';
        const link = b.username ? `/${b.username}` : `/producto.html?id=${b.productId}`;
        return `<a href="${link}" target="_blank" style="color:#fff; text-decoration:underline; font-weight:600; font-size:0.85rem;">${displayName}</a>`;
      }).join(', ');

      if (!warning) {
        const newWarning = document.createElement('div');
        newWarning.id = 'checkout-blocked-warning';
        newWarning.style.cssText = 'padding:15px; background:transparent; border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; text-align:center; margin-top:10px; max-width: 100%;';
        newWarning.innerHTML = `
          <div style="margin-bottom:8px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <i class="bi bi-exclamation-circle" style="font-size:1rem; color:#888;"></i>
            <span style="font-weight:700; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color: #888;">Sujeto a Verificación</span>
          </div>
          <p style="font-size:0.75rem; line-height:1.4; margin-bottom:8px; color: #666;">
            El productor no tiene configurado PayPal.<br>
            Contacta para habilitar la compra:
          </p>
          <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;">
            ${producerLinks}
          </div>
        `;
        container.parentNode.insertBefore(newWarning, container);
      } else {
        const linksDiv = warning.querySelector('div:last-child');
        if (linksDiv) linksDiv.innerHTML = producerLinks;
      }
    } else {
      container.style.display = 'block';
      if (warning) warning.remove();
    }
  },

  // --- COUPON LOGIC ---
  applyCoupon: async function () {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-status-msg');
    const btn = document.getElementById('apply-coupon-btn');
    if (!input || !msg || !btn) return;

    const code = input.value.trim().toUpperCase();
    if (!code) return;

    btn.disabled = true;
    btn.innerText = "Aplicando...";

    try {
      const { subtotal } = this.calculateTotals();
      const response = await fetch(`${this.API_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: parseFloat(subtotal) })
      });

      const data = await response.json();

      if (data.valid) {
        this.appliedCoupon = code;
        this.couponData = data;
        localStorage.setItem('offszn_applied_coupon', code);
        localStorage.setItem('offszn_coupon_data', JSON.stringify(data));

        this.updateCouponUI(true);
        this.renderOrderSummary();
      } else {
        msg.innerText = data.message || "Código de cupón no válido.";
        msg.style.color = '#ef4444';
        msg.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      msg.innerText = "Error al validar el cupón.";
      msg.style.color = '#ef4444';
      msg.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerText = "APLICAR";
    }
  },

  removeCoupon: function () {
    this.discount = 0;
    this.appliedCoupon = null;
    this.couponData = null;
    localStorage.removeItem('offszn_applied_coupon');
    localStorage.removeItem('offszn_coupon_data');

    this.updateCouponUI(false);
    this.renderOrderSummary();
  },

  updateCouponUI: function (active) {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-status-msg');
    const btn = document.getElementById('apply-coupon-btn');

    if (!input || !msg || !btn) return;

    if (active) {
      const label = this.couponData?.discount_percent
        ? `${this.couponData.discount_percent}%`
        : (this.couponData?.discount_amount ? `$${this.couponData.discount_amount}` : 'Aplicado');

      msg.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                  <span><i class="bi bi-patch-check-fill"></i> ¡Cupón <b>${this.appliedCoupon}</b> aplicado! (${label})</span>
                  <button onclick="CheckoutManager.removeCoupon()" style="background:none; border:none; color:#ef4444; font-size:0.75rem; cursor:pointer; text-decoration:underline; font-weight:600;">QUITAR</button>
              </div>
          `;
      msg.style.color = '#10b981';
      msg.style.display = 'block';
      input.value = this.appliedCoupon;
      input.disabled = true;
      btn.style.display = 'none';
    } else {
      msg.style.display = 'none';
      input.value = '';
      input.disabled = false;
      btn.style.display = 'block';
    }
  },

  // --- UI: RENDER SUMMARY ---
  renderOrderSummary: function () {
    const container = document.getElementById('checkout-order-summary');
    if (!container) return;

    const { items, subtotal, discountAmount, serviceFee, total } = this.calculateTotals();

    if (items.length === 0) {
      container.innerHTML = `<div class="empty-cart-msg" style="text-align: center; padding: 40px; color: #666;">Tu carrito está vacío. <a href="/explorar.html" style="color: #fff; text-decoration:underline;">Ir a explorar</a></div>`;
      return;
    }

    let html = '';

    if (items.length > 0) {
      html += `<div class="checkout-items-list" style="margin-bottom: 24px;">`;
      items.forEach(item => {
        const isBlocked = this.blockedItems?.some(b => String(b.productId) === String(item.product.id));
        let priceHTML = '';

        const pData = this.producerData?.[item.product.producer_id];
        const contactLink = pData?.username ? `/${pData.username}` : `/producto.html?id=${item.product.id}`;

        if (isBlocked) {
          priceHTML = `
                <a href="${contactLink}" target="_blank" 
                        style="display:inline-block; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; cursor: pointer; font-weight: 600; text-decoration:none; text-transform:uppercase; letter-spacing:0.5px;">
                    Contactar
                </a>
            `;
        } else {
          if (item.product.product_type === 'beat') {
            const basicPrice = item.product.price_basic || 0;
            if (item.price < basicPrice) {
              priceHTML = `
                    <div style="font-size:1.05rem; font-weight:700; color:#fff; font-family: 'Plus Jakarta Sans', sans-serif;">$${item.price.toFixed(2)}</div>
                    <div style="font-size:0.8rem; color:#666; text-decoration:line-through;">$${parseFloat(basicPrice).toFixed(2)}</div>
                    <div style="font-size:0.75rem; color:#444;">+ $${item.commission.toFixed(2)}</div>
                  `;
            } else {
              priceHTML = `
                    <div style="font-size:1.05rem; font-weight:700; color:#fff; font-family: 'Plus Jakarta Sans', sans-serif;">$${item.price.toFixed(2)}</div>
                    <div style="font-size:0.75rem; color:#444;">+ $${item.commission.toFixed(2)}</div>
                `;
            }
          } else {
            priceHTML = `
                <div style="font-size:1.05rem; font-weight:700; color:#fff; font-family: 'Plus Jakarta Sans', sans-serif;">$${item.price.toFixed(2)}</div>
                <div style="font-size:0.75rem; color:#444;">+ $${item.commission.toFixed(2)}</div>
              `;
          }
        }

        const fallbackImg = '/images/portada-default.png';
        const imgId = `checkout-img-${item.product.id}`;

        html += `
            <div class="checkout-item ${isBlocked ? 'blocked' : ''}" style="padding:16px 0; display:flex; gap:16px; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 20px;">
              <div class="checkout-item-img" style="position:relative; width:56px; height:56px; flex-shrink:0;">
                <img id="${imgId}" src="${fallbackImg}" 
                     onerror="this.src='${fallbackImg}'; this.onerror=null;"
                     style="width:100%; height:100%; border-radius:6px; object-fit:cover; border:1px solid rgba(255,255,255,0.08); background:#111;">
              </div>
              <div class="checkout-item-details" style="flex:1; min-width:0;">
                <div class="checkout-item-name truncate" style="font-size:0.95rem; font-weight:600; color:#eee; margin-bottom:4px; font-family: 'Plus Jakarta Sans', sans-serif;">"${item.product.name}"</div>
                <div style="font-size:0.7rem; color:#555; text-transform:uppercase; letter-spacing:0.5px; font-weight: 500;">${item.license_name || item.product.product_type}</div>
                ${isBlocked ? `
                    <div class="blocked-warning" style="color: #666; font-size: 0.65rem; margin-top: 6px; font-weight: 500;">
                        <i class="bi bi-exclamation-circle-fill"></i> Productor sin PayPal configurado.
                    </div>
                ` : ''}
              </div>
              <div class="checkout-item-price" style="text-align:right; display:flex; align-items:center; gap:12px;">
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                  ${priceHTML}
                </div>
                <button onclick="CheckoutManager.removeFromCheckout('${item.product.id}')" class="remove-item-btn" title="Eliminar del carrito">
                   <i class="bi bi-x"></i>
                </button>
              </div>
            </div>
          `;

        // Load authorized image URL
        if (window.getAuthorizedUrl && item.product.image_url) {
          window.getAuthorizedUrl(item.product.image_url).then(url => {
            const imgEl = document.getElementById(imgId);
            if (imgEl && url) imgEl.src = url;
          });
        }
      });
      html += `</div>`;
    }

    html += `
        <div class="checkout-totals" style="padding-top:12px;">
          <div class="total-row" style="display:flex; justify-content:space-between; color:#555; font-size:0.9rem; margin-bottom:10px;">
            <span>Subtotal</span>
            <span style="color: #888;">$${subtotal.toFixed(2)}</span>
          </div>
      `;

    if (discountAmount > 0) {
      html += `
          <div class="total-row" style="display:flex; justify-content:space-between; color:#fff; font-size:0.9rem; margin-bottom:10px; font-weight:500;">
            <span>Ahorro aplicado</span>
            <span>-$${discountAmount.toFixed(2)}</span>
          </div>
        `;
    }

    html += `
          <div class="total-row" style="display:flex; justify-content:space-between; color:#555; font-size:0.9rem; margin-bottom:20px;">
            <span>Tarifa de servicio</span>
            <span style="color: #888;">$${serviceFee.toFixed(2)}</span>
          </div>
          <div class="total-row grand-total" style="display:flex; justify-content:space-between; align-items: center; color:#fff; padding-top:20px; border-top:1px solid rgba(255,255,255,0.05); font-family:'Plus Jakarta Sans', sans-serif;">
            <span style="font-size: 1rem; font-weight: 600; text-transform:uppercase; letter-spacing:1px; color:#666;">Total</span>
            <span style="font-size: 1.5rem; font-weight: 800;">$${total.toFixed(2)}</span>
          </div>
        </div>
      `;

    container.innerHTML = html;
  },

  removeFromCheckout: function (productId) {
    if (window.CartManager) {
      CartManager.removeFromCart(productId);
      // Wait a bit for the removal to propagate and re-check blocked status
      setTimeout(() => {
        this.checkBlockedStatus();
        this.renderOrderSummary();
        // If all blocked items were removed, PayPal buttons should reappear
        const stillBlocked = CartManager.state.items.some(item => {
          const pData = this.producerData?.[item.product.producer_id];
          return pData && !pData.hasPayPal;
        });
        if (!stillBlocked) {
          this.blockedItems = [];
          this.updatePayPalButtonsVisibility();
          this.initPayPal();
        }
      }, 100);
    }
  },

  // --- PAYPAL INTEGRATION ---
  initPayPal: function () {
    const merchantIds = new Set();

    // Only include platform merchant ID if there is a service fee
    const totals = this.calculateTotals();
    if (totals.serviceFee > 0) {
      merchantIds.add('MXV5F6X8JXG4S'); // Platform fee recipient
    }

    // Add all producer emails from the cart
    CartManager.state.items.forEach(item => {
      const pData = this.producerData?.[item.product.producer_id];
      if (pData && pData.hasPayPal && pData.paypalEmail) {
        merchantIds.add(pData.paypalEmail);
      }
    });

    const merchantIdArr = Array.from(merchantIds);
    const merchantIdString = merchantIdArr.join(',');
    const clientId = 'ATPgFaKnGSf4hJZEN_lkw82QVO2sNc6O9d6QX7GcWBny9tqchRoXpZ89UxkUtD1U2ZWsbv9uAkwruu2B';

    // Check if PayPal is already loaded with the correct merchant string
    const existingScript = document.getElementById('paypal-sdk-script');
    if (existingScript) {
      if (existingScript.getAttribute('data-merchant-id-string') === merchantIdString && window.paypal) {
        this.renderPayPalButtons();
        return;
      } else {
        // Remove old script and window.paypal object if the configuration changed
        existingScript.remove();
        delete window.paypal;
        const container = document.getElementById('paypal-button-container');
        if (container) container.innerHTML = '';
      }
    }

    const script = document.createElement('script');
    script.id = 'paypal-sdk-script';

    // Dynamic merchant string handling
    if (merchantIdArr.length > 1) {
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&merchant-id=*`;
      script.setAttribute('data-merchant-id', merchantIdString);
    } else if (merchantIdArr.length === 1) {
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&merchant-id=${merchantIdArr[0]}`;
    } else {
      // Fallback
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    }
    script.setAttribute('data-merchant-id-string', merchantIdString); // Provide an exact flag to track change since data-merchant-id may not exist

    script.onload = () => {
      this.renderPayPalButtons();
    };
    script.onerror = () => console.error("Failed to load PayPal SDK");
    document.head.appendChild(script);
  },

  renderPayPalButtons: function () {
    if (!window.paypal) return;

    const container = document.getElementById('paypal-button-container');
    if (container) container.innerHTML = '';

    const self = this;

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay'
      },
      // Optionally configure funding sources if we want to restrict
      // fundingSource: window.paypal.FUNDING.PAYPAL,

      createOrder: function (data, actions) {
        const body = { couponCode: self.appliedCoupon };
        if (!CartManager.state.user) {
          body.cartItems = CartManager.state.items;
        }

        return window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
          return fetch(`${self.API_URL}/orders/paypal/create`, { // Fixed template literal spacing
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

        const body = { orderID: data.orderID, couponCode: self.appliedCoupon };
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
        console.error("PayPal Error:", err);
        if (err.message && err.message.includes('Some producers have no payment method')) {
          alert("Alerta: Uno o más productores en tu carrito aún no han configurado su cuenta bancaria/PayPal. \n\nRevisa el resumen de tu pedido, contacta al productor o elimina el beat de tu carrito para poder continuar.");
        } else {
          alert("Ocurrió un error al procesar la solicitud con PayPal. Intenta nuevamente.");
        }
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
    // Clear applied coupon on success
    this.discount = 0;
    this.appliedCoupon = null;
    localStorage.removeItem('offszn_applied_coupon');
    localStorage.removeItem('offszn_welcome_claimed');

    window.location.href = `/pages/success.html${orderId ? '?order_id=' + orderId : ''}`;
  },
};

// Auto-Init
document.addEventListener('DOMContentLoaded', () => {
  CheckoutManager.init();
});
