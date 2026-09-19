#pragma once
#include <juce_core/juce_core.h>
#include <cmath>

namespace EasyPitch
{

struct QuantizeResult
{
    float targetMidiNote   = 0.0f;
    float centsCorrection  = 0.0f; // -50.0 to +50.0 (or larger if unquantized)
    juce::String inputNoteName;
    juce::String targetNoteName;
    bool isScaleActive     = false;
};

class ScaleQuantizer
{
public:
    ScaleQuantizer();
    ~ScaleQuantizer() = default;

    // keyIndex: 0 = C, 1 = C#, ..., 11 = B
    // scaleIndex: 0 = Mayor, 1 = Menor Natural
    QuantizeResult quantize (float detectedHz, int keyIndex, int scaleIndex, float referenceHz = 440.0f, float speedPercent = 65.0f, int customMask = 0x0FFF);

    void reset();

    static juce::String midiToNoteName (int midiNote);
    static float hzToMidi (float hz, float referenceHz = 440.0f);
    static float midiToHz (float midi, float referenceHz = 440.0f);

private:
    float lastTargetMidi = -1.0f;
    float smoothedMidi   = -1.0f;
    int lastKeyIndex     = -1;
    int lastScaleIndex   = -1;
    int lastCustomMask   = -1;

    // Bitmasks for scales across 12 semitones
    // Major: C, D, E, F, G, A, B -> semitones 0, 2, 4, 5, 7, 9, 11
    static constexpr int MAJOR_MASK = (1 << 0) | (1 << 2) | (1 << 4) | (1 << 5) | (1 << 7) | (1 << 9) | (1 << 11);
    
    // Natural Minor: C, D, Eb, F, G, Ab, Bb -> semitones 0, 2, 3, 5, 7, 8, 10
    static constexpr int MINOR_MASK = (1 << 0) | (1 << 2) | (1 << 3) | (1 << 5) | (1 << 7) | (1 << 8) | (1 << 10);

    bool isNoteAllowed (int noteClass, int rootClass, int scaleIndex, int customMask) const;
};

} // namespace EasyPitch
