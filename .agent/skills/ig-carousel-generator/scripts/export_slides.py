import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

# Configuración base
VIEW_W = 420
VIEW_H = 525
SCALE = 1080 / 420  # Escala para llegar a 1080px de ancho

async def export_slides(html_path: str, output_dir: str, total_slides: int):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": VIEW_W, "height": VIEW_H},
            device_scale_factor=SCALE
        )
        page = await context.new_page()
        
        # Cargar el archivo HTML
        absolute_path = os.path.abspath(html_path)
        await page.goto(f"file:///{absolute_path}")
        
        # Esperar a que las fuentes y recursos carguen
        await page.wait_for_timeout(3000)
        
        # Limpiar el frame de IG para el export
        await page.evaluate("""() => {
            const elementsToHide = ['.ig-header', '.ig-dots', '.ig-actions', '.ig-caption'];
            elementsToHide.forEach(selector => {
                const el = document.querySelector(selector);
                if (el) el.style.display = 'none';
            });
            
            const frame = document.querySelector('.ig-frame');
            if (frame) {
                frame.style.cssText = 'width:420px;height:525px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
            }
            
            const viewport = document.querySelector('.carousel-viewport');
            if (viewport) {
                viewport.style.cssText = 'width:420px;height:525px;aspect-ratio:unset;overflow:hidden;cursor:default;';
            }
            
            document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;background:transparent;';
        }""")
        
        await page.wait_for_timeout(500)

        for i in range(total_slides):
            # Mover el track al slide correspondiente sin transiciones
            await page.evaluate(f"""(idx) => {{
                const track = document.querySelector('.carousel-track');
                if (track) {{
                    track.style.transition = 'none';
                    track.style.transform = `translateX(${{-idx * 420}}px)`;
                }}
            }}""", i)
            
            await page.wait_for_timeout(400) # Pequeña espera para renderizado
            
            # Tomar screenshot del viewport
            slide_file = output_path / f"slide_{i+1}.png"
            await page.screenshot(
                path=str(slide_file),
                clip={"x": 0, "y": 0, "width": VIEW_W, "height": VIEW_H}
            )
            print(f"Exportado: {slide_file.name}")

        await browser.close()

if __name__ == "__main__":
    # Estos valores se actualizarán dinámicamente o se pasarán por CLI
    import sys
    if len(sys.argv) < 4:
        print("Uso: python export_slides.py <html_path> <output_dir> <total_slides>")
    else:
        asyncio.run(export_slides(sys.argv[1], sys.argv[2], int(sys.argv[3])))
