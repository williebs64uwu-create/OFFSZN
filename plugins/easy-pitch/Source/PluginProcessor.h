#pragma once
#include <JuceHeader.h>
#include <atomic>
#include <memory>
#include "dsp/PitchDetector.h"
#include "dsp/ScaleQuantizer.h"
#include "dsp/PitchShifter.h"
#include "licensing/LicenseManager.h"

namespace EasyPitch
{

struct LiveMetrics
{
    float inputMidi    = 0.0f;
    float targetMidi   = 0.0f;
    float centsShift   = 0.0f;
    float rmsLevel     = 0.0f;
    bool  isVoiced     = false;
    juce::String inputNote;
    juce::String targetNote;
    int   customMask   = 0x0FFF;
};

} // namespace EasyPitch

class EasyPitchAudioProcessor : public juce::AudioProcessor
{
public:
    EasyPitchAudioProcessor();
    ~EasyPitchAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;

    #ifndef JucePlugin_PreferredChannelConfigurations
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    #endif

    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;
    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    // ── UI Bridge Communication ──────────────────────────────────────────────
    void setParamFromUI (const juce::String& paramId, float value);
    float getParamValue (const juce::String& paramId) const;

    EasyPitch::LiveMetrics getLiveMetrics() const;
    EasyPitch::LicenseManager& getLicenseManager() { return licenseManager; }

    void loadPresetByIndex (int index);

private:
    // ── DSP Modules ──────────────────────────────────────────────────────────
    EasyPitch::PitchDetector   pitchDetector;
    EasyPitch::ScaleQuantizer  scaleQuantizer;
    EasyPitch::PitchShifter    pitchShifter;
    EasyPitch::LicenseManager  licenseManager;

    // ── Atomic Parameters ────────────────────────────────────────────────────
    std::atomic<bool>  p_enabled        { true };
    std::atomic<int>   p_key            { 0 };     // 0 = C / Do (0-indexed across 12 semitones)
    std::atomic<int>   p_scale          { 0 };     // 0 = Mayor, 1 = Menor natural
    std::atomic<float> p_speed          { 65.0f }; // 0 - 100%
    std::atomic<float> p_amount         { 100.0f };// 0 - 100%
    std::atomic<int>   p_voiceRange     { 0 };     // 0 = General, 1 = Grave, 2 = Aguda
    std::atomic<bool>  p_preserveTimbre { true };
    std::atomic<float> p_referenceHz    { 440.0f };// 430 - 450 Hz
    std::atomic<int>   p_customMask     { 0x0FFF };// 12-bit mask for allowed chromatic notes (default all enabled)
    std::atomic<int>   p_channelMode    { 1 };     // Default: 1 = Mono Coherente (Waves Tune Real-Time standard)

    // ── Live Feedback Metrics (UI Timer Reads) ───────────────────────────────
    std::atomic<float> liveInputMidi    { 0.0f };
    std::atomic<float> liveTargetMidi   { 0.0f };
    std::atomic<float> liveCentsShift   { 0.0f };
    std::atomic<float> liveRMS          { 0.0f };
    std::atomic<bool>  liveIsVoiced     { false };

    mutable juce::CriticalSection notesLock;
    juce::String liveInputNote  { "--" };
    juce::String liveTargetNote { "--" };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (EasyPitchAudioProcessor)
};
