#include "PluginProcessor.h"
#include "PluginEditor.h"

#if JUCE_WINDOWS
 #include <objbase.h>
#endif

EasyPitchAudioProcessorEditor::EasyPitchAudioProcessorEditor (EasyPitchAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p)
{
#if JUCE_WINDOWS
    // 1. Mandatory COM Initialization for Ableton Live / Cubase
    CoInitializeEx (nullptr, COINIT_APARTMENTTHREADED);

    // 2. Dedicated isolated WebView2 user data folder
    juce::File wv2Folder = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                               .getChildFile ("OFFSZN")
                               .getChildFile ("EasyPitchWV2");
    wv2Folder.createDirectory();

    auto options = juce::WebBrowserComponent::Options{}
        .withBackend (juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled()
        .withWinWebView2Options (
            juce::WebBrowserComponent::Options::WinWebView2{}
                .withUserDataFolder (wv2Folder)
                .withStatusBarDisabled()
                .withBuiltInErrorPageDisabled());
#else
    auto options = juce::WebBrowserComponent::Options{}
        .withNativeIntegrationEnabled();
#endif

    registerNativeFunctions (options);

    webComponent = std::make_unique<EasyPitchWebBrowser> (options);

    juce::File terminadosGui ("C:/Users/Willie/Desktop/TERMINADOS - EASY PITCH/mockup.html");
    juce::File localGui      ("D:/!OFFSZN/PROYECTOS/OFFSZN/plugins/easy-pitch/mockup.html");
    juce::File desktopGui    ("C:/Users/Willie/Desktop/EASY PITCH/mockup.html");
    juce::File guiAppdata    = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                                  .getChildFile ("OFFSZN").getChildFile ("EasyPitchGui").getChildFile ("mockup.html");
    juce::File globalMacGui  ("/Library/Application Support/OFFSZN/EasyPitchGui/mockup.html");
    juce::File exeGui        = juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                                  .getParentDirectory().getChildFile ("mockup.html");
    juce::File bundleResGui  = juce::File::getSpecialLocation (juce::File::currentExecutableFile)
                                  .getParentDirectory().getParentDirectory().getChildFile ("Resources").getChildFile ("mockup.html");

    juce::File targetHtml;
    if (terminadosGui.existsAsFile())
        targetHtml = terminadosGui;
    else if (localGui.existsAsFile())
        targetHtml = localGui;
    else if (guiAppdata.existsAsFile())
        targetHtml = guiAppdata;
    else if (globalMacGui.existsAsFile())
        targetHtml = globalMacGui;
    else if (bundleResGui.existsAsFile())
        targetHtml = bundleResGui;
    else if (desktopGui.existsAsFile())
        targetHtml = desktopGui;
    else if (exeGui.existsAsFile())
        targetHtml = exeGui;
    else
        targetHtml = localGui;

    juce::String url = "file:///" + targetHtml.getFullPathName().replaceCharacter ('\\', '/');
    webComponent->goToURL (url);

    addAndMakeVisible (*webComponent);
    setSize (860, 425);
    setResizable (false, false);

    startTimerHz (30);
}

EasyPitchAudioProcessorEditor::~EasyPitchAudioProcessorEditor()
{
    stopTimer();
    webComponent = nullptr;
}

void EasyPitchAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff0c0e12));
}

void EasyPitchAudioProcessorEditor::resized()
{
    if (webComponent != nullptr)
        webComponent->setBounds (getLocalBounds());
}

void EasyPitchAudioProcessorEditor::registerNativeFunctions (juce::WebBrowserComponent::Options& options)
{
    options = options
        .withNativeFunction ("setParam", [this] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 2)
            {
                juce::String id = args[0].toString();
                float val = static_cast<float> (args[1]);

                juce::Component::SafePointer<EasyPitchAudioProcessorEditor> safeThis (this);
                juce::MessageManager::callAsync ([safeThis, id, val]
                {
                    if (safeThis != nullptr)
                        safeThis->audioProcessor.setParamFromUI (id, val);
                });
            }
            complete (juce::var());
        })
        .withNativeFunction ("getParam", [this] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 1)
            {
                juce::String id = args[0].toString();
                float val = audioProcessor.getParamValue (id);
                complete (juce::var (val));
                return;
            }
            complete (juce::var (0.0f));
        })
        .withNativeFunction ("getAllParams", [this] (const juce::Array<juce::var>&, auto complete)
        {
            auto* obj = new juce::DynamicObject();
            obj->setProperty ("enabled",        audioProcessor.getParamValue ("enabled"));
            obj->setProperty ("key",            audioProcessor.getParamValue ("key"));
            obj->setProperty ("scale",          audioProcessor.getParamValue ("scale"));
            obj->setProperty ("speed",          audioProcessor.getParamValue ("speed"));
            obj->setProperty ("amount",         audioProcessor.getParamValue ("amount"));
            obj->setProperty ("voiceRange",     audioProcessor.getParamValue ("voiceRange"));
            obj->setProperty ("preserveTimbre", audioProcessor.getParamValue ("preserveTimbre"));
            obj->setProperty ("referenceHz",    audioProcessor.getParamValue ("referenceHz"));
            obj->setProperty ("customMask",     audioProcessor.getParamValue ("customMask"));
            obj->setProperty ("channelMode",    audioProcessor.getParamValue ("channelMode"));
            complete (juce::var (obj));
        })
        .withNativeFunction ("uiReady", [this] (const juce::Array<juce::var>&, auto complete)
        {
            auto* obj = new juce::DynamicObject();
            obj->setProperty ("enabled",        audioProcessor.getParamValue ("enabled"));
            obj->setProperty ("key",            audioProcessor.getParamValue ("key"));
            obj->setProperty ("scale",          audioProcessor.getParamValue ("scale"));
            obj->setProperty ("speed",          audioProcessor.getParamValue ("speed"));
            obj->setProperty ("amount",         audioProcessor.getParamValue ("amount"));
            obj->setProperty ("voiceRange",     audioProcessor.getParamValue ("voiceRange"));
            obj->setProperty ("preserveTimbre", audioProcessor.getParamValue ("preserveTimbre"));
            obj->setProperty ("referenceHz",    audioProcessor.getParamValue ("referenceHz"));
            obj->setProperty ("customMask",     audioProcessor.getParamValue ("customMask"));
            obj->setProperty ("channelMode",    audioProcessor.getParamValue ("channelMode"));
            complete (juce::var (obj));
        })
        .withNativeFunction ("getLiveMeters", [this] (const juce::Array<juce::var>&, auto complete)
        {
            auto metrics = audioProcessor.getLiveMetrics();
            auto* obj = new juce::DynamicObject();
            obj->setProperty ("inputNote",  metrics.inputNote);
            obj->setProperty ("targetNote", metrics.targetNote);
            obj->setProperty ("inputMidi",  metrics.inputMidi);
            obj->setProperty ("targetMidi", metrics.targetMidi);
            obj->setProperty ("centsShift", metrics.centsShift);
            obj->setProperty ("rmsLevel",   metrics.rmsLevel);
            obj->setProperty ("isVoiced",   metrics.isVoiced);
            obj->setProperty ("customMask", metrics.customMask);
            complete (juce::var (obj));
        })
        .withNativeFunction ("getLicenseState", [this] (const juce::Array<juce::var>&, auto complete)
        {
            auto state = audioProcessor.getLicenseManager().getLicenseState();
            auto* obj = new juce::DynamicObject();
            obj->setProperty ("isValid",  state.isValid);
            obj->setProperty ("isTrial",  state.isTrial);
            obj->setProperty ("daysLeft", state.daysLeft);
            obj->setProperty ("serial",   state.serial);
            obj->setProperty ("message",  state.message);
            obj->setProperty ("hwid",     EasyPitch::LicenseManager::getHardwareID());
            complete (juce::var (obj));
        })
        .withNativeFunction ("getHardwareId", [] (const juce::Array<juce::var>&, auto complete)
        {
            complete (juce::var (EasyPitch::LicenseManager::getHardwareID()));
        })
        .withNativeFunction ("saveLicense", [this] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 1)
            {
                juce::String serial = args[0].toString();
                bool saved = audioProcessor.getLicenseManager().saveSerialLocally (serial);
                if (saved) audioProcessor.getLicenseManager().initLicenseState();
                complete (juce::var (saved));
                return;
            }
            complete (juce::var (false));
        })
        .withNativeFunction ("setLicenseStatus", [this] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 2)
            {
                juce::String serial = args[1].toString();
                audioProcessor.getLicenseManager().saveSerialLocally (serial);
            }
            audioProcessor.getLicenseManager().initLicenseState();
            complete (juce::var (audioProcessor.getLicenseManager().isLicensed()));
        })
        .withNativeFunction ("activateLicense", [this] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 1)
            {
                juce::String serial = args[0].toString();
                audioProcessor.getLicenseManager().activateSerial (serial, [complete] (bool success, const juce::String& msg)
                {
                    auto* res = new juce::DynamicObject();
                    res->setProperty ("success", success);
                    res->setProperty ("message", msg);
                    complete (juce::var (res));
                });
                return;
            }
            auto* err = new juce::DynamicObject();
            err->setProperty ("success", false);
            err->setProperty ("message", "Serial no proporcionado.");
            complete (juce::var (err));
        })
        .withNativeFunction ("loadPreset", [this] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 1)
            {
                int index = static_cast<int> (args[0]);
                audioProcessor.loadPresetByIndex (index);
            }
            complete (juce::var());
        })
        .withNativeFunction ("openBrowserURL", [] (const juce::Array<juce::var>& args, auto complete)
        {
            if (args.size() >= 1)
            {
                juce::URL (args[0].toString()).launchInDefaultBrowser();
            }
            complete (juce::var());
        });
}

void EasyPitchAudioProcessorEditor::timerCallback()
{
    if (webComponent == nullptr)
        return;

    // 1. Initial State Sync to UI during page load
    if (initialSyncTicks > 0)
    {
        --initialSyncTicks;
        juce::String syncJson = "{"
            "enabled:"        + juce::String (audioProcessor.getParamValue ("enabled")) + ","
            "key:"            + juce::String (audioProcessor.getParamValue ("key")) + ","
            "scale:"          + juce::String (audioProcessor.getParamValue ("scale")) + ","
            "speed:"          + juce::String (audioProcessor.getParamValue ("speed")) + ","
            "amount:"         + juce::String (audioProcessor.getParamValue ("amount")) + ","
            "voiceRange:"     + juce::String (audioProcessor.getParamValue ("voiceRange")) + ","
            "preserveTimbre:" + juce::String (audioProcessor.getParamValue ("preserveTimbre")) + ","
            "referenceHz:"    + juce::String (audioProcessor.getParamValue ("referenceHz")) + ","
            "customMask:"     + juce::String (audioProcessor.getParamValue ("customMask")) + ","
            "channelMode:"    + juce::String (audioProcessor.getParamValue ("channelMode"))
        + "}";
        webComponent->evaluateJavascript ("try { if (window.syncFromHost) { window.syncFromHost(" + syncJson + "); } } catch(e){}");
    }

    // 2. Poll pending UI parameter changes (Dual-pipeline bridge for 100% reliability)
    webComponent->evaluateJavascript (
        "(function() { try { return window.flushPendingChanges ? window.flushPendingChanges() : null; } catch(e) { return null; } })()",
        [this] (const juce::WebBrowserComponent::EvaluationResult& res)
        {
            if (const auto* varPtr = res.getResult())
            {
                if (const auto* val = varPtr->getArray())
                {
                    for (const auto& item : *val)
                    {
                        if (auto* obj = item.getDynamicObject())
                        {
                            juce::String id = obj->getProperty ("id").toString();
                            float paramVal = static_cast<float> (obj->getProperty ("val"));
                            audioProcessor.setParamFromUI (id, paramVal);
                        }
                    }
                }
            }
        });

    // 3. Push real-time pitch detection & correction metrics
    auto metrics = audioProcessor.getLiveMetrics();
    juce::String json = "{"
        "inputNote:'"   + metrics.inputNote  + "',"
        "targetNote:'"  + metrics.targetNote + "',"
        "inputMidi:"    + juce::String (metrics.inputMidi, 2) + ","
        "targetMidi:"   + juce::String (metrics.targetMidi, 2) + ","
        "centsShift:"   + juce::String (metrics.centsShift, 1) + ","
        "rmsLevel:"     + juce::String (metrics.rmsLevel, 3)   + ","
        "isVoiced:"     + (metrics.isVoiced ? "true" : "false") + ","
        "customMask:"   + juce::String (metrics.customMask)
    + "}";

    webComponent->evaluateJavascript ("try { if (window.onLiveMetersUpdate) { window.onLiveMetersUpdate(" + json + "); } } catch (e) {}");
}
