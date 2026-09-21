#include "LicenseManager.h"

namespace EasyPitch
{

LicenseManager::LicenseManager()
{
    initLicenseState();
}

juce::File LicenseManager::getSettingsFile() const
{
    return juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
        .getChildFile ("OFFSZN")
        .getChildFile ("EasyPitch.settings");
}

juce::String LicenseManager::getHardwareID()
{
    juce::String host = juce::SystemStats::getComputerName();
    juce::String devId = juce::SystemStats::getUniqueDeviceID();
    return host + "_" + devId;
}

void LicenseManager::initLicenseState()
{
    juce::File file = getSettingsFile();
    if (file.existsAsFile())
    {
        juce::String content = file.loadFileAsString().trim();
        validateSettingsContent (content);
    }
    else
    {
        // First launch on this machine: create 3-day trial automatically
        int64_t now = juce::Time::currentTimeMillis() / 1000;
        int64_t expiresAt = now + (3 * 86400); // 3 days
        juce::String hwid = getHardwareID();
        juce::String trialKey = "PITCH-TRIAL-" + hwid.substring (0, 8).toUpperCase();

        file.getParentDirectory().createDirectory();
        juce::String initialData = trialKey + "|" + juce::String (expiresAt) + "|" + juce::String (now);
        file.replaceWithText (initialData);
        validateSettingsContent (initialData);
    }
}

void LicenseManager::validateSettingsContent (const juce::String& content)
{
    const juce::ScopedLock sl (licenseLock);

    bool isFull = content.startsWith ("PITCH-FULL-") || content.startsWith ("EASY-FULL-") || content.startsWith ("EASY-PITCH-FULL-");
    bool isTrialOrSub = content.startsWith ("PITCH-TRIAL-") || content.startsWith ("EASY-TRIAL-") || content.startsWith ("EASY-PITCH-TRIAL-")
                     || content.startsWith ("PITCH-SUB-")   || content.startsWith ("EASY-SUB-")   || content.startsWith ("EASY-PITCH-SUB-");

    if (isFull)
    {
        // Lifetime full license
        isValid.store (true);
        isTrial.store (false);
        daysLeft.store (9999);
        currentSerial = content;
        statusMessage = "Licencia vitalicia activa.";
    }
    else if (isTrialOrSub)
    {
        // Format: SERIAL|EXPIRES_UNIX|LAST_CHECK_UNIX
        auto tokens = juce::StringArray::fromTokens (content, "|", "");
        juce::String serial = tokens.size() > 0 ? tokens[0] : content;
        int64_t expiresAt   = tokens.size() > 1 ? tokens[1].getLargeIntValue() : 0;
        int64_t lastCheck   = tokens.size() > 2 ? tokens[2].getLargeIntValue() : 0;
        int64_t now         = juce::Time::currentTimeMillis() / 1000;

        currentSerial = serial;
        isTrial.store (true);

        // Fallback default: 3 days if newly saved offline
        if (expiresAt == 0)
        {
            expiresAt = now + (3 * 86400);
        }

        if (expiresAt > 0 && now >= expiresAt)
        {
            // Trial expired
            isValid.store (false);
            daysLeft.store (0);
            statusMessage = "Periodo de prueba expirado.";
        }
        else if (lastCheck > 0 && now < (lastCheck - 3600))
        {
            // Clock roll-back detected
            isValid.store (false);
            daysLeft.store (0);
            statusMessage = "Se detectó manipulación del reloj del sistema.";
        }
        else
        {
            // Valid active trial
            isValid.store (true);
            int remainingDays = 1;
            if (expiresAt > 0)
            {
                int64_t secLeft = expiresAt - now;
                remainingDays = std::max (1, static_cast<int> (std::ceil (secLeft / 86400.0)));
            }
            daysLeft.store (remainingDays);
            statusMessage = "Prueba activa: " + juce::String (remainingDays) + " días restantes.";

            // Update last-seen timestamp
            if (expiresAt > 0)
            {
                juce::File file = getSettingsFile();
                file.replaceWithText (serial + "|" + juce::String (expiresAt) + "|" + juce::String (now));
            }
        }
    }
    else
    {
        isValid.store (false);
        isTrial.store (false);
        daysLeft.store (0);
        currentSerial = "";
        statusMessage = "Clave no reconocida.";
    }
}

LicenseState LicenseManager::getLicenseState() const
{
    const juce::ScopedLock sl (licenseLock);

    LicenseState state;
    state.isValid = isValid.load();
    state.isTrial = isTrial.load();
    state.daysLeft = daysLeft.load();
    state.serial  = currentSerial;
    state.message = statusMessage;
    return state;
}

bool LicenseManager::saveSerialLocally (const juce::String& serial)
{
    juce::String trimmed = serial.trim();
    bool matches = trimmed.startsWith ("PITCH-FULL-") || trimmed.startsWith ("EASY-FULL-") || trimmed.startsWith ("EASY-PITCH-FULL-")
                || trimmed.startsWith ("PITCH-TRIAL-") || trimmed.startsWith ("EASY-TRIAL-") || trimmed.startsWith ("EASY-PITCH-TRIAL-")
                || trimmed.startsWith ("PITCH-SUB-")   || trimmed.startsWith ("EASY-SUB-")   || trimmed.startsWith ("EASY-PITCH-SUB-");
    if (! matches)
        return false;

    juce::File file = getSettingsFile();
    file.getParentDirectory().createDirectory();
    return file.replaceWithText (trimmed);
}

void LicenseManager::activateSerial (const juce::String& serialKey, std::function<void(bool success, const juce::String& msg)> callback)
{
    juce::String cleanKey = serialKey.trim();

    if (cleanKey.isEmpty())
    {
        if (callback) callback (false, "Por favor ingresa una clave de licencia.");
        return;
    }

    // Verify in background thread
    juce::Thread::launch ([this, cleanKey, callback]()
    {
        juce::String hwid = getHardwareID();
        juce::String jsonBody = "{\"serial_key\":\"" + cleanKey
                              + "\",\"hwid\":\"" + hwid
                              + "\",\"plugin_name\":\"EASY PITCH\"}";

        auto tryEndpoint = [&jsonBody](const juce::String& urlStr) -> std::unique_ptr<juce::InputStream>
        {
            juce::URL activateUrl (urlStr);
            activateUrl = activateUrl.withPOSTData (jsonBody);
            auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
                               .withExtraHeaders ("Content-Type: application/json\n")
                               .withConnectionTimeoutMs (5000);
            return activateUrl.createInputStream (options);
        };

        // 1. Try production cloud endpoint
        std::unique_ptr<juce::InputStream> stream = tryEndpoint ("https://offszn.lat/api/plugin/activate");
        
        // 2. Fallback to local dev server if cloud is offline or user testing locally
        if (stream == nullptr)
        {
            stream = tryEndpoint ("http://127.0.0.1:3000/api/plugin/activate");
        }

        if (stream == nullptr)
        {
            juce::MessageManager::callAsync ([callback]()
            {
                if (callback) callback (false, "No se pudo conectar al servidor. Se requiere conexión a internet para la primera activación.");
            });
            return;
        }

        juce::String responseText = stream->readEntireStreamAsString();
        auto json = juce::JSON::parse (responseText);

        bool success = json.isObject() && (bool) json.getProperty ("success", false);
        juce::String message = json.isObject() ? json.getProperty ("message", "").toString() : "";
        juce::String error   = json.isObject() ? json.getProperty ("error", "").toString() : "";

        if (success)
        {
            juce::String licenseType = json.getProperty ("license_type", "lifetime").toString();
            int64_t expiresAt = 0;
            if (json.hasProperty ("expires_at_unix"))
            {
                expiresAt = json.getProperty ("expires_at_unix", 0).toString().getLargeIntValue();
            }
            else if (json.hasProperty ("expires_at"))
            {
                juce::String isoStr = json.getProperty ("expires_at", "").toString();
                if (isoStr.isNotEmpty() && isoStr != "never")
                {
                    juce::Time t = juce::Time::fromISO8601 (isoStr);
                    expiresAt = t.toMilliseconds() / 1000;
                }
            }

            int64_t now = juce::Time::currentTimeMillis() / 1000;

            if (licenseType.toLowerCase().contains ("trial") && expiresAt <= 0)
            {
                int days = json.getProperty ("days_remaining", 3);
                if (days <= 0) days = 3;
                expiresAt = now + (days * 86400);
            }

            juce::File file = getSettingsFile();
            file.getParentDirectory().createDirectory();

            if (licenseType.toLowerCase().contains ("trial") || licenseType.toLowerCase().contains ("sub"))
            {
                file.replaceWithText (cleanKey + "|" + juce::String (expiresAt) + "|" + juce::String (now));
            }
            else
            {
                file.replaceWithText (cleanKey);
            }

            initLicenseState();

            juce::MessageManager::callAsync ([callback, message]()
            {
                if (callback) callback (true, message.isNotEmpty() ? message : "¡Activación completada con éxito!");
            });
        }
        else
        {
            juce::MessageManager::callAsync ([callback, error]()
            {
                if (callback) callback (false, error.isNotEmpty() ? error : "La clave de licencia no es válida.");
            });
        }
    });
}

} // namespace EasyPitch
