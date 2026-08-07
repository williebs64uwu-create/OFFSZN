---
name: juce-plugin-creator
description: Standard instructions and best practices for creating, securing, compiling, and packaging OFFSZN JUCE VST3 audio plugins (Easy Mix, Easy Master, Inka Kola, etc.).
---

# OFFSZN JUCE VST3 Plugin Creator & Licensing Architecture

This skill defines the mandatory technical standards for all OFFSZN VST3 audio plugins.

---

## 1. Local GUI Architecture (Fixing Error 11 & Error 13)

To prevent WebView2 network disconnections (Error 11) and DNS resolution failures (Error 13), all plugins load their HTML/CSS/JS interface from local disk:

### `PluginEditor.cpp` URL Loading Logic
```cpp
juce::File guiDir = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                        .getChildFile ("OFFSZN")
                        .getChildFile ("<PluginGuiFolder>"); // e.g. EasyMixGui, EasyMasterGui
juce::File guiFile = guiDir.getChildFile ("mockup.html");

// Auto-copy on first run from binary directory
if (!guiFile.existsAsFile())
{
    guiDir.createDirectory();
    juce::File exeDir = juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                            .getParentDirectory();
    juce::File src = exeDir.getChildFile ("mockup.html");
    if (src.existsAsFile())
        src.copyFileTo (guiFile);
}

const juce::String url = guiFile.existsAsFile()
    ? "file:///" + guiFile.getFullPathName().replaceCharacter ('\\', '/')
    : "https://offszn.lat/plugins/<plugin-slug>?v=5"; // Remote fallback

webComponent->goToURL (url);
```

---

## 2. Server-Side Authoritative C++ Security (Anti-Piracy)

**NEVER trust JS `setLicenseStatus(true)` calls!** Local HTML files can be edited by users.

### Native Function Bridge (`setLicenseStatus`)
```cpp
if (audioProcessor.isLicenseValid.load())
{
    complete (juce::var());
    return; // Already restored from disk
}

juce::String serial = args.size() > 1 ? args[1].toString().trim() : "";
if (serial.isEmpty()) { audioProcessor.isLicenseValid.store (false); return; }

// Launch C++ background HTTP POST to server
juce::Thread::launch ([this, serial] ()
{
    juce::String hwid = juce::SystemStats::getComputerName() + "_" + juce::SystemStats::getUniqueDeviceID();
    juce::URL verifyUrl ("https://offszn.lat/api/plugin/activate");
    juce::String jsonBody = "{\"serial_key\":\"" + serial + "\",\"hwid\":\"" + hwid + "\",\"plugin_name\":\"<PluginName>\"}";
    verifyUrl = verifyUrl.withPOSTData (jsonBody);

    auto httpOptions = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
                           .withExtraHeaders ("Content-Type: application/json\n")
                           .withConnectionTimeoutMs (8000);

    std::unique_ptr<juce::InputStream> stream (verifyUrl.createInputStream (httpOptions));
    bool serverConfirmed = false;
    juce::String licenseType = "lifetime";
    juce::String expiresAtStr = "never";

    if (stream != nullptr)
    {
        auto responseJson = juce::JSON::parse (stream->readEntireStreamAsString());
        if (responseJson.isObject() && (bool) responseJson.getProperty ("success", false))
        {
            serverConfirmed = true;
            licenseType     = responseJson.getProperty ("license_type", "lifetime").toString();
            expiresAtStr    = responseJson.getProperty ("expires_at", "never").toString();
        }
    }

    juce::MessageManager::callAsync ([this, serial, serverConfirmed, licenseType, expiresAtStr] ()
    {
        if (serverConfirmed)
        {
            juce::String diskData = serial;
            if (licenseType == "trial" && expiresAtStr != "never" && expiresAtStr.isNotEmpty())
            {
                juce::Time expTime  = juce::Time::fromISO8601 (expiresAtStr);
                int64_t expiresUnix = expTime.toMilliseconds() / 1000;
                int64_t nowUnix     = juce::Time::currentTimeMillis() / 1000;
                diskData            = serial + "|" + juce::String (expiresUnix) + "|" + juce::String (nowUnix);
            }

            juce::File appData = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                                     .getChildFile ("OFFSZN").getChildFile ("<PluginSettingsFile>.settings");
            appData.getParentDirectory().createDirectory();
            appData.replaceWithText (diskData);
            audioProcessor.isLicenseValid.store (true);
        }
        else
        {
            audioProcessor.isLicenseValid.store (false);
        }
    });
});
```

---

## 3. Offline License Verification & Anti-Tamper (`PluginProcessor.cpp`)

```cpp
if (settingsFile.existsAsFile())
{
    juce::String content = settingsFile.loadFileAsString().trim();
    if (content.startsWith ("<SERIAL_PREFIX_FULL>-")) // e.g. EASY-FULL-, EASY-MASTER-FULL-
    {
        // FULL License: 100% offline forever, no clock or timestamp checks
        isLicenseValid.store (true);
    }
    else if (content.startsWith ("<SERIAL_PREFIX_TRIAL>-")) // e.g. EASY-TRIAL-
    {
        auto tokens       = juce::StringArray::fromTokens (content, "|", "");
        juce::String serial = tokens.size() > 0 ? tokens[0] : content;
        int64_t expiresAt   = tokens.size() > 1 ? tokens[1].getLargeIntValue() : 0;
        int64_t lastCheck   = tokens.size() > 2 ? tokens[2].getLargeIntValue() : 0;
        int64_t now         = juce::Time::currentTimeMillis() / 1000;

        if (expiresAt > 0 && now >= expiresAt)
        {
            isLicenseValid.store (false); // Expired trial
        }
        else if (lastCheck > 0 && now < (lastCheck - 3600))
        {
            isLicenseValid.store (false); // Clock rewind detected
        }
        else
        {
            isLicenseValid.store (true);
            if (expiresAt > 0)
                settingsFile.replaceWithText (serial + "|" + juce::String (expiresAt) + "|" + juce::String (now));
        }
    }
}
```

---

---

## 4. Ableton Live 11 & DAW Compatibility Standards (JUCE 8 + WebView2)

To prevent immediate host crashes in Ableton Live 11 and other DAWs when opening the VST3 editor:

### A. Windows COM Thread Apartment Initialization
Ableton Live 11 instantiates VST3 editor windows on threads where COM is not initialized. Before instantiating `juce::WebBrowserComponent` in `PluginEditor.cpp`, call:
```cpp
#if JUCE_WINDOWS
  #include <objbase.h>
  // In Editor Constructor:
  CoInitializeEx (nullptr, COINIT_APARTMENTTHREADED);
#endif
```

### B. Isolated WebView2 Cache Folder per Plugin
Never share the same `WebView2Cache` folder across different plugins or plugin instances to prevent file locking conflicts (`ERROR_SHARING_VIOLATION`):
```cpp
juce::File wv2Folder = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                           .getChildFile ("OFFSZN")
                           .getChildFile ("<PluginName>WV2"); // e.g. InkaKolaWV2, EasyMixWV2
wv2Folder.createDirectory();

auto options = juce::WebBrowserComponent::Options{}
    .withWinWebView2Options (juce::WebBrowserComponent::Options::WinWebView2{}.withUserDataFolder (wv2Folder));
```

### C. Avoid Duplicate Function Listener Registration
**NEVER** register the same function name in both `.withEventListener("funcName", ...)` and `.withNativeFunction("funcName", ...)`. Having duplicate keys causes JUCE's internal options map to abort during `WebBrowserComponent` construction. Use `.withNativeFunction` exclusively for two-way JS ↔ C++ bridges.

### D. SafePointer Protection for Asynchronous Callbacks
Always wrap `this` pointers in `juce::Component::SafePointer` when scheduling async tasks to prevent crashes if the DAW closes the plugin window prematurely:
```cpp
juce::Component::SafePointer<MyAudioProcessorEditor> safeThis (this);
juce::MessageManager::callAsync ([safeThis, id, val] {
    if (safeThis != nullptr)
        safeThis->audioProcessor.setParamFromUI (id, val);
});
```

---

## 5. Inno Setup Installer Standard (`.iss`) & Silent WebView2 Auto-Installation

### Licensing Security Guarantee
Installing Microsoft Edge WebView2 Runtime **has ZERO impact on plugin licensing or anti-piracy security**. 
- Licensing is 100% server-verified and enforced in compiled C++ native code (`PluginProcessor.cpp` / `validateKey` / `getHWID`).
- WebView2 Runtime is strictly an HTML/CSS/JS UI renderer.

### Inno Setup (`.iss`) Script with Background Silent WebView2 Installer
All OFFSZN plugin installers must automatically check for Microsoft Edge WebView2 Runtime in the Windows Registry and silently install it if missing:

```ini
[Setup]
AppName=OFFSZN <PLUGIN_NAME> VST3
AppVersion=1.0.0
DefaultDirName={autopf}\OFFSZN\<PLUGIN_NAME>
DefaultGroupName=OFFSZN
OutputDir=.\installer_output
OutputBaseFilename=<PLUGIN_NAME>_Setup
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin

[Files]
Source: "build\<PLUGIN_NAME>_artefacts\Release\VST3\<PLUGIN_NAME>.vst3\*"; DestDir: "{commoncf64}\VST3\<PLUGIN_NAME>.vst3"; Flags: recursesubdirs createallsubdirs ignoreversion

[Code]
function IsWebView2Installed(): Boolean;
var
  verStr: String;
begin
  Result := RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3C4FA00-2870-474C-B5E0-F91685E92E76}', 'pv', verStr) or
            RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3C4FA00-2870-474C-B5E0-F91685E92E76}', 'pv', verStr) or
            RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3C4FA00-2870-474C-B5E0-F91685E92E76}', 'pv', verStr);
  if verStr = '0.0.0.0' then
    Result := False;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  resCode: Integer;
  psCmd: String;
begin
  if CurStep = ssPostInstall then
  begin
    if not IsWebView2Installed() then
    begin
      // Silent download and background install of WebView2 Runtime (invisible to user)
      psCmd := '-NoProfile -ExecutionPolicy Bypass -Command "$webClient = New-Object System.Net.WebClient; $webClient.DownloadFile(''https://go.microsoft.com/fwlink/p/?LinkId=2124703'', ''$env:TEMP\wv2setup.exe''); Start-Process ''$env:TEMP\wv2setup.exe'' -ArgumentList ''/silent /install'' -Wait"';
      Exec('powershell.exe', psCmd, '', SW_HIDE, ewWaitUntilTerminated, resCode);
    end;
  end;
end;
```
