import os

def replace_navbar(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    start_marker = '<!-- ==================== EXTRACTED NAVBAR ===================='
    end_marker = '</header>'
    
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print(f"Start marker not found in {filepath}")
        return
        
    main_idx = content.find('<main', start_idx)
    if main_idx == -1:
        main_idx = content.find('<!-- ==================== SIDE PANELS', start_idx)
        if main_idx == -1:
             print(f"End boundary not found in {filepath}")
             return
             
    end_idx = content.rfind('</header>', start_idx, main_idx)
    
    if end_idx == -1:
        print(f"</header> not found before boundary in {filepath}")
        return
        
    end_idx += len('</header>') 
    
    replacement = """<!-- ==================== DYNAMIC NAVBAR ==================== -->
  <div id="navbar-placeholder">
    <!-- Static shell to prevent flash before JS loads -->
    <div style="background: rgba(0, 0, 0, 0.95); height: 58px; width: 100%; border-bottom: 1px solid rgba(255, 255, 255, 0.08); backdrop-filter: blur(20px); position: sticky; top: 0; z-index: 1000;"></div>
  </div>
  <script src="/script/load-navbar.js?v=21"></script>"""
    
    new_content = content[:start_idx] + replacement + content[end_idx:]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    print(f"Successfully replaced navbar in {filepath}")

replace_navbar('c:/Users/Willie/Desktop/OFFSZN/comunidad/feed.html')
replace_navbar('c:/Users/Willie/Desktop/OFFSZN/comunidad/productores.html')
