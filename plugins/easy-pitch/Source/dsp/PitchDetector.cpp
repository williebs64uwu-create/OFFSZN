#include "PitchDetector.h"
#include <cmath>
#include <algorithm>
#include <numeric>

namespace EasyPitch
{

PitchDetector::PitchDetector()
{
    inputBuffer.resize (WINDOW_SIZE, 0.0f);
    linearWindow.resize (WINDOW_SIZE, 0.0f);
    prefixSq.resize (WINDOW_SIZE + 1, 0.0f);
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
    std::fill (linearWindow.begin(), linearWindow.end(), 0.0f);
    std::fill (prefixSq.begin(), prefixSq.end(), 0.0f);
    std::fill (nsdfBuffer.begin(), nsdfBuffer.end(), 0.0f);
    maxPositions.clear();
    periodEstimates.clear();
    ampEstimates.clear();

    writeIndex = 0;
    hopCounter = 0;
    dcX1 = 0.0f;
    dcY1 = 0.0f;

    pitchHistory[0] = 0.0f;
    pitchHistory[1] = 0.0f;
    pitchHistory[2] = 0.0f;
    historyIdx = 0;
    unvoicedHangover = 0;
    lastValidHz = 0.0f;

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
    // O(1) Prefix Sums for squared energy:
    // prefixSq[k] = sum_{j=0}^{k-1} window[j]^2
    prefixSq[0] = 0.0f;
    for (int i = 0; i < size; ++i)
        prefixSq[i + 1] = prefixSq[i] + (window[i] * window[i]);

    std::fill (nsdfBuffer.begin(), nsdfBuffer.end(), 0.0f);

    for (int tau = minTau; tau <= maxTau; ++tau)
    {
        int limit = size - tau;
        if (limit <= 0)
            break;

        // Vectorized SIMD inner product with 4-way independent accumulators
        // This eliminates dependency chains and allows auto-vectorization (AVX2/SSE)
        float s0 = 0.0f, s1 = 0.0f, s2 = 0.0f, s3 = 0.0f;
        int j = 0;
        int unrollLimit = limit - 3;
        for (; j < unrollLimit; j += 4)
        {
            s0 += window[j]     * window[j + tau];
            s1 += window[j + 1] * window[j + 1 + tau];
            s2 += window[j + 2] * window[j + 2 + tau];
            s3 += window[j + 3] * window[j + 3 + tau];
        }
        float sumProd = (s0 + s1) + (s2 + s3);
        for (; j < limit; ++j)
            sumProd += window[j] * window[j + tau];

        // O(1) Energy terms from prefix sums
        float sumSquare1 = prefixSq[limit] - prefixSq[0];
        float sumSquare2 = prefixSq[size] - prefixSq[tau];
        float denom = sumSquare1 + sumSquare2;

        if (denom > 1e-8f)
            nsdfBuffer[tau] = (2.0f * sumProd) / denom;
        else
            nsdfBuffer[tau] = 0.0f;
    }
}

void PitchDetector::analyzeFrame (int voiceRangeIndex)
{
    // Unroll circular buffer into contiguous window
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

    // Silence / Noise gate threshold (-50 dBFS ~ 0.00316)
    if (rms < 0.00316f)
    {
        if (unvoicedHangover < 2 && lastValidHz > 0.0f)
        {
            unvoicedHangover++;
            latestResult.pitchHz  = lastValidHz;
            latestResult.isVoiced = true;
            return;
        }

        unvoicedHangover = 0;
        lastValidHz = 0.0f;
        pitchHistory[0] = 0.0f;
        pitchHistory[1] = 0.0f;
        pitchHistory[2] = 0.0f;

        latestResult.pitchHz  = 0.0f;
        latestResult.clarity  = 0.0f;
        latestResult.isVoiced = false;
        return;
    }

    // Realistic vocal pitch bounds:
    // 0: General / Amplio (75 - 1100 Hz) - covers bass/baritone E2 up to soprano C6
    // 1: Grave            (65 - 450 Hz)
    // 2: Aguda            (140 - 1100 Hz)
    float minHz = 75.0f;
    float maxHz = 1100.0f;

    if (voiceRangeIndex == 1)      // Grave
    {
        minHz = 65.0f;
        maxHz = 450.0f;
    }
    else if (voiceRangeIndex == 2) // Aguda
    {
        minHz = 140.0f;
        maxHz = 1100.0f;
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
        if (unvoicedHangover < 2 && lastValidHz > 0.0f)
        {
            unvoicedHangover++;
            latestResult.pitchHz  = lastValidHz;
            latestResult.isVoiced = true;
            return;
        }

        unvoicedHangover = 0;
        lastValidHz = 0.0f;
        pitchHistory[0] = 0.0f;
        pitchHistory[1] = 0.0f;
        pitchHistory[2] = 0.0f;

        latestResult.pitchHz  = 0.0f;
        latestResult.clarity  = 0.0f;
        latestResult.isVoiced = false;
        return;
    }

    // Find highest peak in NSDF
    float maxAmp = *std::max_element (ampEstimates.begin(), ampEstimates.end());
    latestResult.clarity = std::max (0.0f, std::min (1.0f, maxAmp));

    // Voiced clarity threshold (0.42 indicates periodic vocal pitch)
    if (maxAmp < 0.42f)
    {
        if (unvoicedHangover < 2 && lastValidHz > 0.0f)
        {
            unvoicedHangover++;
            latestResult.pitchHz  = lastValidHz;
            latestResult.isVoiced = true;
            return;
        }

        unvoicedHangover = 0;
        lastValidHz = 0.0f;
        pitchHistory[0] = 0.0f;
        pitchHistory[1] = 0.0f;
        pitchHistory[2] = 0.0f;

        latestResult.pitchHz  = 0.0f;
        latestResult.isVoiced = false;
        return;
    }

    // McLeod Pitch Method with Pitch Continuity Tracking:
    float threshold = 0.82f * maxAmp;
    float chosenPeriod = periodEstimates[0];
    bool foundContinuous = false;

    // Pitch continuity: if we had a valid pitch recently, prefer a peak near that pitch (prevents octave drops)
    if (lastValidHz > 50.0f)
    {
        float expectedPeriod = static_cast<float> (currentSampleRate / lastValidHz);
        for (size_t i = 0; i < ampEstimates.size(); ++i)
        {
            if (ampEstimates[i] >= 0.70f * maxAmp)
            {
                float ratio = periodEstimates[i] / expectedPeriod;
                if (ratio >= 0.80f && ratio <= 1.25f)
                {
                    chosenPeriod = periodEstimates[i];
                    foundContinuous = true;
                    break;
                }
            }
        }
    }

    if (!foundContinuous)
    {
        for (size_t i = 0; i < ampEstimates.size(); ++i)
        {
            if (ampEstimates[i] >= threshold)
            {
                chosenPeriod = periodEstimates[i];
                break;
            }
        }
    }

    if (chosenPeriod > 0.0f)
    {
        float estimatedHz = static_cast<float> (currentSampleRate / chosenPeriod);
        if (estimatedHz >= minHz && estimatedHz <= maxHz)
        {
            // 3-tap median filter for glitch-free sudden note leaps
            pitchHistory[historyIdx] = estimatedHz;
            historyIdx = (historyIdx + 1) % 3;

            float p0 = pitchHistory[0];
            float p1 = pitchHistory[1];
            float p2 = pitchHistory[2];

            float medianHz = estimatedHz;
            if (p0 > 0.0f && p1 > 0.0f && p2 > 0.0f)
            {
                medianHz = std::max (std::min (p0, p1), std::min (std::max (p0, p1), p2));
            }

            lastValidHz = medianHz;
            unvoicedHangover = 0;
            latestResult.pitchHz  = medianHz;
            latestResult.isVoiced = true;
            return;
        }
    }

    latestResult.pitchHz  = 0.0f;
    latestResult.isVoiced = false;
}

} // namespace EasyPitch
