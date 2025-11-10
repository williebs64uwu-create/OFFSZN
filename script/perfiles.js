import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ============================================
// CONFIGURACIÓN DE SUPABASE
// ============================================
const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔌 Supabase conectado correctamente');

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
    // Obtener datos del usuario
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
      document.querySelector('.profile-header-container').innerHTML = 
        '<p style="color: red; text-align: center; padding: 2rem;">❌ Usuario no encontrado</p>';
      return;
    }

    console.log('✅ Usuario cargado correctamente:', user);

    // Actualizar el DOM con los datos del usuario
    actualizarHeaderPerfil(user);
    
    // Cargar productos del usuario
    await cargarProductos(user.id);
    
    // Cargar estadísticas
    await cargarEstadisticas(user.id);

  } catch (error) {
    console.error('❌ Error cargando perfil:', error);
    mostrarError('Error al cargar el perfil. Por favor, intenta de nuevo.');
  }
}

// ============================================
// MOSTRAR ERROR
// ============================================
function mostrarError(mensaje) {
  const container = document.querySelector('.profile-header-container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #fff;">
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
// FUNCIÓN PARA GENERAR AVATAR PLACEHOLDER
// ============================================
function getAvatarPlaceholder(user) {
  const inicial = user.first_name ? user.first_name.charAt(0).toUpperCase() : 
                  user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U';
  return `https://ui-avatars.com/api/?name=${inicial}&size=400&background=7209b7&color=ffffff&bold=true`;
}

// ============================================
// ACTUALIZAR HEADER DEL PERFIL
// ============================================
function actualizarHeaderPerfil(user) {
  console.log('🎨 Actualizando header con datos:', user);

  // Avatar - Manejar correctamente la URL
  const avatarImg = document.querySelector('.profile-avatar img');
  if (avatarImg) {
    const placeholder = getAvatarPlaceholder(user);
    
    // Si hay avatar_url Y es una URL válida
    if (user.avatar_url && user.avatar_url.startsWith('http')) {
      console.log('🖼️ Avatar URL válida:', user.avatar_url);
      avatarImg.src = user.avatar_url;
    } else {
      console.log('🖼️ Usando avatar placeholder');
      avatarImg.src = placeholder;
    }
    
    avatarImg.alt = user.nickname || 'Usuario';
    
    // Fallback si falla la carga
    avatarImg.onerror = function() {
      console.warn('⚠️ Error cargando avatar, usando placeholder');
      this.src = placeholder;
      this.onerror = null; // Prevenir loop infinito
    };
  }

  // Username - Actualizar nombre completo
  const usernameEl = document.querySelector('.profile-username');
  if (usernameEl) {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || user.nickname || 'Usuario';
    const verifiedBadge = user.is_verified ? '<span class="verified-badge"><i class="bi bi-check-lg"></i></span>' : '';
    usernameEl.innerHTML = `${fullName.toUpperCase()} ${verifiedBadge}`;
    console.log('👤 Username actualizado:', fullName);
  }

  // Role - Actualizar rol
  const roleEl = document.querySelector('.profile-role');
  if (roleEl) {
    const role = user.role || 'Usuario';
    roleEl.textContent = `${role} • Lima, Perú`;
    console.log('💼 Role actualizado:', role);
  }

  // Sidebar - Username (@nickname)
  const sidebarContent = document.querySelectorAll('.sidebar-content');
  if (sidebarContent[0]) {
    const nickname = user.nickname || 'usuario';
    sidebarContent[0].innerHTML = `<p>@${nickname}</p>`;
  }

  // Sidebar - Bio/Role
  if (sidebarContent[1]) {
    const bio = user.bio && user.bio.trim() !== '' ? user.bio : user.role || 'Usuario de OFFSZN';
    // Si la bio está vacía, mostrar estado vacío
    if (!user.bio || user.bio.trim() === '') {
      sidebarContent[1].innerHTML = `<p class="empty-state">(bio)</p>`;
    } else {
      sidebarContent[1].innerHTML = `<p>${bio}</p>`;
    }
  }

  // Redes sociales
  console.log('🌐 Redes sociales:', user.socials);
  actualizarRedesSociales(user.socials);
}

// ============================================
// ACTUALIZAR REDES SOCIALES
// ============================================
function actualizarRedesSociales(socials) {
  const socialsContainer = document.querySelector('.profile-socials');
  if (!socialsContainer) {
    console.warn('⚠️ No se encontró el contenedor de redes sociales');
    return;
  }

  // Limpiar redes existentes
  socialsContainer.innerHTML = '';

  if (!socials || typeof socials !== 'object' || Object.keys(socials).length === 0) {
    console.warn('⚠️ No hay redes sociales configuradas');
    return;
  }

  console.log('🔗 Procesando redes sociales:', socials);

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
    discord: { 
      icon: 'bi-discord', 
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
      
      console.log(`✅ Agregando red: ${red} -> ${finalUrl}`);
      
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

    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) {
      console.warn('⚠️ No se encontró el grid de productos');
      return;
    }

    if (!products || products.length === 0) {
      productsGrid.innerHTML = `
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
    } else {
      productsGrid.innerHTML = products.map(product => crearCardProducto(product)).join('');
    }

  } catch (error) {
    console.error('❌ Error en cargarProductos:', error);
  }
}

// ============================================
// CREAR CARD DE PRODUCTO
// ============================================
function crearCardProducto(product) {
  // Precio formateado
  const precio = product.is_free 
    ? '<span style="color: #0cbc87; font-weight: 700;">GRATIS</span>' 
    : `$${parseFloat(product.price_basic || 0).toFixed(0)}`;

  // Géneros limitados a 3
  const generos = product.genres && Array.isArray(product.genres) && product.genres.length > 0
    ? product.genres.slice(0, 3).map(g => 
        `<span style="background: rgba(114, 9, 183, 0.2); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: rgba(255,255,255,0.9);">${g}</span>`
      ).join(' ')
    : '<span style="color: #666; font-size: 0.75rem;">Sin géneros</span>';

  // Imagen con fallback
  const imagenUrl = product.image_url && product.image_url.startsWith('http') 
    ? product.image_url 
    : 'https://ui-avatars.com/api/?name=Music&size=400&background=7209b7&color=ffffff&bold=true';

  // BPM y Key con valores por defecto
  const bpm = product.bpm || '---';
  const key = product.key || '--';

  return `
    <div style="background: #1a1a1a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; transition: all 0.3s; cursor: pointer;" 
         onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(114, 9, 183, 0.4)'" 
         onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='rgba(255, 255, 255, 0.08)'"
         onclick="window.location.href='producto.html?id=${product.id}'"
         data-product-id="${product.id}">
      <div style="position: relative; width: 100%; padding-top: 100%; overflow: hidden; background: #000;">
        <img src="${imagenUrl}" 
             alt="${product.name || 'Producto'}" 
             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
             onerror="this.src='https://ui-avatars.com/api/?name=Music&size=400&background=7209b7&color=ffffff&bold=true'">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(114, 9, 183, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;"
             class="play-overlay">
          <i class="bi bi-play-fill" style="font-size: 1.5rem; color: #fff; margin-left: 3px;"></i>
        </div>
      </div>
      <div style="padding: 1rem;">
        <h3 style="font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name || 'Sin título'}</h3>
        <p style="font-size: 0.875rem; color: #999; margin-bottom: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.description || 'Sin descripción'}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <span style="font-size: 1.125rem; font-weight: 800; color: #fff;">${precio}</span>
          <span style="font-size: 0.875rem; color: #999;">${bpm} BPM • ${key}</span>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
          ${generos}
        </div>
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
// CARGAR ESTADÍSTICAS
// ============================================
async function cargarEstadisticas(userId) {
  console.log('📊 Cargando estadísticas para user_id:', userId);
  
  try {
    // Contar productos
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
      console.log('✅ Productos contados:', productCount);
    }

    // TODO: Implementar contadores de seguidores cuando tengas esas tablas
    const followersCountEl = document.getElementById('followersCount');
    const followingCountEl = document.getElementById('followingCount');
    
    if (followersCountEl) followersCountEl.textContent = '0';
    if (followingCountEl) followingCountEl.textContent = '0';

  } catch (error) {
    console.error('❌ Error en cargarEstadisticas:', error);
  }
}

// ============================================
// AGREGAR HOVER EFFECT PARA PLAY BUTTON
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
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Iniciando carga de perfil...');
  console.log('🌐 URL actual:', window.location.href);
  cargarPerfil();
});
