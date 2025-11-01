document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const sidebarLinks = document.querySelectorAll('.sidebar nav ul li a');
    const logoutButton = document.getElementById('admin-logout-button');
    const token = localStorage.getItem('authToken'); // Usa el token normal

    let API_URL = '';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_URL = 'http://localhost:3000/api';
    } else {
        API_URL = 'https://offszn-academy.onrender.com/api';
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            alert('Has cerrado sesión del panel de administrador.');
            window.location.replace('/pages/login.html');
        });
    }

    async function loadContent(section) {
        mainContent.innerHTML = `<h1>Cargando ${section}...</h1>`;
        sidebarLinks.forEach(link => link.classList.remove('active'));
        document.querySelector(`.sidebar a[href="#${section}"]`)?.classList.add('active');

        try {
            switch (section) {
                case 'dashboard':
                    mainContent.innerHTML = '<h1>Bienvenido al Dashboard</h1><p>Resumen general...</p>';
                    break;
                case 'products':
                    mainContent.innerHTML = await loadProductsSection();
                    addProductListeners();
                    break;
                case 'orders':
                    mainContent.innerHTML = await loadOrdersSection();
                    break;
                case 'users':
                    mainContent.innerHTML = await loadUsersSection();
                    break;
                default:
                    mainContent.innerHTML = '<h1>Sección no encontrada</h1>';
            }
        } catch (error) {
             console.error(`Error cargando sección ${section}:`, error);
             mainContent.innerHTML = `<h1 style="color: red;">Error al cargar ${section}</h1><p>${error.message}</p>`;
        }
    }

    async function loadProductsSection() {
        const response = await fetch(`${API_URL}/admin/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('No se pudo cargar la lista de productos.');
        const products = await response.json();

        let tableHTML = `
            <h2>Gestión de Productos</h2>
            <button class="btn-new-product">Nuevo Producto</button>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;
        products.forEach(p => {
            tableHTML += `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.name}</td>
                    <td>$${p.price}</td>
                    <td>
                        <button class="btn-edit" data-id="${p.id}">Editar</button>
                        <button class="btn-delete" data-id="${p.id}">Eliminar</button>
                    </td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        return tableHTML;
    }

    async function loadOrdersSection() {
        return '<h2>Gestión de Pedidos</h2><p>Próximamente...</p>';
    }
    async function loadUsersSection() {
        return '<h2>Gestión de Usuarios</h2><p>Próximamente...</p>';
    }

    function showNewProductForm() {
        mainContent.innerHTML = `
            <h2>Nuevo Producto</h2>
            <form id="new-product-form">
                <label for="name">Nombre:</label>
                <input type="text" id="name" name="name" required><br>

                <label for="description">Descripción:</label>
                <textarea id="description" name="description" required></textarea><br>

                <label for="price">Precio (USD):</label>
                <input type="number" id="price" name="price" step="0.01" required><br>

                <label for="image_url">URL Imagen:</label>
                <input type="url" id="image_url" name="image_url" required><br>

                <label for="download_url">URL Descarga:</label>
                <input type="url" id="download_url" name="download_url" required><br>

                <button type="submit">Guardar Producto</button>
                <button type="button" class="btn-cancel">Cancelar</button>
                <div id="form-message" class="message"></div>
            </form>
        `;
        document.getElementById('new-product-form').addEventListener('submit', handleCreateProduct);
        mainContent.querySelector('.btn-cancel').addEventListener('click', () => loadContent('products')); // Botón Cancelar
    }

    async function showEditProductForm(productId) {
        mainContent.innerHTML = `<h2>Editando Producto ID: ${productId}...</h2>`;
        try {
            const response = await fetch(`${API_URL}/products`);
            if (!response.ok) throw new Error('No se pudo obtener datos del producto.');
            const allProducts = await response.json();
            const product = allProducts.find(p => p.id == productId);

            if (!product) throw new Error('Producto no encontrado.');

            mainContent.innerHTML = `
                <h2>Editar Producto (ID: ${productId})</h2>
                <form id="edit-product-form">
                    <input type="hidden" name="id" value="${product.id}"> 

                    <label for="name">Nombre:</label>
                    <input type="text" id="name" name="name" value="${product.name}" required><br>

                    <label for="description">Descripción:</label>
                    <textarea id="description" name="description" required>${product.description}</textarea><br>

                    <label for="price">Precio (USD):</label>
                    <input type="number" id="price" name="price" step="0.01" value="${product.price}" required><br>

                    <label for="image_url">URL Imagen:</label>
                    <input type="url" id="image_url" name="image_url" value="${product.image_url}" required><br>

                    <label for="download_url">URL Descarga:</label>
                    <input type="url" id="download_url" name="download_url" value="${product.download_url}" required><br>

                    <button type="submit">Actualizar Producto</button>
                    <button type="button" class="btn-cancel">Cancelar</button>
                    <div id="form-message" class="message"></div>
                </form>
            `;
            document.getElementById('edit-product-form').addEventListener('submit', handleUpdateProduct);
            mainContent.querySelector('.btn-cancel').addEventListener('click', () => loadContent('products'));

        } catch (error) {
             console.error("Error al cargar formulario de edición:", error);
             mainContent.innerHTML = `<h2 style="color:red;">Error cargando producto para editar</h2><p>${error.message}</p><button onclick="loadContent('products')">Volver</button>`;
        }
    }

    async function handleCreateProduct(event) {
        event.preventDefault();
        const form = event.target;
        const messageDiv = form.querySelector('#form-message');
        const submitButton = form.querySelector('button[type="submit"]');

        const formData = {
            name: form.name.value,
            description: form.description.value,
            price: form.price.value,
            image_url: form.image_url.value,
            download_url: form.download_url.value,
        };

        messageDiv.textContent = '';
        messageDiv.className = 'message';
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        try {
            const response = await fetch(`${API_URL}/admin/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al guardar');
            }

            messageDiv.textContent = '¡Producto creado exitosamente!';
            messageDiv.classList.add('success');
            form.reset();
            setTimeout(() => loadContent('products'), 1500); 

        } catch (error) {
            messageDiv.textContent = `Error: ${error.message}`;
            messageDiv.classList.add('error');
        } finally {
             submitButton.disabled = false;
             submitButton.textContent = 'Guardar Producto';
        }
    }

    async function handleUpdateProduct(event) {
        event.preventDefault();
        const form = event.target;
        const messageDiv = form.querySelector('#form-message');
        const submitButton = form.querySelector('button[type="submit"]');
        const productId = form.id.value;

        const formData = {
            name: form.name.value,
            description: form.description.value,
            price: form.price.value,
            image_url: form.image_url.value,
            download_url: form.download_url.value,
        };

        messageDiv.textContent = '';
        messageDiv.className = 'message';
        submitButton.disabled = true;
        submitButton.textContent = 'Actualizando...';

        try {
            const response = await fetch(`${API_URL}/admin/products/${productId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al actualizar');
            }

            messageDiv.textContent = '¡Producto actualizado exitosamente!';
            messageDiv.classList.add('success');
            setTimeout(() => loadContent('products'), 1500);

        } catch (error) {
            messageDiv.textContent = `Error: ${error.message}`;
            messageDiv.classList.add('error');
             submitButton.disabled = false;
             submitButton.textContent = 'Actualizar Producto';
        }
    }

    async function handleDeleteProduct(productId) {
         if (!confirm(`¿Estás seguro de que quieres eliminar el producto con ID ${productId}? Esta acción no se puede deshacer.`)) {
             return;
         }

         const rowToDelete = mainContent.querySelector(`button.btn-delete[data-id="${productId}"]`)?.closest('tr');
         if (rowToDelete) rowToDelete.style.opacity = '0.5';

        try {
            const response = await fetch(`${API_URL}/admin/products/${productId}`, { 
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
             const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Error ${response.status} al eliminar`);
            }

            alert(data.message || 'Producto eliminado.');
            loadContent('products');

        } catch (error) {
            console.error(`Error al eliminar producto ${productId}:`, error);
            alert(`Error al eliminar: ${error.message}`);
             if (rowToDelete) rowToDelete.style.opacity = '1';
        }
    }

    function addProductListeners() {
         const newBtn = mainContent.querySelector('.btn-new-product');
         if(newBtn) newBtn.addEventListener('click', showNewProductForm);

         mainContent.querySelectorAll('.btn-edit').forEach(btn => {
             btn.addEventListener('click', (e) => showEditProductForm(e.target.dataset.id));
         });
         mainContent.querySelectorAll('.btn-delete').forEach(btn => {
             btn.addEventListener('click', (e) => handleDeleteProduct(e.target.dataset.id));
         });
    }


    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.getAttribute('href').substring(1);
            loadContent(section);
            window.location.hash = section;
        });
    });

    const initialSection = window.location.hash.substring(1) || 'dashboard';
    loadContent(initialSection);

});