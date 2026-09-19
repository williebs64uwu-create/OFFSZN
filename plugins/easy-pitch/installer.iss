; EASY_PITCH.iss
; Script de compilación de Inno Setup para EASY PITCH VST3 v1.0.0
; Cumple con la arquitectura juce-plugin-creator de OFFSZN (uninstaller fuera del bundle VST3)

[Setup]
AppId={{D8F2A145-8C7E-4F3B-9A2E-5B1D8F2A145E}}
AppName=EASY PITCH VST3
AppVersion=1.0.0
AppPublisher=OFFSZN
AppPublisherURL=https://offszn.lat
DefaultDirName={autopf}\OFFSZN\EASY PITCH
DefaultGroupName=OFFSZN
DisableProgramGroupPage=yes
DisableDirPage=yes
DirExistsWarning=no
DisableWelcomePage=no
OutputBaseFilename=EASY_PITCH_Setup
OutputDir=.\Output
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
UninstallDisplayName=EASY PITCH VST3

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Binario VST3: Se copia al directorio global de plugins VST3
Source: "build\EASY_PITCH_artefacts\Release\VST3\EASY PITCH.vst3\*"; \
    DestDir: "{commoncf}\VST3\EASY PITCH.vst3"; \
    Flags: ignoreversion recursesubdirs createallsubdirs

; GUI HTML local: Se preserva al desinstalar y siempre se actualiza al reinstalar
Source: "mockup.html"; \
    DestDir: "{userappdata}\OFFSZN\EasyPitchGui"; \
    DestName: "mockup.html"; \
    Flags: replacesameversion uninsneveruninstall

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  bundlePath: String;
begin
  if CurStep = ssInstall then
  begin
    bundlePath := ExpandConstant('{commoncf}\VST3\EASY PITCH.vst3');

    // Limpieza de desinstaladores residuales dentro del bundle VST3 (evita error 11 en DAWs)
    DeleteFile(bundlePath + '\unins000.exe');
    DeleteFile(bundlePath + '\unins000.dat');
    DeleteFile(bundlePath + '\unins001.exe');
    DeleteFile(bundlePath + '\unins001.dat');

    // Anti-nesting: elimina carpeta anidada duplicada
    DelTree(bundlePath + '\EASY PITCH.vst3', True, True, True);
  end;
end;

function InitializeSetup(): Boolean;
begin
  MsgBox(
    'Antes de continuar, asegúrese de tener cerrado completamente:' + #13#10 +
    '  - FL Studio' + #13#10 +
    '  - Ableton Live' + #13#10 +
    '  - Reaper, Cubase u otro DAW' + #13#10 + #13#10 +
    'El instalador necesita acceso exclusivo para actualizar los archivos.',
    mbInformation, MB_OK);
  Result := True;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{commoncf}\VST3\EASY PITCH.vst3"
