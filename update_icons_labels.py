import os
import glob

patterns = [
    '*.html', 
    'recursos/*.html', 
    'legal/*.html', 
    'comunidad/*.html', 
    'cursos/*.html', 
    'components/*.html', 
    'pages/*.html', 
    'studio/*.html', 
    'cuenta/*.html', 
    'servicios/*.html', 
    'admin/*.html',
    'admin/pages/*.html'
]

count = 0
for p in patterns:
    files = glob.glob(p)
    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as file: 
                content = file.read()
            
            # 1. Update text if missed
            new_content = content.replace('Gift Cards', 'Transacciones')
            new_content = new_content.replace('GIFT CARDS', 'TRANSACCIONES')
            
            # 2. Update icons (specifically looking for the ones next to Transacciones)
            new_content = new_content.replace('<i class="fas fa-gift"></i> Transacciones', '<i class="fas fa-dollar-sign"></i> Transacciones')
            new_content = new_content.replace('<i class="fas fa-gift"></i> Gift Cards', '<i class="fas fa-dollar-sign"></i> Transacciones')
            new_content = new_content.replace('<i class="fas fa-gift"></i> TRANSACCIONES', '<i class="fas fa-dollar-sign"></i> TRANSACCIONES')
            new_content = new_content.replace('<i class="bi bi-gift"></i> DESCARGAS GRATIS', '<i class="bi bi-gift"></i> DESCARGAS GRATIS') # Keep this one safe
            
            if new_content != content:
                with open(f, 'w', encoding='utf-8') as file: 
                    file.write(new_content)
                print(f'Updated {f}')
                count += 1
        except Exception as e:
            pass

print(f'\nTotal files updated: {count}')
