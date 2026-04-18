import asyncio
import os
from playwright.async_api import async_playwright

async def export_slides():
    async with async_playwright() as p:
        # Get absolute path to the HTML file
        html_path = os.path.abspath("carousel_willie.html")
        if not os.path.exists(html_path):
            print(f"Error: {html_path} not found.")
            return

        browser = await p.chromium.launch()
        # Set viewport to Instagram 4:5 ratio (1080x1350)
        page = await browser.new_page(viewport={"width": 1080, "height": 1350})
        
        await page.goto(f"file://{html_path}")
        await page.wait_for_load_state("networkidle")
        
        # Slides are expected to have IDs slide-1, slide-2, etc.
        slides = await page.query_selector_all(".slide")
        
        if not os.path.exists("exports"):
            os.makedirs("exports")
            
        print(f"Found {len(slides)} slides. Exporting...")
        
        for i, slide in enumerate(slides):
            output_path = f"exports/slide_{i+1}.png"
            # Scroll to the slide or just capture the element
            await slide.screenshot(path=output_path)
            print(f"✅ Exported: {output_path}")

        await browser.close()
        print("\n✨ Done! Check the 'exports' folder.")

if __name__ == "__main__":
    asyncio.run(export_slides())
