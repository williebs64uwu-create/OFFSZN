import asyncio
import os
from playwright.async_api import async_playwright

async def export_carousel():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(device_scale_factor=1) 
        
        # Pointing to the new superior carousel
        html_path = 'file:///' + os.path.abspath('carrusel-superior.html').replace('\\', '/')
        print(f"Opening: {html_path}")
        
        await page.goto(html_path)
        await page.wait_for_timeout(3000) 
        
        slides = await page.query_selector_all('.slide')
        print(f"Found {len(slides)} slides to export...")
        
        for i, slide in enumerate(slides):
            out_name = f'superior_slide_{i+1}.png'
            await slide.screenshot(path=out_name)
            print(f'Exported: {out_name}')
            
        await browser.close()
        print("Done!")

if __name__ == '__main__':
    asyncio.run(export_carousel())
