from PIL import Image, ImageEnhance, ImageOps
import os

dir_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images"
images_to_enhance = ["image3.png", "image5.png", "image11.png", "image18.png"]

for img_name in images_to_enhance:
    img_path = os.path.join(dir_path, img_name)
    if not os.path.exists(img_path):
        print(f"Skipping {img_name}, not found.")
        continue
        
    print(f"Enhancing {img_name}...")
    try:
        img = Image.open(img_path)
        
        # 1. Convert to grayscale
        gray_img = ImageOps.grayscale(img)
        
        # 2. Resize 2x for better OCR recognition of small fonts
        w, h = gray_img.size
        resized_img = gray_img.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
        
        # 3. Enhance contrast
        enhancer = ImageEnhance.Contrast(resized_img)
        contrast_img = enhancer.enhance(2.5) # Increase contrast heavily
        
        # Save variations
        contrast_img.save(os.path.join(dir_path, f"enhanced_{img_name}"))
        
        # Save inverted variation (white text on black or black on white)
        inverted_img = ImageOps.invert(contrast_img)
        inverted_img.save(os.path.join(dir_path, f"inverted_{img_name}"))
        
        print(f"Successfully saved enhanced variations for {img_name}")
    except Exception as e:
        print(f"Error enhancing {img_name}: {e}")
