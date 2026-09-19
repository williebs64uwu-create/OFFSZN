#include "PitchDetector.h"
#include <cmath>
#include <algorithm>

namespace EasyPitch
{

PitchDetector::PitchDetector()
{
    inputBuffer.resize (WINDOW_SIZE, 0.0f);
    linearWindow.resize (WINDOW_SIZE, 0.0f);
    nsdfBuffer.resize (WINDOW_SIZE, 0.0f);
    maxPositions.reserve (64);
    periodEstimates.reserve (64);
    ampEstimates.reserve (64);
    reset();
}

void PitchDetector::prepare (double sampleRate, int /*maxBlockSize*/)
{
    currentSampleRate = (sampleRate > 8000.0) ? sampleRate : 48000.0;
    reset();
}

void PitchDetector::reset()
{
    std::fill (inputBuffer.begin(), inputBuffer.end(), 0.0f);
    std::fill (nsdfBuffer.begin(), nsdfBuffer.end(), 0.0f);
    writeIndex = 0;
    hopCounter = 0;
    dcX1 = 0.0f;
    dcY1 = 0.0f;

    latestResult.pitchHz  = 0.0f;
    latestResult.clarity  = 0.0f;
    latestResult.isVoiced = false;
    latestResult.rmsLevel = 0.0f;
}

bool PitchDetector::processSample (float sample, PitchDetectionResult& outResult, int voiceRangeIndex)
{
    // Simple 1-pole DC blocker (R = 0.995)
    float dcFiltered = sample - dcX1 + 0.995f * dcY1;
    dcX1 = sample;
    dcY1 = dcFiltered;

    inputBuffer[writeIndex] = dcFiltered;
    writeIndex = (writeIndex + 1) % WINDOW_SIZE;

    hopCounter++;
    if (hopCounter >= HOP_SIZE)
    {
        hopCounter = 0;
        analyzeFrame (voiceRangeIndex);
        outResult = latestResult;
        return true;
    }

    outResult = latestResult;
    return false;
}

void PitchDetector::computeNSDF (const float* window, int size, int minTau, int maxTau)
{
    // NSDF: r(tau) = 2 * sum(x_j * x_{j+tau}) / (sum(x_j^2) + sum(x_{j+tau}^2))
    std::fill (nsdfBuffer.begin(), nsdfBuffer.end(), 0.0f);

    for (int tau = minTau; tau <= maxTau; ++tau)
    {
        float sumProd = 0.0f;
        float sumSquare1 = 0.0f;
        float sumSquare2 = 0.0f;

        int limit = size - tau;
        for (int j = 0; j < limit; ++j)
        {
            float s1 = window[j];
            float s2 = window[j + tau];
            sumProd += s1 * s2;
            sumSquare1 += s1 * s1;
            sumSquare2 += s2 * s2;
        }

        float denom = sumSquare1 + sumSquare2;
        if (denom > 1e-9f)
            nsdfBuffer[tau] = (2.0f * sumProd) / denom;
        else
            nsdfBuffer[tau] = 0.0f;
    }
}

void PitchDetector::analyzeFrame (int voiceRangeIndex)
{
    // Unroll circular buffer into contiguous window (pre-allocated)
    float sumSq = 0.0f;

    for (int i = 0; i < WINDOW_SIZE; ++i)
    {
        int idx = (writeIndex + i) % WINDOW_SIZE;
        float s = inputBuffer[idx];
        linearWindow[i] = s;
        sumSq += s * s;
    }

    float rms = std::sqrt (sumSq / static_cast<float> (WINDOW_SIZE));
    latestResult.rmsLevel = rms;

    // Silence or noise gate threshold (-50 dBFS ~ 0.00316)
    if (rms < 0.00316f)
    {
        latestResult.pitchHz  = 0.0f;
        latestResult.clarity  = 0.0f;
        latestResult.isVoiced = false;
        return;
    }

    // Determine frequency bounds based on voiceRangeIndex:
    // 0: General / Amplio (50 - 2400 Hz)
    // 1: Grave            (50 - 600 Hz)
    // 2: Aguda            (120 - 2400 Hz)
    float minHz = 50.0f;
    float maxHz = 2400.0f;

    if (voiceRangeIndex == 1)      // Grave
    {
        minHz = 50.0f;
        maxHz = 600.0f;
    }
    else if (voiceRangeIndex == 2) // Aguda
    {
        minHz = 120.0f;
        maxHz = 2400.0f;
    }

    int minTau = static_cast<int> (std::floor (currentSampleRate / maxHz));
    int maxTau = static_cast<int> (std::ceil  (currentSampleRate / minHz));

    minTau = std::max (2, std::min (minTau, WINDOW_SIZE / 2));
    maxTau = std::min (WINDOW_SIZE - 2, std::max (minTau + 1, maxTau));

    computeNSDF (linearWindow.data(), WINDOW_SIZE, minTau, maxTau);

    // Peak picking in NSDF
    maxPositions.clear();
    periodEstimates.clear();
    ampEstimates.clear();

    bool positiveSlope = false;
    for (int tau = minTau; tau < maxTau; ++tau)
    {
        if (nsdfBuffer[tau] > 0.0f)
        {
            if (nsdfBuffer[tau] > nsdfBuffer[tau - 1] && nsdfBuffer[tau] >= nsdfBuffer[tau + 1])
            {
                // Local maximum found, perform parabolic interpolation for sub-sample tau
                float y1 = nsdfBuffer[tau - 1];
                float y2 = nsdfBuffer[tau];
                float y3 = nsdfBuffer[tau + 1];

                float denom = 2.0f * (2.0f * y2 - y1 - y3);
                float delta = 0.0f;
                if (std::abs (denom) > 1e-9f)
                    delta = (y3 - y1) / denom;

                float refinedPeriod = static_cast<float> (tau) + delta;
                float peakAmp = y2 - 0.25f * (y1 - y3) * delta;

                maxPositions.push_back (tau);
                periodEstimates.push_back (refinedPeriod);
                ampEstimates.push_back (peakAmp);
            }
        }
    }

    if (ampEstimates.empty())
    {
        latestResult.pitchHz  = 0.0f;
        latestResult.clarity  = 0.0f;
        latestResult.isVoiced = false;
        return;
    }

    // Find highest peak in NSDF
    float maxAmp = *std::max_element (ampEstimates.begin(), ampEstimates.end());
    latestResult.clarity = std::max (0.0f, std::min (1.0f, maxAmp));

    // Voiced clarity threshold (0.48 indicates periodic vocal tone)
    if (maxAmp < 0.48f)
    {
        latestResult.pitchHz  = 0.0f;
        latestResult.isVoiced = false;
        return;
    }

    // McLeod Pitch Method: Choose first significant peak exceeding 0.85 * maxAmp
    // to avoid octave-drop errors
    float threshold = 0.85f * maxAmp;
    float chosenPeriod = periodEstimates[0];

    for (size_t i = 0; i < ampEstimates.size(); ++i)
    {
        if (ampEstimates[i] >= threshold)
        {
            chosenPeriod = periodEstimates[i];
            break;
        }
    }

    if (chosenPeriod > 0.0f)
    {
        float estimatedHz = static_cast<float> (currentSampleRate / chosenPeriod);
        if (estimatedHz >= minHz && estimatedHz <= maxHz)
        {
            latestResult.pitchHz  = estimatedHz;
            latestResult.isVoiced = true;
            return;
        }
    }

    latestResult.pitchHz  = 0.0f;
    latestResult.isVoiced = false;
}

} // namespace EasyPitch
