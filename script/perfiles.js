// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUserId = null;
let currentAudio = null;

// URL de la API
let API_URL = '';
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  API_URL = 'http://localhost:3000/api';
} else {
  API_URL = 'https://offszn-academy.onrender.com/api'; // (Tu URL de Render)
}

// ============================================
// OBTENER NICKNAME DESDE LA URL (¡CORREGIDO!)
// ============================================
function getNicknameFromURL() {
  // 1. PRIMERO, buscar el query param (para pruebas locales)
  const params = new URLSearchParams(window.location.search);
  const nicknameParam = params.get('nickname');
  if (nicknameParam) {
    return nicknameParam; // Devuelve "testeo5"
  }

  const path = window.location.pathname; // Ej: "/@willieinspired"

  // 2. SEGUNDO, buscar la ruta /@nickname (para producción)
  if (path.startsWith('/@')) {
    return path.substring(2); // Devuelve "willieinspired"
  }

  // 3. TERCERO, buscar la ruta /nickname (el fallback)
  // (Añadimos !path.includes('.html') para que no coja el nombre del archivo)
  if (path.length > 1 && !path.includes('.html') && !path.startsWith('/pages/') && !path.startsWith('/cuenta/')) {
    return path.substring(1);
  }

  // Si no se encontró nada
  return null;
}

// ============================================
// CARGAR PERFIL DEL USUARIO
// ============================================
async function cargarPerfil() {
  const nickname = getNicknameFromURL();

  if (!nickname) {
    mostrarError('No se especificó un usuario');
    return;
  }

  console.log('🔍 Buscando usuario:', nickname);

  try {
    const response = await fetch(`${API_URL}/users/${nickname}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Usuario no encontrado');
      }
      throw new Error('Error al cargar el perfil');
    }

    const user = await response.json();
    console.log('✅ Usuario cargado correctamente:', user);

    currentUserId = user.id;
    actualizarHeaderPerfil(user);

    await Promise.all([
      cargarProductos(nickname),
      cargarEstadisticas(nickname)
    ]);

  } catch (error) {
    console.error('❌ Error cargando perfil:', error.message);
    mostrarError(error.message);
  }
}

// ============================================
// ACTUALIZAR HEADER DEL PERFIL (¡CORREGIDO!)
// ============================================
function actualizarHeaderPerfil(user) {
  const avatarImg = document.getElementById('profile-avatar-img');
  //const avatarContainer = document.querySelector('.profile-avatar');

  if (avatarImg) {
    const initial = (user.first_name || user.nickname || 'U').charAt(0).toUpperCase();
    // ¡URL DEL PLACEHOLDER CORREGIDA!
    const placeholderUrl = `https://dummyimage.com/400x400/7209b7/ffffff.png&text=${initial}`;

    if (user.avatar_url) {
      // (Aquí irá la optimización de imagen, por ahora usamos la URL directa)
      avatarImg.src = user.avatar_url;
      avatarImg.onerror = () => { avatarImg.src = placeholderUrl; }; // Fallback
    } else {
      avatarImg.src = placeholderUrl;
    }
    avatarImg.alt = user.nickname;
  }

  const usernameEl = document.querySelector('.profile-username');
  if (usernameEl) {
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.nickname;
    usernameEl.innerHTML = `
            ${displayName.toUpperCase()}
            ${user.is_verified ? '<span class="verified-badge"><i class="bi bi-check-lg"></i></span>' : ''}
        `;
  }

  const roleEl = document.querySelector('.profile-role');
  if (roleEl) {
    roleEl.textContent = user.role || 'Productor • Artista';
  }

  const sidebarUsername = document.querySelector('.sidebar-section h3.sidebar-title + .sidebar-content p');
  if (sidebarUsername) {
    sidebarUsername.textContent = '@' + user.nickname;
  }

  const bioContent = document.querySelector('.bio-section .sidebar-content');
  if (bioContent) {
    if (user.bio) {
      bioContent.innerHTML = `<p>${user.bio}</p>`;
    } else {
      bioContent.innerHTML = '<p class="empty-state">(bio)</p>';
    }
  }

  actualizarRedesSociales(user.socials);
}

// ============================================
// ACTUALIZAR REDES SOCIALES (Con links mejorados)
// ============================================
function actualizarRedesSociales(socials) {
  const socialsContainer = document.querySelector('.profile-socials');
  if (!socialsContainer) return;
  socialsContainer.innerHTML = '';
  if (!socials || typeof socials !== 'object') return;

  const socialIcons = {
    instagram: 'bi-instagram',
    youtube: 'bi-youtube',
    spotify: 'bi-spotify',
    discord: 'bi-discord',
    twitter: 'bi-twitter',
    tiktok: 'bi-tiktok'
  };

  Object.entries(socials).forEach(([platform, url]) => {
    if (url && socialIcons[platform]) {
      let fullUrl = url.startsWith('http') ? url : `https://${url}`;

      if (platform === 'instagram' && !url.includes('instagram.com')) {
        fullUrl = `https://instagram.com/${url.replace('@', '')}`;
      } else if (platform === 'tiktok' && !url.includes('tiktok.com')) {
        fullUrl = `https://tiktok.com/@${url.replace('@', '')}`;
      }

      const link = document.createElement('a');
      link.href = fullUrl;
      link.target = '_blank';
      link.className = 'social-btn';
      link.title = platform.charAt(0).toUpperCase() + platform.slice(1);
      link.innerHTML = `<i class="bi ${socialIcons[platform]}"></i>`;
      socialsContainer.appendChild(link);
    }
  });
}

// ============================================
// CARGAR PRODUCTOS DEL USUARIO
// ============================================
async function cargarProductos(nickname) {
  const grid = document.getElementById('productsGrid');
  try {
    const response = await fetch(`${API_URL}/users/${nickname}/products`);
    if (!response.ok) throw new Error('Error al cargar productos');

    const products = await response.json();
    console.log('✅ Productos cargados:', products);
    mostrarProductos(products);

    const productsCount = document.getElementById('productsCount');
    if (productsCount) productsCount.textContent = products.length || 0;

  } catch (error) {
    console.error('❌ Error cargando productos:', error);
    mostrarProductosVacio();
  }
}

// ============================================
// MOSTRAR PRODUCTOS EN EL GRID
// ============================================
function mostrarProductos(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (!products || products.length === 0) {
    mostrarProductosVacio();
    return;
  }

  const productsEmptyState = document.querySelector('.products-empty');
  if (productsEmptyState) productsEmptyState.style.display = 'none';

  grid.innerHTML = products.map(product => {

    let imgUrl = "https://via.placeholder.com/300x180/7209b7/000000?text=OFFSZN";
    if (product.image_url) {
      try {
        const optimizedUrlBase = product.image_url.replace('/object/', '/render/image/');
        imgUrl = `${optimizedUrlBase}?width=400&quality=80&resize=contain`;
      } catch (e) {
        imgUrl = product.image_url; // Fallback si la URL es inválida
      }
    }

    let priceText = '';
    if (product.is_free) {
      priceText = 'Gratis';
    } else {
      const prices = [product.price_basic, product.price_premium, product.price_stems, product.price_exclusive].filter(p => p > 0);
      priceText = prices.length > 0 ? `$${parseFloat(Math.min(...prices)).toFixed(2)}` : 'N/A';
    }

    const previewUrl = product.download_url_mp3;

    return `
        <div class="beat-card">
            <div class="beat-cover">
                <img src="${imgUrl}" alt="${product.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://dummyimage.com/300x180/7209b7/ffffff.png&text=IMG'">
                ${previewUrl ? `
                <div class="beat-play-btn" onclick="reproducirPreview(event, '${previewUrl}', this)">
                    <i class="bi bi-play-fill"></i>
                </div>
                ` : ''}
            </div>
            <div class="beat-info">
                <h3 class="beat-title">${product.name}</h3>
                <p class="beat-producer">${product.product_type || 'Beat'}</p>
                <div class="beat-meta">
                    <span class="beat-price ${product.is_free ? 'free' : ''}">${priceText}</span>
                    ${product.bpm ? `<span class="beat-bpm">${product.bpm} BPM</span>` : ''}
                </div>
                <a href="/producto/${product.id}" class="btn-view-product">Ver Producto</a>
            </div>
        </div>
        `;
  }).join('');

  // (Añadir estilo para btn-view-product en tu CSS si no existe)
  if (!document.getElementById('profile-product-btn-style')) {
    const style = document.createElement('style');
    style.id = 'profile-product-btn-style';
    style.textContent = `
            .btn-view-product {
                display: block;
                background: var(--purple-main);
                color: #fff;
                text-align: center;
                padding: 10px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                margin-top: 1rem;
                transition: all 0.3s;
            }
            .btn-view-product:hover {
                background: var(--purple-dark);
            }
            .beat-price.free { color: var(--green-verified); }
        `;
    document.head.appendChild(style);
  }
}

// ============================================
// MOSTRAR ESTADO VACÍO
// ============================================
function mostrarProductosVacio() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  const emptyState = document.querySelector('.products-empty');
  if (emptyState) {
    emptyState.style.display = 'flex';
  } else {
    grid.innerHTML = `
        <div class="products-empty" style="display:flex; flex-direction:column; align-items:center; justify-content:center; grid-column: 1 / -1; background: #1a1a1a; border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 5rem 2rem; min-height: 500px;">
            <div class="empty-icon" style="font-size: 4rem; color: rgba(255, 255, 255, 0.1); margin-bottom: 1.5rem;"><i class="bi bi-music-note-list"></i></div>
            <h3 class="empty-title" style="font-size: 1.5rem; font-weight: 800; color: #fff; font-family: 'Montserrat', sans-serif; margin-bottom: 0.75rem;">Aún no tiene productos</h3>
            <p class="empty-description" style="font-size: 1rem; color: #666; max-width: 400px; margin: 0 auto; line-height: 1.6;">Este usuario aún no ha subido ningún beat, kit o preset a la plataforma.</p>
        </div>
        `;
  }
}

// ============================================
// CARGAR ESTADÍSTICAS
// ============================================
async function cargarEstadisticas(nickname) {
  // (Esta función es llamada por cargarPerfil,
  // el contador de productos se actualiza en cargarProductos)

  const followersCount = document.getElementById('followersCount');
  if (followersCount) followersCount.textContent = '0'; // Placeholder

  const followingCount = document.getElementById('followingCount');
  if (followingCount) followingCount.textContent = '0'; // Placeholder
}

// ============================================
// REPRODUCIR PREVIEW DE AUDIO (¡CORREGIDO!)
// ============================================
function reproducirPreview(event, audioUrl, button) {
  event.stopPropagation(); // Evita que el clic se propague a la tarjeta
  const icon = button.querySelector('i');

  if (currentAudio && currentAudio.src === audioUrl && !currentAudio.paused) {
    currentAudio.pause();
    return; // onpause se encargará del ícono
  }

  if (currentAudio) {
    currentAudio.pause();
  }

  currentAudio = new Audio(audioUrl);

  // Resetear todos los íconos de play
  document.querySelectorAll('.beat-play-btn i').forEach(i => {
    i.classList.remove('bi-pause-fill');
    i.classList.add('bi-play-fill');
  });

  icon.classList.remove('bi-play-fill');
  icon.classList.add('bi-pause-fill');

  currentAudio.play().catch(e => {
    console.error("Error al reproducir audio:", e);
    icon.classList.remove('bi-pause-fill');
    icon.classList.add('bi-play-fill');
  });

  currentAudio.onpause = () => {
    icon.classList.remove('bi-pause-fill');
    icon.classList.add('bi-play-fill');
  };
  currentAudio.onended = () => {
    icon.classList.remove('bi-pause-fill');
    icon.classList.add('bi-play-fill');
  };
  currentAudio.onerror = () => {
    console.error("No se pudo cargar el audio");
    icon.classList.remove('bi-pause-fill');
    icon.classList.add('bi-play-fill');
  };
}
// Exponer la función al scope global para que 'onclick' la encuentre
window.reproducirPreview = reproducirPreview;

// ============================================
// MOSTRAR ERROR
// ============================================
function mostrarError(mensaje) {
  if (window.toast) {
    window.toast.error(mensaje);
  } else {
    alert(mensaje);
  }

  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = `
        <div class="products-empty" style="display:flex; flex-direction:column; align-items:center; justify-content:center; grid-column: 1 / -1; background: #1a1a1a; border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 5rem 2rem; min-height: 500px;">
            <div class="empty-icon" style="font-size: 4rem; color: #ef4444; margin-bottom: 1.5rem;"><i class="bi bi-exclamation-triangle"></i></div>
            <h3 class="empty-title" style="font-size: 1.5rem; font-weight: 800; color: #fff; font-family: 'Montserrat', sans-serif; margin-bottom: 0.75rem;">${mensaje}</h3>
            <p class="empty-description" style="font-size: 1rem; color: #666; max-width: 400px; margin: 0 auto; line-height: 1.6;">
                <a href="/index.html" style="color: var(--purple-light);">Volver al inicio</a>
            </p>
        </div>
        `;
  }
}

// ============================================
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  cargarPerfil();
});