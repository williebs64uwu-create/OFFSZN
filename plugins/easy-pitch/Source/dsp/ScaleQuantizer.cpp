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

int ScaleQuantizer::getScaleMask (int scaleIndex)
{
    switch (scaleIndex)
    {
        case 0: return 0x0FFF; // Cromatica (todos los semitonos)
        case 1: return 2741;   // Mayor (0, 2, 4, 5, 7, 9, 11)
        case 2: return 1453;   // Menor natural (0, 2, 3, 5, 7, 8, 10)
        case 3: return 2477;   // Menor armonica (0, 2, 3, 5, 7, 8, 11)
        case 4: return 2733;   // Menor melodica (0, 2, 3, 5, 7, 9, 11)
        case 5: return 661;    // Pentatonica Mayor (0, 2, 4, 7, 9)
        case 6: return 1189;   // Pentatonica Menor (0, 3, 5, 7, 10)
        case 7: return 1253;   // Blues (0, 3, 5, 6, 7, 10)
        case 8: return 1449;   // Dorica (0, 2, 3, 5, 7, 9, 10)
        default: return 0x0FFF;
    }
}

bool ScaleQuantizer::isNoteAllowed (int noteClass, int rootClass, int scaleIndex, int customMask) const
{
    int effCustom = (customMask == 0) ? 0x0FFF : customMask;
    if ((effCustom & (1 << noteClass)) == 0)
        return false;

    if (scaleIndex == 0) // Cromatica
        return true;

    // Transpose relative to root
    int interval = (noteClass - rootClass + 12) % 12;
    int mask = getScaleMask (scaleIndex);

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
        result.targetMidiNote  = -1.0f;
        lastTargetMidi         = -1.0f; // Reset phrase history on pause/silence!
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
        lastKeyIndex   = keyIndex;
        lastScaleIndex = scaleIndex;
        lastCustomMask = customMask;
    }

    // Direct search outward from the nearest rounded semitone of the input pitch
    float bestMidi = -1.0f;
    float minDistance = 999.0f;

    for (int offset = 0; offset <= 12; ++offset)
    {
        for (int sign : { 1, -1 })
        {
            int candidateMidi = roundedMidi + (offset * sign);
            if (candidateMidi < 12 || candidateMidi > 120)
                continue;

            int noteClass = candidateMidi % 12;
            if (isNoteAllowed (noteClass, rootClass, scaleIndex, customMask))
            {
                float dist = std::abs (midiInput - static_cast<float> (candidateMidi));
                if (dist < minDistance)
                {
                    minDistance = dist;
                    bestMidi = static_cast<float> (candidateMidi);
                }
            }
        }

        // If we found a valid scale note within 0.6 semitones, that is unambiguously the target
        if (bestMidi >= 0.0f && minDistance <= 0.6f)
            break;
    }

    // Safe fallback: stay on current sung note if scale is completely empty
    if (bestMidi < 0.0f)
        bestMidi = static_cast<float> (roundedMidi);

    // Hysteresis around scale boundaries:
    // Only apply hysteresis for small, subtle pitch wavers between adjacent scale notes (<= 2.2 semitones).
    // For intentional large jumps or runs (> 2.2 semitones), snap cleanly and immediately to the new note!
    if (lastTargetMidi >= 0.0f && std::abs (bestMidi - lastTargetMidi) >= 0.5f && std::abs (bestMidi - lastTargetMidi) <= 2.2f)
    {
        int prevClass = static_cast<int> (std::round (lastTargetMidi)) % 12;
        if (isNoteAllowed (prevClass, rootClass, scaleIndex, customMask))
        {
            float distToLast = std::abs (midiInput - lastTargetMidi);
            float distToBest = std::abs (midiInput - bestMidi);
            if (distToLast < distToBest + 0.15f)
            {
                bestMidi = lastTargetMidi;
            }
        }
    }

    lastTargetMidi = bestMidi;
    result.targetMidiNote = bestMidi;
    result.targetNoteName = midiToNoteName (static_cast<int> (std::round (bestMidi)));

    // Direct pitch deviation in cents from sung pitch to target scale note
    float rawCents = (bestMidi - midiInput) * 100.0f;
    float cents = rawCents;

    // Waves Tune Real-Time vibrato preservation when speed is below hard-tune
    float s = std::max (0.0f, std::min (100.0f, speedPercent)) / 100.0f;
    if (s < 0.95f)
    {
        float deadzone = 7.0f * (1.0f - s);
        if (std::abs (rawCents) <= deadzone)
        {
            cents = rawCents * 0.35f;
        }
    }

    // Safety clamp: an auto-tune should never pull more than +/- 200 cents (2 semitones)
    cents = std::max (-200.0f, std::min (200.0f, cents));

    result.centsCorrection = cents;
    return result;
}

} // namespace EasyPitch
