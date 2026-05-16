from playwright.sync_api import sync_playwright
import os
import subprocess

def export_carousel():
    html_file = os.path.abspath('carousel_premium_youtube.html')
    file_url = f"file:///{html_file.replace(chr(92), '/')}"
    output_dir = "carousel_export"
    
    os.makedirs(output_dir, exist_ok=True)
    
    with sync_playwright() as p:
        print("Iniciando exportacion premium...")
        # Usamos device_scale_factor=2 para que el 540x675 del HTML se convierta en 1080x1350 real
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": 1080, "height": 1350},
            device_scale_factor=2
        )
        page.goto(file_url)
        
        # Esperamos a las fuentes y al renderizado
        page.wait_for_timeout(3000)
        
        slides = page.locator('.slide').all()
        total = len(slides)
        print(f"Se encontraron {total} slides. Exportando...")
        
        for i, slide in enumerate(slides):
            output_path = os.path.join(output_dir, f"slide_{i+1}.png")
            # Forzamos a que capture el elemento con su tamaño real escalado
            slide.screenshot(path=output_path, scale="device")
            print(f"Slide {i+1}/{total} guardado en {output_path}")
            
        browser.close()
        print(f"Todo listo bro! Los {total} archivos estan en la carpeta '{output_dir}'.")
        
        # Abrir la carpeta en Windows
        print("Abriendo carpeta de exportacion...")
        os.startfile(os.path.abspath(output_dir))

if __name__ == "__main__":
    export_carousel()
