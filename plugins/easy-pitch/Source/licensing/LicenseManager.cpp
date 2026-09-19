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
        isValid.store (false);
        isTrial.store (false);
        daysLeft.store (0);

        const juce::ScopedLock sl (licenseLock);
        currentSerial = "";
        statusMessage = "Sin licencia activa.";
    }
}

void LicenseManager::validateSettingsContent (const juce::String& content)
{
    const juce::ScopedLock sl (licenseLock);

    if (content.startsWith ("EASY-FULL-"))
    {
        // Lifetime full license
        isValid.store (true);
        isTrial.store (false);
        daysLeft.store (9999);
        currentSerial = content;
        statusMessage = "Licencia vitalicia activa.";
    }
    else if (content.startsWith ("EASY-TRIAL-"))
    {
        // Format: SERIAL|EXPIRES_UNIX|LAST_CHECK_UNIX
        auto tokens = juce::StringArray::fromTokens (content, "|", "");
        juce::String serial = tokens.size() > 0 ? tokens[0] : content;
        int64_t expiresAt   = tokens.size() > 1 ? tokens[1].getLargeIntValue() : 0;
        int64_t lastCheck   = tokens.size() > 2 ? tokens[2].getLargeIntValue() : 0;
        int64_t now         = juce::Time::currentTimeMillis() / 1000;

        currentSerial = serial;
        isTrial.store (true);

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
    if (! (trimmed.startsWith ("EASY-FULL-") || trimmed.startsWith ("EASY-TRIAL-")))
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
        juce::URL activateUrl ("https://offszn.lat/api/plugin/activate");
        
        juce::String jsonBody = "{\"serial_key\":\"" + cleanKey
                              + "\",\"hwid\":\"" + hwid
                              + "\",\"plugin_name\":\"EASY PITCH\"}";

        activateUrl = activateUrl.withPOSTData (jsonBody);

        auto options = juce::URL::InputStreamOptions (juce::URL::ParameterHandling::inAddress)
                           .withExtraHeaders ("Content-Type: application/json\n")
                           .withConnectionTimeoutMs (8000);

        std::unique_ptr<juce::InputStream> stream (activateUrl.createInputStream (options));

        if (stream == nullptr)
        {
            // Server not reachable
            // If the format is already valid and user is offline, check if it's already saved
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
                expiresAt = json.getProperty ("expires_at_unix", 0).toString().getLargeIntValue();

            int64_t now = juce::Time::currentTimeMillis() / 1000;
            juce::File file = getSettingsFile();
            file.getParentDirectory().createDirectory();

            if (licenseType.toLowerCase().contains ("trial"))
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
