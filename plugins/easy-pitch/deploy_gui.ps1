$src = "d:\!OFFSZN\PROYECTOS\OFFSZN\plugins\easy-pitch\mockup.html"
$dest1 = "C:\Users\Willie\AppData\Roaming\OFFSZN\EasyPitchGui\mockup.html"
$dest2 = "C:\Users\Willie\Desktop\EASY PITCH\mockup.html"
$dest3 = "d:\!OFFSZN\PROYECTOS\OFFSZN\plugins\easy-pitch\build\EASY_PITCH_artefacts\Release\Standalone\mockup.html"

New-Item -ItemType Directory -Path (Split-Path $dest1) -Force -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Path (Split-Path $dest2) -Force -ErrorAction SilentlyContinue | Out-Null
New-Item -ItemType Directory -Path (Split-Path $dest3) -Force -ErrorAction SilentlyContinue | Out-Null

Copy-Item -Path $src -Destination $dest1 -Force
Copy-Item -Path $src -Destination $dest2 -Force
Copy-Item -Path $src -Destination $dest3 -Force

Write-Output "DEPLOY_OK"
