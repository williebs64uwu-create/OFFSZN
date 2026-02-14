function generatePublicSlug(title) {
    // Generate clean URL-safe slug from title
    // PROPOSED NEW LOGIC:
    return title
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\+/g, '-') // Replace + with -
        .replace(/_/g, '-') // Replace _ with -
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Spaces to hyphens
        .replace(/-+/g, '-') // Multiple hyphens to single
        .replace(/^-+|-+$/g, '') // Trim hyphens from ends
        .substring(0, 60); // Max 60 characters
}

const testCases = [
    "Hola+Type",
    "Hola_Type",
    "hola type",
    "Café con Leche",
    "This+is_a-Mixing---Test",
    " Special ! Characters @ Test # ",
    "---Start-End---",
    "Product & More",
    "Crème Brûlée"
];

console.log("Running Slug Tests:");
testCases.forEach(input => {
    const slug = generatePublicSlug(input);
    console.log(`Input: "${input}" => Slug: "${slug}"`);
});
