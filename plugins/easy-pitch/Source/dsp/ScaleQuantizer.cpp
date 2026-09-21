#include "ScaleQuantizer.h"
#include <algorithm>
#include <cmath>

namespace EasyPitch
{

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

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

    int noteClass = (midiNote % 12 + 12) % 12;
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
    int normClass = (noteClass % 12 + 12) % 12;
    if ((effCustom & (1 << normClass)) == 0)
        return false;

    if (scaleIndex == 0) // Cromatica
        return true;

    // Transpose relative to root
    int interval = (normClass - rootClass + 12) % 12;
    int mask = getScaleMask (scaleIndex);

    return (mask & (1 << interval)) != 0;
}

QuantizeResult ScaleQuantizer::quantize (float detectedHz, int keyIndex, int scaleIndex, float referenceHz, float speedPercent, int customMask)
{
    QuantizeResult result;

    if (detectedHz <= 45.0f || detectedHz >= 1800.0f)
    {
        result.inputNoteName   = "--";
        result.targetNoteName  = "--";
        result.centsCorrection = 0.0f;
        result.isScaleActive   = true;
        result.targetMidiNote  = -1.0f;
        lastTargetMidi         = -1.0f;
        return result;
    }

    float midiInput = hzToMidi (detectedHz, referenceHz);
    int roundedInputMidi = static_cast<int> (std::round (midiInput));
    result.inputNoteName = midiToNoteName (roundedInputMidi);
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

    // 1. Find the nearest allowed scale note below midiInput
    int noteBelow = -1;
    for (int m = static_cast<int> (std::floor (midiInput)); m >= 12; --m)
    {
        if (isNoteAllowed (m % 12, rootClass, scaleIndex, customMask))
        {
            noteBelow = m;
            break;
        }
    }

    // 2. Find the nearest allowed scale note above midiInput
    int noteAbove = -1;
    for (int m = static_cast<int> (std::ceil (midiInput)); m <= 120; ++m)
    {
        if (isNoteAllowed (m % 12, rootClass, scaleIndex, customMask))
        {
            noteAbove = m;
            break;
        }
    }

    // If scale is empty or only one bound found
    if (noteBelow < 0 && noteAbove < 0)
    {
        result.targetMidiNote  = static_cast<float> (roundedInputMidi);
        result.targetNoteName  = result.inputNoteName;
        result.centsCorrection = 0.0f;
        return result;
    }
    if (noteBelow < 0) noteBelow = noteAbove - 12;
    if (noteAbove < 0) noteAbove = noteBelow + 12;

    float W = static_cast<float> (noteAbove - noteBelow);
    if (W <= 0.0f) W = 1.0f;

    // Decision midpoint between scale notes with hysteresis
    float midpoint = static_cast<float> (noteBelow) + (W * 0.5f);
    float hysteresis = 0.08f; // ~8 cents of stability to prevent flutter between adjacent notes
    if (lastTargetMidi == static_cast<float> (noteBelow))
        midpoint += hysteresis;
    else if (lastTargetMidi == static_cast<float> (noteAbove))
        midpoint -= hysteresis;

    float targetMidi;
    float delta; // Target minus input (in semitones)
    float halfW = W * 0.5f;

    if (midiInput < midpoint)
    {
        targetMidi = static_cast<float> (noteBelow);
        delta = targetMidi - midiInput; // in range [-halfW, 0]
    }
    else
    {
        targetMidi = static_cast<float> (noteAbove);
        delta = targetMidi - midiInput; // in range [0, +halfW]
    }

    lastTargetMidi = targetMidi;
    result.targetMidiNote = targetMidi;
    result.targetNoteName = midiToNoteName (static_cast<int> (std::round (targetMidi)));

    // ── Continuous C^1 correction curve (Waves Tune Real-Time design) ──
    // u in [-1.0, 1.0]: 0 = dead-on pitch, +/-1 = at the note transition boundary
    float u = std::max (-1.0f, std::min (1.0f, delta / halfW));
    float signU = (u >= 0.0f) ? 1.0f : -1.0f;
    float absU  = std::abs (u);

    float s = std::max (0.0f, std::min (100.0f, speedPercent)) / 100.0f;

    // Natural C^1 sinusoidal curve: zero at note center (u=0) AND zero at note boundary (|u|=1)
    // Guarantees zero jump when transitioning between syllables (e.g. "TRANQUI - LO")
    float naturalShape = signU * std::sin (static_cast<float> (M_PI) * absU);

    // Fast snap curve for modern robotic / hard tune
    float snapShape = u * std::pow (std::max (0.0f, 1.0f - absU * absU), 0.25f);

    float shape = (1.0f - s) * naturalShape + s * snapShape;

    // Scale by half-width to convert to cents: halfW * 100 is max semitone half-width in cents
    float maxPullCents = halfW * 100.0f;
    float cents = shape * (maxPullCents * 0.5f);

    // Vibrato preservation at natural speeds
    if (s < 0.80f)
    {
        float deadzone = 4.0f * (1.0f - s);
        if (std::abs (cents) <= deadzone)
        {
            cents *= 0.25f;
        }
    }

    // Safety clamp to prevent unnatural pitch pulling
    cents = std::max (-100.0f, std::min (100.0f, cents));

    result.centsCorrection = cents;
    return result;
}

} // namespace EasyPitch
