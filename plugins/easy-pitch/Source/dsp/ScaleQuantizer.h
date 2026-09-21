#pragma once
#include <juce_core/juce_core.h>
#include <cmath>

namespace EasyPitch
{

struct QuantizeResult
{
    float targetMidiNote   = 0.0f;
    float centsCorrection  = 0.0f; // -100.0 to +100.0 (or within scale boundaries)
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
    // scaleIndex: 
    //   0 = Cromatica (todos los semitonos)
    //   1 = Mayor
    //   2 = Menor natural
    //   3 = Menor armonica
    //   4 = Menor melodica
    //   5 = Pentatonica Mayor
    //   6 = Pentatonica Menor
    //   7 = Blues
    //   8 = Dorica
    QuantizeResult quantize (float detectedHz, int keyIndex, int scaleIndex, float referenceHz = 440.0f, float speedPercent = 65.0f, int customMask = 0x0FFF);

    void reset();

    static juce::String midiToNoteName (int midiNote);
    static float hzToMidi (float hz, float referenceHz = 440.0f);
    static float midiToHz (float midi, float referenceHz = 440.0f);
    static int getScaleMask (int scaleIndex);

private:
    float lastTargetMidi = -1.0f;
    int lastKeyIndex     = -1;
    int lastScaleIndex   = -1;
    int lastCustomMask   = -1;

    bool isNoteAllowed (int noteClass, int rootClass, int scaleIndex, int customMask) const;
};

} // namespace EasyPitch
