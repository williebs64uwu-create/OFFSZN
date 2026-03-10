# Brand Guidelines y Estilos UI de OFFSZN

Este documento centraliza las directrices visuales, colores, componentes y patrones de diseño utilizados en OFFSZN. El objetivo es mantener una estética consistente, premium y profesional en toda la plataforma.

## 1. Filosofía de Diseño: "Dark Premium" (Black & White)

OFFSZN utiliza una estética **minimalista, oscura y elegante**. Nos alejamos de los colores saturados para darle protagonismo al contenido (las portadas de los beats, banners y avatares de los productores).

### Paleta de Colores Base
- **Fondo Principal (Background):** `#000000` o `#080808`
- **Superficies (Tarjetas, Modales, Dropdowns):** `#0F0F0F`, `#111111` o `#1A1A1A`
- **Bordes y Divisores (Subtiles):** `rgba(255, 255, 255, 0.1)` o `rgba(255, 255, 255, 0.05)`
- **Texto Principal (Títulos, Enlaces activos):** `#FFFFFF`
- **Texto Secundario (Descripciones, Metadata):** `#A0A0A0`, `#888888` o `#666666`

### Tipografía (Fonts)
- **Principal:** Inter o tipografías sans-serif modernas y legibles.
- **Pesos:**
  - `400` (Regular) para textos descriptivos.
  - `500` (Medium) o `600` (SemiBold) para botones y metadata importante.
  - `700` (Bold) u `800` (ExtraBold) para títulos grandes e impactantes.

## 2. Componentes Clave

### Botones (Buttons)
1. **Primario (Call to Action principal):**
   - Fondo: `#FFFFFF`
   - Texto: `#000000` (Negro)
   - Border-Radius: `8px` o `12px` (consistente en toda la UI)
   - Hover: `transform: translateY(-1px)` o `opacity: 0.9`
2. **Secundario (Acciones menores, Cancelar, Opciones):**
   - Fondo: `transparent` o `rgba(255, 255, 255, 0.03)`
   - Borde: `1px solid rgba(255, 255, 255, 0.1)`
   - Texto: `#FFFFFF`
   - Hover: Fondo pasa a `rgba(255, 255, 255, 0.08)` o el borde se ilumina ligeramente.

### 1.5. Scrollbars y Pestañas
Para mantener la estética oscura "premium", usamos estos estilos adicionales:
- **Scrollbars:** Track `#0A0A0A`, Thumb `#333`, Hover `#444`. Ancho fijo de `8px`.
- **License Tabs (Activas):** Fondo `#FFFFFF`, texto `#000000`. Black & White total.

### Modales (Globales, Compartir, Upload, etc.)
Los modales en OFFSZN son limpios y enfocados en la tarea del usuario.
- **Backdrop (Fondo oscuro detrás del modal):** `rgba(0, 0, 0, 0.8)` o `rgba(0,0,0,0.6)` con `backdrop-filter: blur(8px)`.
- **Contenedor del Modal:**
  - Fondo: `#111111` o linear-gradient súper sutil (e.j. `#1a1a1a` a `#0a0a0a`).
  - Borde: `1px solid rgba(255, 255, 255, 0.1)`.
  - Border-Radius: `16px` o `20px` (aspecto moderno y pro).
  - Padding: Espacioso (ej. `24px` o `32px`).
- **Botón de Cerrar (X):** Posicionado arriba a la derecha. Generalmente un círculo transparente con hover en `#222` o `#333`.

### Dropdowns y Menús Contextuales
- **Superficie:** Similar a los modales (`#111111`).
- **Sombra (Shadow):** `0 10px 40px rgba(0, 0, 0, 0.8)` para dar profundidad real sobre el fondo negro.
- **Borde:** `1px solid rgba(255, 255, 255, 0.1)`.
- **Items del Dropdown:**
  - Padding generoso (`10px 16px`).
  - Hover: Fondo `rgba(255, 255, 255, 0.05)`.
  - Transiciones suaves (`transition: all 0.2s ease`).

## 3. Directrices por Sección

### A. Perfil Público (`perfil-publico.html`)
- **Header/Banner:** El banner marca la identidad del productor. Si sube un banner, debe verse limpio. Si usa un banner predeterminado, debe ser abstracto y monocromático (ej. texturas de ruido, gradientes grises).
- **Lista de Productos:** Rectángulos con un aspect-ratio cuadriculado (`1/1`) para mantener simetría. Efectos de `hover` sutiles sobre el cover (sin escalas exageradas que deformen la UI).
- **Tablas/Grid:** Mantener un `gap` consistente (ej. `16px` a `24px`) entre los elementos del grid de beats.

### B. Página de Producto (`producto.html`)
- **Limpieza visual:** La portada del producto a la izquierda (o arriba en móvil), y los detalles y licencias claramente separados a la derecha.
- **Play Button:** Siempre visible y accesible rápidamente intuitivo en el UI sin depender del hover para aparecer.

### C. Explorar / Marketplace (`explorar.html`) y Productores (`productores.html`)
- **Filtros:** Estilo píldora (Pills) con bordes de 1px.
- **Estado Activo:** Debe ser **Blanco Puro** (`#FFFFFF`) con texto **Negro** (`#000000`). Se prohíbe el uso de morados o colores de acento en los estados de selección de estas páginas para mantener el rigor B&W.
- **Iconografía:** Usar iconos de "Embudo" (`bi-funnel`) para filtrado avanzado.
- **Cards de Beats/Creadores:** Formato cuadrado clásico de industria, con información condensada debajo (Título en blanco, Artista en gris sutil, Precio o "FREE" destacado).

### D. Planes de Subscripción (`planes.html`)
- **Grid de Cards Dinámico:** Uso de `display: flex` con `gap: 32px` para mantener las tarjetas del plan PRO y Starter una al lado de la otra. 
- **Jerarquía Visual Stark:**
  - **Starter (Violeta):** Clase `.card-starter` utiliza acentos en `#A78BFA` y sombras suaves.
  - **PRO (Dorado/Premium):** Clase `.card-pro` destaca con bordes dorados, un badge de "Most Popular" y un efecto de aura sutil.
- **Micro-interacciones:** Hover effects que escalan ligeramente la tarjeta y aumentan la opacidad de los bordes.
- **Transparencias y Glassmorphism:** Uso de `rgba(15, 15, 15, 0.4)` con `backdrop-filter: blur(20px)` para dar profundidad sin recargar la vista.
- **Fondo con Partículas:** Un canvas de fondo con partículas blancas lentas para dar una sensación de "espacio" y exclusividad.

## 4. Reglas Estrictas de Modificación

1. **NO TOCAR EL NAVBAR:** El diseño y funcionamiento de la barra de navegación (Navbar) está bloqueado como regla base. Solo se debe modificar si existe una instrucción explícita del usuario que mencione: *"Modifica el navbar"*.
2. **Mobilidad (Mobile Responsive):**
   - El enfoque inmediato suele ser el diseño de Escritorio (Desktop) al construir algo nuevo para asentar la lógica y estética gruesa.
   - Las adaptaciones a móvil (como convertir pestañas (tabs) en menús desplegables (dropdowns) en el caso de las promociones) se tratan con detenimiento y generalmente se ajustan como paso posterior, para asegurar que no se rompa la vista base. Hay que **tener cuidado extra con flex-directions y overflows** en pantallas menores a 768px.
3. **Imágenes:** Usar el aspect-ratio correcto (`1/1` para portadas, `16:9` o `3:1` para banners). Nada de estiramientos (`object-fit: cover` siempre).
4. **Colores Prohibidos:** Evitar colores "vivos" puros (Rojo, Azul, Verde fosforito) a menos que sean alertas de error específicas o botones excepcionales. Todo debe rondar la escala de grises.

---
*Este archivo sirve como referencia central para mantener la identidad visual de OFFSZN impecable durante todo nuestro proceso de desarrollo.*

