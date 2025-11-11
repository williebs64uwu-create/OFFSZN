import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qtjpvztpgfymjhhpoouq.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0anB2enRwZ2Z5bWpoaHBvb3VxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3ODA5MTUsImV4cCI6MjA3NjM1NjkxNX0.YsItTFk3hSQaVuy707-z7Z-j34mXa03O0wWGAlAzjrw";
const supabase = createClient(supabaseUrl, supabaseKey);

// Variables globales
let currentProducerNickname = null;
let currentProducerId = null;
let audioElement = null;
let currentProduct = null;

// ============================================
// OBTENER ID DEL PRODUCTO
// ============================================
function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ============================================
// VOLVER AL PERFIL
// ============================================
window.volverAlPerfil = function() {
  if (currentProducerNickname) {
    window.location.href = `usuarios.html?nickname=${currentProducerNickname}`;
  } else {
    history.back();
  }
};

// ============================================
// COMPARTIR PRODUCTO
// ============================================
window.compartirProducto = function() {
  const url = window.location.href;
  const title = currentProduct ? currentProduct.name : 'Producto';
  
  if (navigator.share) {
    navigator.share({
      title: `${title} - OFFSZN`,
      url: url
    }).catch(err => console.log('Error compartiendo:', err));
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('✅ Link copiado al portapapeles!');
    });
  }
};

// ============================================
// ABRIR MENSAJE AL PRODUCTOR
// ============================================
window.abrirMensaje = function() {
  // Verificar si hay usuario logueado
  const user = supabase.auth.getUser();
  
  if (!user) {
    alert('Debes iniciar sesión para enviar mensajes');
    window.location.href = '/pages/login';
    return;
  }
  
  // Por ahora un simple prompt
  const mensaje = prompt(`Enviar mensaje al productor:\n\nProducto: ${currentProduct.name}`);
  
  if (mensaje && mensaje.trim()) {
    enviarMensaje(mensaje.trim());
  }
};

async function enviarMensaje(mensaje) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Debes iniciar sesión');
      return;
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        from_user_id: user.id,
        to_user_id: currentProducerId,
        product_id: currentProduct.id,
        subject: `Consulta sobre: ${currentProduct.name}`,
        message: mensaje
      });

    if (error) throw error;
    
    alert('✅ Mensaje enviado correctamente!');
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    alert('Error al enviar el mensaje. Intenta de nuevo.');
  }
}

// ============================================
// CARGAR PRODUCTO
// ============================================
async function cargarProducto() {
  const productId = getProductId();
  
  if (!productId) {
    alert('ID de producto no encontrado');
    window.history.back();
    return;
  }

  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    const { data: producer, error: producerError } = await supabase
      .from('users')
      .select('*')
      .eq('id', product.producer_id)
      .single();

    if (producerError) throw producerError;

    currentProducerNickname = producer.nickname;
    currentProducerId = producer.id;
    currentProduct = product;

    actualizarProductoUI(product, producer);
    inicializarAudioPlayer(product.download_url_mp3);
    cargarProductosRelacionados(product.producer_id, productId);
    cargarReviews(productId);
    
  } catch (error) {
    console.error('Error cargando producto:', error);
    alert('Error al cargar el producto');
  }
}

// ============================================
// ACTUALIZAR UI
// ============================================
function actualizarProductoUI(product, producer) {
  document.getElementById('productTitle').textContent = product.name || 'Sin título';
  
  const productImg = document.querySelector('#productImage img');
  const defaultImg = 'https://ui-avatars.com/api/?name=Music&size=400&background=7209b7&color=ffffff&bold=true';
  productImg.src = (product.image_url && product.image_url.startsWith('http')) ? product.image_url : defaultImg;
  productImg.alt = product.name;
  productImg.onerror = function() { this.src = defaultImg; };

  document.getElementById('productBpm').textContent = product.bpm || '---';
  document.getElementById('productKey').textContent = product.key || '--';
  document.getElementById('productType').textContent = product.product_type || 'Beat';
  document.getElementById('productDescription').textContent = product.description || 'Sin descripción disponible.';

  const tagsContainer = document.getElementById('productTags');
  if (product.genres && product.genres.length > 0) {
    tagsContainer.innerHTML = product.genres.map(genre => 
      `<span class="tag">${genre}</span>`
    ).join('');
  }

  const inicial = producer.first_name ? producer.first_name.charAt(0).toUpperCase() : 'U';
  const defaultAvatar = `https://ui-avatars.com/api/?name=${inicial}&size=100&background=7209b7&color=ffffff&bold=true`;
  
  const producerAvatar = document.querySelector('.producer-avatar img');
  producerAvatar.src = (producer.avatar_url && producer.avatar_url.startsWith('http')) ? producer.avatar_url : defaultAvatar;
  producerAvatar.onerror = function() { this.src = defaultAvatar; };
  
  const producerName = document.getElementById('producerName');
  producerName.textContent = `${producer.first_name || ''} ${producer.last_name || ''}`.trim() || producer.nickname;
  
  const producerLink = document.getElementById('producerLink');
  producerLink.href = `usuarios.html?nickname=${producer.nickname}`;

  cargarLicencias(product);
}

// ============================================
// AUDIO PLAYER FUNCIONAL
// ============================================
function inicializarAudioPlayer(audioUrl) {
  if (!audioUrl) {
    document.querySelector('.audio-player').innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No hay preview disponible</p>';
    return;
  }

  audioElement = new Audio(audioUrl);
  const playBtn = document.getElementById('playBtn');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const volumeBtn = document.getElementById('volumeBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeFill = document.getElementById('volumeFill');

  playBtn.disabled = false;

  playBtn.addEventListener('click', () => {
    if (audioElement.paused) {
      audioElement.play();
      playBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
    } else {
      audioElement.pause();
      playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
    }
  });

  audioElement.addEventListener('timeupdate', () => {
    const percent = (audioElement.currentTime / audioElement.duration) * 100;
    progressFill.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
  });

  audioElement.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audioElement.duration);
  });

  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioElement.currentTime = percent * audioElement.duration;
  });

  audioElement.addEventListener('ended', () => {
    playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
    progressFill.style.width = '0%';
  });

  volumeBtn.addEventListener('click', () => {
    if (audioElement.muted) {
      audioElement.muted = false;
      volumeBtn.innerHTML = '<i class="bi bi-volume-up"></i>';
      volumeFill.style.width = '100%';
    } else {
      audioElement.muted = true;
      volumeBtn.innerHTML = '<i class="bi bi-volume-mute"></i>';
      volumeFill.style.width = '0%';
    }
  });

  volumeSlider.addEventListener('click', (e) => {
    const rect = volumeSlider.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioElement.volume = percent;
    volumeFill.style.width = `${percent * 100}%`;
    audioElement.muted = false;
    volumeBtn.innerHTML = '<i class="bi bi-volume-up"></i>';
  });
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// LICENCIAS CON BOTONES DOBLES
// ============================================
function cargarLicencias(product) {
  const container = document.getElementById('licenseCards');
  const licenses = [];

  if (product.is_free) {
    licenses.push({
      id: 'free',
      name: 'Descarga Gratis',
      price: 'GRATIS',
      priceValue: 0,
      features: ['MP3 con tag', 'Uso no comercial', 'Streaming permitido'],
      isFree: true,
      downloadUrl: product.download_url_mp3
    });
  }

  if (product.price_basic && parseFloat(product.price_basic) > 0) {
    licenses.push({
      id: 'basic',
      name: 'Licencia Básica',
      price: `$${parseFloat(product.price_basic).toFixed(2)}`,
      priceValue: parseFloat(product.price_basic),
      features: ['MP3 sin tag', 'Uso comercial', 'Streaming ilimitado', '5,000 ventas'],
      isFree: false
    });
  }

  if (product.price_premium && parseFloat(product.price_premium) > 0) {
    licenses.push({
      id: 'premium',
      name: 'Licencia Premium',
      price: `$${parseFloat(product.price_premium).toFixed(2)}`,
      priceValue: parseFloat(product.price_premium),
      features: ['WAV sin tag', 'Uso comercial', 'Streaming ilimitado', '50,000 ventas'],
      isFree: false
    });
  }

  if (product.price_stems && parseFloat(product.price_stems) > 0) {
    licenses.push({
      id: 'stems',
      name: 'Stems Trackout',
      price: `$${parseFloat(product.price_stems).toFixed(2)}`,
      priceValue: parseFloat(product.price_stems),
      features: ['Todos los stems', 'Uso comercial', 'Streaming ilimitado', '100,000 ventas'],
      isFree: false
    });
  }

  if (product.price_exclusive && parseFloat(product.price_exclusive) > 0) {
    licenses.push({
      id: 'exclusive',
      name: 'Licencia Exclusiva',
      price: `$${parseFloat(product.price_exclusive).toFixed(2)}`,
      priceValue: parseFloat(product.price_exclusive),
      features: ['Derechos completos', 'Ventas ilimitadas', 'Beat removido de venta'],
      isFree: false
    });
  }

  container.innerHTML = licenses.map(license => `
    <div class="license-card ${license.isFree ? 'free' : ''}" data-license-id="${license.id}">
      <div class="license-name">${license.name}</div>
      <div class="license-price">${license.price}</div>
      <ul class="license-features">
        ${license.features.map(f => `<li><i class="bi bi-check-circle-fill"></i> ${f}</li>`).join('')}
      </ul>
      <div class="license-actions">
        ${license.isFree 
          ? `<button class="btn-license" onclick='descargarGratis("${license.downloadUrl}")'>
               <i class="bi bi-download"></i> Descargar
             </button>`
          : `<button class="btn-license" onclick='comprarAhora(${JSON.stringify(product).replace(/'/g, "&#39;")}, "${license.id}", "${license.name}", ${license.priceValue})'>
               <i class="bi bi-lightning-fill"></i> Comprar
             </button>
             <button class="btn-license-secondary" onclick='agregarAlCarrito(${JSON.stringify(product).replace(/'/g, "&#39;")}, "${license.id}", "${license.name}", ${license.priceValue})'>
               <i class="bi bi-cart-plus"></i> Al carrito
             </button>`
        }
      </div>
    </div>
  `).join('');
}

// ============================================
// REVIEWS
// ============================================
async function cargarReviews(productId) {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        users (
          first_name,
          last_name,
          nickname
        )
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reviewsList = document.getElementById('reviewsList');
    const reviewCount = document.getElementById('reviewCount');
    const avgRatingEl = document.getElementById('avgRating');

    if (!reviews || reviews.length === 0) {
      reviewsList.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Aún no hay reseñas</p>';
      reviewCount.textContent = '(0)';
      return;
    }

    // Calcular promedio
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const stars = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
    avgRatingEl.textContent = stars;
    reviewCount.textContent = `(${reviews.length})`;

    // Renderizar reviews
    reviewsList.innerHTML = reviews.map(review => {
      const userName = review.users 
        ? `${review.users.first_name || ''} ${review.users.last_name || ''}`.trim() || review.users.nickname
        : 'Usuario';
      const inicial = userName.charAt(0).toUpperCase();
      const reviewStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      
      return `
        <div class="review-item">
          <div class="review-header">
            <div class="review-author">
              <div class="review-avatar">${inicial}</div>
              <div>
                <div style="font-weight: 600; color: #fff;">${userName}</div>
                <div style="color: #ffc107; font-size: 0.875rem;">${reviewStars}</div>
              </div>
            </div>
            <span style="color: #999; font-size: 0.875rem;">${new Date(review.created_at).toLocaleDateString()}</span>
          </div>
          <div class="review-text">${review.comment}</div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error cargando reviews:', error);
  }
}

// ============================================
// PRODUCTOS RELACIONADOS
// ============================================
async function cargarProductosRelacionados(producerId, currentProductId) {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('producer_id', producerId)
      .eq('status', 'approved')
      .neq('id', currentProductId)
      .limit(4);

    if (error) throw error;

    const relatedGrid = document.getElementById('relatedGrid');
    const relatedSection = document.getElementById('relatedSection');

    if (!products || products.length === 0) {
      relatedSection.style.display = 'none';
      return;
    }

    relatedGrid.innerHTML = products.map(p => {
      const img = p.image_url && p.image_url.startsWith('http') ? p.image_url : 'https://ui-avatars.com/api/?name=Music&size=400&background=7209b7&color=ffffff&bold=true';
      const price = p.is_free ? 'GRATIS' : `$${parseFloat(p.price_basic || 0).toFixed(0)}`;
      
      return `
        <div class="related-card" onclick="window.location.href='producto.html?id=${p.id}'">
          <div class="related-image">
            <img src="${img}" alt="${p.name}">
          </div>
          <div class="related-info">
            <div class="related-title">${p.name}</div>
            <div class="related-price">${price}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error cargando relacionados:', error);
  }
}

// ============================================
// DESCARGAR GRATIS
// ============================================
window.descargarGratis = function(url) {
  if (url) {
    window.open(url, '_blank');
  } else {
    alert('URL de descarga no disponible');
  }
};

// ============================================
// COMPRAR AHORA (CHECKOUT DIRECTO)
// ============================================
window.comprarAhora = function(product, licenseId, licenseName, price) {
  // Por ahora redirige a carrito, después implementaremos checkout directo
  agregarAlCarrito(product, licenseId, licenseName, price);
  setTimeout(() => {
    window.location.href = 'carrito.html';
  }, 500);
};

// ============================================
// AGREGAR AL CARRITO
// ============================================
window.agregarAlCarrito = function(product, licenseId, licenseName, price) {
  let cart = JSON.parse(localStorage.getItem('offszn_cart') || '[]');
  
  const cartItem = {
    id: `${product.id}_${licenseId}`,
    productId: product.id,
    productName: product.name,
    productImage: product.image_url,
    licenseId: licenseId,
    licenseName: licenseName,
    price: price,
    producerName: document.getElementById('producerName').textContent,
    addedAt: new Date().toISOString()
  };
  
  const existingIndex = cart.findIndex(item => item.id === cartItem.id);
  
  if (existingIndex >= 0) {
    alert('Este producto con esta licencia ya está en tu carrito');
    return;
  }
  
  cart.push(cartItem);
  localStorage.setItem('offszn_cart', JSON.stringify(cart));
  
  alert(`✅ "${licenseName}" agregada al carrito!\n\nProducto: ${product.name}\nPrecio: $${price.toFixed(2)}`);
  
  actualizarContadorCarrito();
};

function actualizarContadorCarrito() {
  const cart = JSON.parse(localStorage.getItem('offszn_cart') || '[]');
  const cartBadge = document.querySelector('.cart-count');
  if (cartBadge) {
    cartBadge.textContent = cart.length;
    cartBadge.style.display = cart.length > 0 ? 'block' : 'none';
  }
}

// ============================================
// INICIALIZAR
// ============================================
document.addEventListener('DOMContentLoaded', cargarProducto);
