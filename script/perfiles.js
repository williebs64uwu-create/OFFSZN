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
  console.log('📌 Nickname desde URL:', nickname);
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
    alert('Error al cargar el perfil: ' + error.message);
  }
}

// ============================================
// ACTUALIZAR HEADER DEL PERFIL
// ============================================
function actualizarHeaderPerfil(user) {
  console.log('🎨 Actualizando header con datos:', user);

  // Avatar - Actualizar imagen
  const avatarImg = document.querySelector('.profile-avatar img');
  if (avatarImg) {
    const avatarUrl = user.avatar_url || `https://via.placeholder.com/400x400/7209b7/ffffff?text=${user.first_name?.charAt(0) || 'U'}`;
    console.log('🖼️ Avatar URL:', avatarUrl);
    
    avatarImg.src = avatarUrl;
    avatarImg.alt = user.nickname;
    avatarImg.onerror = function() {
      console.warn('⚠️ Error cargando avatar, usando placeholder');
      this.src = `https://via.placeholder.com/400x400/7209b7/ffffff?text=${user.first_name?.charAt(0) || 'U'}`;
    };
  }

  // Username - Actualizar nombre completo
  const usernameEl = document.querySelector('.profile-username');
  if (usernameEl) {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toUpperCase();
    const verifiedBadge = user.is_verified ? '<span class="verified-badge"><i class="bi bi-check-lg"></i></span>' : '';
    usernameEl.innerHTML = `${fullName} ${verifiedBadge}`;
    console.log('👤 Username actualizado:', fullName);
  }

  // Role - Actualizar rol
  const roleEl = document.querySelector('.profile-role');
  if (roleEl) {
    roleEl.textContent = `${user.role || 'Usuario'} • Lima, Perú`;
    console.log('💼 Role actualizado:', user.role);
  }

  // Sidebar - Username (@nickname)
  const sidebarContent = document.querySelectorAll('.sidebar-content');
  if (sidebarContent[0]) {
    sidebarContent[0].innerHTML = `<p>@${user.nickname}</p>`;
  }

  // Sidebar - Bio/Role
  if (sidebarContent[1]) {
    if (user.bio && user.bio.trim() !== '') {
      sidebarContent[1].innerHTML = `<p>${user.bio}</p>`;
    } else {
      sidebarContent[1].innerHTML = '<p class="empty-state">Sin biografía</p>';
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

  if (!socials || Object.keys(socials).length === 0) {
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
        return `https://tiktok.com/${handle.replace('@', '')}`;
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
  const precio = product.is_free 
    ? '<span style="color: #0cbc87; font-weight: 700;">GRATIS</span>' 
    : `${parseFloat(product.price_basic || 0).toFixed(0)}`;

  const generos = product.genres && product.genres.length > 0
    ? product.genres.slice(0, 3).map(g => `<span style="background: rgba(114, 9, 183, 0.2); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: rgba(255,255,255,0.9);">${g}</span>`).join(' ')
    : '<span style="color: #666; font-size: 0.75rem;">Sin géneros</span>';

  return `
    <div style="background: #1a1a1a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow: hidden; transition: all 0.3s; cursor: pointer;" 
         onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(114, 9, 183, 0.4)'" 
         onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='rgba(255, 255, 255, 0.08)'"
         data-product-id="${product.id}">
      <div style="position: relative; width: 100%; padding-top: 100%; overflow: hidden; background: #000;">
        <img src="${product.image_url}" 
             alt="${product.name}" 
             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
             onerror="this.src='https://via.placeholder.com/400x400/7209b7/ffffff?text=🎵'">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(114, 9, 183, 0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;"
             onmouseover="this.style.opacity='1'"
             onmouseout="this.style.opacity='0'">
          <i class="bi bi-play-fill" style="font-size: 1.5rem; color: #fff; margin-left: 3px;"></i>
        </div>
      </div>
      <div style="padding: 1rem;">
        <h3 style="font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name}</h3>
        <p style="font-size: 0.875rem; color: #999; margin-bottom: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.description || 'Sin descripción'}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <span style="font-size: 1.125rem; font-weight: 800; color: #fff;">${precio}</span>
          <span style="font-size: 0.875rem; color: #999;">${product.bpm} BPM • ${product.key}</span>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${generos}
        </div>
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
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Iniciando carga de perfil...');
  console.log('🌍 URL actual:', window.location.href);
  cargarPerfil();
});
