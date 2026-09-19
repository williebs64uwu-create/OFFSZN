#pragma once
#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <vector>

namespace EasyPitch
{

class PitchShifter
{
public:
    PitchShifter();
    ~PitchShifter() = default;

    void prepare (double sampleRate, int maxBlockSize);
    void reset();

    // Set desired shift in cents (-1200 to +1200 cents), speed (0-100), amount (0-100), voiced state and detected pitch
    void setTargetShift (float targetCents, float speedPercent, float amountPercent, bool isVoiced, float detectedHz = 0.0f);
    
    // Set whether formant/timbre preservation is enabled
    void setPreserveTimbre (bool preserve) { preserveTimbre = preserve; }

    // Process a block of audio (supports 1 or 2 channels)
    // if bypassToOriginal is true, outputs the delay-aligned original dry audio
    void processBlock (juce::AudioBuffer<float>& buffer, bool bypassToOriginal);

    int getLatencySamples() const { return LATENCY_SAMPLES; }
    float getCurrentAppliedCents() const { return currentCents; }

private:
    double currentSampleRate = 48000.0;
    static constexpr int LATENCY_SAMPLES = 512;
    static constexpr int DELAY_BUFFER_SIZE = 8192;

    // Trajectory smoothing state
    float targetCents  = 0.0f;
    float currentCents = 0.0f;
    float pitchRatio   = 1.0f;
    bool  wasVoiced    = false;
    bool  preserveTimbre = true;

    // Pitch-synchronous grain state
    float targetGrainLength  = 480.0f;
    float currentGrainLength = 480.0f;

    // Ring buffers for left & right channels
    std::vector<float> delayBufferL;
    std::vector<float> delayBufferR;
    int writeIndex = 0;

    // Grain phases for dual-pointer overlap-add pitch shifting
    float grainPhase0 = 0.0f;
    float grainPhase1 = 0.5f;

    // Formant preservation filtering states
    float formantFilterStateL = 0.0f;
    float formantFilterStateR = 0.0f;

    // Smooth bypass gain crossfader
    float bypassGain = 0.0f;

    void updateSmoothing (float speedPercent);
};

} // namespace EasyPitch
