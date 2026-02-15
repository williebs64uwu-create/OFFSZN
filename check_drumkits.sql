-- CHECK PUBLISHED DRUM KITS
SELECT count(*) as total_published, product_type, visibility 
FROM products 
WHERE product_type = 'drumkit' 
GROUP BY product_type, visibility;

-- CHECK DRUM KIT DRAFTS
SELECT count(*) as total_drafts, cover_url, kit_url, audio_url
FROM drumkit_drafts
GROUP BY cover_url, kit_url, audio_url;

-- LIST FIRST 10 ITEMS (If any, to see storage paths)
SELECT id, name, kit_url, image_url 
FROM products 
WHERE product_type = 'drumkit' 
LIMIT 10;

-- LIST FIRST 10 DRAFTS
SELECT id, title, files_data 
FROM drumkit_drafts 
LIMIT 10;
