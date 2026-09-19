#include "PitchShifter.h"
#include <cmath>
#include <algorithm>

namespace EasyPitch
{

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

PitchShifter::PitchShifter()
{
    delayBufferL.resize (DELAY_BUFFER_SIZE, 0.0f);
    delayBufferR.resize (DELAY_BUFFER_SIZE, 0.0f);
    reset();
}

void PitchShifter::prepare (double sampleRate, int /*maxBlockSize*/)
{
    currentSampleRate = (sampleRate > 8000.0) ? sampleRate : 48000.0;
    reset();
}

void PitchShifter::reset()
{
    std::fill (delayBufferL.begin(), delayBufferL.end(), 0.0f);
    std::fill (delayBufferR.begin(), delayBufferR.end(), 0.0f);
    writeIndex = 0;
    grainPhase0 = 0.0f;
    grainPhase1 = 0.5f;

    targetCents  = 0.0f;
    currentCents = 0.0f;
    pitchRatio   = 1.0f;
    wasVoiced    = false;

    targetGrainLength  = 480.0f;
    currentGrainLength = 480.0f;
    bypassGain = 0.0f;

    formantFilterStateL = 0.0f;
    formantFilterStateR = 0.0f;
}

void PitchShifter::setTargetShift (float inTargetCents, float speedPercent, float amountPercent, bool isVoiced, float detectedHz)
{
    if (!isVoiced)
    {
        // Smoothly return shift to 0 cents when unvoiced (silence, breath, consonant)
        targetCents = 0.0f;
        wasVoiced = false;
        targetGrainLength = static_cast<float> (currentSampleRate * 0.020f); // Default 20ms
    }
    else
    {
        // Scale deviation by Amount percentage (0 = dry, 100 = full correction)
        float amt = std::max (0.0f, std::min (100.0f, amountPercent)) / 100.0f;
        targetCents = inTargetCents * amt;
        wasVoiced = true;

        if (detectedHz >= 50.0f && detectedHz <= 2400.0f)
        {
            float periodSamples = static_cast<float> (currentSampleRate) / detectedHz;
            // 2 periods per grain for optimal phase-coherent overlap-add
            targetGrainLength = std::max (32.0f, std::min (1024.0f, 2.0f * periodSamples));
        }
        else
        {
            targetGrainLength = static_cast<float> (currentSampleRate * 0.020f);
        }
    }

    updateSmoothing (speedPercent);
}

void PitchShifter::updateSmoothing (float speedPercent)
{
    float s = std::max (0.0f, std::min (100.0f, speedPercent)) / 100.0f;

    if (s >= 0.95f)
    {
        // Hard Auto-tune mode (immediate robotic snap)
        currentCents = targetCents;
    }
    else
    {
        // Perceptual curve for natural human pitch transition
        float tau = 0.003f + 0.300f * std::pow (1.0f - s, 2.5f);
        float dt = 1.0f / static_cast<float> (currentSampleRate);
        float alpha = 1.0f - std::exp (-dt * 128.0f / tau);

        currentCents += alpha * (targetCents - currentCents);
    }

    // Adapt grain length smoothly
    currentGrainLength += 0.05f * (targetGrainLength - currentGrainLength);
    currentGrainLength = std::max (32.0f, std::min (1024.0f, currentGrainLength));

    // Limit cents to valid range (-1200 to +1200 cents = 1 octave)
    currentCents = std::max (-1200.0f, std::min (1200.0f, currentCents));
    pitchRatio = std::pow (2.0f, currentCents / 1200.0f);
}

static inline float readSampleCubic (const std::vector<float>& buffer, float readPos)
{
    int size = static_cast<int> (buffer.size());
    int i1 = static_cast<int> (std::floor (readPos));
    float frac = readPos - static_cast<float> (i1);

    int i0 = (i1 - 1 + size) % size;
    i1 = (i1 + size) % size;
    int i2 = (i1 + 1) % size;
    int i3 = (i1 + 2) % size;

    float y0 = buffer[i0];
    float y1 = buffer[i1];
    float y2 = buffer[i2];
    float y3 = buffer[i3];

    // Hermite 4-point cubic interpolation
    float c0 = y1;
    float c1 = 0.5f * (y2 - y0);
    float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
    float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);

    return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

void PitchShifter::processBlock (juce::AudioBuffer<float>& buffer, bool bypassToOriginal)
{
    int numChannels = buffer.getNumChannels();
    int numSamples  = buffer.getNumSamples();

    float grainLength = currentGrainLength;
    if (grainLength < 32.0f)
        grainLength = 32.0f;

    // Phase increment per sample
    float phaseInc = (1.0f - pitchRatio) / grainLength;

    // Formant filter coefficient (compensates spectral tilt when shifting)
    float formantTilt = 0.0f;
    if (preserveTimbre && std::abs (currentCents) > 5.0f)
    {
        formantTilt = -0.12f * (currentCents / 100.0f);
        formantTilt = std::max (-0.35f, std::min (0.35f, formantTilt));
    }

    auto* channelDataL = buffer.getWritePointer (0);
    auto* channelDataR = (numChannels > 1) ? buffer.getWritePointer (1) : nullptr;

    float targetBypassGain = bypassToOriginal ? 1.0f : 0.0f;

    for (int i = 0; i < numSamples; ++i)
    {
        float inL = channelDataL[i];
        float inR = (channelDataR != nullptr) ? channelDataR[i] : inL;

        // Write into delay ring buffers
        delayBufferL[writeIndex] = inL;
        delayBufferR[writeIndex] = inR;

        // Smooth crossfade between processed and bypass
        bypassGain += 0.005f * (targetBypassGain - bypassGain);

        // Dry read position aligned with average delay of shifter
        float avgDelay = static_cast<float> (LATENCY_SAMPLES) + grainLength * 0.5f;
        float dryReadPos = static_cast<float> (writeIndex) - avgDelay + static_cast<float> (DELAY_BUFFER_SIZE * 2);
        dryReadPos = std::fmod (dryReadPos, static_cast<float> (DELAY_BUFFER_SIZE));

        float dryL = readSampleCubic (delayBufferL, dryReadPos);
        float dryR = (channelDataR != nullptr) ? readSampleCubic (delayBufferR, dryReadPos) : dryL;

        // Dual grain overlap-add pitch shift
        float w0 = 0.5f * (1.0f - std::cos (2.0f * static_cast<float> (M_PI) * grainPhase0));
        float w1 = 0.5f * (1.0f - std::cos (2.0f * static_cast<float> (M_PI) * grainPhase1));

        float offset0 = static_cast<float> (LATENCY_SAMPLES) + grainPhase0 * grainLength;
        float offset1 = static_cast<float> (LATENCY_SAMPLES) + grainPhase1 * grainLength;

        float readPos0 = static_cast<float> (writeIndex) - offset0 + static_cast<float> (DELAY_BUFFER_SIZE * 2);
        readPos0 = std::fmod (readPos0, static_cast<float> (DELAY_BUFFER_SIZE));

        float readPos1 = static_cast<float> (writeIndex) - offset1 + static_cast<float> (DELAY_BUFFER_SIZE * 2);
        readPos1 = std::fmod (readPos1, static_cast<float> (DELAY_BUFFER_SIZE));

        float wetL = w0 * readSampleCubic (delayBufferL, readPos0) + w1 * readSampleCubic (delayBufferL, readPos1);
        float wetR = w0 * readSampleCubic (delayBufferR, readPos0) + w1 * readSampleCubic (delayBufferR, readPos1);

        // Formant spectral envelope preservation
        if (preserveTimbre && std::abs (formantTilt) > 0.001f)
        {
            wetL = wetL + formantTilt * (wetL - formantFilterStateL);
            formantFilterStateL = wetL;

            wetR = wetR + formantTilt * (wetR - formantFilterStateR);
            formantFilterStateR = wetR;
        }

        // Output with smooth crossfade
        float outL = (1.0f - bypassGain) * wetL + bypassGain * dryL;
        float outR = (1.0f - bypassGain) * wetR + bypassGain * dryR;

        channelDataL[i] = outL;
        if (channelDataR != nullptr)
            channelDataR[i] = outR;

        // Advance grain phases
        grainPhase0 += phaseInc;
        if (grainPhase0 >= 1.0f) grainPhase0 -= 1.0f;
        if (grainPhase0 < 0.0f)  grainPhase0 += 1.0f;

        grainPhase1 += phaseInc;
        if (grainPhase1 >= 1.0f) grainPhase1 -= 1.0f;
        if (grainPhase1 < 0.0f)  grainPhase1 += 1.0f;

        writeIndex = (writeIndex + 1) % DELAY_BUFFER_SIZE;
    }
}

} // namespace EasyPitch
