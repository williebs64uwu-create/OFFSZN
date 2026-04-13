# Lógica Completa de BD para Feed (Bulk Sync) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Obtener el estado real de interacciones del usuario (Likes, Follows, Bienvenidas previas) en lote ("bulk") desde Supabase al iniciar el feed, procesarlas en memoria para pintar la UI correcta y conectar las interacciones reales a la BD usando TDD.
**Architecture:** Bulk Promise.all fetching para hidratar el estado global `window.FeedState` antes de que se inicie el renderizado de la vista de Comunidad. Supabase JS Client Mutation para escrituras atómicas.
**Tech Stack:** Vanilla JavaScript, Supabase, DOM Manipulation
---

### Task 1: Hidratación Síncrona de Estados (Bulk Load)

**Files:**
- Modify `c:/Users/Willie/Desktop/OFFSZN/script/feed.js`

- [ ] **Step 1: Write the failing test**
`Obtener un error o log undefined si consultamos window.FeedState.likes antes de inicializar la app.`

- [ ] **Step 2: Run test to verify it fails**
`console.log(window.FeedState)` Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
```javascript
// Añadir a feed.js antes de fetch de actividades
window.FeedState = { likes: new Set(), follows: new Set(), welcomes: new Set() };

async function loadUserFeedState() {
    const user = AuthUtils.getSession()?.user;
    if (!user) return; // Si es invitado, no hay estado

    try {
        const [likesRes, followsRes, welcomesRes] = await Promise.all([
            window.supabaseClient.from('likes').select('target_id').eq('user_id', user.id),
            window.supabaseClient.from('followers').select('user_id').eq('follower_id', user.id),
            window.supabaseClient.from('notifications').select('user_id').eq('actor_id', user.id).eq('type', 'welcome')
        ]);

        if (likesRes.data) likesRes.data.forEach(l => window.FeedState.likes.add(String(l.target_id)));
        if (followsRes.data) followsRes.data.forEach(f => window.FeedState.follows.add(String(f.user_id)));
        if (welcomesRes.data) welcomesRes.data.forEach(w => window.FeedState.welcomes.add(String(w.user_id)));
    } catch (e) {
        console.error("Error loading feed states", e);
    }
}
// Llamar a loadUserFeedState() con await dentro de un bloque async initFeed() antes de iterar y renderizar las tarjetas.
```

- [ ] **Step 4: Run test to verify it passes**
`console.log(window.FeedState.likes)` Expected: PASS (Debe retornar un Set con los targets)

- [ ] **Step 5: Commit**
`git commit -m "feat(feed): implement bulk state loader for interactions"`

---

### Task 2: Sincronización Declarativa de Interfaz (Initial Render)

**Files:**
- Modify `c:/Users/Willie/Desktop/OFFSZN/script/feed.js`

- [ ] **Step 1: Write the failing test**
`A pesar de estar en FeedState, la tarjeta del render sigue apareciendo sin el like relleno.`

- [ ] **Step 2: Run test to verify it fails**
`Ver el UI en localhost:3000/comunidad/feed` Expected: FAIL (El corazón siempre está Outline).

- [ ] **Step 3: Write minimal implementation**
```javascript
// En createActivityCard, al detectar un state mapeado, renderizar condicionalmente las clases DOM:

// Like
const isLiked = window.FeedState.likes.has(String(activity.target_id));
// Replace heart icon classes directly inside contentHtml or dynamically.
const likeClass = isLiked ? 'bi-heart-fill text-danger' : 'bi-heart';

// Follow
const isFollowing = window.FeedState.follows.has(String(activity.actor_id));
const followText = isFollowing ? 'Siguiendo' : 'Seguir';
const followCSS = isFollowing ? 'color: #fff;' : 'color: #777;';

// Welcome
const hasWelcomed = window.FeedState.welcomes.has(String(activity.actor_id));
```
*Asegurar de inyectar estas lógicas dentro del HTML template en `createActivityCard`.*

- [ ] **Step 4: Run test to verify it passes**
`Abrir la web logueado` Expected: PASS (Muestra corazones rellenos y texto "Siguiendo" si aplica)

- [ ] **Step 5: Commit**
`git commit -m "style(feed): sync UI with active bulk states"`

---

### Task 3: Mutaciones Reales (Write interactions to BD)

**Files:**
- Modify `c:/Users/Willie/Desktop/OFFSZN/script/feed.js`

- [ ] **Step 1: Write the failing test**
`Darle clic a 'Dar la bienvenida' o al corazón, e invocar Supabase, no persiste refrescando la página.`

- [ ] **Step 2: Run test to verify it fails**
`Clic -> F5` Expected: FAIL (El estado es volatil).

- [ ] **Step 3: Write minimal implementation**
```javascript
// Click handles con Supabase inserts:
// Bienvenida (Solo permite una vez, inserta a notifications):
waveBtn.onclick = async (e) => {
    e.stopPropagation();
    authGuard(async () => {
        if(window.FeedState.welcomes.has(activity.actor_id)) return; // Prevents double click
        
        // Optimistic UI
        waveBtn.classList.add('active');
        waveBtn.innerHTML = '<i class="bi bi-hand-wave-fill"></i> ¡Saludado!';
        window.FeedState.welcomes.add(String(activity.actor_id));

        // DB Insert
        await window.supabaseClient.from('notifications').insert({
            user_id: activity.actor_id,
            actor_id: AuthUtils.getSession().user.id,
            type: 'welcome',
            title: '¡Nueva Bienvenida!',
            message: 'Alguien de la comunidad te ha dado la bienvenida.',
            read: false
        });
    });
};

// Seguir (Idempotente DB insert/delete if needed, here just positive flow):
followBtn.onclick = async (e) => {
    e.stopPropagation();
    authGuard(async () => {
        if(window.FeedState.follows.has(activity.actor_id)) return; // Prevent if 'Siguiendo'
        
        // Optimistic UI
        followBtn.innerText = 'Siguiendo';
        followBtn.style.color = '#fff';
        window.FeedState.follows.add(String(activity.actor_id));

        // DB Insert
        await window.supabaseClient.from('followers').insert({
            follower_id: AuthUtils.getSession().user.id,
            user_id: activity.actor_id
        });
    });
};

// Like DB Logic
likeBtn.onclick = async () => {
    authGuard(async () => {
        const isCurrentlyLiked = window.FeedState.likes.has(String(activity.target_id));
        const user = AuthUtils.getSession().user;

        // Optimistic UI
        const icon = likeBtn.querySelector('i');
        if (isCurrentlyLiked) {
            window.FeedState.likes.delete(String(activity.target_id));
            icon.classList.remove('bi-heart-fill');
            icon.classList.add('bi-heart');
            // Remove from DB
            await window.supabaseClient.from('likes').delete().match({ user_id: user.id, target_id: String(activity.target_id) });
        } else {
            window.FeedState.likes.add(String(activity.target_id));
            icon.classList.remove('bi-heart');
            icon.classList.add('bi-heart-fill');
            // Insert to DB
            await window.supabaseClient.from('likes').insert({
                user_id: user.id, target_id: String(activity.target_id), target_type: activity.type === 'product_published' ? 'product' : 'activity'
            });
        }
    });
};
```

- [ ] **Step 4: Run test to verify it passes**
`F5 después del clic` Expected: PASS (Estado mantenido re-cargando la página)

- [ ] **Step 5: Commit**
`git commit -m "fix(feed): wire welcome, follow and like buttons to bd logic"`
