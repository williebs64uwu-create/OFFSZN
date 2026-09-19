#pragma once
#include <juce_core/juce_core.h>
#include <juce_events/juce_events.h>
#include <atomic>

namespace EasyPitch
{

struct LicenseState
{
    bool isValid = false;
    bool isTrial = false;
    int daysLeft = 0;
    juce::String serial;
    juce::String message;
};

class LicenseManager
{
public:
    LicenseManager();
    ~LicenseManager() = default;

    // Load license from disk on startup
    void initLicenseState();

    // Check if license is currently valid (thread-safe)
    bool isLicensed() const { return isValid.load(); }

    // Get snapshot of license details for UI
    LicenseState getLicenseState() const;

    // Direct key activation (called from native bridge)
    void activateSerial (const juce::String& serial, std::function<void(bool success, const juce::String& msg)> callback);

    // Save serial directly to disk if format is valid
    bool saveSerialLocally (const juce::String& serial);

    // Get hardware ID
    static juce::String getHardwareID();

private:
    std::atomic<bool> isValid { false };
    std::atomic<bool> isTrial { false };
    std::atomic<int>  daysLeft { 0 };

    mutable juce::CriticalSection licenseLock;
    juce::String currentSerial;
    juce::String statusMessage;

    juce::File getSettingsFile() const;
    void validateSettingsContent (const juce::String& content);
};

} // namespace EasyPitch
