// script/share-modal.js
(function () {
    const cleanName = (name) => {
        if (!name) return 'Sin título';
        return name
            .replace(/_/g, ' ')
            .replace(/\.(mp3|wav|zip|rar)$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    window.openShareModal = function (product) {
        if (!product) return;

        let backdrop = document.getElementById('share-modal-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'share-modal-backdrop';
            backdrop.className = 'share-modal-backdrop';
            backdrop.onclick = function (e) {
                if (e.target === backdrop) window.closeShareModal();
            };
            document.body.appendChild(backdrop);
        }

        const displayName = cleanName(product.name);
        let shortLink = window.location.href;
        // Generate actual link for the product instead of relying on current page url in case we are on explore
        if (window.createSeoLink) {
            shortLink = window.location.origin + window.createSeoLink(product);
        } else if (window.IdObfuscator) {
            const code = window.IdObfuscator.encodeId(product.id);
            if (code) shortLink = `${window.location.origin}/p/${code}`;
        }

        const shareText = `Escucha "${displayName}" en OFFSZN 🔥`;
        const encodedLink = encodeURIComponent(shortLink);
        const encodedText = encodeURIComponent(shareText);
        const safeLink = shortLink.replace(/'/g, '%27');

        const socials = [
            { name: 'Twitter', icon: 'bi-twitter-x', url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedLink}` },
            { name: 'WhatsApp', icon: 'bi-whatsapp', url: `https://api.whatsapp.com/send?text=${encodedText}%20${encodedLink}` },
            { name: 'Facebook', icon: 'bi-facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}` }
        ];

        // Resolve Producer Data
        let pData = product.artist_users || product.producer || product.producer_data || {};
        if (Array.isArray(pData)) pData = pData[0];
        const producerName = pData?.nickname || pData?.name || product.producer_nickname || product.producer_name || product.artist_name || 'Productor';

        const coverImgSrc = product.image_url || '/images/portada-default.png';

        backdrop.innerHTML = `
            <div class="share-modal-content">
                <div class="modal-pull-bar"></div>
                <button class="share-modal-close-btn" onclick="window.closeShareModal()">&times;</button>

                <div style="text-align:center; padding: 15px 15px 20px;">
                    <img id="share-modal-cover" src="/images/portada-default.png" style="width:140px; height:140px; border-radius:12px; object-fit:cover; border:1px solid rgba(255,255,255,0.1); margin:0 auto 20px; display:block;">
                    <div style="font-size:1.15rem; font-weight:800; color:#fff; margin-bottom:6px; line-height: 1.4; word-break: break-word;">${displayName}</div>
                    <div style="font-size:0.9rem; color:#888; margin-bottom:28px;">${producerName}</div>

                    <div class="share-social-row" style="margin-bottom:28px; justify-content:center; gap:20px;">
                        ${socials.map(s => `
                            <a href="${s.url}" target="_blank" class="social-share-item">
                                <div class="social-icon-circle"><i class="bi ${s.icon}"></i></div>
                            </a>
                        `).join('')}
                    </div>

                    <div class="share-input-wrapper-v2">
                        <input type="text" value="${shortLink}" readonly id="link-short-share">
                        <button onclick="window.copyToClipboardShare('${safeLink}', this)">
                            <i class="bi bi-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Resolve Image URL
        if (window.getAuthorizedUrl && coverImgSrc.startsWith('http')) {
            window.getAuthorizedUrl(coverImgSrc).then(url => {
                const imgEl = document.getElementById('share-modal-cover');
                if (imgEl && url) imgEl.src = url;
            });
        } else {
            const imgEl = document.getElementById('share-modal-cover');
            if (imgEl) imgEl.src = coverImgSrc;
        }

        backdrop.style.display = 'flex';
        setTimeout(() => {
            backdrop.classList.add('active');
        }, 10);
    };

    window.closeShareModal = function () {
        const backdrop = document.getElementById('share-modal-backdrop');
        if (backdrop) {
            backdrop.classList.add('closing');
            backdrop.classList.remove('active');
            setTimeout(() => {
                backdrop.style.display = 'none';
                backdrop.classList.remove('closing');
            }, 350);
        }
    };

    window.copyToClipboardShare = function (text, btn) {
        return navigator.clipboard.writeText(text).then(() => {
            if (btn) {
                const icon = btn.querySelector('i') || btn;
                const originalClass = icon.className;
                icon.className = 'bi bi-check-lg';
                icon.style.color = '#4bff8f';
                icon.style.transition = 'all 0.2s ease';
                btn.style.pointerEvents = 'none';
                setTimeout(() => {
                    icon.className = originalClass;
                    icon.style.color = '';
                    btn.style.pointerEvents = '';
                }, 2000);
            }
        });
    };
})();
