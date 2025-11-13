// ============================================
// VARIABLES GLOBALES
// ============================================
let currentUserId = null;

// ============================================
// OBTENER NICKNAME DESDE LA URL
// ============================================
function getNicknameFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('nickname');
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
    // Usar la API pública
    const response = await fetch(`https://offszn1.onrender.com/api/profile/${nickname}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.error('❌ Usuario no encontrado');
        mostrarError('Usuario no encontrado');
        return;
      }
      throw new Error('Error al cargar el perfil');
    }

    const user = await response.json();
    console.log('✅ Usuario cargado correctamente:', user);

    currentUserId = user.id;
    actualizarHeaderPerfil(user);
    await cargarProductos(user.id);
    await cargarEstadisticas(user.id);

  } catch (error) {
    console.error('❌ Error cargando perfil:', error);
    mostrarError('Error al cargar el perfil. Por favor, intenta de nuevo.');
  }
}

// ============================================
// ACTUALIZAR HEADER DEL PERFIL
// ============================================
function actualizarHeaderPerfil(user) {
  // Avatar
  const avatarImg = document.querySelector('.profile-avatar img');
  if (avatarImg) {
    avatarImg.src = user.avatar_url || 'https://via.placeholder.com/400x400/7209b7/ffffff?text=' + (user.first_name?.[0] || 'U');
    avatarImg.alt = user.nickname;
  }

  // Username
  const username = document.querySelector('.profile-username');
  if (username) {
    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.nickname;
    username.innerHTML = `
      ${displayName.toUpperCase()}
      ${user.is_verified ? '<span class="verified-badge"><i class="bi bi-check-lg"></i></span>' : ''}
    `;
  }

  // Role/Bio
  const role = document.querySelector('.profile-role');
  if (role) {
    role.textContent = user.role || 'Producer • Artist';
  }

  // Username en sidebar
  const sidebarUsername = document.querySelector('.sidebar-section .sidebar-content p');
  if (sidebarUsername) {
    sidebarUsername.textContent = '@' + user.nickname;
  }

  // Bio en sidebar
  const bioContent = document.querySelector('.bio-section .sidebar-content');
  if (bioContent) {
    if (user.bio) {
      bioContent.innerHTML = `<p>${user.bio}</p>`;
    } else {
      bioContent.innerHTML = '<p class="empty-state">(bio)</p>';
    }
  }

  // Redes sociales
  actualizarRedesSociales(user.socials);
}

// ============================================
// ACTUALIZAR REDES SOCIALES
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
      const link = document.createElement('a');
      link.href = url;
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
async function cargarProductos(userId) {
  const nickname = getNicknameFromURL();
  
  try {
    const response = await fetch(`https://offszn1.onrender.com/api/profile/${nickname}/products`);
    
    if (!response.ok) {
      throw new Error('Error al cargar productos');
    }

    const products = await response.json();
    console.log('✅ Productos cargados:', products);

    mostrarProductos(products);

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

  grid.innerHTML = products.map(product => `
    <div class="beat-card">
      <div class="beat-cover">
        <img src="${product.cover_url || '/images/default-cover.jpg'}" alt="${product.title}">
        ${product.audio_preview ? `
          <div class="beat-play-btn" onclick="reproducirPreview('${product.audio_preview}', this)">
            <i class="bi bi-play-fill"></i>
          </div>
        ` : ''}
      </div>
      <div class="beat-info">
        <h3 class="beat-title">${product.title}</h3>
        <p class="beat-producer">${product.genre || 'Beat'}</p>
        <div class="beat-meta">
          <span class="beat-price">$${product.price}</span>
          ${product.bpm ? `<span class="beat-bpm">${product.bpm} BPM</span>` : ''}
        </div>
        <a href="/pages/producto?id=${product.id}" class="btn-view-product">Ver Producto</a>
      </div>
    </div>
  `).join('');
}

// ============================================
// MOSTRAR ESTADO VACÍO
// ============================================
function mostrarProductosVacio() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="products-empty">
      <div class="empty-icon">
        <i class="bi bi-music-note-list"></i>
      </div>
      <h3 class="empty-title">Aún no tiene productos</h3>
      <p class="empty-description">
        Este usuario aún no ha subido ningún beat, kit o preset a la plataforma.
        ¡Vuelve pronto para ver sus creaciones!
      </p>
    </div>
  `;
}

// ============================================
// CARGAR ESTADÍSTICAS
// ============================================
async function cargarEstadisticas(userId) {
  const nickname = getNicknameFromURL();
  
  try {
    // Contar productos
    const productsResponse = await fetch(`https://offszn1.onrender.com/api/profile/${nickname}/products`);
    const products = await productsResponse.json();
    
    const productsCount = document.getElementById('productsCount');
    if (productsCount) {
      productsCount.textContent = products.length || 0;
    }

    // TODO: Implementar conteo de seguidores cuando esté la funcionalidad
    const followersCount = document.getElementById('followersCount');
    if (followersCount) {
      followersCount.textContent = '0';
    }

    const followingCount = document.getElementById('followingCount');
    if (followingCount) {
      followingCount.textContent = '0';
    }

  } catch (error) {
    console.error('❌ Error cargando estadísticas:', error);
  }
}

// ============================================
// REPRODUCIR PREVIEW DE AUDIO
// ============================================
let currentAudio = null;

function reproducirPreview(audioUrl, button) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  if (currentAudio && currentAudio.src === audioUrl && !currentAudio.paused) {
    currentAudio.pause();
    button.innerHTML = '<i class="bi bi-play-fill"></i>';
    return;
  }

  currentAudio = new Audio(audioUrl);
  button.innerHTML = '<i class="bi bi-pause-fill"></i>';

  currentAudio.play();

  currentAudio.onended = () => {
    button.innerHTML = '<i class="bi bi-play-fill"></i>';
  };
}

// ============================================
// MOSTRAR ERROR
// ============================================
function mostrarError(mensaje) {
  if (window.toast) {
    window.toast.error(mensaje);
  } else {
    alert(mensaje);
  }

  // Mostrar error en el contenedor de productos
  const grid = document.getElementById('productsGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="products-empty">
        <div class="empty-icon">
          <i class="bi bi-exclamation-triangle"></i>
        </div>
        <h3 class="empty-title">${mensaje}</h3>
        <p class="empty-description">
          <a href="/index">Volver al inicio</a>
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
