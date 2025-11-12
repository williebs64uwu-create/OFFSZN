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
    }).then(() => {
      window.toast.success('¡Producto compartido!');
    }).catch(err => {
      if (err.name !== 'AbortError') {
        console.log('Error compartiendo:', err);
      }
    });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      window.toast.success('Link copiado al portapapeles');
    }).catch(() => {
      window.toast.error('Error al copiar el link');
    });
  }
};

// ============================================
// ABRIR MENSAJE AL PRODUCTOR
// ============================================
window.abrirMensaje = async function() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      window.toast.warning('Debes iniciar sesión para enviar mensajes');
      setTimeout(() => {
        window.location.href = '/pages/login';
      }, 1500);
      return;
    }
    
    const mensaje = await crearModalMensaje();
    
    if (mensaje && mensaje.trim()) {
      await enviarMensaje(mensaje.trim(), user);
    }
  } catch (error) {
    console.error('Error:', error);
    window.toast.error('Error al abrir el formulario de mensaje');
  }
};

async function crearModalMensaje() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
      border: 1px solid rgba(114, 9, 183, 0.3);
      border-radius: 16px;
      padding: 2rem;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    `;

    modal.innerHTML = `
      <h3 style="color: #fff; margin-bottom: 1rem; font-size: 1.25rem;">
        Enviar mensaje a ${currentProduct ? currentProduct.name : 'productor'}
      </h3>
      <textarea 
        id="mensajeTextarea" 
        placeholder="Escribe tu mensaje aquí..."
        style="width: 100%; min-height: 120px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; color: #fff; font-family: inherit; resize: vertical; margin-bottom: 1rem;"
      ></textarea>
      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button id="cancelBtn" style="padding: 0.75rem 1.5rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; cursor: pointer;">
          Cancelar
        </button>
        <button id="sendBtn" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #7209b7, #560bad); border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer;">
          Enviar mensaje
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const textarea = modal.querySelector('#mensajeTextarea');
    textarea.focus();

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    modal.querySelector('#sendBtn').addEventListener('click', () => {
      close(textarea.value);
    });

    modal.querySelector('#cancelBtn').addEventListener('click', () => {
      close(null);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

async function enviarMensaje(mensaje, user) {
  const loading = window.toast.loading('Enviando mensaje...');
  
  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        from_user_id: user.id,
        to_user_id: currentProducerId,
        product_id: currentProduct.id,
        subject: `Consulta sobre: ${currentProduct.name}`,
        message: mensaje
      });

    loading.remove();

    if (error) throw error;
    
    window.toast.success('¡Mensaje enviado correctamente!');
  } catch (error) {
    loading.remove();
    console.error('Error enviando mensaje:', error);
    window.toast.error('Error al enviar el mensaje');
  }
}

// ============================================
// CARGAR PRODUCTO
// ============================================
async function cargarProducto() {
  const productId = getProductId();
  
  if (!productId) {
    window.toast.error('ID de producto no encontrado');
    setTimeout(() => window.history.back(), 1500);
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
    window.toast.error('Error al cargar el producto');
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
// AUDIO PLAYER CON WAVEFORM
// ============================================
function inicializarAudioPlayer(audioUrl) {
  if (!audioUrl) {
    document.querySelector('.audio-player-enhanced').innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No hay preview disponible</p>';
    return;
  }

  audioElement = new Audio(audioUrl);
  const playBtn = document.getElementById('playBtn');
  const waveformContainer = document.getElementById('waveformContainer');
  const progressOverlay = document.getElementById('progressOverlay');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const volumeBtn = document.getElementById('volumeBtn');

  playBtn.disabled = false;

  dibujarWaveform();

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
    progressOverlay.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
  });

  audioElement.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(audioElement.duration);
  });

  waveformContainer.addEventListener('click', (e) => {
    const rect = waveformContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioElement.currentTime = percent * audioElement.duration;
  });

  audioElement.addEventListener('ended', () => {
    playBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
    progressOverlay.style.width = '0%';
  });

  volumeBtn.addEventListener('click', () => {
    if (audioElement.muted) {
      audioElement.muted = false;
      volumeBtn.innerHTML = '<i class="bi bi-volume-up"></i>';
    } else {
      audioElement.muted = true;
      volumeBtn.innerHTML = '<i class="bi bi-volume-mute"></i>';
    }
  });
}

function dibujarWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);
  
  const barCount = 100;
  const barWidth = width / barCount;
  
  ctx.fillStyle = 'rgba(114, 9, 183, 0.3)';
  
  for (let i = 0; i < barCount; i++) {
    const barHeight = Math.random() * height * 0.8 + height * 0.1;
    const x = i * barWidth;
    const y = (height - barHeight) / 2;
    
    ctx.fillRect(x, y, barWidth - 2, barHeight);
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// LICENCIAS
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

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const stars = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
    avgRatingEl.textContent = stars;
    reviewCount.textContent = `(${reviews.length})`;

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
// 📧 DESCARGAR GRATIS CON CAPTURA DE EMAIL
// ============================================
window.descargarGratis = async function(url) {
  if (!url) {
    window.toast.error('URL de descarga no disponible');
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Usuario logueado
      await enviarEmailDescargaGratis(user.email, user);
      iniciarDescarga(url);
    } else {
      // Usuario NO logueado: Pedir email
      const email = await mostrarModalEmail();
      
      if (email && validarEmail(email)) {
        await enviarEmailDescargaGratis(email, null);
        iniciarDescarga(url);
      }
    }
  } catch (error) {
    console.error('Error en descarga gratis:', error);
    window.toast.error('Error al procesar la descarga');
  }
};

// ============================================
// MODAL PARA CAPTURAR EMAIL
// ============================================
function mostrarModalEmail() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'email-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'email-modal';

    modal.innerHTML = `
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .email-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }
        
        .email-modal {
          background: linear-gradient(135deg, #1a1a1a, #0a0a0a);
          border: 2px solid rgba(114, 9, 183, 0.5);
          border-radius: 24px;
          padding: 3rem;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 30px 100px rgba(114, 9, 183, 0.4);
          animation: slideUp 0.3s ease;
        }
        
        .modal-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 1.5rem;
          background: linear-gradient(135deg, #7209b7, #560bad);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 40px rgba(114, 9, 183, 0.5);
          animation: pulse 2s ease-in-out infinite;
        }
        
        .modal-title {
          color: #fff;
          font-size: 1.75rem;
          font-weight: 900;
          margin-bottom: 0.75rem;
          font-family: 'Montserrat', sans-serif;
          text-align: center;
        }
        
        .modal-subtitle {
          color: #999;
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: 2rem;
          text-align: center;
        }
        
        .modal-input {
          width: 100%;
          padding: 1.125rem 1.25rem;
          background: rgba(0,0,0,0.5);
          border: 2px solid rgba(114, 9, 183, 0.3);
          border-radius: 12px;
          color: #fff;
          font-size: 1.0625rem;
          margin-bottom: 1.5rem;
          outline: none;
          transition: all 0.3s;
          font-family: inherit;
        }
        
        .modal-input:focus {
          border-color: #7209b7;
          box-shadow: 0 0 0 4px rgba(114, 9, 183, 0.1);
        }
        
        .modal-buttons {
          display: flex;
          gap: 1rem;
        }
        
        .modal-btn {
          flex: 1;
          padding: 1rem;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9375rem;
          cursor: pointer;
          transition: all 0.3s;
          font-family: inherit;
          border: none;
        }
        
        .modal-btn-cancel {
          background: transparent;
          border: 2px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.7);
        }
        
        .modal-btn-cancel:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.3);
          color: #fff;
        }
        
        .modal-btn-download {
          flex: 2;
          background: linear-gradient(135deg, #7209b7, #560bad);
          color: #fff;
          box-shadow: 0 4px 20px rgba(114, 9, 183, 0.4);
        }
        
        .modal-btn-download:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(114, 9, 183, 0.6);
        }
        
        .modal-footer {
          color: #666;
          font-size: 0.8125rem;
          text-align: center;
          margin-top: 1.5rem;
          line-height: 1.4;
        }
      </style>
      
      <div class="modal-icon">
        <i class="bi bi-download" style="font-size: 2.5rem; color: #fff;"></i>
      </div>
      
      <h3 class="modal-title">¡Descarga Gratis!</h3>
      <p class="modal-subtitle">
        Ingresa tu email y recibe el link<br>de descarga al instante
      </p>
      
      <input 
        type="email" 
        id="emailInput" 
        class="modal-input"
        placeholder="tu@email.com"
        autocomplete="email"
      />
      
      <div class="modal-buttons">
        <button id="cancelBtn" class="modal-btn modal-btn-cancel">
          Cancelar
        </button>
        <button id="downloadBtn" class="modal-btn modal-btn-download">
          <i class="bi bi-download"></i> Descargar Ahora
        </button>
      </div>
      
      <p class="modal-footer">
        <i class="bi bi-shield-check" style="color: #0cbc87;"></i>
        Sin spam. Solo el link de descarga.
      </p>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const emailInput = modal.querySelector('#emailInput');
    const downloadBtn = modal.querySelector('#downloadBtn');
    const cancelBtn = modal.querySelector('#cancelBtn');

    emailInput.focus();

    const close = (result) => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    downloadBtn.addEventListener('click', () => {
      const email = emailInput.value.trim();
      if (!email) {
        window.toast.warning('Por favor ingresa tu email');
        emailInput.focus();
        emailInput.style.borderColor = '#ff6b6b';
        setTimeout(() => {
          emailInput.style.borderColor = 'rgba(114, 9, 183, 0.3)';
        }, 1500);
        return;
      }
      if (!validarEmail(email)) {
        window.toast.error('Email inválido');
        emailInput.focus();
        emailInput.style.borderColor = '#ff6b6b';
        setTimeout(() => {
          emailInput.style.borderColor = 'rgba(114, 9, 183, 0.3)';
        }, 1500);
        return;
      }
      close(email);
    });

    cancelBtn.addEventListener('click', () => {
      close(null);
    });

    emailInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        downloadBtn.click();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
  });
}

// ============================================
// VALIDAR EMAIL
// ============================================
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ============================================
// ENVIAR EMAIL DE DESCARGA GRATIS
// ============================================
async function enviarEmailDescargaGratis(email, user) {
  try {
    const { enviarEmailDescargaGratis: sendEmail } = await import('./email-service.js');
    
    const userName = user 
      ? (user.user_metadata?.full_name || 
         `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
         email.split('@')[0])
      : email.split('@')[0];
    
    const emailData = {
      userEmail: email,
      userName: userName,
      productName: currentProduct.name,
      producerName: document.getElementById('producerName').textContent,
      downloadUrl: currentProduct.download_url_mp3
    };

    console.log('📧 Enviando email de descarga gratis...', emailData);
    
    const result = await sendEmail(emailData);
    
    if (result.success) {
      console.log('✅ Email enviado correctamente');
      window.toast.success('¡Email enviado! Revisa tu bandeja de entrada');
    } else {
      console.warn('⚠️ Email no enviado:', result.error);
      window.toast.warning('Descarga iniciada (email no enviado)');
    }

  } catch (error) {
    console.warn('⚠️ Error al enviar email (no crítico):', error);
    window.toast.warning('Descarga iniciada');
  }
}

// ============================================
// INICIAR DESCARGA
// ============================================
function iniciarDescarga(url) {
  window.open(url, '_blank');
  
  // Animación de éxito
  const successMsg = document.createElement('div');
  successMsg.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    background: linear-gradient(135deg, #0cbc87, #0a9d72);
    color: #fff;
    padding: 2rem 3rem;
    border-radius: 16px;
    font-size: 1.25rem;
    font-weight: 700;
    z-index: 10001;
    box-shadow: 0 20px 60px rgba(12, 188, 135, 0.5);
    opacity: 0;
    transition: all 0.3s ease;
  `;
  
  successMsg.innerHTML = `
    <i class="bi bi-check-circle-fill"></i> ¡Descarga iniciada!
  `;
  
  document.body.appendChild(successMsg);
  
  // Animar entrada
  setTimeout(() => {
    successMsg.style.opacity = '1';
    successMsg.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 10);
  
  // Animar salida
  setTimeout(() => {
    successMsg.style.opacity = '0';
    successMsg.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => successMsg.remove(), 300);
  }, 2000);
}

// ============================================
// COMPRAR AHORA
// ============================================
window.comprarAhora = function(product, licenseId, licenseName, price) {
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
    window.toast.warning('Este producto ya está en tu carrito');
    return;
  }
  
  cart.push(cartItem);
  localStorage.setItem('offszn_cart', JSON.stringify(cart));
  
  window.toast.success(`"${licenseName}" agregada al carrito`);
  
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
document.addEventListener('DOMContentLoaded', () => {
  cargarProducto();
  actualizarContadorCarrito();
});

console.log('✅ producto.js cargado correctamente');
