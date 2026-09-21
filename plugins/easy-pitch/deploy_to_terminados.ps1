$ErrorActionPreference = "Stop"

$dest = "C:\Users\Willie\Desktop\TERMINADOS - EASY PITCH"
if (-not (Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$vst3Src = "D:\!OFFSZN\PROYECTOS\OFFSZN\plugins\easy-pitch\build\EASY_PITCH_artefacts\Release\VST3\EASY PITCH.vst3"
$exeSrc  = "D:\!OFFSZN\PROYECTOS\OFFSZN\plugins\easy-pitch\build\EASY_PITCH_artefacts\Release\Standalone\EASY PITCH.exe"
$htmlSrc = "D:\!OFFSZN\PROYECTOS\OFFSZN\plugins\easy-pitch\mockup.html"

Write-Host "Copying VST3 to $dest..."
Copy-Item -Path $vst3Src -Destination (Join-Path $dest "EASY PITCH.vst3") -Recurse -Force

Write-Host "Copying Standalone EXE to $dest..."
Copy-Item -Path $exeSrc -Destination (Join-Path $dest "EASY PITCH.exe") -Force

Write-Host "Copying mockup.html to $dest..."
Copy-Item -Path $htmlSrc -Destination (Join-Path $dest "mockup.html") -Force

# AppData GUI
$appDataGui = Join-Path $env:APPDATA "OFFSZN\EasyPitchGui"
if (-not (Test-Path $appDataGui)) {
    New-Item -ItemType Directory -Path $appDataGui -Force | Out-Null
}
Copy-Item -Path $htmlSrc -Destination (Join-Path $appDataGui "mockup.html") -Force
Write-Host "Updated AppData GUI: $appDataGui\mockup.html"

# Common Files VST3
if (Test-Path "C:\Program Files\Common Files\VST3") {
    Copy-Item -Path $vst3Src -Destination "C:\Program Files\Common Files\VST3\EASY PITCH.vst3" -Recurse -Force
    Write-Host "Installed to C:\Program Files\Common Files\VST3\EASY PITCH.vst3"
}

Write-Host "`nContents of $dest :"
Get-ChildItem -Path $dest | Select-Object Name, Length, LastWriteTime
