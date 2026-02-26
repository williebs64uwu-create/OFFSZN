/**
 * CART MANAGER (Hybrid: LocalStorage + Supabase)
 * Handles cart logic for both Guest and Authenticated users.
 * Replaces the old API-based implementation.
 */

const CartManager = {
    state: {
        items: [], // [{ product: {id, name, price, image_url...}, quantity: 1 }]
        isOpen: false,
        user: null
    },

    init: async function () {
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
        this.state.items = [];

        try {
            if (this.state.user) {
                // AUTH: Load from DB
                const { data, error } = await supabaseClient
                    .from('cart_items')
                    .select('quantity, license_name, variant_price, product:products(id, name, price_basic, image_url, product_type, producer_id, status)')
                    .eq('user_id', this.state.user.id);

                if (error) {
                    console.error("Error loading cart db:", error);
                    // Fallback to local if DB fails? No, risky. Just empty.
                } else if (data) {
                    // Normalize data structure
                    this.state.items = data.map(row => ({
                        product: row.product,
                        quantity: row.quantity,
                        license_name: row.license_name,
                        variant_price: row.variant_price
                    })).filter(i => i.product && i.product.status !== 'deleted'); // Filter out deleted
                }

            } else {
                // GUEST: Load from LocalStorage
                const local = localStorage.getItem('offszn_cart');
                if (local) {
                    this.state.items = JSON.parse(local);
                }
            }
        } catch (err) {
            console.error("Cart load error:", err);
        }

        this.render();
    },

    addToCart: async function (product) {
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
                this.openCart();
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
        this.openCart(); // Auto-open on add

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

    render: async function () {
        if (!this.ui.container) return; // Cart UI not present

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
            const price = parseFloat(i.variant_price) > 0 ? parseFloat(i.variant_price) : (parseFloat(i.product.price_basic) || 0);
            originalTotal += price * i.quantity;
        });

        // 3. Consultar promociones de estos productores (Opcional: Cachear esto)
        const pIds = Object.keys(producersMap);
        if (pIds.length > 0) {
            try {
                const { data: promos } = await supabaseClient
                    .from('promociones_offszn_seguro')
                    .select('*')
                    .in('producer_id', pIds)
                    .eq('active', true);

                if (promos) {
                    promos.forEach(promo => {
                        const items = producersMap[promo.producer_id];
                        const count = items.reduce((acc, curr) => acc + curr.quantity, 0);
                        const threshold = promo.buy_quantity + promo.get_quantity;

                        if (count >= threshold) {
                            // Cuántas veces aplica la oferta (ej: si es 2x1 y tiene 6, aplica 2 veces)
                            const times = Math.floor(count / threshold);
                            const freeCount = times * promo.get_quantity;

                            // Ordenar items de este productor por precio (Gratis los más baratos)
                            const sortedItems = [...items].sort((a, b) => {
                                const pA = parseFloat(a.variant_price) || parseFloat(a.product.price_basic) || 0;
                                const pB = parseFloat(b.variant_price) || parseFloat(b.product.price_basic) || 0;
                                return pA - pB;
                            });

                            let discountedRemaining = freeCount;
                            sortedItems.forEach(item => {
                                if (discountedRemaining <= 0) return;
                                const price = parseFloat(item.variant_price) || parseFloat(item.product.price_basic) || 0;

                                // Aplicamos descuento al item (solo a la cantidad que quepa)
                                const taking = Math.min(item.quantity, discountedRemaining);
                                discountTotal += price * taking;
                                discountedRemaining -= taking;

                                item.isPromotionFree = true; // Flag visual
                            });

                            appliedPromos.push(`${promo.buy_quantity}x${promo.buy_quantity + promo.get_quantity} activa`);
                        }
                    });
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
                const displayPrice = parseFloat(item.variant_price) > 0 ? item.variant_price : item.product.price_basic;
                const licName = item.license_name || item.product.product_type || 'Licencia';
                const isFree = item.isPromotionFree;

                return `
                <div class="cart-item-row" style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; gap:14px; align-items: center;">
                        <img src="${item.product.image_url}" style="width:56px; height:56px; object-fit:cover; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="flex:1; display:flex; flex-direction:column; min-width: 0;">
                            <h4 style="margin:0; font-size:0.85rem; font-weight:700; color:#fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; letter-spacing: 0.3px;">${item.product.name}</h4>
                            <span style="font-size:0.75rem; color:#666; margin-top: 2px;">${licName}</span>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                            ${isFree ? `
                                <span style="font-size:0.6rem; font-weight:800; color:#000; background:#22c55e; padding: 2px 6px; border-radius:4px; margin-bottom:2px;">OFERTA</span>
                                <span style="font-size:1rem; font-weight:800; color:#22c55e; font-family: 'Plus Jakarta Sans', sans-serif;">GRATIS</span>
                            ` : `
                                <span style="font-size:1rem; font-weight:800; color:#fff; font-family: 'Plus Jakarta Sans', sans-serif;">$${parseFloat(displayPrice).toFixed(2)}</span>
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
            if (this.ui.checkoutBtn) {
                this.ui.checkoutBtn.disabled = false;
                this.ui.checkoutBtn.style.opacity = '1';
                this.ui.checkoutBtn.style.pointerEvents = 'auto';
            }
        }
    },

    updateBadge: function () {
        // Also update navbar badge if it exists
        const count = this.state.items.length;
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
            panelCount.style.display = count > 0 ? 'inline' : 'none'; // Hide if 0
        }

        // Fallback for independent navbar elements
        const navBadges = document.querySelectorAll('.cart-count');
        navBadges.forEach(b => {
            b.innerText = count;
            b.style.display = count > 0 ? 'flex' : 'none';
        });
    },

    openCart: function () {
        const panel = document.getElementById('globalCartPanel');
        if (panel && panel.classList.contains('active')) return;

        if (window.closeAllOverlays) window.closeAllOverlays();
        if (window.toggleCartPanel) {
            window.toggleCartPanel({ preventDefault: () => { }, stopPropagation: () => { } });
        }
    },

    clearCart: function () {
        this.state.items = [];
        localStorage.removeItem('offszn_cart');
        this.render();
        this.updateBadge();
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