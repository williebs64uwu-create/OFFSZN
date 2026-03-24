import os
import re
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

# Regex for the navbar link handling multiline
navbar_pattern = re.compile(r'<a href="/transacciones\.html" class="w-list-item auth-protected">\s*<i class="fas fa-gift"></i>\s*Gift\s*Cards\s*</a>', re.IGNORECASE | re.DOTALL)
navbar_pattern_2 = re.compile(r'<a href="/transacciones\.html" class="w-list-item auth-protected">\s*<i class="fas fa-gift"></i>\s*Transacciones\s*</a>', re.IGNORECASE | re.DOTALL)

count = 0
for p in patterns:
    files = glob.glob(p)
    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as file: 
                content = file.read()
            
            orig_content = content
            
            # 1. Update multiline navbar links
            content = navbar_pattern.sub('<a href="/transacciones.html" class="w-list-item auth-protected"><i class="fas fa-dollar-sign"></i> Transacciones</a>', content)
            content = navbar_pattern_2.sub('<a href="/transacciones.html" class="w-list-item auth-protected"><i class="fas fa-dollar-sign"></i> Transacciones</a>', content)
            
            # 2. Fix icons in existing "Transacciones" links that were partially updated
            content = re.sub(r'href="/transacciones\.html"[^>]*>\s*<i class="fas fa-gift"></i>\s*Transacciones', r'href="/transacciones.html" class="w-list-item auth-protected"><i class="fas fa-dollar-sign"></i> Transacciones', content, flags=re.DOTALL)
            
            # 3. Sequential replace for other text occurrences
            content = content.replace('Gift Cards', 'Transacciones')
            content = content.replace('GIFT CARDS', 'TRANSACCIONES')
            
            # 4. Global Icon fixes for specific FA classes
            content = content.replace('fa-gift"></i> Transacciones', 'fa-dollar-sign"></i> Transacciones')
            content = content.replace('fa-gift"></i> Gift Cards', 'fa-dollar-sign"></i> Transacciones')
            
            if content != orig_content:
                with open(f, 'w', encoding='utf-8') as file: 
                    file.write(content)
                print(f'Updated {f}')
                count += 1
        except Exception as e:
            pass

print(f'\nTotal files updated: {count}')
