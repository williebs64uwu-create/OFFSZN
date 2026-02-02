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
                    .select('quantity, license_name, variant_price, product:products(id, name, price_basic, image_url, product_type, producer_id)')
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
                    })).filter(i => i.product); // Safety check
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

    render: function () {
        if (!this.ui.container) return; // Cart UI not present

        this.updateBadge();

        // Calculate Total
        let total = 0;
        this.state.items.forEach(i => {
            const price = parseFloat(i.variant_price) > 0 ? parseFloat(i.variant_price) : (parseFloat(i.product.price_basic) || 0);
            total += price * i.quantity;
        });

        if (this.ui.total) this.ui.total.innerText = `$${total.toFixed(2)}`;

        // Render Items
        if (this.state.items.length === 0) {
            this.ui.container.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; color: #666;">
                    <i class="bi bi-cart-x" style="font-size: 2rem; display:block; margin-bottom:10px;"></i>
                    <p>Tu carrito está vacío.</p>
                </div>`;
            if (this.ui.checkoutBtn) this.ui.checkoutBtn.disabled = true;
        } else {
            this.ui.container.innerHTML = this.state.items.map(item => {
                const displayPrice = parseFloat(item.variant_price) > 0 ? item.variant_price : item.product.price_basic;
                const licName = item.license_name || item.product.product_type || 'Licencia';

                return `
                <div class="cart-item-row" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid #1a1a1a;">
                    <div style="display:flex; gap:12px;">
                        <img src="${item.product.image_url}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #222;">
                        <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
                            <h4 style="margin:0; font-size:0.9rem; font-weight:600; color:#eee;">${item.product.name}</h4>
                            <span style="font-size:0.8rem; color:#888;">${licName}</span>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center; gap:4px;">
                            <span style="font-size:0.95rem; font-weight:700; color:#fff;">$${parseFloat(displayPrice).toFixed(2)}</span>
                            <button onclick="CartManager.removeFromCart('${item.product.id}')" style="background:none; border:none; color:#555; font-size:0.9rem; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#555'">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            if (this.ui.checkoutBtn) this.ui.checkoutBtn.disabled = false;
        }
    },

    updateBadge: function () {
        // Also update navbar badge if it exists
        const count = this.state.items.length;
        if (this.ui.countBadge) {
            this.ui.countBadge.innerText = count;
            this.ui.countBadge.style.display = count > 0 ? 'flex' : 'none';
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