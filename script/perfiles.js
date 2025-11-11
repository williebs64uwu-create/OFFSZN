import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔌 Supabase conectado correctamente');

// ============================================
// VARIABLES GLOBALES
// ============================================
let allProducts = [];
let currentFilter = 'all';
let currentSearchTerm = '';
let currentUserId = null;
let audioPlayer = null;
let currentPlayingId = null;

// ============================================
// OBTENER NICKNAME DE LA URL
// ============================================
function getNicknameFromURL() {
  const params = new URLSearchParams(window.location.search);
  const nickname = params.get('nickname') || 'WillieInspired';
  console.log('🔌 Nickname desde URL:', nickname);
  return nickname;
}

// ============================================
// CARGAR PERFIL DEL USUARIO
// ============================================
async function cargarPerfil() {
  const nickname = getNicknameFromURL();
  
  console.log('🔍 Buscando usuario:', nickname);
  
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('nickname', nickname)
      .single();

    console.log('📦 Respuesta de Supabase:', { user, error: userError });

    if (userError) {
      console.error('❌ Error de Supabase:', userError);
      throw userError;
    }
    
    if (!user) {
      console.error('❌ Usuario no encontrado');
      mostrarError('Usuario no encontrado');
      return;
    }

    console.log('✅ Usuario cargado correctamente:', user);

    currentUserId = user.id;
    actualizarHeaderPerfil(user);
    await cargarProductos(user.id);
    await cargarEstadisticas(user.id);
    inicializarFiltros();
    inicializarBusqueda();

  } catch (error) {
    console.error('❌ Error cargando perfil:', error);
    mostrarError('Error al cargar el perfil. Por favor, intenta de nuevo.');
  }
}

// ============================================
// ACTUALIZAR HEADER DEL PERFIL
// ============================================
function actualizarHeaderPerfil(user) {
  console.log('🎨 Actualizando header con datos:', user);

  const avatarImg = document.querySelector('.profile-avatar img');
  if (avatarImg) {
    const inicial = user.first_name ? user.first_name.charAt(0).toUpperCase() : 
                    user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U';
    const placeholder = `https://ui-avatars.com/api/?name=${inicial}&size=400&background=7209b7&color=ffffff&bold=true`;
    
    if (user.avatar_url && user.avatar_url.startsWith('http')) {
      avatarImg.src = user.avatar_url;
    } else {
      avatarImg.src = placeholder;
    }
    
    avatarImg.alt = user.nickname || 'Usuario';
    avatarImg.onerror = function() {
      this.src = placeholder;
      this.onerror = null;
    };
  }

  const usernameEl = document.querySelector('.profile-username');
  if (usernameEl) {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || user.nickname || 'Usuario';
    const verifiedBadge = user.is_verified ? '<span class="verified-badge"><i class="bi bi-check-lg"></i></span>' : '';
    usernameEl.innerHTML = `${fullName.toUpperCase()} ${verifiedBadge}`;
  }

  const roleEl = document.querySelector('.profile-role');
  if (roleEl) {
    const role = user.role || 'Usuario';
    roleEl.textContent = `${role} • Lima, Perú`;
  }

  const sidebarContent = document.querySelectorAll('.sidebar-content');
  if (sidebarContent[0]) {
    const nickname = user.nickname || 'usuario';
    sidebarContent[0].innerHTML = `<p>@${nickname}</p>`;
  }

  if (sidebarContent[1]) {
    if (!user.bio || user.bio.trim() === '') {
      sidebarContent[1].innerHTML = `<p class="empty-state">(bio)</p>`;
    } else {
      sidebarContent[1].innerHTML = `<p>${user.bio}</p>`;
    }
  }

  actualizarRedesSociales(user.socials);
}

// ============================================
// ACTUALIZAR REDES SOCIALES
// ============================================
function actualizarRedesSociales(socials) {
  const socialsContainer = document.querySelector('.profile-socials');
  if (!socialsContainer) return;

  socialsContainer.innerHTML = '';

  if (!socials || typeof socials !== 'object' || Object.keys(socials).length === 0) {
    return;
  }

  const redesMap = {
    instagram: { 
      icon: 'bi-instagram', 
      url: (handle) => {
        if (!handle) return null;
        if (handle.startsWith('http')) return handle;
        return `https://instagram.com/${handle.replace('@', '')}`;
      }
    },
    youtube: { 
      icon: 'bi-youtube', 
      url: (handle) => {
        if (!handle) return null;
        if (handle.startsWith('http')) return handle;
        return `https://youtube.com/${handle.replace('@', '')}`;
      }
    },
    spotify: { 
      icon: 'bi-spotify', 
      url: (url) => url 
    },
    tiktok: { 
      icon: 'bi-tiktok', 
      url: (handle) => {
        if (!handle) return null;
        if (handle.startsWith('http')) return handle;
        return `https://tiktok.com/@${handle.replace('@', '')}`;
      }
    }
  };

  Object.entries(socials).forEach(([red, valor]) => {
    if (valor && redesMap[red]) {
      const { icon, url } = redesMap[red];
      const finalUrl = url(valor);
      
      if (!finalUrl) return;
      
      const link = document.createElement('a');
      link.href = finalUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'social-btn';
      link.title = red.charAt(0).toUpperCase() + red.slice(1);
      link.innerHTML = `<i class="bi ${icon}"></i>`;
      socialsContainer.appendChild(link);
    }
  });
}

// ============================================
// CARGAR PRODUCTOS DEL USUARIO
// ============================================
async function cargarProductos(userId) {
  console.log('📦 Cargando productos para user_id:', userId);
  
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('producer_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error cargando productos:', error);
      throw error;
    }

    console.log(`✅ ${products?.length || 0} productos cargados`);

    allProducts = products || [];
    renderizarProductos(allProducts);

  } catch (error) {
    console.error('❌ Error en cargarProductos:', error);
  }
}

// ============================================
// VERIFICAR SI PRODUCTO ES NUEVO (< 7 DÍAS)
// ============================================
function esProductoNuevo(createdAt) {
  const now = new Date();
  const productDate = new Date(createdAt);
  const diffDays = Math.floor((now - productDate) / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

// ============================================
// RENDERIZAR PRODUCTOS
// ============================================
function renderizarProductos(products) {
  const productsGrid = document.getElementById('productsGrid');
  const productsSubtitle = document.querySelector('.products-subtitle');
  
  if (!productsGrid) return;

  if (!products || products.length === 0) {
    productsGrid.innerHTML = `
      <div class="products-empty">
        <div class="empty-icon">
          <i class="bi bi-music-note-list"></i>
        </div>
        <h3 class="empty-title">No se encontraron productos</h3>
        <p class="empty-description">
          ${currentFilter !== 'all' || currentSearchTerm ? 'Intenta con otros filtros o búsqueda.' : 'Este usuario aún no ha subido productos.'}
        </p>
      </div>
    `;
    if (productsSubtitle) {
      productsSubtitle.textContent = '0 productos';
    }
  } else {
    productsGrid.innerHTML = products.map(product => crearCardProducto(product)).join('');
    if (productsSubtitle) {
      productsSubtitle.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;
    }
  }
}

// ============================================
// CREAR CARD DE PRODUCTO CON BADGES
// ============================================
function crearCardProducto(product) {
  const precio = product.is_free 
    ? '<span style="color: #0cbc87; font-weight: 700;">GRATIS</span>' 
    : `$${parseFloat(product.price_basic || 0).toFixed(0)}`;

  const generos = product.genres && Array.isArray(product.genres) && product.genres.length > 0
    ? product.genres.slice(0, 3).map(g => 
        `<span style="background: rgba(114, 9, 183, 0.2); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: rgba(255,255,255,0.9);">${g}</span>`
      ).join(' ')
    : '';

  const imagenUrl = product.image_url && product.image_url.startsWith('http') 
    ? product.image_url 
    : 'https://ui-avatars.com/api/?name=Music&size=400&background=7209b7&color=ffffff&bold=true';

  const bpm = product.bpm || '---';
  const key = product.key || '--';

  // BADGES
  const badges = [];
  if (esProductoNuevo(product.created_at)) {
    badges.push('<span style="position: absolute; top: 0.5rem; left: 0.5rem; background: linear-gradient(135deg, #ff6b6b, #ee5a6f); color: #fff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; z-index: 10;">NUEVO</span>');
  }
  if (product.is_free) {
    badges.push('<span style="position: absolute; top: 0.5rem; right: 0.5rem; background: linear-gradient(135deg, #0cbc87, #0a9d72); color: #fff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; z-index: 10;">GRATIS</span>');
  }

  return `
    <div style="background: #1a1a1a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; transition: all 0.3s; cursor: pointer;" 
         onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(114, 9, 183, 0.4)'" 
         onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='rgba(255, 255, 255, 0.08)'"
         data-product-id="${product.id}">
      <div style="position: relative; width: 100%; padding-top: 100%; overflow: hidden; background: #000;">
        ${badges.join('')}
        <img src="${imagenUrl}" 
             alt="${product.name || 'Producto'}" 
             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
             onerror="this.src='https://ui-avatars.com/api/?name=Music&size=400&background=7209b7&color=ffffff&bold=true'">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(114, 9, 183, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;"
             class="play-overlay"
             onclick="event.stopPropagation(); reproducirAudio('${product.id}', '${product.download_url_mp3}', '${product.name}')">
          <i class="bi bi-play-fill" style="font-size: 1.5rem; color: #fff; margin-left: 3px;"></i>
        </div>
      </div>
      <div style="padding: 1rem;" onclick="window.location.href='producto.html?id=${product.id}'">
        <h3 style="font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name || 'Sin título'}</h3>
        <p style="font-size: 0.875rem; color: #999; margin-bottom: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.description || 'Sin descripción'}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <span style="font-size: 1.125rem; font-weight: 800; color: #fff;">${precio}</span>
          <span style="font-size: 0.875rem; color: #999;">${bpm} BPM • ${key}</span>
        </div>
        ${generos ? `<div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">${generos}</div>` : ''}
        <button 
          onclick="event.stopPropagation(); window.location.href='producto.html?id=${product.id}'"
          style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #7209b7, #560bad); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.875rem; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(114, 9, 183, 0.5)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
          <i class="bi bi-cart-plus"></i>
          ${product.is_free ? 'Descargar Gratis' : 'Ver Licencias'}
        </button>
      </div>
    </div>
  `;
}

// ============================================
// REPRODUCIR AUDIO (SIMPLE PLAYER)
// ============================================
window.reproducirAudio = function(productId, audioUrl, productName) {
  console.log('🎵 Reproducir:', productId, audioUrl);
  
  if (!audioUrl) {
    alert('Este producto no tiene audio preview disponible');
    return;
  }

  // Si ya está reproduciéndose, pausar
  if (currentPlayingId === productId && audioPlayer && !audioPlayer.paused) {
    audioPlayer.pause();
    currentPlayingId = null;
    actualizarIconoPlay(productId, true);
    return;
  }

  // Pausar audio anterior si existe
  if (audioPlayer) {
    audioPlayer.pause();
    if (currentPlayingId) {
      actualizarIconoPlay(currentPlayingId, true);
    }
  }

  // Crear nuevo audio
  audioPlayer = new Audio(audioUrl);
  currentPlayingId = productId;
  
  audioPlayer.addEventListener('ended', () => {
    currentPlayingId = null;
    actualizarIconoPlay(productId, true);
  });

  audioPlayer.addEventListener('error', (e) => {
    console.error('Error reproduciendo audio:', e);
    alert('Error al reproducir el audio');
    currentPlayingId = null;
    actualizarIconoPlay(productId, true);
  });

  audioPlayer.play();
  actualizarIconoPlay(productId, false);
};

function actualizarIconoPlay(productId, esPause) {
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  if (card) {
    const playOverlay = card.querySelector('.play-overlay i');
    if (playOverlay) {
      playOverlay.className = esPause ? 'bi bi-play-fill' : 'bi bi-pause-fill';
    }
  }
}

// ============================================
// FILTROS
// ============================================
function inicializarFiltros() {
  // Crear botones de filtro si no existen
  const productsHeader = document.querySelector('.products-header');
  if (!productsHeader) return;

  const existingFilters = document.querySelector('.filter-buttons');
  if (existingFilters) return;

  const filterButtons = document.createElement('div');
  filterButtons.className = 'filter-buttons';
  filterButtons.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;';
  
  filterButtons.innerHTML = `
    <button class="filter-btn active" data-filter="all" style="padding: 0.5rem 1rem; background: rgba(114, 9, 183, 0.2); border: 1px solid rgba(114, 9, 183, 0.4); border-radius: 6px; color: #fff; font-size: 0.875rem; cursor: pointer; transition: all 0.3s;">
      <i class="bi bi-grid"></i> Todos
    </button>
    <button class="filter-btn" data-filter="free" style="padding: 0.5rem 1rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 0.875rem; cursor: pointer; transition: all 0.3s;">
      <i class="bi bi-gift"></i> Gratis
    </button>
    <button class="filter-btn" data-filter="paid" style="padding: 0.5rem 1rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 0.875rem; cursor: pointer; transition: all 0.3s;">
      <i class="bi bi-tag"></i> De pago
    </button>
    <button class="filter-btn" data-filter="new" style="padding: 0.5rem 1rem; background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: rgba(255,255,255,0.7); font-size: 0.875rem; cursor: pointer; transition: all 0.3s;">
      <i class="bi bi-star"></i> Nuevos
    </button>
  `;

  productsHeader.appendChild(filterButtons);

  // Event listeners
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        b.style.color = 'rgba(255,255,255,0.7)';
      });
      
      this.classList.add('active');
      this.style.background = 'rgba(114, 9, 183, 0.2)';
      this.style.borderColor = 'rgba(114, 9, 183, 0.4)';
      this.style.color = '#fff';
      
      currentFilter = this.dataset.filter;
      aplicarFiltros();
    });
  });
}

function aplicarFiltros() {
  let productosFiltrados = [...allProducts];

  // Aplicar filtro de tipo
  if (currentFilter === 'free') {
    productosFiltrados = productosFiltrados.filter(p => p.is_free === true);
  } else if (currentFilter === 'paid') {
    productosFiltrados = productosFiltrados.filter(p => p.is_free === false);
  } else if (currentFilter === 'new') {
    productosFiltrados = productosFiltrados.filter(p => esProductoNuevo(p.created_at));
  }

  // Aplicar búsqueda
  if (currentSearchTerm) {
    productosFiltrados = productosFiltrados.filter(p => {
      const searchLower = currentSearchTerm.toLowerCase();
      return (
        (p.name && p.name.toLowerCase().includes(searchLower)) ||
        (p.description && p.description.toLowerCase().includes(searchLower)) ||
        (p.genres && p.genres.some(g => g.toLowerCase().includes(searchLower)))
      );
    });
  }

  renderizarProductos(productosFiltrados);
}

// ============================================
// BÚSQUEDA
// ============================================
function inicializarBusqueda() {
  const productsHeader = document.querySelector('.products-header');
  if (!productsHeader) return;

  const existingSearch = document.querySelector('.search-box');
  if (existingSearch) return;

  const searchBox = document.createElement('div');
  searchBox.className = 'search-box';
  searchBox.style.cssText = 'display: flex; align-items: center; background: #1a1a1a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 0 1rem; margin-bottom: 1rem; transition: all 0.3s;';
  
  searchBox.innerHTML = `
    <i class="bi bi-search" style="color: #666; margin-right: 0.5rem;"></i>
    <input type="text" id="searchInput" placeholder="Buscar productos..." style="background: none; border: none; outline: none; color: #fff; padding: 0.625rem 0; font-size: 0.875rem; flex: 1;">
  `;

  productsHeader.appendChild(searchBox);

  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    aplicarFiltros();
  });

  searchBox.addEventListener('focusin', () => {
    searchBox.style.borderColor = '#7209b7';
    searchBox.style.boxShadow = '0 0 0 3px rgba(114, 9, 183, 0.1)';
  });

  searchBox.addEventListener('focusout', () => {
    searchBox.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    searchBox.style.boxShadow = 'none';
  });
}

// ============================================
// CARGAR ESTADÍSTICAS
// ============================================
async function cargarEstadisticas(userId) {
  console.log('📊 Cargando estadísticas para user_id:', userId);
  
  try {
    const { count: productCount, error } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('producer_id', userId)
      .eq('status', 'approved');

    if (error) {
      console.error('❌ Error contando productos:', error);
    }

    const productsCountEl = document.getElementById('productsCount');
    if (productsCountEl) {
      productsCountEl.textContent = productCount || 0;
    }

    const followersCountEl = document.getElementById('followersCount');
    const followingCountEl = document.getElementById('followingCount');
    
    if (followersCountEl) followersCountEl.textContent = '0';
    if (followingCountEl) followingCountEl.textContent = '0';

  } catch (error) {
    console.error('❌ Error en cargarEstadisticas:', error);
  }
}

// ============================================
// MOSTRAR ERROR
// ============================================
function mostrarError(mensaje) {
  const container = document.querySelector('.profile-header-container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #fff; width: 100%;">
        <i class="bi bi-exclamation-triangle" style="font-size: 3rem; color: #ff4444; margin-bottom: 1rem;"></i>
        <h3 style="margin-bottom: 0.5rem;">¡Ups! Algo salió mal</h3>
        <p style="color: #999;">${mensaje}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #7209b7; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
          Reintentar
        </button>
      </div>
    `;
  }
}

// ============================================
// HOVER EFFECTS
// ============================================
document.addEventListener('mouseover', function(e) {
  const card = e.target.closest('[data-product-id]');
  if (card) {
    const playOverlay = card.querySelector('.play-overlay');
    if (playOverlay) {
      playOverlay.style.opacity = '1';
    }
  }
});

document.addEventListener('mouseout', function(e) {
  const card = e.target.closest('[data-product-id]');
  if (card) {
    const playOverlay = card.querySelector('.play-overlay');
    if (playOverlay) {
      playOverlay.style.opacity = '0';
    }
  }
});

// ============================================
// INICIALIZAR
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Iniciando carga de perfil...');
  console.log('🌐 URL actual:', window.location.href);
  cargarPerfil();
});
