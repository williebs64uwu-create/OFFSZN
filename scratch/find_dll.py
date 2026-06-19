import os

search_paths = [
    r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319",
    r"C:\Program Files (x86)\Reference Assemblies\Microsoft\Framework\.NETFramework\v4.8",
]

found = []
for p in search_paths:
    if os.path.exists(p):
        for root, dirs, files in os.walk(p):
            for file in files:
                if file.lower() == "system.runtime.windowsruntime.dll":
                    full_path = os.path.join(root, file)
                    found.append(full_path)
                    print(f"Found: {full_path}")
