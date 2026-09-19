#include "ScaleQuantizer.h"

namespace EasyPitch
{

static const char* NOTE_NAMES[12] = {
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"
};

ScaleQuantizer::ScaleQuantizer()
{
    reset();
}

void ScaleQuantizer::reset()
{
    lastTargetMidi = -1.0f;
    smoothedMidi   = -1.0f;
    lastKeyIndex   = -1;
    lastScaleIndex = -1;
    lastCustomMask = -1;
}

float ScaleQuantizer::hzToMidi (float hz, float referenceHz)
{
    if (hz <= 0.0f || referenceHz <= 0.0f)
        return 0.0f;

    return 69.0f + 12.0f * std::log2 (hz / referenceHz);
}

float ScaleQuantizer::midiToHz (float midi, float referenceHz)
{
    if (referenceHz <= 0.0f)
        return 0.0f;

    return referenceHz * std::pow (2.0f, (midi - 69.0f) / 12.0f);
}

juce::String ScaleQuantizer::midiToNoteName (int midiNote)
{
    if (midiNote < 0 || midiNote > 127)
        return "--";

    int noteClass = midiNote % 12;
    int octave = (midiNote / 12) - 1;

    return juce::String (NOTE_NAMES[noteClass]) + juce::String (octave);
}

bool ScaleQuantizer::isNoteAllowed (int noteClass, int rootClass, int scaleIndex, int customMask) const
{
    // Check if user custom mask disabled this semitone
    if ((customMask & (1 << noteClass)) == 0)
        return false;

    // Transpose relative to root
    int interval = (noteClass - rootClass + 12) % 12;
    int mask = (scaleIndex == 1) ? MINOR_MASK : MAJOR_MASK;

    return (mask & (1 << interval)) != 0;
}

QuantizeResult ScaleQuantizer::quantize (float detectedHz, int keyIndex, int scaleIndex, float referenceHz, float speedPercent, int customMask)
{
    QuantizeResult result;

    if (detectedHz <= 20.0f || detectedHz >= 5000.0f)
    {
        result.inputNoteName   = "--";
        result.targetNoteName  = "--";
        result.centsCorrection = 0.0f;
        result.isScaleActive   = true;
        smoothedMidi = -1.0f;
        return result;
    }

    float midiInput = hzToMidi (detectedHz, referenceHz);
    int roundedMidi = static_cast<int> (std::round (midiInput));
    result.inputNoteName = midiToNoteName (roundedMidi);

    result.isScaleActive = true;
    int rootClass = (keyIndex >= 0 && keyIndex < 12) ? keyIndex : 0;

    // Invalidate history if key, scale, or custom mask changed
    if (keyIndex != lastKeyIndex || scaleIndex != lastScaleIndex || customMask != lastCustomMask)
    {
        lastTargetMidi = -1.0f;
        smoothedMidi   = -1.0f;
        lastKeyIndex   = keyIndex;
        lastScaleIndex = scaleIndex;
        lastCustomMask = customMask;
    }

    // Vibrato separation: track slowly-varying tonal center (lowpass ~2.5 Hz)
    if (smoothedMidi <= 0.0f)
        smoothedMidi = midiInput;
    else
        smoothedMidi += 0.05f * (midiInput - smoothedMidi);

    float vibratoDeviation = midiInput - smoothedMidi; // In semitones

    // Find the closest allowed note in the scale for the tonal center
    float bestMidi = -1.0f;
    float minDistance = 999.0f;

    int searchCenter = static_cast<int> (std::round (smoothedMidi));
    for (int offset = -12; offset <= 12; ++offset)
    {
        int candidateMidi = searchCenter + offset;
        if (candidateMidi < 12 || candidateMidi > 120)
            continue;

        int noteClass = candidateMidi % 12;
        if (isNoteAllowed (noteClass, rootClass, scaleIndex, customMask))
        {
            float dist = std::abs (smoothedMidi - static_cast<float> (candidateMidi));
            if (dist < minDistance)
            {
                minDistance = dist;
                bestMidi = static_cast<float> (candidateMidi);
            }
        }
    }

    // Fallback if all custom mask notes are excluded
    if (bestMidi < 0.0f)
        bestMidi = static_cast<float> (roundedMidi);

    // Hysteresis: prevent flutter around semitone boundaries
    if (lastTargetMidi >= 0.0f && std::abs (bestMidi - lastTargetMidi) >= 0.5f)
    {
        int prevClass = static_cast<int> (std::round (lastTargetMidi)) % 12;
        if (isNoteAllowed (prevClass, rootClass, scaleIndex, customMask))
        {
            float distToPrev = std::abs (smoothedMidi - lastTargetMidi);
            if (distToPrev < 0.65f)
            {
                bestMidi = lastTargetMidi;
            }
        }
    }

    lastTargetMidi = bestMidi;
    result.targetMidiNote = bestMidi;
    result.targetNoteName = midiToNoteName (static_cast<int> (std::round (bestMidi)));

    // Natural Vibrato Preservation:
    // When speed < 95% (Suave/Firme), keep the singer's natural expressive vibrato oscillation
    // around the newly tuned center note. When speed >= 95% (Marcado), flatten vibrato into hard robotic pitch.
    float s = std::max (0.0f, std::min (100.0f, speedPercent)) / 100.0f;
    float vibratoPreserve = 0.0f;
    if (s < 0.95f)
    {
        vibratoPreserve = (1.0f - (s / 0.95f)) * 0.80f;
    }

    float correctedTarget = bestMidi + vibratoDeviation * vibratoPreserve;
    result.centsCorrection = (correctedTarget - midiInput) * 100.0f;

    return result;
}

} // namespace EasyPitch
