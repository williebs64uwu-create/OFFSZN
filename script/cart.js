/**
 * CART MANAGER (Hybrid: LocalStorage + Supabase)
 * Handles cart logic for both Guest and Authenticated users.
 * Replaces the old API-based implementation.
 */

const CartManager = {
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

    state: {
        items: [], // [{ product: {id, name, price, image_url...}, quantity: 1 }]
        isOpen: false,
        user: null,
        producerVerification: {}, // Caches { hasPayPal, paypalEmail, plan, nickname }
        _lastProducerHash: null,
        isVerifying: false,
        paymentEligibility: { paypal: true, yape: false, preferred: 'paypal' }
    },

    injectCartUIIfNeeded: function () {
        if (!document.getElementById('globalCartPanel')) {
            const cartHtml = `
  <div class="overlay-backdrop" id="globalBackdrop" onclick="if(window.closeAllOverlays) window.closeAllOverlays()"></div>
  <div class="side-panel" id="globalCartPanel">
    <div class="panel-header">
      <div class="panel-title" style="display: flex; align-items: center; gap: 12px;">
        <div style="position: relative; display: flex;">
          <i class="fas fa-shopping-cart" style="font-size: 0.9rem; opacity: 0.7;"></i>
          <span id="cart-panel-count" class="notification-badge"
            style="position: absolute; top: -8px; right: -8px; display: flex; transform: scale(0.85);">0</span>
        </div>
        MI SELECCIÓN
      </div>
      <button class="panel-close" onclick="if(window.closeAllOverlays) window.closeAllOverlays()">&times;</button>
    </div>
    <div class="panel-content" id="cart-items-container">
      <div style="text-align:center; padding: 60px 0; color: #444;">
        <i class="bi bi-cart-x" style="font-size: 3.5rem; opacity: 0.1; display: block; margin-bottom: 20px;"></i>
        <p style="font-size: 0.9rem; color: #666; font-weight: 500;">No hay elementos en tu selección</p>
      </div>
    </div>
    <div class="cart-total-section" id="cart-summary">
      <div
        style="display:flex; justify-content:space-between; margin-bottom:1.5rem; color:#fff; font-weight:800; font-size: 1.1rem; letter-spacing: -0.5px;">
        <span
          style="color: #666; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Subtotal</span>
        <span id="cart-total-price">$0.00</span>
      </div>
      <button class="btn-checkout-global" id="cart-checkout-btn" onclick="window.CartManager.proceedToCheckout()">
        PROCEDER AL PAGO
      </button>

      <div
        style="margin-top: 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
        <p style="font-size: 0.65rem; color: #666; margin-bottom: 10px; letter-spacing: 1px; font-weight: 700;">
          METODOS DE PAGO SEGUROS</p>

        <div
          style="display: flex; gap: 12px; justify-content: center; align-items: center; opacity: 0.8; filter: grayscale(100%); transition: filter 0.3s;"
          onmouseover="this.style.filter='grayscale(0%)'" onmouseout="this.style.filter='grayscale(100%)'">
          <i class="fab fa-cc-paypal" style="font-size: 26px; color: #fff;"></i>
          <i class="fab fa-cc-visa" style="font-size: 26px; color: #fff;"></i>
          <i class="fab fa-cc-mastercard" style="font-size: 26px; color: #fff;"></i>

          <div class="badge-yape">YAPE</div>
          <div
            style="background: #00d3de; color: white; font-size: 0.7rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center;">
            PLIN</div>
        </div>
      </div>
    </div>
  </div>`;
            document.body.insertAdjacentHTML('beforeend', cartHtml);
        }
    },

    init: async function () {
        this.injectCartUIIfNeeded();

        // UI Elements
        this.ui = {
            panel: document.getElementById('globalCartPanel'),
            container: document.getElementById('cart-items-container'),
            total: document.getElementById('cart-total-price'),
            countBadge: document.getElementById('cart-count-badge'),
            checkoutBtn: document.getElementById('cart-checkout-btn')
        };

        // Auth Listener

        const supabaseClient = window.supabaseClient; // Use global

        if (supabaseClient) {
            const { data } = await supabaseClient.auth.getSession();
            this.state.user = data.session?.user || null;

            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                const prevUser = this.state.user;
                this.state.user = session?.user || null;

                if (this.state.user && !prevUser) {
                    // Login detected: Sync Guest -> DB
                    await this.mergeGuestCartToDB();
                }
                this.loadCart();
            });
        }

        // Initial Load
        await this.loadCart();
        this.updateBadge(); // Ensure badge is correct on load

        // Expose to window for global access
        window.CartManager = this;
    },

    // --- CORE LOGIC ---

    loadCart: async function () {
        // --- 🚀 FIX FLICKER: Don't clear state.items immediately ---
        let items = [];
        
        try {
            if (this.state.user) {
                // AUTH: Load from DB
                const { data, error } = await supabaseClient
                    .from('cart_items')
                    .select('quantity, license_name, variant_price, product:products(id, name, price_basic, image_url, product_type, producer_id, status, storage_version, r2_version, promo_active, promo_buy_qty, promo_get_qty, licenses, producer:producer_id(*))')
                    .eq('user_id', this.state.user.id);

                    if (!error && data) {
                        items = data.map(row => {
                            const item = {
                                product: row.product,
                                quantity: row.quantity,
                                license_name: row.license_name,
                                variant_price: row.variant_price
                            };
                            if (row.product && row.product.producer) item.product.producer = row.product.producer;
                            return item;
                        }).filter(i => i.product && i.product.status !== 'deleted');
                    }
            } else {
                // GUEST: Load from LocalStorage
                const local = localStorage.getItem('offszn_cart');
                if (local) {
                    items = JSON.parse(local);
                }
            }
            
            // Set final state items
            this.state.items = items;
            
            // RESTORE verification if it exists (for fast checkout load)
            const savedVerification = sessionStorage.getItem('offszn_producer_verification');
            const savedEligibility = sessionStorage.getItem('offszn_payment_eligibility');
            const savedHash = sessionStorage.getItem('offszn_producer_hash');
            
            if (savedVerification && savedHash) {
                this.state.producerVerification = JSON.parse(savedVerification);
                this.state._lastProducerHash = savedHash;
                if (savedEligibility) {
                    this.state.paymentEligibility = JSON.parse(savedEligibility);
                }
            }
        } catch (err) {
            console.error("Cart load error:", err);
        }

        this.render();
    },

    addToCart: async function (product, options = {}) {
        // --- DEFENSIVE ELIGIBILITY CHECK ---
        // Block if NOT free and producer has no payment methods
        const isFree = product.is_free || false;
        if (!isFree) {
            let producer = product.producer || (product.producer_id ? { id: product.producer_id } : null);
            if (Array.isArray(producer)) producer = producer[0];
            
            if (producer) {
                // Check for PayPal (email or explicitly set in methods)
                const has_paypal = producer.paypal_email || (producer.payment_methods && (producer.payment_methods.paypal?.enabled || producer.payment_methods.paypal));
                // Check for Yape (presence of yape_phone is now enough)
                const has_yape = !!(producer.yape_phone);

                if (!has_paypal && !has_yape) {
                    if (window.openBlockedPaymentModal) {
                        window.openBlockedPaymentModal(producer, product);
                    } else {
                        console.warn("[Cart] No methods and modal missing.");
                    }
                    return;
                }
            }
        }

        // Optimistic UI Update: Find index if exists
        const existingIndex = this.state.items.findIndex(i => String(i.product.id) === String(product.id));

        const newItem = {
            product: product,
            quantity: 1,
            license_name: product.license?.name || null,
            variant_price: product.price_basic || null
        };

        let message = "Agregado a tu carrito";
        let type = "success";

        if (existingIndex !== -1) {
            const existingItem = this.state.items[existingIndex];

            // Check if it's the SAME license
            if (existingItem.license_name === newItem.license_name) {
                if (window.toast) window.toast.info("Ya está en tu carrito", 3000, product.id);
                if (!options.silent) this.openCart();
                return; // Don't proceed with redundant add
            }

            // DIFFERENT License: Replace existing (updates license/price)
            this.state.items[existingIndex] = newItem;
            console.log("[Cart] Replaced license for item:", product.name);
            message = "Licencia actualizada en tu carrito";
        } else {
            // New Addition
            this.state.items.push(newItem);
        }

        // Trigger Toast (Unified System)
        if (window.toast) {
            window.toast.show(message, type, 4000, product.id);
        }

        this.render();
        if (!options.silent) {
            this.openCart(); // Auto-open on add
        }

        // BACKGROUND SYNC
        if (this.state.user) {
            // DB Sync: Use Upsert to handle replacements correctly in DB
            const licenseName = product.license?.name || null;
            const variantPrice = product.price_basic || null;

            const { error } = await supabaseClient
                .from('cart_items')
                .upsert({
                    user_id: this.state.user.id,
                    product_id: product.id,
                    quantity: 1,
                    license_name: licenseName,
                    variant_price: variantPrice
                }, { onConflict: 'user_id, product_id' });

            if (error) console.error("DB Sync Error:", error);
        } else {
            // Local Save
            this.saveLocal();
        }
    },

    addItem: async function (productId) {
        if (!productId) return;
        try {
            // If we have the product in allProducts (global cache) use it
            let product = null;
            if (window.allProducts) {
                product = window.allProducts.find(p => String(p.id) === String(productId));
            }

            if (!product) {
                // Fetch from DB if not in cache
                const { data, error } = await window.supabaseClient
                    .from('products')
                    .select('*, producer:producer_id(*)')
                    .eq('id', productId)
                    .single();
                
                if (error) throw error;
                product = data;
            }

            if (product) {
                await this.addToCart(product);
            }
        } catch (err) {
            console.error("[CartManager] Error adding item:", err);
            if (window.toast) window.toast.error("Error al agregar al carrito");
        }
    },

    removeFromCart: async function (productId) {
        // Optimistic UI
        this.state.items = this.state.items.filter(i => String(i.product.id) !== String(productId));
        this.render();

        if (this.state.user) {
            // DB Delete
            const { error } = await supabaseClient
                .from('cart_items')
                .delete()
                .eq('user_id', this.state.user.id)
                .eq('product_id', productId);

            if (error) console.error("DB Remove Error:", error);
        } else {
            this.saveLocal();
        }
    },

    saveLocal: function () {
        localStorage.setItem('offszn_cart', JSON.stringify(this.state.items));
        this.updateBadge(); // Update badge immediately for guests
    },

    mergeGuestCartToDB: async function () {
        const local = JSON.parse(localStorage.getItem('offszn_cart') || '[]');
        if (local.length === 0) return;

        // Upsert logic
        const upsertData = local.map(item => ({
            user_id: this.state.user.id,
            product_id: item.product.id,
            quantity: 1,
            license_name: item.product.license?.name || null,
            variant_price: item.product.price_basic || null
        }));

        const { error } = await supabaseClient
            .from('cart_items')
            .upsert(upsertData, { onConflict: 'user_id, product_id', ignoreDuplicates: true });

        if (!error) {
            // Clear local after successful sync
            localStorage.removeItem('offszn_cart');
        } else {
            console.error("Merge error:", error);
        }
    },

    // --- UI RENDERING ---

    verifyCart: async function () {
        if (!this.state.items || this.state.items.length === 0) {
            this.state.producerVerification = {};
            this.state._lastProducerHash = null;
            return;
        }

        const producerIds = [...new Set(this.state.items.map(item => item.product.producer_id))].sort();
        const currentHash = producerIds.join(',');

        if (this.state.isVerifying) return; // Already in progress
        if (this.state._lastProducerHash === currentHash && Object.keys(this.state.producerVerification).length > 0) {
            return; // Already verified this exact set of producers
        }

        this.state.isVerifying = true;
        
        try {
            // Fetch Users (plan, payment methods, email, nickname, YAPE)
            const { data: usersData, error: usersError } = await window.supabaseClient
                .from('users')
                .select('id, plan, payment_methods, paypal_email, nickname, yape_phone, is_verified')
                .in('id', producerIds);

            if (usersError) throw usersError;

            // Profiles is now only for username fallback
            const { data: profilesData, error: profilesError } = await window.supabaseClient
                .from('profiles')
                .select('user_id, username')
                .in('user_id', producerIds);

            if (profilesError) throw profilesError;



            const verification = {};
            producerIds.forEach(pId => {
                const user = usersData?.find(u => String(u.id) === String(pId)) || {};
                const profile = profilesData?.find(p => String(p.user_id) === String(pId)) || {};
                
                let hasPayPal = false;
                if (user.paypal_email || (user.payment_methods && user.payment_methods.paypal)) {
                    hasPayPal = true;
                }

                verification[pId] = {
                    hasPayPal: hasPayPal,
                    paypalEmail: user.paypal_email || user.payment_methods?.paypal || null,
                    plan: user.plan || profile.plan || 'free',
                    nickname: user.nickname || profile.username || 'Productor',
                    username: profile.username || user.nickname || null,
                    hasYape: !!(user.yape_phone)
                };
            });

            // Calculate overall eligibility
            const allProducers = Object.values(verification);
            const allHaveYape = allProducers.length > 0 && allProducers.every(p => p.hasYape);
            const allHavePayPal = allProducers.length > 0 && allProducers.every(p => p.hasPayPal);

            this.state.paymentEligibility = {
                paypal: allHavePayPal,
                yape: allHaveYape,
                preferred: allHaveYape ? 'yape' : 'paypal'
            };

            this.state.producerVerification = verification;
            this.state._lastProducerHash = currentHash;

            // PERSIST for checkout page speed
            sessionStorage.setItem('offszn_producer_verification', JSON.stringify(verification));
            sessionStorage.setItem('offszn_payment_eligibility', JSON.stringify(this.state.paymentEligibility));
            sessionStorage.setItem('offszn_producer_hash', currentHash);
        } catch (err) {
            console.error("[CartManager] Error verifying producers:", err);
            // Default fallback
            this.state.paymentEligibility = { paypal: true, yape: false, preferred: 'paypal' };
        } finally {
            this.state.isVerifying = false;
        }
    },

    render: async function () {
        if (!this.ui.container) return; // Cart UI not present

        await this.verifyCart(); // 🛡️ ALWAYS VERIFY PRODUCERS BEFORE RENDERING/DISPATCHING

        this.updateBadge();

        // 🚀 NUEVA LÓGICA DE PROMOCIONES (Instantánea y Fluida)
        let total = 0;
        let originalTotal = 0;
        let discountTotal = 0;
        let appliedPromos = []; // Para mostrar feedback visual

        // 1. Agrupar items por productor (Solo beats califican por ahora)
        const producersMap = {};
        this.state.items.forEach(item => {
            if (item.product.product_type === 'beat') {
                const pId = item.product.producer_id;
                if (!producersMap[pId]) producersMap[pId] = [];
                producersMap[pId].push(item);
            }
        });

        // 2. Calcular precios base
        this.state.items.forEach(i => {
            if (!i.product) return;
            const price = parseFloat(i.variant_price) > 0 ? parseFloat(i.variant_price) : (parseFloat(i.product.price_basic) || 0);
            originalTotal += price * i.quantity;
        });

        // 3. Consultar promociones de estos productores
        const pIds = Object.keys(producersMap);
        if (pIds.length > 0) {
            try {
                // 3.a Fetch producer-wide promos (Legacy fallback)
                const { data: globalPromos } = await supabaseClient
                    .from('promociones_offszn_seguro')
                    .select('*')
                    .in('producer_id', pIds)
                    .eq('active', true);

                // 4. Aplicar por cada productor
                for (const pId of pIds) {
                    const groupItems = producersMap[pId];
                    const globalPromo = globalPromos ? globalPromos.find(p => p.producer_id === pId) : null;
                    
                    // Priority: Use individual promo if ANY item in the group has it explicitly active
                    const itemWithPromo = groupItems.find(i => i.product.promo_active === true);
                    
                    let buyQty = 0;
                    let getQty = 0;
                    let qualifyingItems = [];

                    if (itemWithPromo) {
                        // INDIVIDUAL LOGIC: Threshold based on specific product settings
                        buyQty = itemWithPromo.product.promo_buy_qty || 1;
                        getQty = itemWithPromo.product.promo_get_qty || 1;
                        // For individual, maybe only items with promo_active count? 
                        // Actually, if a producer puts "2x1" on a beat, usually they mean "Buy 1 of this, get 1 of anything (or another beat) for free".
                        // To keep it simple and powerful: if an item has a promo, it triggers the deal for the producer's group.
                        qualifyingItems = groupItems.filter(i => i.product.promo_active === true);
                    } else if (globalPromo) {
                        // LEGACY LOGIC: Threshold based on global settings
                        buyQty = globalPromo.buy_quantity;
                        getQty = globalPromo.get_quantity;
                        qualifyingItems = groupItems; // All beats count for global
                    }

                    if (qualifyingItems.length > 0) {
                        const totalQualifyingCount = qualifyingItems.reduce((acc, curr) => acc + curr.quantity, 0);
                        const threshold = buyQty + getQty;

                        if (totalQualifyingCount >= threshold) {
                            const times = Math.floor(totalQualifyingCount / threshold);
                            const freeCount = times * getQty;

                            // Sort by price ascending (cheapest ones are free)
                            const sortedItems = [...groupItems].sort((a, b) => {
                                const pA = parseFloat(a.variant_price) || parseFloat(a.product.price_basic) || 0;
                                const pB = parseFloat(b.variant_price) || parseFloat(b.product.price_basic) || 0;
                                return pA - pB;
                            });

                            let discountedRemaining = freeCount;
                            sortedItems.forEach(item => {
                                if (discountedRemaining <= 0) return;
                                const price = parseFloat(item.variant_price) || parseFloat(item.product.price_basic) || 0;
                                const taking = Math.min(item.quantity, discountedRemaining);
                                discountTotal += price * taking;
                                discountedRemaining -= taking;
                                item.isPromotionFree = true;
                            });

                            appliedPromos.push(`${buyQty}x${buyQty + getQty} activa (${itemWithPromo ? 'Individual' : 'Global'})`);
                        }
                    }
                }
            } catch (e) {
                console.error("Error aplicando promos en carrito:", e);
            }
        }

        total = originalTotal - discountTotal;

        if (this.ui.total) {
            if (discountTotal > 0) {
                this.ui.total.innerHTML = `
                    <span style="font-size: 0.8rem; text-decoration: line-through; color: #666; margin-right: 8px;">$${originalTotal.toFixed(2)}</span>
                    <span style="color: #22c55e;">$${total.toFixed(2)}</span>
                `;
            } else {
                this.ui.total.innerText = `$${total.toFixed(2)}`;
            }
        }

        // Render Items
        if (this.state.items.length === 0) {
            this.ui.container.innerHTML = `
                <div style="text-align:center; padding: 60px 20px; color: #444;">
                    <i class="bi bi-cart-x" style="font-size: 3.5rem; opacity: 0.1; display: block; margin-bottom: 20px;"></i>
                    <p style="font-size: 0.9rem; color: #666; font-weight: 500;">No hay elementos en tu selección</p>
                </div>`;
            if (this.ui.checkoutBtn) {
                this.ui.checkoutBtn.disabled = true;
                this.ui.checkoutBtn.style.opacity = '0.5';
                this.ui.checkoutBtn.style.pointerEvents = 'none';
            }
        } else {
            // Render Items
            const itemsHtml = this.state.items.map(item => {
                const displayPriceRaw = parseFloat(item.variant_price) > 0 ? item.variant_price : item.product.price_basic;
                const displayPrice = displayPriceRaw !== null && displayPriceRaw !== undefined ? parseFloat(displayPriceRaw) : null;
                
                let rawLicName = item.license_name || item.product.product_type || 'Licencia';
                if (item.product.product_type && item.product.product_type.toLowerCase() !== 'beat') {
                    const typeStr = item.product.product_type.toLowerCase();
                    const typeMap = {
                        'drum kit': 'Drum Kit', 'drumkit': 'Drum Kit', 'drum_kit': 'Drum Kit',
                        'loop kit': 'Loop Kit', 'loopkit': 'Loop Kit', 'loop_kit': 'Loop Kit',
                        'preset': 'Preset', 'vocal preset': 'Vocal Preset', 'vocal_preset': 'Vocal Preset',
                        'midi kit': 'MIDI Kit', 'midikit': 'MIDI Kit', 'midi_kit': 'MIDI Kit',
                        'oneshot': 'One-Shot Kit', 'one_shot': 'One-Shot Kit', 'one shot': 'One-Shot Kit',
                        'plugin': 'Plugin'
                    };
                    rawLicName = typeMap[typeStr] || (typeStr.charAt(0).toUpperCase() + typeStr.slice(1));
                } else {
                    rawLicName = item.license_name || 'Licencia Estándar';
                }
                const licName = this.escapeHTML(rawLicName);
                
                // Robust check for FREE status — only when actual price is 0
                // Note: is_free means "has free download option", NOT "license is free"
                const isFree = item.isPromotionFree || 
                             (displayPrice === 0 || displayPrice === null);
                const imgId = `cart-row-img-${item.product.id}`;
                const safeName = this.escapeHTML(item.product.name);

                return `
                <div class="cart-item-row" style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; gap:14px; align-items: center;">
                        <img id="${imgId}" src="/images/portada-default.png" data-r2-version="${item.product.storage_version || item.product.r2_version || 'v2'}" style="width:56px; height:56px; object-fit:cover; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="flex:1; display:flex; flex-direction:column; min-width: 0;">
                            <h4 style="margin:0; font-size:0.85rem; font-weight:700; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; letter-spacing: 0.3px;">${safeName}</h4>
                            <span style="font-size:0.75rem; color:#666; margin-top: 2px;">${licName}</span>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                            ${isFree ? `
                                <span style="font-size:0.6rem; font-weight:800; color:#000; background:#22c55e; padding: 2px 6px; border-radius:4px; margin-bottom:2px;">OFERTA</span>
                                <span style="font-size:1rem; font-weight:800; color:#22c55e; font-family: 'Plus Jakarta Sans', sans-serif;">GRATIS</span>
                            ` : `
                                <span id="cart-item-price-${item.product.id}" style="font-size:1rem; font-weight:800; color:#fff; font-family: 'Plus Jakarta Sans', sans-serif;">$${(displayPrice || 0).toFixed(2)}</span>
                            `}
                            <button onclick="CartManager.removeFromCart('${item.product.id}')" style="background:none; border:none; color:#444; font-size:0.85rem; cursor:pointer; padding: 4px; transition:all 0.2s; display: flex; align-items: center;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#444'">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');

            // Promotion Banners Summary
            const promosHtml = (appliedPromos.length > 0) ? `
                <div style="background: rgba(34,197,94,0.1); border: 1px dashed rgba(34,197,94,0.3); color: #22c55e; padding: 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 700; margin-bottom: 20px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                   <i class="bi bi-patch-check-fill"></i> ¡OFERTA APLICADA AUTOMÁTICAMENTE!
                </div>
            ` : '';

            this.ui.container.innerHTML = promosHtml + itemsHtml;

            // Async load images
            this.state.items.forEach(item => {
                const imgId = `cart-row-img-${item.product.id}`;
                if (item.product.image_url && window.getAuthorizedUrl) {
                    const storageVer = item.product.storage_version || item.product.r2_version || 'v2';
                    window.getAuthorizedUrl(item.product.image_url, storageVer, item.product.id).then(url => {
                        const img = document.getElementById(imgId);
                        if (img && url) img.src = url;
                    });
                }
            });
            if (this.ui.checkoutBtn) {
                this.ui.checkoutBtn.disabled = false;
                this.ui.checkoutBtn.style.opacity = '1';
                this.ui.checkoutBtn.style.pointerEvents = 'auto';
            }
        }

        // Notify other components (like Checkout) that cart has updated
        window.dispatchEvent(new CustomEvent('cart-updated', { detail: this.state.items }));
    },

    updateBadge: function () {
        // Also update navbar badge if it exists
        const count = (this.state && this.state.items) ? this.state.items.length : 0;
        
        // Target specific ID from init
        if (this.ui.countBadge) {
            this.ui.countBadge.innerText = count;
            this.ui.countBadge.style.display = count > 0 ? 'flex' : 'none';
        }

        // Sync with mobile badge helper if defined
        if (typeof window.syncMobileCartBadge === 'function') {
            window.syncMobileCartBadge(count);
        }

        // Update Panel Title Count
        const panelCount = document.getElementById('cart-panel-count');
        if (panelCount) {
            panelCount.innerText = count;
            panelCount.style.display = count > 0 ? 'inline' : 'none';
        }

        // 🚀 GUEST RESILIENCE: Update all elements with potential badge classes
        const selectors = [
            '.cart-count', 
            '.cart-badge', 
            '#cart-badge-count', 
            '.navbar-cart-count',
            '.mobile-cart-count'
        ];
        
        selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(b => {
                b.innerText = count;
                b.style.display = count > 0 ? (selector.includes('badge') ? 'flex' : 'inline-block') : 'none';
                
                // If it's a flex circle (badge), ensure it's visible
                if (count > 0 && b.classList.contains('badge-circle')) {
                    b.style.display = 'flex';
                }
            });
        });

        // Notify navbar.js specifically
        window.dispatchEvent(new CustomEvent('offszn-cart-badge-updated', { detail: { count } }));
    },

    openCart: function () {
        const panel = document.getElementById('globalCartPanel');
        const backdrop = document.getElementById('globalBackdrop');
        
        if (!panel) return;
        if (panel.classList.contains('active')) return;

        // Close any other open UI elements first
        if (window.closeAllOverlays) window.closeAllOverlays();
        
        // Direct DOM manipulation — bypass handleSmartToggle to avoid
        // its "ANY_OPEN → return" guard which can block the cart from opening
        // when closeAllOverlays just ran in the same tick.
        panel.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
    },

    proceedToCheckout: function() {
        // Enforce Login/Registration for Guests
        const user = this.state.user;
        if (!user) {
            if (typeof window.showGuestModal === 'function') {
               // Close sidebar first to avoid stacking issues
               if (window.closeAllOverlays) window.closeAllOverlays();
               // Open guest modal
               window.showGuestModal(
                   "Inicia Sesión o Regístrate",
                   "Para comprar y tener acceso permanente a tus archivos desde cualquier lugar, crea tu cuenta o inicia sesión en segundos.",
                   "/pages/checkout.html"
               );
            } else {
               window.location.href = "/pages/login.html?redirect=/pages/checkout.html";
            }
            return;
        }
        
        window.location.href = '/pages/checkout.html';
    },

    clearCart: function () {
        this.state.items = [];
        localStorage.removeItem('offszn_cart');
        this.render();
        this.updateBadge();
    }
};

// --- UI HELPERS (SHARED) ---
window.copyToClipboard = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        if (btn) {
            const icon = btn.querySelector('i') || btn;
            const originalClass = icon.className;
            icon.className = 'bi bi-check2';
            setTimeout(() => { icon.className = originalClass; }, 2000);
        }
        if (window.showNotification) window.showNotification("Copiado al portapapeles", "success");
    });
};

window.closeBlockedPaymentModal = () => {
    const backdrop = document.getElementById('blocked-payment-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
        setTimeout(() => { backdrop.style.display = 'none'; }, 300);
    }
};

window.openBlockedPaymentModal = function (producer, productData = null) {
    if (!producer) return;
    
    // Fallback to global if not provided
    const product = productData || window.currentProductData;

    // 🚨 REGISTER NOTIFICATION (Optional)
    const currentUser = window.AuthUtils && typeof window.AuthUtils.getCurrentUser === 'function' ? window.AuthUtils.getCurrentUser() : null;
    if (window.supabaseClient && producer.id && (!currentUser || currentUser.id !== producer.id)) {
        const buyerName = currentUser?.nickname || 'Un visitante';
        window.supabaseClient.from('notifications').insert({
            user_id: producer.id,
            type: 'payment_method_missing',
            title: 'Intento de compra',
            message: `${buyerName} intentó comprar "${product?.name || 'un producto'}", pero necesitas configurar PayPal o Yape.`,
            link: '/cuenta/configuracion',
            is_read: false
        }).then(() => {});
    }

    let backdrop = document.getElementById('blocked-payment-modal-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'blocked-payment-modal-backdrop';
        backdrop.className = 'share-modal-backdrop';
        backdrop.onclick = (e) => { if (e.target === backdrop) window.closeBlockedPaymentModal(); };
        document.body.appendChild(backdrop);
    }

    const nickname = producer.nickname || 'este productor';
    const email = producer.email || '';
    const category = (product?.product_type || 'producto').toLowerCase();
    const message = `Hola @${nickname}, intenté comprar tu ${category} "${product?.name || 'este producto'}" pero no logré completar el pago.`;
    const contactUrl = `/mensajes.html?user=${encodeURIComponent(nickname)}&msg=${encodeURIComponent(message)}`;

    backdrop.innerHTML = `
        <div class="share-modal-content" style="max-width: 440px; width: 95%; padding: 45px 30px; border-radius: 28px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 50px 100px rgba(0,0,0,0.9);">
            <div class="modal-pull-bar"></div>
            <button class="share-modal-close-btn" onclick="window.closeBlockedPaymentModal()" style="top: 25px; right: 25px;">&times;</button>
            <div style="text-align:center;">
                <div style="width: 60px; height: 60px; background: rgba(255, 255, 255, 0.03); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 25px; border: 1px solid rgba(255, 255, 255, 0.08);">
                    <i class="bi bi-info-circle" style="color: #fff; font-size: 1.8rem; opacity: 0.8;"></i>
                </div>
                <h2 style="color: #fff; font-size: 1.4rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">No se pudo añadir este ${category}</h2>
                <p style="color:#888; font-size:0.95rem; margin-bottom:30px; line-height:1.6; font-weight:500;">
                    <a href="/@${nickname}" style="color:#fff; text-decoration:none; font-weight:800;">@${nickname}</a> aún no ha configurado sus métodos de pago. Por favor, contáctalo directamente para completar tu compra.
                </p>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <button onclick="window.location.href='${contactUrl}'" style="width:100%; height: 56px; font-size: 1rem; font-weight:800; border-radius: 12px; background: #fff; color: #000; border: none; text-transform: uppercase; cursor: pointer;">
                        CONTACTAR AL PRODUCTOR
                    </button>
                    ${email ? `
                        <div style="margin-top: 10px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
                            <div style="color: #555; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 800;">Email de contacto</div>
                            <div style="color: #fff; font-size: 0.95rem; font-weight: 600; display: flex; justify-content: center; align-items: center; gap: 10px;">
                                ${email}
                                <i class="bi bi-clipboard" style="cursor: pointer; opacity: 0.4; font-size: 0.8rem;" onclick="window.copyToClipboard('${email}', this)"></i>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => { backdrop.classList.add('active'); }, 10);
};

// Global Helpers for HTML attributes
window.handleAddToCart = (e, id) => {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    if (window.CartManager) {
        window.CartManager.addItem(id);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CartManager.init();
});

// 🚀 RACE CONDITION FIX: If navbar is loaded dynamically, re-init UI and update badge
window.addEventListener('offszn-navbar-loaded', () => {
    if (window.CartManager) {
        window.CartManager.init(); // Re-scan DOM for new navbar elements
        window.CartManager.updateBadge();
    }
});