
/**
 * CHECKOUT MANAGER
 * Handles Order Summary, Commission Calculation, and PayPal Integration.
 */

const CheckoutManager = {
  // Utility for sanitization
  escapeHTML: function (str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  },

  formatPhone: function (phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11) { // 51 + 9 digits
      return `+51 ${digits.substring(2, 5)} ${digits.substring(5, 8)} ${digits.substring(8, 11)}`;
    }
    return phone;
  },

  // CONFIGURATION
  currency: 'USD',

  // STATE
  discount: 0,
  discountType: 'percent', // 'percent' or 'amount'
  appliedCoupon: null,
  couponData: null,
  negotiateData: null, // For negotiation-based checkout
  _lastCartHash: null, // Track cart changes to avoid redundant updates

  init: async function () {
    // Prevent re-initialization (e.g., on tab switch or back-forward cache)
    if (this._initialized) {
      console.log("[CheckoutManager] Already initialized, skipping.");
      return;
    }
    this._initialized = true;

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

    // IMPORTANT: Show empty state ASAP if cart is empty
    const initialItemsCount = window.CartManager?.state?.items?.length || 0;
    this.updateEmptyState(initialItemsCount);

    // RENDER IMMEDIATELY (if we have cached data, it will show content; else skeleton)
    this.renderOrderSummary();

    // 1. GUEST EMAIL SETUP (NEW)
    const user = window.CartManager?.state?.user;
    const contactSection = document.getElementById('section-contact');
    const guestEmailInput = document.getElementById('guest-email');

    if (!user) {
      if (contactSection) contactSection.style.display = 'block';
      if (guestEmailInput) {
        guestEmailInput.addEventListener('input', (e) => {
          this.guestEmail = e.target.value.trim();
          this.validateGuestEmail();
        });
      }
      this.updatePaymentAccess(false); // Initially locked for guests
    } else {
      if (contactSection) contactSection.style.display = 'none';
      this.guestEmail = user.email;
      this.updatePaymentAccess(true); // Always unlocked for logged-in users
    }

    // Mark init as complete ASAP — so cart-updated listener can start handling background refreshes
    this._initComplete = true;

    // Run verification in the background to unblock the rest of the page
    if (window.CartManager && typeof window.CartManager.verifyCart === 'function') {
      const verifyBg = async () => {
        try {
          await window.CartManager.verifyCart();
          // After background verification finishes, re-sync everything
          this.checkBlockedStatus();
          this.renderOrderSummary();
          this.updatePayPalButtonsVisibility();

          // If PayPal is now eligible, init it if not already done
          const eligibility = window.CartManager?.state?.paymentEligibility;
          if (eligibility?.paypal && initialItemsCount > 0) {
            this.initPayPal();
          }
        } catch (e) {
          console.warn("[Checkout] Background verification failed:", e);
          // Even on failure, ensure we try to show what we can
          this.renderOrderSummary();
          this.updatePayPalButtonsVisibility();
        }
      };
      verifyBg();
    }

    // SYNC Check for initial cached/state data
    this.checkBlockedStatus();
    this.updateCouponUI(this.appliedCoupon ? true : false);

    const eligibility = window.CartManager?.state?.paymentEligibility;
    if (eligibility?.paypal) {
      if (initialItemsCount > 0) this.initPayPal();
    }
    this.updatePayPalButtonsVisibility();
    this.togglePaymentMethod('paypal'); // Ensure PayPal is default

    // Mark init as complete — only NOW will cart-updated listener do anything    
    this._initComplete = true;

    // Prevent stacking event listeners
    if (!this._cartListenerBound) {
      this._cartListenerBound = true;
      window.addEventListener('cart-updated', () => {
        if (this.negotiateData) return;
        if (!this._initComplete) return; // Ignore events fired during init
        if (this._cartUpdateRunning) return; // Debounce
        this._cartUpdateRunning = true;

        try {
          const items = window.CartManager?.state?.items || [];
          const count = items.length;

          // Verify if items actually changed to avoid redundant re-verifications
          const currentCartHash = items.map(i => `${i.product.id}-${i.license_name}`).join('|');
          if (this._lastCartHash === currentCartHash) {
            this._cartUpdateRunning = false;
            return;
          }
          this._lastCartHash = currentCartHash;

          this.updateEmptyState(count);

          if (count === 0) {
            this.blockedItems = []; // Clear blocked items on empty cart
            this.renderOrderSummary();
            this.updatePayPalButtonsVisibility();
            return;
          }

          // Everything is now synchronous because CartManager handles verification
          this.checkBlockedStatus();
          this.renderOrderSummary();

          if (!this.blockedItems || this.blockedItems.length === 0) {
            this.initPayPal();
          }
          this.updatePayPalButtonsVisibility();
        } finally {
          this._cartUpdateRunning = false;
        }
      });
    }
  },

  updateEmptyState: function (itemsCount) {
    const grid = document.getElementById('checkout-container');
    const emptyState = document.getElementById('empty-cart-state');

    if (itemsCount === 0) {
      if (grid) grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      this.loadRecommendations();

      // Auto-scroll to top when cart empties to ensure the empty state is visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (grid) grid.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';

      // Show summary skeleton while details load
      const summaryItems = document.getElementById('checkout-order-summary-items');
      if (summaryItems && !this._summaryRendered) {
        summaryItems.innerHTML = `<div class="skeleton-shimmer" style="height: 60px; border-radius: 12px; margin-bottom: 12px;"></div>`;
      }
    }
  },

  // --- GUEST VALIDATION (NEW) ---
  validateGuestEmail: function () {
    const email = this.guestEmail || '';
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = re.test(email);
    const input = document.getElementById('guest-email');

    if (email.length > 0) {
      if (isValid) {
        input?.classList.remove('invalid');
        this.updatePaymentAccess(true);
      } else {
        input?.classList.add('invalid');
        this.updatePaymentAccess(false);
      }
    } else {
      input?.classList.remove('invalid');
      this.updatePaymentAccess(false);
    }
    return isValid;
  },

  updatePaymentAccess: function (isAllowed) {
    const overlay = document.getElementById('payment-blocking-overlay');
    const methodsContainer = document.getElementById('checkout-payment-methods');

    if (overlay) overlay.style.display = isAllowed ? 'none' : 'flex';
    if (methodsContainer) {
      if (isAllowed) {
        methodsContainer.classList.remove('disabled-payment');
      } else {
        methodsContainer.classList.add('disabled-payment');
      }
    }
  },

  loadRecommendations: async function () {
    const container = document.getElementById('checkout-recommendations-grid');
    if (!container) return;

    container.style.display = 'block';

    if (window._checkoutRecommendationsLoaded) return;

    // Show skeletons immediately
    let skeletonHTML = `
        <div class="explore-row" style="margin-top: 0; padding-top: 0; width: 100%;">
            <div class="shelf-wrapper" style="padding: 0;">
                <div class="shelf-inner">
                    <div class="shelf-container" style="gap: 16px;">
    `;
    for (let i = 0; i < 6; i++) {
      skeletonHTML += `
            <div class="skeleton-card">
                <div class="skeleton-cover skeleton-shimmer"></div>
                <div class="skeleton-text-title skeleton-shimmer"></div>
                <div class="skeleton-text-sub skeleton-shimmer"></div>
                <div class="skeleton-btn skeleton-shimmer"></div>
            </div>
        `;
    }
    skeletonHTML += `</div></div></div></div>`;
    container.innerHTML = skeletonHTML;

    window._checkoutRecommendationsLoaded = true;

    try {
      const { data, error } = await window.supabaseClient
        .from('products')
        .select('id, name, producer_id, price_basic, image_url, r2_version, storage_version, status, public_slug, audio_url, download_url_mp3')
        .eq('product_type', 'beat')
        .eq('status', 'approved')
        .gt('price_basic', 0)
        .limit(40);

      if (error) throw error;

      let validData = data || [];
      validData = validData.filter(p => !p.public_slug?.startsWith('deleted'));

      if (validData.length > 0) {
        // Fetch producer profiles manually from users table with payment info
        const producerIds = [...new Set(validData.map(p => p.producer_id))];
        let profilesDict = {};
        let eligibleProducers = new Set();

        if (producerIds.length > 0) {
          const { data: profilesData } = await window.supabaseClient
            .from('users')
            .select('id, nickname, paypal_email, payment_methods, yape_phone, is_verified')
            .in('id', producerIds);

          if (profilesData) {
            profilesData.forEach(pf => {
              const nameToUse = pf.nickname || 'Productor';
              profilesDict[pf.id] = nameToUse;

              // Check eligibility (PayPal exists or Yape is setup)
              const hasPayPal = pf.paypal_email || pf.payment_methods?.paypal?.enabled || pf.payment_methods?.paypal;
              const hasYape = pf.yape_phone;

              if (hasPayPal || hasYape) {
                eligibleProducers.add(pf.id);
              }
            });
          }
        }

        // Filter validData for eligible producers ONLY
        const filteredData = validData.filter(p => eligibleProducers.has(p.producer_id));

        // If we have none eligible, we show any as fallback (though ideally we should have many)
        const finalPool = filteredData.length > 0 ? filteredData : validData;

        const shuffled = finalPool.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 6);

        let html = `
                <div id="checkout-recs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 24px; width: 100%;">
            `;

        for (const p of selected) {
          const img = '/images/portada-default.png'; // Default while loading
          const artist = this.escapeHTML(profilesDict[p.producer_id] || 'Productor');
          html += `
                    <div class="product-card-smart-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="product-card-smart" data-product-id="${p.id}" onclick="window.location.href='/producto.html?id=${p.id}'" style="margin: 0; width: 100%; min-width: 180px;">
                            <div class="card-cover-wrapper">
                                <img id="rec-img-${p.id}" src="${img}" alt="${this.escapeHTML(p.name)}"
                                     data-artist="${p.producer_id}">
                                <button class="quick-play-btn" onclick="event.stopPropagation(); window.playCheckoutTrack('${p.id}')"><i class="bi bi-play-fill"></i></button>
                                <button class="card-like-btn" onclick="event.stopPropagation(); window.handleLike(event, '${p.id}', this)">
                                     <i class="bi bi-heart"></i>
                                </button>
                            </div>
                            <div class="card-info">
                                <div class="card-title" style="font-size: 0.85rem;">${this.escapeHTML(p.name)}</div>
                                <div class="card-producer"
                                     style="font-size: 0.75rem; cursor: pointer;"
                                     data-artist="${p.producer_id}"
                                     onclick="event.stopPropagation(); window.location.href='/@${encodeURIComponent(profilesDict[p.producer_id]?.replace(/\\s+/g, '') || 'artista')}'">
                                    ${artist}
                                </div>
                            </div>
                        </div>
                        <button onclick="if(window.CartManager) window.CartManager.addItem('${p.id}')" style="margin-top: 4px; background: #fff; color: #000; border: 1px solid #fff; padding: 10px 0; border-radius: 8px; font-weight: 700; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%;" onmouseover="this.style.background='#f0f0f0'; this.style.borderColor='#f0f0f0';" onmouseout="this.style.background='#fff'; this.style.borderColor='#fff';">
                            <i class="bi bi-cart-plus"></i> Agregar • $${p.price_basic}
                        </button>
                    </div>
                `;
        }
        html += `</div>`;
        container.innerHTML = html;

        // Load authorized images asynchronously
        selected.forEach(async p => {
          if (p.image_url && window.getAuthorizedUrl) {
            try {
              const authUrl = await window.getAuthorizedUrl(p.image_url, p.storage_version, p.r2_version);
              const imgEl = document.getElementById(`rec-img-${p.id}`);
              if (imgEl) imgEl.src = authUrl;
            } catch (e) {
              console.error("Error loading rec image:", e);
            }
          }
        });

        // Attach play and like logic to window for checkout page specifically
        window._checkoutRecsProducts = selected;
        window._checkoutRecsProfiles = profilesDict;

        if (!window.playCheckoutTrack) {
          window.playCheckoutTrack = function (id) {
            const product = window._checkoutRecsProducts.find(x => x.id === id);
            if (!product) return;

            // Attach resolved nickname for the players
            product.producer_nickname = (window._checkoutRecsProfiles || {})[product.producer_id] || 'Productor';

            // Unified Playback via StickyPlayer + ExpandedPlayer
            if (window.StickyPlayer) {
              window.StickyPlayer.play(product);
            } else if (window.playTrack) {
              window.playTrack(product);
            }

            if (window.ExpandedPlayer) {
              window.ExpandedPlayer.open(product);
            }
          };
        }

        if (!window.handleLike) {
          window.handleLike = function (e, id, btn) {
            if (e) e.stopPropagation();
            if (!window.AuthUtils || !window.AuthUtils.isLoggedIn()) {
              window.location.href = '/pages/login.html';
              return;
            }
            if (window.FavoritesManager) {
              const icon = btn.querySelector('i');
              const isLiked = window.FavoritesManager.isLiked(id);
              if (isLiked) {
                window.FavoritesManager.removeFavorite(id);
                if (icon) { icon.className = 'bi bi-heart'; icon.style.color = ''; }
              } else {
                window.FavoritesManager.addFavorite(id);
                if (icon) { icon.className = 'bi bi-heart-fill heart-beat'; icon.style.color = '#ef4444'; }
              }
            }
          };
        }

        // Initial render of favorite states
        if (window.FavoritesManager) {
          setTimeout(() => {
            selected.forEach(p => {
              const btn = container.querySelector(`.product-card-smart[data-product-id="${p.id}"] .card-like-btn i`);
              if (btn && window.FavoritesManager.isLiked(p.id)) {
                btn.className = 'bi bi-heart-fill heart-beat';
                btn.style.color = '#ef4444';
              }
            });
          }, 500);
        }

        const cShelf = document.getElementById('checkout-recs-container');
        const cPrev = container.querySelector('.prev');
        const cNext = container.querySelector('.next');
        if (cShelf && cPrev && cNext) {
          cShelf.addEventListener('scroll', () => {
            if (cShelf.scrollLeft <= 0) cPrev.classList.add('disabled');
            else cPrev.classList.remove('disabled');
            if (cShelf.scrollLeft + cShelf.clientWidth >= cShelf.scrollWidth - 5) cNext.classList.add('disabled');
            else cNext.classList.remove('disabled');
          });
        }

        selected.forEach(p => {
          const imgEl = document.getElementById(`rec-img-${p.id}`);
          const rawImg = p.image_url;
          if (!rawImg) return;

          const isR2 = window.AuthUtils && window.AuthUtils.isR2Url(rawImg);
          if (isR2 && window.getAuthorizedUrl) {
            window.getAuthorizedUrl(rawImg, p.storage_version || p.r2_version || 'v2').then(url => {
              if (url && imgEl) imgEl.src = url;
            });
          } else if (!rawImg.startsWith('http') && !rawImg.startsWith('/')) {
            // Normal Supabase V1 image
            const res = window.supabaseClient.storage.from('products').getPublicUrl(rawImg);
            if (res && res.data && res.data.publicUrl && imgEl) {
              imgEl.src = res.data.publicUrl;
            }
          } else if (imgEl) {
            imgEl.src = rawImg;
          }
        });
      } else {
        container.innerHTML = '';
      }
    } catch (err) {
      console.error("Error loading recommendations", err);
      container.innerHTML = '';
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
          <div class="checkout-item-img" style="position:relative; width:64px; height:64px; flex-shrink:0;">
            <img id="${imgId}" src="/images/portada-default.png" data-r2-version="${d.storage_version || d.r2_version || 'v2'}" 
                 style="width:100%; height:100%; border-radius:10px; object-fit:cover; border:1px solid rgba(255,255,255,0.1); background:#111;">
          </div>
          <div class="checkout-item-details" style="flex:1;">
            <div style="font-size:1rem; font-weight:600; color:#eee; margin-bottom:6px; font-family: 'Plus Jakarta Sans', sans-serif;">"${this.escapeHTML(d.productName)}"</div>
            <div style="font-size:0.75rem; color:#777; text-transform:uppercase; letter-spacing:0.5px; font-weight: 500;">${this.escapeHTML(d.licenseName)} • Negociado</div>
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
      const storageVer = d.storage_version || d.r2_version || 'v2';
      window.getAuthorizedUrl(d.productImage, storageVer).then(url => {
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
        // --- T&C CHECK ---
        const termsChecked = document.getElementById('terms-checkbox')?.checked;
        if (!termsChecked) {
          alert("Por favor, acepta los Términos y Condiciones para continuar.");
          return;
        }

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
      const verification = window.CartManager?.state?.producerVerification?.[producerId];
      const plan = verification?.plan || 'free';

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

      const producerName = verification?.nickname || 'Productor';
      const producerUsername = verification?.username || null;

      subtotal += price;
      serviceFee += commission;

      return {
        ...item,
        price: price,
        commission: commission,
        lineTotal: price + commission,
        producerName,
        producerUsername
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
        let targetIds = Array.isArray(this.couponData.specific_products) ? this.couponData.specific_products : [this.couponData.specific_products];
        targetIds = targetIds.map(String);
        processedItems.forEach(item => {
          if (targetIds.includes(String(item.product.id))) {
            if (this.couponData.discount_percent) {
              discountAmount += item.price * (this.couponData.discount_percent / 100);
            }
          }
        });
        if (this.couponData.discount_amount && discountAmount === 0) {
          if (processedItems.some(i => targetIds.includes(String(i.product.id)))) discountAmount = this.couponData.discount_amount;
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


  checkBlockedStatus: function () {
    const eligibility = window.CartManager?.state?.paymentEligibility;
    if (!eligibility) return;

    // Use centralized eligibility: blocked only if NO common method exists
    const isBlocked = !eligibility.paypal && !eligibility.yape;

    if (isBlocked) {
      console.warn("[CheckoutManager] Order blocked: No common payment method found for these producers.");
      this.renderOrderSummary();
      this.updatePayPalButtonsVisibility();
    }
  },

  updatePayPalButtonsVisibility: function () {
    const container = document.getElementById('paypal-button-container');
    const warning = document.getElementById('checkout-blocked-warning');
    const paypalSection = document.getElementById('method-paypal');
    const yapeSection = document.getElementById('method-yape');
    const paypalSkeleton = document.getElementById('paypal-skeleton');
    const yapeSkeleton = document.getElementById('yape-skeleton');
    const yapeActual = document.getElementById('yape-actual-content');

    const paypalHeaderContent = document.getElementById('paypal-header-content');
    const paypalHeaderSkeleton = document.getElementById('paypal-header-skeleton');
    const yapeHeaderContent = document.getElementById('yape-header-content');
    const yapeHeaderSkeleton = document.getElementById('yape-header-skeleton');

    const eligibility = window.CartManager?.state?.paymentEligibility;
    const isVerifying = window.CartManager?.state?.isVerifying;

    // 0. Si estamos verificando o no tenemos elegibilidad aún, mostramos skeletons globales y BLOQUEAMOS clicks
    if (isVerifying || !eligibility) {
      if (paypalSkeleton) paypalSkeleton.style.display = 'flex';
      if (container) container.style.display = 'none';

      // Bloquear interacción en ambos métodos
      if (paypalSection) {
        paypalSection.style.pointerEvents = 'none';
        paypalSection.style.opacity = '0.9';
        if (paypalHeaderContent) paypalHeaderContent.style.display = 'none';
        if (paypalHeaderSkeleton) paypalHeaderSkeleton.style.display = 'flex';
      }

      if (yapeSection) {
        yapeSection.style.pointerEvents = 'none';
        yapeSection.style.opacity = '0.9';
        if (yapeHeaderContent) yapeHeaderContent.style.display = 'none';
        if (yapeHeaderSkeleton) yapeHeaderSkeleton.style.display = 'flex';
      }

      // Mostrar skeleton de Yape BODY SOLO si es el método activo (o por defecto)
      if (yapeSkeleton && (yapeSection && yapeSection.classList.contains('active'))) {
        yapeSkeleton.style.display = 'flex';
        const yapeContent = document.getElementById('yape-content');
        if (yapeContent) yapeContent.style.display = 'block';
        if (yapeActual) yapeActual.style.display = 'none';
      }
      return;
    }

    // Si ya no estamos verificando y TENEMOS elegibilidad, ocultamos los skeletons globales y RESTAURAMOS clicks
    if (paypalSkeleton && (this._paypalRendered || this._paypalError)) {
      paypalSkeleton.style.display = 'none';
    }

    // RESTAURAR CABECERAS
    if (paypalHeaderContent) paypalHeaderContent.style.display = 'flex';
    if (paypalHeaderSkeleton) paypalHeaderSkeleton.style.display = 'none';
    if (yapeHeaderContent) yapeHeaderContent.style.display = 'flex';
    if (yapeHeaderSkeleton) yapeHeaderSkeleton.style.display = 'none';

    // Hide Yape body skeleton ONLY if not currently in manual toggle
    if (yapeSkeleton && !this._manualToggleInProgress) {
      yapeSkeleton.style.display = 'none';
    }

    if (yapeActual && yapeSection && yapeSection.classList.contains('active')) {
      // Show content if not in manual toggle
      if (!this._manualToggleInProgress) {
        yapeActual.style.display = 'block';
      }
    }

    // Desbloquear clics
    if (paypalSection) {
      paypalSection.style.pointerEvents = 'auto';
      paypalSection.style.opacity = '1';
    }
    if (yapeSection) {
      yapeSection.style.pointerEvents = 'auto';
      yapeSection.style.opacity = '1';
    }

    // 1. Visibilidad de Métodos según Elegibilidad (Golden Condition)
    // Solo mostramos un método si TODOS los productores en el carrito lo tienen.
    if (paypalSection) paypalSection.style.display = eligibility.paypal ? 'block' : 'none';
    if (yapeSection) yapeSection.style.display = eligibility.yape ? 'block' : 'none';

    // 2. Manejo de Bloqueo (Si no hay método común para todo el carrito)
    const isBlocked = !eligibility.paypal && !eligibility.yape;

    if (isBlocked) {
      container.style.display = 'none';
      if (paypalSection) paypalSection.style.display = 'none';
      if (yapeSection) yapeSection.style.display = 'none';

      if (!warning) {
        const newWarning = document.createElement('div');
        newWarning.id = 'checkout-blocked-warning';
        newWarning.style.cssText = 'padding:15px; background:transparent; border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#fff; text-align:center; margin-top:10px; max-width: 100%;';
        newWarning.innerHTML = `
          <div style="margin-bottom:8px; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <i class="bi bi-exclamation-circle" style="font-size:1rem; color:#888;"></i>
            <span style="font-weight:700; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color: #888;">Compra no habilitada</span>
          </div>
          <p style="font-size:0.75rem; line-height:1.4; margin-bottom:12px; color: #666;">
            Los productos seleccionados no comparten un método de pago común.<br>
            Coordina con los productores haciendo clic arriba.
          </p>
        `;
        container.parentNode.insertBefore(newWarning, container);
      }
    } else {
      // No bloqueado: Limpiar advertencia si existe
      if (warning) warning.remove();

      // 3. Auto-selección del método preferido (Solo si no se ha seleccionado uno manualmente)
      if (!this._initialMethodSelected) {
        const preferred = eligibility.preferred || (eligibility.paypal ? 'paypal' : 'yape');
        this.togglePaymentMethod(preferred);
        this._initialMethodSelected = true;
      }
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
    const box = document.getElementById('coupon-box');
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-status-msg');
    const btn = document.getElementById('apply-coupon-btn');

    if (active && box) {
      // Auto-open if applied and box is currently hidden
      if (box.style.display === 'none' || !box.style.display) {
        this.toggleCoupon();
      }
    }

    if (!input || !msg || !btn) return;

    if (active) {
      let isValidForCart = true;
      if (this.couponData && this.couponData.applies_to === 'product' && this.couponData.specific_products && window.CartManager) {
         const items = window.CartManager.state.items || [];
         let targetIds = Array.isArray(this.couponData.specific_products) ? this.couponData.specific_products : [this.couponData.specific_products];
         targetIds = targetIds.map(String);
         isValidForCart = items.some(i => targetIds.includes(String(i.product.id)));
         
         // Fix array format check (stored as string "[648]" sometimes in local)
         if (!isValidForCart && typeof this.couponData.specific_products === 'string' && this.couponData.specific_products.startsWith('[')) {
             try {
                 let parsed = JSON.parse(this.couponData.specific_products);
                 targetIds = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
                 isValidForCart = items.some(i => targetIds.includes(String(i.product.id)));
             } catch(e){}
         }
      }

      if (!isValidForCart) {
          msg.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                  <span><i class="bi bi-info-circle"></i> Cupón <b>${this.escapeHTML(this.appliedCoupon)}</b> no aplica a estos productos.</span>
                  <button onclick="CheckoutManager.removeCoupon()" style="background:none; border:none; color:#ef4444; font-size:0.7rem; cursor:pointer; text-decoration:underline; font-weight:600;">QUITAR</button>
              </div>
          `;
          msg.style.color = '#f59e0b'; // warning color (amber/orange)
          msg.style.display = 'block';
          input.value = this.appliedCoupon;
          input.disabled = true;
          btn.style.display = 'none';
      } else {
          const label = this.couponData?.discount_percent
            ? `${this.couponData.discount_percent}%`
            : (this.couponData?.discount_amount ? `$${this.couponData.discount_amount}` : 'Aplicado');

          msg.innerHTML = `
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                  <span><i class="bi bi-patch-check-fill"></i> ¡Cupón <b>${this.escapeHTML(this.appliedCoupon)}</b> aplicado! (${label})</span>
                  <button onclick="CheckoutManager.removeCoupon()" style="background:none; border:none; color:#ef4444; font-size:0.7rem; cursor:pointer; text-decoration:underline; font-weight:600;">QUITAR</button>
              </div>
          `;
          msg.style.color = '#10b981';
          msg.style.display = 'block';
          input.value = this.appliedCoupon;
          input.disabled = true;
          btn.style.display = 'none';
      }

      // Ensure coupon box is visible if coupon is active
      document.getElementById('coupon-box')?.classList.add('active');
    } else {
      msg.style.display = 'none';
      input.value = '';
      input.disabled = false;
      btn.style.display = 'block';
    }
  },

  // --- UI: SKELETONS ---
  getSummarySkeleton: function () {
    return `
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px; overflow: hidden;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div class="skeleton-shimmer" style="height: 64px; width: 100%; border-radius: 12px;"></div>
          <div class="skeleton-shimmer" style="height: 64px; width: 100%; border-radius: 12px;"></div>
        </div>
        <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <div class="skeleton-shimmer" style="height: 12px; width: 60px; border-radius: 6px;"></div>
            <div class="skeleton-shimmer" style="height: 12px; width: 40px; border-radius: 6px;"></div>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <div class="skeleton-shimmer" style="height: 12px; width: 80px; border-radius: 6px;"></div>
            <div class="skeleton-shimmer" style="height: 12px; width: 40px; border-radius: 6px;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <div class="skeleton-shimmer" style="height: 28px; width: 80px; border-radius: 8px;"></div>
            <div class="skeleton-shimmer" style="height: 28px; width: 100px; border-radius: 8px;"></div>
          </div>
        </div>
      </div>
    `;
  },

  // --- UI: RENDER SUMMARY ---
  renderOrderSummary: function () {
    this._summaryRendered = true;
    const itemsContainer = document.getElementById('checkout-order-summary-items');
    const totalsContainer = document.getElementById('checkout-order-summary-totals');
    const headerTotalEl = document.getElementById('summary-header-total');

    if (!itemsContainer || !totalsContainer) return;

    const { items, subtotal, discountAmount, serviceFee, total } = this.calculateTotals();

    // Update Header Total
    if (headerTotalEl) headerTotalEl.textContent = `USD $${total.toFixed(2)}`;

    // Toggle from Skeleton to Content
    const summarySkeleton = document.getElementById('summary-skeleton');
    const summaryMainContent = document.getElementById('summary-content-main');

    if (summarySkeleton) summarySkeleton.style.display = 'none';
    if (summaryMainContent) {
      summaryMainContent.style.display = 'flex';
      summaryMainContent.style.opacity = '1';
    }

    if (this.appliedCoupon) {
      this.updateCouponUI(true);
    }

    if (items.length === 0) {
      itemsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #888;">
          <p style="font-size: 0.85rem;">Tu carrito está vacío.</p>
        </div>
      `;
      totalsContainer.innerHTML = '';
      return;
    }

    // Render Items Simplified
    let itemsHTML = '';
    items.forEach(item => {
      const fallbackImg = '/images/portada-default.png';
      const safeName = this.escapeHTML(item.product.name);
      
      const isBeat = String(item.product.product_type).toLowerCase() === 'beat';
      // Normalize licenses: DB stores as object {key: {…}}, convert to array
      const rawLicenses = item.product.licenses || [];
      const licensesArr = Array.isArray(rawLicenses) ? rawLicenses : Object.entries(rawLicenses).map(([key, val]) => ({ id: key, ...val }));
      const enabledLicenses = licensesArr.filter(l => l.enabled);
      
      // Label logic
      let safeLicDisplay = '';
      if (isBeat) {
        safeLicDisplay = `Licencia ${item.license_name || 'Basic'}`;
      } else {
        safeLicDisplay = String(item.product.product_type || 'PRODUCTO').toUpperCase();
      }
      
      // Link visibility
      const canChangeLicense = isBeat && enabledLicenses.length > 1;
      const itemPrice = parseFloat(item.variant_price) || 0;

      const imgId = `summary-img-${item.product.id}`;
      const safeProducer = this.escapeHTML(item.producerName || 'Productor');
      const producerUrl = item.producerUsername ? `/@${item.producerUsername}` : '#';

      itemsHTML += `
        <div class="checkout-item-simple" style="display: flex; flex-direction: column; align-items: stretch; gap: 0; padding: 16px 0;">
          
          <div style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
            <img id="${imgId}" src="${fallbackImg}" data-r2-version="${item.product.storage_version || item.product.r2_version || 'v2'}"
                 onerror="this.src='${fallbackImg}'; this.onerror=null;" 
                 style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; cursor: pointer;" 
                 onclick="window.location.href='/producto.html?id=${item.product.id}'">
            
            <div class="checkout-item-info" style="flex: 1; padding-top: 2px;">
              <div class="checkout-item-name" style="cursor: pointer; font-size: 0.95rem; line-height: 1.3;" onclick="window.location.href='/producto.html?id=${item.product.id}'">"${safeName}"</div>
              
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                <div class="checkout-item-producer" style="font-size: 0.75rem; color: #888; cursor: pointer;" onclick="event.stopPropagation(); window.location.href='${producerUrl}'">${safeProducer}</div>
                <div class="checkout-item-license" style="font-size: 0.65rem; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${safeLicDisplay}</div>
                ${canChangeLicense ? `
                  <div style="font-size: 0.65rem; color: #8b5cf6; cursor: pointer; text-decoration: underline;" onclick="CheckoutManager.openLicenseModal('${item.product.id}')">Cambiar</div>
                ` : ''}
              </div>
            </div>

            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 8px;">
               <div style="font-size: 1rem; font-weight: 700; color: #fff; font-family: 'Geist', sans-serif;">$${itemPrice.toFixed(2)}</div>
               <div class="checkout-item-remove" 
                    onclick="CheckoutManager.removeFromCheckout('${item.product.id}')" 
                    style="cursor: pointer; width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.05); color: #888;"
                    onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='rgba(255,255,255,0.2)'; this.style.color='#fff';"
                    onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(255,255,255,0.05)'; this.style.color='#888';">
                 <i class="bi bi-x" style="font-size: 1.2rem;"></i>
               </div>
            </div>
          </div>
        </div>
      `;

      // Lazy load image if applicable (Sync with Cart Drawer logic)
      const coverPath = item.product.cover_path || item.product.image_url;
      const storageVer = item.product.storage_version || item.product.r2_version || 'v2';

      if (coverPath && window.getAuthorizedUrl) {
        window.getAuthorizedUrl(coverPath, storageVer, item.product.id).then(url => {
          const el = document.getElementById(imgId);
          if (el && url) el.src = url;
        });
      }
    });
    itemsContainer.innerHTML = itemsHTML;

    // Render Totals Simplified
    let totalsHTML = `
      <div class="detail-row">
        <span>Subtotal</span>
        <span>$${subtotal.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span>Tarifa de servicio</span>
        <span>$${serviceFee.toFixed(2)}</span>
      </div>
    `;

    if (discountAmount > 0) {
      totalsHTML += `
        <div class="detail-row" style="color: #10b981;">
          <span>Descuento</span>
          <span>-$${discountAmount.toFixed(2)}</span>
        </div>
      `;
    }

    totalsHTML += `
      <div class="detail-row total">
        <span>TOTAL</span>
        <span>$${total.toFixed(2)}</span>
      </div>
    `;
    totalsContainer.innerHTML = totalsHTML;

    // Sync Bottom Payhip Row
    this.renderBottomSummaryRow(items, total);
  },

  renderBottomSummaryRow: function (items, total) {
    const container = document.getElementById('bottom-summary-row');
    if (!container || items.length === 0) {
      if (container) container.innerHTML = '';
      return;
    }

    // Hide Bottom Skeleton if exists
    const bottomSkeleton = document.getElementById('bottom-summary-skeleton');
    if (bottomSkeleton) bottomSkeleton.style.display = 'none';

    const itemCount = items.length;
    const firstItem = items[0];
    const fallbackImg = '/images/portada-default.png';
    const countText = items.length === 1 ? '1 artículo' : `${items.length} artículos`;
    const imgId = `bottom-summary-thumb`;

    // Only render the display row if it doesn't exist (Ignoring the skeleton)
    let toggleRow = container.querySelector('.bottom-total-row:not(#bottom-summary-skeleton)');
    if (!toggleRow) {
      toggleRow = document.createElement('div');
      toggleRow.className = 'bottom-total-row';
      container.appendChild(toggleRow);
    }

    // Explicitly ensure it's visible if we reuse it
    toggleRow.style.display = 'flex';

    toggleRow.innerHTML = `
        <div class="bottom-total-left" style="pointer-events: none;">
            <img id="${imgId}" src="${fallbackImg}" class="bottom-total-thumb"
                 onerror="this.src='${fallbackImg}'; this.onerror=null;">
            <div class="bottom-total-info">
                <div class="bottom-total-label">Total</div>
                <div class="bottom-total-count">${countText}</div>
            </div>
        </div>
        <div class="bottom-total-right" style="pointer-events: none;">
            <span>USD $${total.toFixed(2)}</span>
            <i class="bi bi-chevron-down accordion-chevron"></i>
        </div>
    `;

    // Lazy load bottom thumb using R2 Auth logic (same as Cart)
    const coverPath = firstItem.product.cover_path || firstItem.product.image_url;
    const storageVer = firstItem.product.storage_version || firstItem.product.r2_version || 'v1';

    if (coverPath && window.getAuthorizedUrl) {
      window.getAuthorizedUrl(coverPath, storageVer, firstItem.product.id).then(url => {
        const el = document.getElementById(imgId);
        if (el && url) el.src = url;
      });
    }
  },

  toggleSummary: function () {
    const accordion = document.getElementById('summary-accordion');
    const content = document.getElementById('summary-content');

    if (!accordion || !content) return;

    accordion.classList.toggle('active');
    content.classList.toggle('active');
  },

  toggleCoupon: function () {
    const box = document.getElementById('coupon-box');
    if (box) {
      const isHidden = box.style.display === 'none' || !box.style.display;
      box.style.display = isHidden ? 'block' : 'none';
      box.classList.toggle('active');
    }
  },

  removeFromCheckout: function (productId) {
    if (window.CartManager) {
      // The actual removal logic. The UI will re-render via 'cart-updated' event listener
      CartManager.removeFromCart(productId);
    }
  },

  // --- PAYPAL INTEGRATION ---
  initPayPal: function () {
    // MUTEX: prevent concurrent SDK loading
    if (this._paypalLoading) {
      console.log("[CheckoutManager] PayPal SDK already loading, skipping.");
      return;
    }

    const merchantIds = new Set();

    // Only include platform merchant ID if there is a service fee
    const totals = this.calculateTotals();
    if (totals.serviceFee > 0) {
      // Must match exactly PLATFORM_PAYPAL_EMAIL in backend config
      merchantIds.add('willie2008garay@gmail.com');
    }

    // Add all producer emails from the cart
    CartManager.state.items.forEach(item => {
      const pData = window.CartManager?.state?.producerVerification?.[item.product.producer_id];
      if (pData && pData.hasPayPal && pData.paypalEmail) {
        // Enforce lowercase/trimmed to match backend Map identifiers
        merchantIds.add(pData.paypalEmail.toLowerCase().trim());
      }
    });

    const merchantIdArr = Array.from(merchantIds).sort(); // SORT to ensure stable string
    const merchantIdString = merchantIdArr.join(',');
    const clientId = 'ATPgFaKnGSf4hJZEN_lkw82QVO2sNc6O9d6QX7GcWBny9tqchRoXpZ89UxkUtD1U2ZWsbv9uAkwruu2B';

    // Check if PayPal is already loaded with the correct merchant string
    const existingScript = document.getElementById('paypal-sdk-script');
    if (existingScript) {
      if (existingScript.getAttribute('data-merchant-id-string') === merchantIdString && window.paypal) {
        // SDK already loaded with same merchants — only re-render if buttons are gone
        if (!this._paypalRendered) {
          this.renderPayPalButtons();
        } else {
          // Buttons already live, just make container visible
          const container = document.getElementById('paypal-button-container');
          if (container) container.style.display = 'block';
        }
        return;
      } else {
        // Merchant config changed — must reload SDK
        existingScript.remove();
        delete window.paypal;
        this._paypalRendered = false;
        const container = document.getElementById('paypal-button-container');
        const skeleton = document.getElementById('paypal-skeleton');
        if (container) {
          container.innerHTML = '';
          container.style.display = 'none';
        }
        if (skeleton) skeleton.style.display = 'flex';
      }
    } else {
      // First load: Show skeleton
      const skeleton = document.getElementById('paypal-skeleton');
      const container = document.getElementById('paypal-button-container');
      if (skeleton) skeleton.style.display = 'flex';
      if (container) container.style.display = 'none';
    }

    // Lock: SDK is now loading
    this._paypalLoading = true;

    const script = document.createElement('script');
    script.id = 'paypal-sdk-script';

    // Dynamic merchant handling for PayPal SDK
    if (merchantIdArr.length > 1) {
      // MULTI-PAYEE: Use asterisk in URL and list in data-merchant-id attribute
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&merchant-id=*`;
      script.setAttribute('data-merchant-id', merchantIdString);
    } else if (merchantIdArr.length === 1) {
      // SINGLE PAYEE: Put the specific merchant ID directly in the URL
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&merchant-id=${merchantIdArr[0]}`;
    } else {
      // FALLBACK: Standard SDK load
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
    }
    script.setAttribute('data-merchant-id-string', merchantIdString);

    script.onload = () => {
      this._paypalLoading = false;
      this.renderPayPalButtons();
    };
    script.onerror = () => {
      this._paypalLoading = false;
      console.error("Failed to load PayPal SDK");
    };
    document.head.appendChild(script);
  },

  renderPayPalButtons: function () {
    if (!window.paypal || !window.paypal.Buttons) {
      console.warn("[CheckoutManager] PayPal Buttons not available yet.");
      return;
    }

    // Mutex: Prevent concurrent rendering
    if (this._renderInProgress) return;

    // Once buttons are rendered, NEVER re-render.
    if (this._paypalRendered) {
      const container = document.getElementById('paypal-button-container');
      const skeleton = document.getElementById('paypal-skeleton');
      if (skeleton) skeleton.style.display = 'none';
      if (container) container.style.display = 'block';
      return;
    }

    const container = document.getElementById('paypal-button-container');
    if (!container) return;

    this._renderInProgress = true;
    container.innerHTML = '';
    this._paypalRendered = true;

    const self = this;

    // STORE the instance to prevent internal SDK conflicts
    this._paypalButtonsInstance = window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay'
      },

      createOrder: function (data, actions) {
        // Disclaimer handled by text under buttons now
        const body = {
          couponCode: self.appliedCoupon,
          guestEmail: self.guestEmail // PASS GUEST EMAIL
        };
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

        const body = {
          orderID: data.orderID,
          couponCode: self.appliedCoupon,
          guestEmail: self.guestEmail // PASS GUEST EMAIL
        };
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

      onCancel: function (data) {
        console.log("Pago cancelado por el usuario.");
        self.showProcessingState(false);
      },

      onError: function (err) {
        console.error("PayPal Error:", err);
        const errMsg = (err?.message || String(err)).toLowerCase();

        // Ignore "User closed" errors silently
        const ignoreTerms = [
          'missing_producer_paypal',
          'detected popup close',
          'window closed',
          'popup_closed_by_user',
          'closed the popup',
          'popup closed',
          'user cancelled',
          'cancelado por el usuario'
        ];
        if (ignoreTerms.some(term => errMsg.includes(term))) {
          console.log("[PayPal] Popup closed or handled error ignored.");
          this.showProcessingState(false);
          return;
        }

        alert("Ocurrió un error al procesar la solicitud con PayPal. Intenta nuevamente.");
      }
    });

    this._paypalButtonsInstance.render('#paypal-button-container').then(() => {
      this._renderInProgress = false;
      const skeleton = document.getElementById('paypal-skeleton');
      const container = document.getElementById('paypal-button-container');
      if (skeleton) skeleton.style.display = 'none';
      if (container) container.style.display = 'block';
    }).catch(err => {
      console.error("[CheckoutManager] Render error:", err);
      this._renderInProgress = false;
      this._paypalRendered = false; // Allow retry
    });
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

  // --- PAYMENT METHOD TOGGLING ---
  togglePaymentMethod: function (method) {
    const paypalItem = document.getElementById('method-paypal');
    const yapeItem = document.getElementById('method-yape');
    const paypalContent = document.getElementById('paypal-content');
    const yapeContent = document.getElementById('yape-content');

    if (method === 'paypal') {
      if (paypalItem) {
        paypalItem.classList.add('active');
        paypalItem.style.borderColor = 'var(--primary-bw)';
        paypalItem.style.background = 'rgba(255, 255, 255, 0.05)';
      }
      if (yapeItem) {
        yapeItem.classList.remove('active');
        yapeItem.style.borderColor = 'var(--glass-border)';
        yapeItem.style.background = 'var(--glass-bg)';
      }
      if (paypalContent) paypalContent.style.display = 'block';
      if (yapeContent) yapeContent.style.display = 'none';

      // Update radio button
      const radio = document.querySelector('input[name="payment-selection"][value="paypal"]');
      if (radio) radio.checked = true;
    } else if (method === 'yape') {
      if (yapeItem) {
        yapeItem.classList.add('active');
        yapeItem.style.borderColor = '#6a1ea5'; // Keep Yape accent for brand recognition
        yapeItem.style.background = 'rgba(106, 30, 165, 0.05)';
      }
      if (paypalItem) {
        paypalItem.classList.remove('active');
        paypalItem.style.borderColor = 'var(--glass-border)';
        paypalItem.style.background = 'var(--glass-bg)';
      }
      if (yapeContent) yapeContent.style.display = 'block';
      if (paypalContent) paypalContent.style.display = 'none';

      // Update radio button
      const radio = document.querySelector('input[name="payment-selection"][value="yape"]');
      if (radio) radio.checked = true;

      // Shimmer effect (Only if not already visible)
      const yapeSkeleton = document.getElementById('yape-skeleton');
      const yapeActual = document.getElementById('yape-actual-content');
      const yapeWrapper = document.getElementById('yape-content');

      if (yapeSkeleton && yapeActual) {
        this._manualToggleInProgress = true;
        yapeWrapper.style.display = 'block';
        yapeActual.style.display = 'none';
        yapeSkeleton.style.display = 'flex';

        setTimeout(() => {
          this.updateYapeTotalPEN();
          if (yapeSkeleton) yapeSkeleton.style.display = 'none';
          if (yapeActual) yapeActual.style.display = 'block';
          this._manualToggleInProgress = false;
        }, 800);
      } else {
        this.updateYapeTotalPEN();
      }
    }
  },



  updateYapeTotalPEN: function () {
    const valEl = document.getElementById('yape-total-value');
    if (!valEl) return;

    const { total } = this.calculateTotals();
    const totalPEN = window.CurrencyManager ? window.CurrencyManager.convert(total, 'PEN') : total * 3.80;
    valEl.textContent = `S/ ${totalPEN.toFixed(2)}`;
  },

  processYapeOrder: async function () {
    // Disclaimer handled by text under buttons now
    this.showProcessingState(true);

    try {
      const { items, total } = this.calculateTotals();
      const totalPEN = window.CurrencyManager ? window.CurrencyManager.convert(total, 'PEN') : total * 3.80;

      const body = {
        couponCode: this.appliedCoupon,
        guestEmail: this.guestEmail, // PASS GUEST EMAIL
        paymentMethod: 'yape',
        currency: 'PEN',
        isManualYape: true,
        skipSellerNotifications: true // Temporary for testing PEN orders
      };

      if (!CartManager.state.user) {
        body.cartItems = CartManager.state.items;
      }

      const { data: { session } } = await window.supabaseClient.auth.getSession();

      const response = await fetch(`${this.API_URL}/orders/paypal/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : ''
        },
        body: JSON.stringify(body)
      });

      const orderData = await response.json();
      if (orderData.error) throw new Error(orderData.error);

      // Success: Clear cart and redirect to WhatsApp
      const orderId = orderData.id;
      const orderNumber = orderId.substring(0, 8).toUpperCase();
      const whatsappPhone = "51965715974"; // The owner's number

      const message = encodeURIComponent(
        `¡Hola OFFSZN! 👋 He realizado mi pago por Yape.\n\n` +
        `🧾 *Orden:* #${orderNumber}\n` +
        `💰 *Monto:* S/ ${totalPEN.toFixed(2)}\n\n` +
        `Confirmo que he realizado el pago y adjunto el comprobante. Quedo atento a la activación de mi pedido. ¡Gracias!`
      );

      const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${message}`;

      // Clear data
      if (window.CartManager) CartManager.clearCart();
      this.discount = 0;
      this.appliedCoupon = null;
      localStorage.removeItem('offszn_applied_coupon');

      // Open WhatsApp and redirect
      window.open(whatsappUrl, '_blank');
      window.location.href = `/pages/success.html?order_id=${orderId}&method=yape`;

    } catch (err) {
      console.error("Yape error:", err);
      alert("Error al procesar el pedido: " + err.message);
    } finally {
      this.showProcessingState(false);
    }
  },

  // ==========================================================================
  // LICENSE MODAL LOGIC (VERTICAL SELECTION)
  // ==========================================================================

  openLicenseModal: async function (productId) {
    const item = window.CartManager?.state?.items.find(i => String(i.product.id) === String(productId));
    if (!item) return;

    let backdrop = document.getElementById('checkout-lic-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'checkout-lic-backdrop';
      backdrop.className = 'share-modal-backdrop';
      backdrop.style.zIndex = '10000';
      backdrop.onclick = (e) => { if (e.target === backdrop) this.closeLicenseModal(); };
      document.body.appendChild(backdrop);
    }

    const safeName = this.escapeHTML(item.product.name);
    const fallbackImg = '/images/portada-default.png';
    const imgId = `modal-header-img-${productId}`;

    backdrop.innerHTML = `
      <div class="share-modal-content lic-modal" style="width: 95%; max-width: 500px; padding: 25px;">
          <div class="lic-modal-header" style="margin-bottom: 20px; display: flex; align-items: flex-start; gap: 15px;">
              <img id="${imgId}" src="${fallbackImg}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);">
              <div style="flex: 1;">
                 <h3 style="margin: 0; font-size: 1.1rem; color: #fff;">Licencias de "${safeName}"</h3>
                 <p style="margin: 5px 0 0; font-size: 0.75rem; color: #888;">Selecciona la licencia que prefieras aplicar.</p>
              </div>
              <button onclick="CheckoutManager.closeLicenseModal()" class="lic-modal-close" style="background:none; border:none; color:#666; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
          </div>
          
          <div class="lic-modal-body" id="checkout-lic-body" style="max-height: 70vh; overflow-y: auto; padding-right: 5px;">
              <!-- Cards injected here -->
              <div style="text-align:center; padding: 30px;">
                 <div class="spinner-small"></div>
              </div>
          </div>
      </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => { backdrop.classList.add('active'); }, 10);

    // Fetch Authorized URL for header image
    if (item.product.image_url && window.getAuthorizedUrl) {
       const storageVer = item.product.storage_version || item.product.r2_version || 'v2';
       window.getAuthorizedUrl(item.product.image_url, storageVer, productId).then(url => {
          const img = document.getElementById(imgId);
          if (img && url) img.src = url;
       });
    }

    this.renderLicenseSelection(productId, item.license_name || item.product.product_type);
  },

  renderLicenseSelection: function (productId, currentLicName) {
    const item = window.CartManager?.state?.items.find(i => String(i.product.id) === String(productId));
    if (!item) return;

    const container = document.getElementById('checkout-lic-body');
    if (!container) return;

    // Normalize licenses: DB stores as object {key: {…}}, convert to array
    const rawLicenses = item.product.licenses || [];
    const licenses = Array.isArray(rawLicenses) ? rawLicenses : Object.entries(rawLicenses).map(([key, val]) => ({ id: key, ...val }));
    if (licenses.length === 0) {
      container.innerHTML = `<p style="color:#666; font-size:0.85rem; text-align:center; padding: 20px;">No se encontraron licencias para este producto.</p>`;
      return;
    }

    const enabledLicenses = licenses.filter(l => l.enabled);
    
    // Sort licenses (Basic < Premium < Unlimited)
    const order = { 'basic': 1, 'premium': 2, 'unlimited': 3, 'exclusive': 4 };
    enabledLicenses.sort((a, b) => (order[a.id.toLowerCase()] || 99) - (order[b.id.toLowerCase()] || 99));

    let html = `<div class="checkout-lic-list">`;
    enabledLicenses.forEach(lic => {
      const isActive = lic.name.toLowerCase() === currentLicName.toLowerCase();
      const price = parseFloat(lic.price) > 0 ? `$${parseFloat(lic.price).toFixed(2)}` : 'GRATIS';
      const filesDesc = lic.files?.stems ? 'MP3, WAV, STEMS' : (lic.files?.wav ? 'MP3, WAV' : 'SOLO MP3');

      html += `
        <div class="checkout-lic-card ${isActive ? 'active' : ''}" onclick="CheckoutManager.selectCheckoutLicense('${productId}', '${lic.name}', '${lic.price}', '${lic.id}')">
            <div class="lic-header-row">
                <span class="lic-name">${lic.name}</span>
                <span class="lic-price">${price}</span>
            </div>
            <div class="lic-files">${filesDesc}</div>
            ${isActive ? '<i class="bi bi-check-circle-fill" style="position:absolute; top:18px; right:-20px; color:#8b5cf6; font-size:0.8rem; transform: translateX(-40px);"></i>' : ''}
        </div>
      `;
    });
    html += `</div>`;

    // Benefit Panel for the current selection
    const activeLic = enabledLicenses.find(l => l.name.toLowerCase() === currentLicName.toLowerCase()) || enabledLicenses[0];
    if (activeLic) {
        html += `
          <div class="checkout-lic-info-panel">
            <h4>Beneficios de ${activeLic.name}</h4>
            <div class="lic-benefit-grid">
               <div class="lic-benefit-item"><i class="bi bi-check2"></i> ${activeLic.streams || 'Unlimited'} Streams</div>
               <div class="lic-benefit-item"><i class="bi bi-check2"></i> ${activeLic.sales || 'Unlimited'} Ventas</div>
               <div class="lic-benefit-item"><i class="bi bi-check2"></i> ${activeLic.radio || 'Universal'} Radio</div>
               <div class="lic-benefit-item"><i class="bi bi-check2"></i> PDF Oficial</div>
            </div>
          </div>
          
          <div style="margin-top: 25px;">
             <button onclick="CheckoutManager.closeLicenseModal()" class="btn-checkout-global" style="width:100%; border-radius:12px; height:50px;">CONFIRMAR SELECCIÓN</button>
          </div>
        `;
    }

    container.innerHTML = html;
  },

  selectCheckoutLicense: async function (productId, licenseName, price, licenseId) {
    if (!window.CartManager) return;

    // 1. Find item in cart
    const itemIndex = window.CartManager.state.items.findIndex(i => String(i.product.id) === String(productId));
    if (itemIndex === -1) return;

    // 2. Update state locally
    const item = window.CartManager.state.items[itemIndex];
    item.license_name = licenseName;
    item.variant_price = price;

    // 3. Update in Supabase if logged in
    if (window.CartManager.state.user) {
        const { error } = await window.supabaseClient
            .from('cart_items')
            .update({ 
                license_name: licenseName, 
                variant_price: price 
            })
            .eq('user_id', window.CartManager.state.user.id)
            .eq('product_id', productId);
        
        if (error) console.error("[Checkout] Error updating license in DB:", error);
    } else {
        // Update local storage for guests
        window.CartManager.saveLocal();
    }

    // 4. Refresh internal lists (Card Row + Modal info)
    this.renderLicenseSelection(productId, licenseName);
    
    // 5. Trigger global re-render (this will update totals and Order Summary)
    window.CartManager.render(); // This will dispatch 'cart-updated'
  },

  closeLicenseModal: function () {
    const backdrop = document.getElementById('checkout-lic-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => { backdrop.style.display = 'none'; }, 300);
    }
  },
};

// Auto-Init
document.addEventListener('DOMContentLoaded', () => {
  CheckoutManager.init();
});
