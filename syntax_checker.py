
import re
import subprocess
import os

def check_syntax(html_file):
    print(f"Checking {html_file}...")
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract all scripts
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
    combined_js = ""
    for s in scripts:
        combined_js += s + "\n;\n" # Add semicolon/newline to prevent concatenation issues
    
    # Write to temp file
    temp_js = "temp_check.js"
    with open(temp_js, 'w', encoding='utf-8') as f:
        f.write(combined_js)

    try:
        result = subprocess.run(['node', '--check', temp_js], capture_output=True, text=True)
        if result.returncode == 0:
            print("Syntax OK")
        else:
            print("Syntax Error Found:")
            print(result.stderr)
    except Exception as e:
        print(f"Error running node: {e}")
    finally:
        if os.path.exists(temp_js):
            os.remove(temp_js)

check_syntax(r'c:\Users\Willie\Desktop\OFFSZN\cuenta\Upload\Presets.html')
check_syntax(r'c:\Users\Willie\Desktop\OFFSZN\cuenta\planes.html')
