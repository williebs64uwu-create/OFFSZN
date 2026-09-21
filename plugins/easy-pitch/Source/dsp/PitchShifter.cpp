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
    crossfadeInc = static_cast<float> (1.0 / (currentSampleRate * 0.004)); // ~4ms default
    if (crossfadeInc <= 0.0f || crossfadeInc > 0.1f)
        crossfadeInc = 1.0f / 192.0f;

    reset();
}

void PitchShifter::reset()
{
    std::fill (delayBufferL.begin(), delayBufferL.end(), 0.0f);
    std::fill (delayBufferR.begin(), delayBufferR.end(), 0.0f);
    writeIndex = 0;

    readPos0 = static_cast<float> (DELAY_BUFFER_SIZE - LATENCY_SAMPLES);
    readPos1 = readPos0;
    isCrossfading = false;
    crossfadeProgress = 0.0f;

    targetCents       = 0.0f;
    currentCents      = 0.0f;
    pitchRatio        = 1.0f;
    wasVoiced         = false;
    bypassGain        = 0.0f;
    currentDetectedHz = 200.0f;

    formantFilterStateL = 0.0f;
    formantFilterStateR = 0.0f;
}

void PitchShifter::setTargetShift (float inTargetCents, float speedPercent, float amountPercent, bool isVoiced, float detectedHz)
{
    if (detectedHz >= 50.0f && detectedHz <= 1400.0f)
        currentDetectedHz = detectedHz;

    if (!isVoiced)
    {
        // Smoothly return to 0 cents when unvoiced (silence, breath, consonant)
        targetCents = 0.0f;
        wasVoiced   = false;
    }
    else
    {
        float amt   = std::max (0.0f, std::min (100.0f, amountPercent)) / 100.0f;
        // Full ±12 semitones (1 octave) range so large note transitions approximate 100% accurately
        targetCents = std::max (-1200.0f, std::min (1200.0f, inTargetCents * amt));
        wasVoiced   = true;
    }

    updateSmoothing (speedPercent);
}

void PitchShifter::updateSmoothing (float speedPercent)
{
    float s = std::max (0.0f, std::min (100.0f, speedPercent)) / 100.0f;

    // Natural Waves Tune Real-Time portamento curve:
    // Even at 100% speed (0.1ms in Waves Tune), sub-millisecond anti-click slew
    // ensures sudden note changes don't click or cause phase cancellation
    float tau = 0.0006f + 0.080f * std::pow (1.0f - s, 2.2f);
    float dt  = 1.0f / static_cast<float> (currentSampleRate);
    smoothingAlpha = 1.0f - std::exp (-dt / tau);
}

// ── Hermite 4-point cubic interpolation (reads safely from circular buffer) ──
static inline float readSampleCubic (const std::vector<float>& buffer, float readPos)
{
    const int size = static_cast<int> (buffer.size());
    while (readPos < 0.0f)                      readPos += static_cast<float> (size);
    while (readPos >= static_cast<float> (size)) readPos -= static_cast<float> (size);

    int   i1   = static_cast<int> (readPos);
    float frac = readPos - static_cast<float> (i1);

    int i0 = (i1 - 1 + size) % size;
    int i2 = (i1 + 1) % size;
    int i3 = (i1 + 2) % size;

    float y0 = buffer[i0];
    float y1 = buffer[i1];
    float y2 = buffer[i2];
    float y3 = buffer[i3];

    float c0 =  y1;
    float c1 =  0.5f * (y2 - y0);
    float c2 =  y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
    float c3 =  0.5f * (y3 - y0) + 1.5f * (y1 - y2);

    return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

void PitchShifter::processBlock (juce::AudioBuffer<float>& buffer, bool bypassToOriginal)
{
    int numChannels = buffer.getNumChannels();
    int numSamples  = buffer.getNumSamples();

    auto* channelDataL = buffer.getWritePointer (0);
    auto* channelDataR = (numChannels > 1) ? buffer.getWritePointer (1) : nullptr;

    float targetBypassGain = bypassToOriginal ? 1.0f : 0.0f;

    // Formant spectral-tilt coefficient
    float formantTilt = 0.0f;
    if (preserveTimbre && std::abs (currentCents) > 5.0f)
    {
        formantTilt = -0.06f * (currentCents / 100.0f);
        formantTilt = std::max (-0.22f, std::min (0.22f, formantTilt));
    }

    const float centerDelay = static_cast<float> (LATENCY_SAMPLES);
    const float maxDrift    = 220.0f;
    const float minDelay    = centerDelay - maxDrift;
    const float maxDelay    = centerDelay + maxDrift;
    const float bufSize     = static_cast<float> (DELAY_BUFFER_SIZE);

    // Fundamental pitch period in samples for phase-synchronous splicing (PSOLA)
    float validHz = std::max (50.0f, std::min (1200.0f, currentDetectedHz));
    float T0      = static_cast<float> (currentSampleRate) / validHz;

    for (int i = 0; i < numSamples; ++i)
    {
        // Continuous per-sample glide toward targetCents (Waves Tune Real-Time feel)
        if (smoothingAlpha >= 0.999f)
            currentCents = targetCents;
        else
            currentCents += smoothingAlpha * (targetCents - currentCents);

        pitchRatio = std::pow (2.0f, currentCents / 1200.0f);

        float inL = channelDataL[i];
        float inR = (channelDataR != nullptr) ? channelDataR[i] : inL;

        // Write new samples into ring buffers
        delayBufferL[writeIndex] = inL;
        delayBufferR[writeIndex] = inR;

        // Smooth host-bypass crossfade
        bypassGain += 0.005f * (targetBypassGain - bypassGain);

        // Dry path aligned at LATENCY (always reads from the past)
        float dryPos = static_cast<float> (writeIndex) - centerDelay;
        if (dryPos < 0.0f) dryPos += bufSize;
        float dryL = readSampleCubic (delayBufferL, dryPos);
        float dryR = (channelDataR != nullptr) ? readSampleCubic (delayBufferR, dryPos) : dryL;

        // Compute current delay of primary read pointer from write head
        float delay0 = static_cast<float> (writeIndex) - readPos0;
        while (delay0 < 0.0f)     delay0 += bufSize;
        while (delay0 >= bufSize) delay0 -= bufSize;

        // Pitch-Synchronous Splice: Trigger ONLY when delay drifts outside allowable window
        if (!isCrossfading && std::abs (currentCents) > 0.5f)
        {
            if (pitchRatio > 1.0f && delay0 <= minDelay)
            {
                // Pitch shift UP: read head catching up with write head.
                // Splice read head back to centerDelay by an integer multiple of pitch period T0
                float needed = centerDelay - delay0;
                int k = std::max (1, static_cast<int> (std::round (needed / T0)));
                float jump = static_cast<float> (k) * T0;
                readPos1 = readPos0 - jump;
                while (readPos1 < 0.0f)     readPos1 += bufSize;
                while (readPos1 >= bufSize) readPos1 -= bufSize;

                float xfadeLen = std::max (64.0f, std::min (256.0f, T0));
                crossfadeInc = 1.0f / xfadeLen;
                crossfadeProgress = 0.0f;
                isCrossfading = true;
            }
            else if (pitchRatio < 1.0f && delay0 >= maxDelay)
            {
                // Pitch shift DOWN: read head falling behind write head.
                // Splice read head forward to centerDelay by an integer multiple of pitch period T0
                float needed = delay0 - centerDelay;
                int k = std::max (1, static_cast<int> (std::round (needed / T0)));
                float jump = static_cast<float> (k) * T0;
                readPos1 = readPos0 + jump;
                while (readPos1 >= bufSize) readPos1 -= bufSize;
                while (readPos1 < 0.0f)     readPos1 += bufSize;

                float xfadeLen = std::max (64.0f, std::min (256.0f, T0));
                crossfadeInc = 1.0f / xfadeLen;
                crossfadeProgress = 0.0f;
                isCrossfading = true;
            }
        }

        // Single-stream reading (98% of the time) or phase-coherent crossfade (2% of the time)
        float wetL, wetR;

        if (!isCrossfading)
        {
            // PURE SINGLE VOICE - ZERO CHORUS!
            wetL = readSampleCubic (delayBufferL, readPos0);
            wetR = (channelDataR != nullptr) ? readSampleCubic (delayBufferR, readPos0) : wetL;
        }
        else
        {
            // Smooth equal-power cosine crossfade during the short pitch-synchronous splice
            float angle = crossfadeProgress * static_cast<float> (M_PI);
            float w0 = 0.5f * (1.0f + std::cos (angle));
            float w1 = 0.5f * (1.0f - std::cos (angle));

            wetL = w0 * readSampleCubic (delayBufferL, readPos0)
                 + w1 * readSampleCubic (delayBufferL, readPos1);
            wetR = (channelDataR != nullptr)
                 ? (w0 * readSampleCubic (delayBufferR, readPos0)
                  + w1 * readSampleCubic (delayBufferR, readPos1))
                 : wetL;

            readPos1 += pitchRatio;
            if (readPos1 >= bufSize) readPos1 -= bufSize;
            if (readPos1 < 0.0f)     readPos1 += bufSize;

            crossfadeProgress += crossfadeInc;
            if (crossfadeProgress >= 1.0f)
            {
                isCrossfading = false;
                readPos0 = readPos1;
            }
        }

        // Advance primary read position and wrap safely
        readPos0 += pitchRatio;
        if (readPos0 >= bufSize) readPos0 -= bufSize;
        if (readPos0 < 0.0f)     readPos0 += bufSize;

        // When pitch shift is virtually 0, smoothly lock read pointer to centerDelay
        if (std::abs (currentCents) <= 0.5f && !isCrossfading)
        {
            float targetPos = static_cast<float> (writeIndex) - centerDelay;
            if (targetPos < 0.0f) targetPos += bufSize;
            float diff = targetPos - readPos0;
            if (diff > bufSize * 0.5f)  diff -= bufSize;
            if (diff < -bufSize * 0.5f) diff += bufSize;
            readPos0 += 0.001f * diff;
            if (readPos0 >= bufSize) readPos0 -= bufSize;
            if (readPos0 < 0.0f)     readPos0 += bufSize;
        }

        // Stable 1-pole formant preservation shelving filter
        if (preserveTimbre && std::abs (formantTilt) > 0.001f)
        {
            float alpha = 0.15f;
            formantFilterStateL += alpha * (wetL - formantFilterStateL);
            wetL = wetL + formantTilt * (wetL - formantFilterStateL);

            formantFilterStateR += alpha * (wetR - formantFilterStateR);
            wetR = wetR + formantTilt * (wetR - formantFilterStateR);
        }

        // Final output with smooth crossfade to host bypass
        channelDataL[i] = (1.0f - bypassGain) * wetL + bypassGain * dryL;
        if (channelDataR != nullptr)
            channelDataR[i] = (1.0f - bypassGain) * wetR + bypassGain * dryR;

        writeIndex = (writeIndex + 1) % DELAY_BUFFER_SIZE;
    }
}

} // namespace EasyPitch
