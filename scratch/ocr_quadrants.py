from PIL import Image
import os
import sys

# We'll use the C# tool to do the OCR on slices.
# Let's write a python script that slices image18.png and image3.png into 4 quadrants each
# and saves them, then we can run the OCR tool on them.

dir_path = r"c:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images"
slices_dir = r"c:\Users\Willie\Desktop\OFFSZN\cursos\extracted_images\slices"
os.makedirs(slices_dir, exist_ok=True)

images_to_slice = ["image3.png", "image18.png", "image11.png"]

for name in images_to_slice:
    path = os.path.join(dir_path, name)
    if not os.path.exists(path):
        continue
    
    print(f"Slicing {name}...")
    img = Image.open(path)
    w, h = img.size
    
    # 2x2 quadrants
    quads = [
        ("top_left", (0, 0, w//2, h//2)),
        ("top_right", (w//2, 0, w, h//2)),
        ("bottom_left", (0, h//2, w//2, h)),
        ("bottom_right", (w//2, h//2, w, h))
    ]
    
    for quad_name, box in quads:
        cropped = img.crop(box)
        # Resize 2x for better readability
        cw, ch = cropped.size
        resized = cropped.resize((cw * 2, ch * 2), Image.Resampling.LANCZOS)
        # Convert to grayscale and enhance contrast
        from PIL import ImageEnhance, ImageOps
        gray = ImageOps.grayscale(resized)
        enhancer = ImageEnhance.Contrast(gray)
        enhanced = enhancer.enhance(2.0)
        
        slice_name = f"slice_{quad_name}_{name}"
        enhanced.save(os.path.join(slices_dir, slice_name))
        
print("Slicing completed.")
