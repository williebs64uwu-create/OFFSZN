document.addEventListener('DOMContentLoaded', () => {

  //configuracion
  let API_URL = '';
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
    API_URL = 'http://localhost:3000/api';
  } else {
    API_URL = 'https://offszn-academy.onrender.com/api';
  }

  const authToken = localStorage.getItem('authToken');
  const productGrid = document.getElementById('product-grid');

  async function loadProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = '<p class="loading-message">Cargando productos...</p>';

    try {
      const productsResponse = await fetch(`${API_URL}/products`);
      if (!productsResponse.ok) throw new Error('No se pudieron cargar los productos.');
      const allProducts = await productsResponse.json();

      let purchasedProductIds = new Set();
      if (authToken) {
        try {
          const purchasedResponse = await fetch(`${API_URL}/my-products`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (purchasedResponse.ok) {
            const purchasedProducts = await purchasedResponse.json();
            purchasedProducts.forEach(p => {
              if (p && p.id) {
                purchasedProductIds.add(p.id);
              }
            });
          } else {
            console.warn("No se pudo obtener la lista de productos comprados. El usuario podría no haber iniciado sesión correctamente o la API falló.");
          }
        } catch (purchasedError) {
          console.error("Error al obtener productos comprados:", purchasedError);
        }
      }

      if (allProducts.length === 0) {
        productGrid.innerHTML = '<p class="empty-cart-message">No hay productos disponibles.</p>';
        return;
      }

      let productHTML = '';
      allProducts.forEach(product => {
        const isPurchased = purchasedProductIds.has(product.id);

        productHTML += `
          <div class="product-card ${isPurchased ? 'purchased' : ''}">
            <img src="${product.image_url}" alt="${product.name}">
            <div class="product-content">
              <h3>${product.name}</h3>
              <p>${product.description}</p>
              <div class="product-price">$${product.price}</div>

              ${isPurchased
            ? `<div class="purchased-badge"><i class="bi bi-check-circle-fill"></i> Adquirido</div>`
            : `
                  <button class="btn btn-add-to-cart" data-product-id="${product.id}">
                    <i class="bi bi-cart-plus"></i> Añadir al Carrito
                  </button>
                  <div class="paypal-button-container" data-product-id="${product.id}"></div>
                `
          }

            </div>
          </div>
        `;
      });

      productGrid.innerHTML = productHTML;

      initializePayPalButtons();
      addCartButtonListeners();


    } catch (error) {
      console.error('Error al cargar productos:', error);
      productGrid.innerHTML = `<p class="empty-cart-message">Error al cargar productos: ${error.message}</p>`;
    }
  }

  function initializePayPalButtons() {
    document.querySelectorAll('.product-card:not(.purchased) .paypal-button-container').forEach(buttonContainer => {

      const productId = buttonContainer.dataset.productId;

      paypal.Buttons({

        createOrder: async () => {
          if (!authToken) {
            alert('Debes iniciar sesión para poder comprar.');
            window.location.href = '/pages/login.html';
            return;
          }

          try {
            const res = await fetch(`${API_URL}/orders/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ productId: productId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return data.orderID;

          } catch (error) {
            console.error('Error al crear la orden:', error);
            alert(`Error al crear la orden: ${error.message}`);
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
            if (!res.ok) throw new Error(captureData.error);

            console.log('Pago capturado:', captureData);
            alert('¡Gracias por tu compra!');

            window.location.href = '/pages/my-products.html';

          } catch (error) {
            console.error('Error al capturar el pago:', error);
            alert('Error al finalizar el pago.');
          }
        },

        onError: (err) => {
          console.error('Error de PayPal:', err);
          alert('Ha ocurrido un error con PayPal.');
        }

      }).render(buttonContainer);
    });
  }

  function addCartButtonListeners() {
    document.querySelectorAll('.product-card:not(.purchased) .btn-add-to-cart').forEach(button => {
      button.addEventListener('click', async (event) => {
        if (!authToken) {
          alert('Debes iniciar sesión para añadir al carrito.');
          window.location.href = '/pages/login.html';
          return;
        }

        const productId = event.target.dataset.productId;
        button.disabled = true;
        button.innerHTML = '<i class="bi bi-hourglass-split"></i> Añadiendo...'; //feedback

        try {
          const res = await fetch(`${API_URL}/cart`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ productId: productId })
          });

          const data = await res.json();

          if (res.ok) {
            alert('¡Producto añadido al carrito!');
            button.innerHTML = '<i class="bi bi-check-lg"></i> Añadido';
          } else if (res.status === 409) {
            alert('Este producto ya está en tu carrito.');
            button.innerHTML = '<i class="bi bi-cart-check"></i> Ya en Carrito';
            button.disabled = false;
          } else {
            throw new Error(data.error || 'Error desconocido');
          }

        } catch (error) {
          console.error('Error al añadir al carrito:', error);
          alert(`Error: ${error.message}`);
          button.innerHTML = '<i class="bi bi-cart-plus"></i> Añadir al Carrito';
          button.disabled = false;
        }
      });
    });
  }

  loadProducts();

});