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

## 4. Inno Setup Installer Script Standard (`.iss`)

```ini
[Setup]
AppName=OFFSZN <PLUGIN_NAME> VST3
AppVersion=1.5.0
DefaultDirName={commoncf}\VST3\<PLUGIN_NAME>.vst3
OutputBaseFilename=OFFSZN_<PLUGIN_NAME>_v1.5_Setup
OutputDir=Output
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Files]
; VST3 binary
Source: "build\<PLUGIN_NAME>_artefacts\Release\VST3\<PLUGIN_NAME>.vst3\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

; GUI local file
Source: "mockup.html"; DestDir: "{userappdata}\OFFSZN\<PluginGuiFolder>"; DestName: "mockup.html"; Flags: ignoreversion uninsneveruninstall
```
