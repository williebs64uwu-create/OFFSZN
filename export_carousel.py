from playwright.sync_api import sync_playwright
import os

def export_carousel():
    html_file = os.path.abspath('carousel_ia_sync.html')
    file_url = f"file:///{html_file.replace(chr(92), '/')}"
    output_dir = "carousel_export"
    
    os.makedirs(output_dir, exist_ok=True)
    
    with sync_playwright() as p:
        print("Iniciando exportacion premium...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1080, "height": 1350})
        page.goto(file_url)
        
        # Esperamos a las fuentes
        page.wait_for_timeout(2000)
        
        slides = page.locator('.slide').all()
        print(f"Se encontraron {len(slides)} slides. Exportando...")
        
        for i, slide in enumerate(slides):
            output_path = os.path.join(output_dir, f"slide_{i+1}.png")
            slide.screenshot(path=output_path)
            print(f"Slide {i+1}/7 guardado en {output_path}")
            
        browser.close()
        print("Todo listo bro! Los archivos estan en la carpeta 'carousel_export'.")

if __name__ == "__main__":
    export_carousel()
