import asyncio
from playwright.async_api import async_playwright
import os

async def export_slides():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1080, 'height': 1350})
        
        # Load the HTML file
        file_path = "file://" + os.path.abspath("carousel_willie.html")
        await page.goto(file_path)
        
        output_dir = "exports"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        for i in range(1, 5):
            # Execute JS to show the specific slide
            await page.evaluate(f"showSlide({i})")
            await page.wait_for_timeout(500) # Wait for fonts/rendering
            
            output_path = os.path.join(output_dir, f"slide_{i}.png")
            await page.screenshot(path=output_path)
            print(f"Exported: {output_path}")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(export_slides())
