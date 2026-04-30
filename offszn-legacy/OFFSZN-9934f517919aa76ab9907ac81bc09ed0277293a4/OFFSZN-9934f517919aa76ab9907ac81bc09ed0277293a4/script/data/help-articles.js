const helpArticles = [
    // Para Vendedores
    {
        id: 1,
        title: "¿Cómo subir beats usando OFFSZN?",
        category: "Para Vendedores",
        subcategory: "OFFSZN",
        snippet: "Aprende cómo subir tus instrumentales (beats) en OFFSZN paso a paso de forma rápida y sencilla.",
        author: "Equipo OFFSZN", date: "Hace 1 año", link: "/ayuda/como-subir-beats.html"
    },
    {
        id: 2,
        title: "¿Cuántas personas compran beats en OFFSZN?",
        category: "Para Vendedores",
        subcategory: "General",
        snippet: "Hay miles de artistas y compradores activos buscando comprar beats todos los días dentro del marketplace de OFFSZN.",
        author: "Equipo OFFSZN", date: "Hace 6 meses", link: "/ayuda/cuantas-personas-compran-beats.html"
    },
    {
        id: 3,
        title: "¿Cómo descargo mis propios beats subidos?",
        category: "Para Vendedores",
        subcategory: "Gestión de Contenido",
        snippet: "Este artículo aplica a los usuarios con planes PRO y Starter. Aprende cómo volver a descargar los archivos de tus propios beats.",
        author: "Soporte", date: "Hace 2 meses", link: "/ayuda/descargar-propios-beats.html"
    },
    {
        id: 4,
        title: "¿Cómo puedo configurar licencias exclusivas para mis beats?",
        category: "Para Vendedores",
        subcategory: "Licencias y Contratos",
        snippet: "Configurar tus contratos y licencias para la venta de beats es sencillo. Ve a la sección de Licencias en tu panel.",
        author: "Soporte", date: "Hace 3 semanas", link: "/ayuda/configurar-licencias-exclusivas.html"
    },

    // Para Compradores
    {
        id: 5,
        title: "¿Cómo busco beats en el Marketplace?",
        category: "Para Compradores",
        subcategory: "Descubriendo Contenido",
        snippet: "En este artículo, aprenderás cómo utilizar los filtros avanzados para buscar beats específicos por género, BPM o mood.",
        author: "Soporte", date: "Hace 3 años", link: "/ayuda/como-busco-beats.html"
    },
    {
        id: 6,
        title: "¿Qué licencias obtengo al comprar un beat?",
        category: "Para Compradores",
        subcategory: "Licencias y Derechos",
        snippet: "Al comprar un beat, recibirás un contrato en PDF estipulando los límites de streams, ventas y uso, dependiendo del tipo de licencia seleccionada.",
        author: "Legal", date: "Hace 1 mes", link: "/ayuda/que-licencias-obtengo.html"
    },
    {
        id: 7,
        title: "¿Cómo descargar los beats que ya compré?",
        category: "Para Compradores",
        subcategory: "Mis Compras",
        snippet: "Ve a tu historial de compras en tu cuenta para descargar los archivos WAV, MP3 y Stems de los beats adquiridos.",
        author: "Soporte", date: "Hace 5 meses", link: "/ayuda/como-descargar-beats.html"
    },

    // Perfil y Suscripción
    {
        id: 8,
        title: "¿Cuáles son las diferencias entre el plan de subidas gratis y el plan PRO?",
        category: "Perfil y Suscripción",
        subcategory: "Planes",
        snippet: "Compara los beneficios de nuestro plan gratuito (ventas limitadas) versus el Plan PRO (0% comisión en tus beats, subidas ilimitadas).",
        author: "Soporte", date: "Hace 2 semanas", link: "/ayuda/diferencias-planes-pro-y-gratis.html"
    },
    {
        id: 9,
        title: "¿Cómo cancelo la renovación automática de mi suscripción PRO?",
        category: "Perfil y Suscripción",
        subcategory: "Facturación",
        snippet: "Para cancelar la renovación de tu suscripción PRO y dejar de vender beats sin límites, ve a Facturación > Cancelar Plan.",
        author: "Pagos", date: "Hace 1 semana", link: "/ayuda/cancelar-suscripcion-pro.html"
    },

    // Publishing & YouTube
    {
        id: 10,
        title: "¿Qué es el OFFSZN ID y para qué sirve?",
        category: "Publishing",
        subcategory: "OFFSZN ID",
        snippet: "En este artículo aprenderás qué es OFFSZN ID y su función. Es un sistema revolucionario para proteger los derechos de tus beats.",
        author: "Publishing", date: "Hace 2 años", link: "/ayuda/que-es-offszn-id.html"
    },
    {
        id: 11,
        title: "¿El ID es sólo para beats o puedo reclamar protección por mis canciones completas?",
        category: "Publishing",
        subcategory: "OFFSZN ID",
        snippet: "¿El ID es sólo para beats o puedo reclamar mis canciones completas? Puedes registrar ambas obras a través de nuestro sistema ID.",
        author: "Publishing", date: "Hace 2 años", link: "/ayuda/reclamos-id-para-canciones.html"
    },
    {
        id: 16,
        title: "¿Por qué mis beats se agregan a YouTube Content ID?",
        category: "Publishing",
        subcategory: "YouTube",
        snippet: "Cuando activas la monetización y Publishing de tu beat, se agrega automáticamente a YouTube Content ID para proteger tus derechos de autor contra resubidas no autorizadas.",
        author: "Publishing", date: "Hace 2 meses", link: "/ayuda/youtube-content-id.html"
    },

    // Tienda Personalizada
    {
        id: 12,
        title: "¿Cómo conecto mi propio dominio a mi Pro Page?",
        category: "Tienda Personalizada",
        subcategory: "Dominios",
        snippet: "El plan PRO incluye la opción de crear una Tienda Personalizada (Pro Page). Aprende a conectar tu propio dominio .com.",
        author: "Soporte", date: "Hace 8 meses", link: "/ayuda/conectar-dominio-tienda.html"
    },

    // Pagos y Retiros
    {
        id: 13,
        title: "¿Qué métodos aceptan para comprar beats?",
        category: "Pagos y Retiros",
        subcategory: "Compras",
        snippet: "Aceptamos pagos a través de PayPal de forma internacional y mediante Yape exclusivamente para usuarios en Perú (validación manual).",
        author: "Pagos", date: "Hace 1 mes", link: "/ayuda/metodos-de-pago-aceptados.html"
    },
    {
        id: 14,
        title: "¿Cómo solicito retiros de mis ganancias por venta de beats?",
        category: "Pagos y Retiros",
        subcategory: "Productores",
        snippet: "Para solicitar el retiro de tus regalías y ventas, ve a la sección de Billetera (Wallet) en tu panel de control y haz click en 'Retirar fondos'.",
        author: "Finanzas", date: "Hace 3 semanas", link: "/ayuda/como-solicito-retiros.html"
    },
    {
        id: 15,
        title: "¿Cuánto tiempo demora un pago en procesarse?",
        category: "Pagos y Retiros",
        subcategory: "General",
        snippet: "Si compraste un beat y tu pago aún aparece pendiente, no te preocupes. Procesamos pagos por Yape entre 1 a 24 horas. Los pagos por PayPal son instantáneos.",
        author: "Pagos", date: "Hace 5 días", link: "/ayuda/tiempo-de-procesamiento-pagos.html"
    }
];

if (typeof window !== 'undefined') {
    window.helpArticles = helpArticles;
}
