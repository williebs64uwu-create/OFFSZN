document.addEventListener('DOMContentLoaded', () => {

    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    const authToken = localStorage.getItem('authToken');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartSummaryDiv = document.getElementById('cart-summary');
    const cartTotalSpan = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout-button');
    let currentCartItems = [];

    async function loadCart() {
        if (!authToken) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-message">Debes iniciar sesión para ver tu carrito.</p>';
            return;
        }
        if (!cartItemsContainer) return;

        cartItemsContainer.innerHTML = '<p class="loading-message">Cargando carrito...</p>';

        try {
            const response = await fetch(`${API_URL}/cart`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'No se pudo cargar el carrito.');
            }

            currentCartItems = await response.json();

            if (currentCartItems.length === 0) {
                cartItemsContainer.innerHTML = '<p class="empty-cart-message">Tu carrito está vacío.</p>';
                cartSummaryDiv.style.display = 'none';
            } else {
                renderCartItems(currentCartItems);
                calculateTotal(currentCartItems);
                cartSummaryDiv.style.display = 'block';
            }

        } catch (error) {
            console.error('Error al cargar carrito:', error);
            cartItemsContainer.innerHTML = `<p class="empty-cart-message">Error al cargar carrito: ${error.message}</p>`;
            cartSummaryDiv.style.display = 'none';
        }
    }

    function renderCartItems(items) {
        let html = '';
        items.forEach(item => {
            if (item.product) {
                html += `
                    <div class="cart-item">
                        <div class="cart-item-image">
                            <img src="${item.product.image_url || '/images/placeholder.jpg'}" alt="${item.product.name}">
                        </div>
                        <div class="cart-item-details">
                            <h3>${item.product.name}</h3>
                            <p class="cart-item-price">$${item.product.price}</p>
                            </div>
                        <div class="cart-item-actions">
                            <button class="remove-item-btn" data-cart-item-id="${item.cartItemId}">Eliminar</button>
                        </div>
                    </div>
                `;
            } else {
                console.warn("Item de carrito encontrado sin producto asociado:", item);
            }

        });
        cartItemsContainer.innerHTML = html;

        addRemoveButtonListeners();
    }

    function calculateTotal(items) {
        let total = 0;
        items.forEach(item => {
            if (item.product && item.product.price) {
                total += parseFloat(item.product.price) * item.quantity;
            }
        });
        cartTotalSpan.textContent = `$${total.toFixed(2)}`;
    }

    function addRemoveButtonListeners() {
        document.querySelectorAll('.remove-item-btn').forEach(button => {
            button.addEventListener('click', async (event) => {
                const cartItemId = event.target.dataset.cartItemId;
                if (!confirm('¿Seguro que quieres eliminar este item del carrito?')) {
                    return;
                }

                try {
                    const response = await fetch(`${API_URL}/cart/${cartItemId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'No se pudo eliminar el item.');
                    }

                    alert('Item eliminado del carrito.');
                    loadCart();

                } catch (error) {
                    console.error('Error al eliminar item:', error);
                    alert(`Error al eliminar: ${error.message}`);
                }
            });
        });
    }

    if (checkoutButton) {
        checkoutButton.addEventListener('click', () => {
            if (currentCartItems.length === 0) {
                alert('Tu carrito está vacío.');
                return;
            }

            let totalPrice = 0;
            let itemDescriptions = [];
            currentCartItems.forEach(item => {
                if (item.product && item.product.price) {
                    totalPrice += parseFloat(item.product.price) * item.quantity;
                    itemDescriptions.push(item.product.name);
                }
            });
            totalPrice = totalPrice.toFixed(2);
            const descriptionForPaypal = itemDescriptions.join(', ');

            checkoutButton.disabled = true;
            checkoutButton.textContent = 'Procesando...';

            const paypalContainer = document.createElement('div');
            paypalContainer.id = 'paypal-checkout-button-container';
            cartSummaryDiv.appendChild(paypalContainer);

            paypal.Buttons({
                createOrder: async () => {
                    try {
                        const calculatedTotalPrice = cartTotalSpan.textContent.replace('$', '');
                        const calculatedDescription = currentCartItems.map(i => i.product.name).join(', ');

                        const res = await fetch(`${API_URL}/orders/create`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({
                                totalPrice: totalPrice,
                                description: descriptionForPaypal,
                                cartItems: currentCartItems.map(item => ({
                                    productId: item.product.id,
                                    quantity: item.quantity,
                                    price: item.product.price
                                }))
                            })
                        });

                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Error al crear orden');
                        return data.orderID;
                    } catch (error) {
                    
                    }
                },
                onApprove: async (data, actions) => {
                    try {
                        const res = await fetch(`${API_URL}/orders/capture`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({ orderID: data.orderID })
                        });
                        const captureData = await res.json();
                        if (!res.ok) throw new Error(captureData.error || 'Error al capturar');

                        console.log('Pago capturado desde carrito:', captureData);
                        alert('¡Gracias por tu compra!');
                        window.location.href = '/pages/my-products.html';

                    } catch (error) {
                        console.error('Error al capturar pago desde carrito:', error);
                        alert('Error al finalizar el pago.');
                        checkoutButton.disabled = false;
                        checkoutButton.textContent = 'Proceder al Pago (PayPal)';
                        paypalContainer.remove();
                    }
                },
                onError: (err) => {
                    console.error('Error de PayPal:', err);
                    alert('Ha ocurrido un error con PayPal.');
                    checkoutButton.disabled = false;
                    checkoutButton.textContent = 'Proceder al Pago (PayPal)';
                    paypalContainer.remove();
                },
                onCancel: () => {
                    console.log('Pago cancelado por el usuario.');
                    checkoutButton.disabled = false;
                    checkoutButton.textContent = 'Proceder al Pago (PayPal)';
                    paypalContainer.remove();
                }
            }).render('#paypal-checkout-button-container').then(() => {
                checkoutButton.style.display = 'none';
            }).catch(err => {
                console.error("Failed to render PayPal Buttons", err);
                checkoutButton.disabled = false;
                checkoutButton.textContent = 'Proceder al Pago (PayPal)';
                paypalContainer.remove();
            });
        });
    }

    loadCart();

});