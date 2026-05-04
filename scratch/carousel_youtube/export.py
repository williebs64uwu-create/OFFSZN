import asyncio
from playwright.async_api import async_playwright
import os

async def export_slides():
    output_dir = "scratch/carousel_youtube/output"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Viewport exacto para los 5 slides (5400x1350)
        page = await browser.new_page(viewport={'width': 5400, 'height': 1350})
        
        # Cargar el archivo local
        abs_path = os.path.abspath("scratch/carousel_youtube/index.html")
        await page.goto(f"file://{abs_path}")
        
        # Esperar a que las fuentes se carguen
        await page.wait_for_timeout(2000)

        num_slides = 5
        for i in range(num_slides):
            # Capturar cada slide moviendo el "clipping" o el scroll
            # Como los slides están en un flex container, podemos capturar regiones
            x_offset = i * 1080
            await page.screenshot(
                path=f"{output_dir}/slide_{i+1}.png",
                clip={'x': x_offset, 'y': 0, 'width': 1080, 'height': 1350}
            )
            print(f"Slide {i+1} exportado perfectamente a: {os.path.abspath(f'{output_dir}/slide_{i+1}.png')}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(export_slides())
