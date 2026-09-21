$src = "d:\!OFFSZN\PROYECTOS\OFFSZN\plugins\easy-pitch\build\EASY_PITCH_artefacts\Release\VST3\EASY PITCH.vst3\Contents\x86_64-win\EASY PITCH.vst3"
$dest = "C:\Program Files\Common Files\VST3\EASY PITCH.vst3\Contents\x86_64-win\EASY PITCH.vst3"

try {
    Copy-Item -Path $src -Destination $dest -Force -ErrorAction Stop
    Write-Output "VST3_COPIED_SUCCESSFULLY"
} catch {
    Write-Output "VST3_LOCKED_BY_DAW"
}
