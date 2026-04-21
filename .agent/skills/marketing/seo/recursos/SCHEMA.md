# Plantillas de Schema.org (JSON-LD)

### Perfil de Productor (Person)
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "{{nickname}}",
  "url": "https://offszn.lat/@{{nickname}}",
  "image": "{{avatar_url}}",
  "description": "{{bio}}",
  "jobTitle": "Productor Musical"
}
```

### Producto (Beats/Kits)
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{name}}",
  "image": "{{image_url}}",
  "description": "{{description}}",
  "sku": "{{id}}",
  "brand": {
    "@type": "Brand",
    "name": "OFFSZN"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://offszn.lat/p/{{code}}",
    "priceCurrency": "USD",
    "price": "{{price}}",
    "availability": "https://schema.org/InStock"
  }
}
```
