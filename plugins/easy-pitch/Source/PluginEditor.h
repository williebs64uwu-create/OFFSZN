#pragma once
#include <JuceHeader.h>
#include "PluginProcessor.h"

class EasyPitchWebBrowser : public juce::WebBrowserComponent
{
public:
    using WebBrowserComponent::WebBrowserComponent;

    bool pageAboutToLoad (const juce::String& newURL) override
    {
        // Allow local file:// URLs (our plugin UI)
        if (newURL.startsWith ("file://"))
            return true;

        // For all external http/https URLs, open in system default browser
        if (newURL.startsWith ("http://") || newURL.startsWith ("https://"))
        {
            juce::URL (newURL).launchInDefaultBrowser();
            return false;
        }

        return true;
    }

    void newWindowAttemptingToLoad (const juce::String& newURL) override
    {
        juce::URL (newURL).launchInDefaultBrowser();
    }
};

class EasyPitchAudioProcessorEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit EasyPitchAudioProcessorEditor (EasyPitchAudioProcessor&);
    ~EasyPitchAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;
    void timerCallback() override;

private:
    EasyPitchAudioProcessor& audioProcessor;
    std::unique_ptr<EasyPitchWebBrowser> webComponent;

    void registerNativeFunctions (juce::WebBrowserComponent::Options& options);
    void sendInitialStateToUI();
    int initialSyncTicks = 90;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (EasyPitchAudioProcessorEditor)
};
