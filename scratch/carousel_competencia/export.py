# Archivo: scratch/carousel_competencia/export.py
import asyncio
from playwright.async_api import async_playwright
import os

async def export_slides():
    async with async_playwright() as p:
        # Lanzamos con viewport real 1080x1350
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1080, 'height': 1350})
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        html_path = os.path.join(current_dir, "index.html")
        
        await page.goto(f"file:///{html_path.replace('\\', '/')}")
        
        # Esperar carga de fuentes
        await page.wait_for_timeout(3000)
        
        output_dir = os.path.join(current_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        for i in range(3):
            # Posicionamiento exacto por slide
            await page.evaluate(f"window.scrollTo({i * 1080}, 0)")
            await asyncio.sleep(0.5) 
            
            output_file = os.path.join(output_dir, f"slide_{i+1}.png")
            # Captura directa del viewport (sin escala)
            await page.screenshot(path=output_file)
            print(f"Slide {i+1} exportado perfectamente a: {output_file}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(export_slides())
