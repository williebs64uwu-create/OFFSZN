; VOCAL_PRESET.iss
; Instalador Windows (Inno Setup 6.1+) para OFFSZN VOCAL PRESET VST3 v1.0.0
; Funciona para FL Studio, Ableton Live, Reaper, Cubase, Studio One, etc. (VST3 x64)
;
; Causa del error "'Promise' no está definido": si el PC no tiene el runtime de
; Microsoft Edge WebView2, JUCE cae al motor viejo de Internet Explorer (MSHTML)
; y la GUI moderna no puede ejecutarse. Este instalador detecta WebView2 y lo
; instala en silencio si falta.

#define AppName "VOCAL PRESET"
#define AppVer  "1.0.0"
#define Gui     "VocalPresetGui"

[Setup]
AppId={{6B0F2E7A-3C41-4E9D-8A55-0C7D1F9E4B21}}
AppName={#AppName} VST3
AppVersion={#AppVer}
AppPublisher=OFFSZN
AppPublisherURL=https://offszn.lat
DefaultDirName={autopf}\OFFSZN\{#AppName}
DefaultGroupName=OFFSZN
DisableProgramGroupPage=yes
DisableDirPage=yes
DirExistsWarning=no
OutputBaseFilename=OFFSZN_VocalPreset_Setup
OutputDir=.\Output
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
UninstallDisplayName={#AppName} VST3

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Binario VST3 → carpeta global de VST3 (la leen FL Studio, Ableton, Reaper...)
Source: "build\VOCAL_PRESET_artefacts\Release\VST3\Vocal Preset.vst3\*"; \
    DestDir: "{commoncf}\VST3\Vocal Preset.vst3"; \
    Flags: ignoreversion recursesubdirs createallsubdirs

; GUI HTML local: se actualiza siempre y se conserva al desinstalar
Source: "..\..\mockup.html"; \
    DestDir: "{userappdata}\OFFSZN\{#Gui}"; \
    DestName: "mockup.html"; \
    Flags: ignoreversion uninsneveruninstall

[Code]
const
  WV2_GUID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WV2_URL  = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';

function IsWebView2Installed(): Boolean;
var
  ver: String;
begin
  Result :=
    (RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\' + WV2_GUID, 'pv', ver) and (ver <> '') and (ver <> '0.0.0.0'))
    or (RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_GUID, 'pv', ver) and (ver <> '') and (ver <> '0.0.0.0'))
    or (RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WV2_GUID, 'pv', ver) and (ver <> '') and (ver <> '0.0.0.0'));
end;

procedure InstallWebView2();
var
  tmp: String;
  rc: Integer;
begin
  if IsWebView2Installed() then Exit;

  tmp := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
  try
    DownloadTemporaryFile(WV2_URL, 'MicrosoftEdgeWebview2Setup.exe', '', nil);
    if not Exec(tmp, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, rc) then
      rc := -1;
  except
    rc := -1;
  end;

  if not IsWebView2Installed() then
    MsgBox(
      'No se pudo instalar Microsoft Edge WebView2 automáticamente.' + #13#10 +
      'Sin él, la interfaz de VOCAL PRESET no se mostrará bien.' + #13#10 + #13#10 +
      'Instálalo manualmente desde:' + #13#10 +
      'https://developer.microsoft.com/microsoft-edge/webview2/' + #13#10 +
      '(botón "Evergreen Standalone Installer") y vuelve a abrir tu DAW.',
      mbError, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  bundlePath: String;
begin
  if CurStep = ssInstall then
  begin
    bundlePath := ExpandConstant('{commoncf}\VST3\Vocal Preset.vst3');

    // Limpia desinstaladores residuales dentro del bundle (evita error en DAWs)
    DeleteFile(bundlePath + '\unins000.exe');
    DeleteFile(bundlePath + '\unins000.dat');
    // Anti-nesting
    DelTree(bundlePath + '\Vocal Preset.vst3', True, True, True);
  end;

  if CurStep = ssPostInstall then
    InstallWebView2();
end;

function InitializeSetup(): Boolean;
begin
  MsgBox(
    'Antes de continuar, cierra por completo:' + #13#10 +
    '  - FL Studio' + #13#10 +
    '  - Ableton Live' + #13#10 +
    '  - Reaper, Cubase u otro DAW' + #13#10 + #13#10 +
    'El instalador necesita acceso exclusivo para actualizar los archivos.',
    mbInformation, MB_OK);
  Result := True;
end;

[UninstallDelete]
Type: filesandordirs; Name: "{commoncf}\VST3\Vocal Preset.vst3"
