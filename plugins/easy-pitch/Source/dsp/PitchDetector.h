#pragma once
#include <juce_core/juce_core.h>
#include <juce_audio_basics/juce_audio_basics.h>
#include <vector>

namespace EasyPitch
{

struct PitchDetectionResult
{
    float pitchHz    = 0.0f;
    float clarity    = 0.0f; // 0.0 to 1.0
    bool  isVoiced   = false;
    float rmsLevel   = 0.0f;
};

class PitchDetector
{
public:
    PitchDetector();
    ~PitchDetector() = default;

    void prepare (double sampleRate, int maxBlockSize);
    void reset();

    // Push new incoming samples and process analysis periodically
    // Returns true when a new pitch frame is calculated
    bool processSample (float sample, PitchDetectionResult& outResult, int voiceRangeIndex = 0);

    // Get the most recent detection result
    const PitchDetectionResult& getLatestResult() const { return latestResult; }

private:
    double currentSampleRate = 48000.0;
    static constexpr int WINDOW_SIZE = 2048;
    static constexpr int HOP_SIZE    = 128; // ~2.6ms at 48kHz for fast causal response

    std::vector<float> inputBuffer;
    std::vector<float> linearWindow;
    int writeIndex = 0;
    int hopCounter = 0;

    // Temporary buffers for NSDF calculation
    std::vector<float> nsdfBuffer;
    std::vector<int> maxPositions;
    std::vector<float> periodEstimates;
    std::vector<float> ampEstimates;

    // DC Blocker filter state
    float dcX1 = 0.0f;
    float dcY1 = 0.0f;

    PitchDetectionResult latestResult;

    void analyzeFrame (int voiceRangeIndex);
    void computeNSDF (const float* window, int size, int minTau, int maxTau);
};

} // namespace EasyPitch
