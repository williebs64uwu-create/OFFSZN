#include "PluginProcessor.h"
#include "PluginEditor.h"

EasyPitchAudioProcessor::EasyPitchAudioProcessor()
#ifndef JucePlugin_PreferredChannelConfigurations
    : AudioProcessor (BusesProperties()
                      .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      .withOutput ("Output", juce::AudioChannelSet::stereo(), true))
#endif
{
    licenseManager.initLicenseState();
}

EasyPitchAudioProcessor::~EasyPitchAudioProcessor()
{
}

const juce::String EasyPitchAudioProcessor::getName() const
{
    return "EASY PITCH";
}

bool EasyPitchAudioProcessor::acceptsMidi() const { return false; }
bool EasyPitchAudioProcessor::producesMidi() const { return false; }
bool EasyPitchAudioProcessor::isMidiEffect() const { return false; }
double EasyPitchAudioProcessor::getTailLengthSeconds() const { return 0.0; }

int EasyPitchAudioProcessor::getNumPrograms() { return 3; }
int EasyPitchAudioProcessor::getCurrentProgram() { return 1; }
void EasyPitchAudioProcessor::setCurrentProgram (int index) { loadPresetByIndex (index); }

const juce::String EasyPitchAudioProcessor::getProgramName (int index)
{
    switch (index)
    {
        case 0: return "Suave";
        case 1: return "Firme";
        case 2: return "Marcado";
        default: return "Default";
    }
}

void EasyPitchAudioProcessor::changeProgramName (int /*index*/, const juce::String& /*newName*/) {}

void EasyPitchAudioProcessor::loadPresetByIndex (int index)
{
    switch (index)
    {
        case 0: // Suave
            p_speed.store (35.0f);
            p_amount.store (80.0f);
            break;
        case 1: // Firme
            p_speed.store (65.0f);
            p_amount.store (100.0f);
            break;
        case 2: // Marcado
            p_speed.store (100.0f);
            p_amount.store (100.0f);
            break;
        default:
            break;
    }
}

#ifndef JucePlugin_PreferredChannelConfigurations
bool EasyPitchAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    // Seamless support for Mono -> Mono and Stereo -> Stereo
    const auto& mainOut = layouts.getMainOutputChannelSet();
    const auto& mainIn  = layouts.getMainInputChannelSet();

    if (mainOut != juce::AudioChannelSet::mono() && mainOut != juce::AudioChannelSet::stereo())
        return false;

    if (mainOut != mainIn)
        return false;

    return true;
}
#endif

void EasyPitchAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    pitchDetector.prepare (sampleRate, samplesPerBlock);
    scaleQuantizer.reset();
    pitchShifter.prepare (sampleRate, samplesPerBlock);

    setLatencySamples (pitchShifter.getLatencySamples());

    liveInputMidi.store (0.0f);
    liveTargetMidi.store (0.0f);
    liveCentsShift.store (0.0f);
    liveRMS.store (0.0f);
    liveIsVoiced.store (false);

    const juce::ScopedLock sl (notesLock);
    liveInputNote  = "--";
    liveTargetNote = "--";
}

void EasyPitchAudioProcessor::releaseResources()
{
    pitchDetector.reset();
    scaleQuantizer.reset();
    pitchShifter.reset();
}

void EasyPitchAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& /*midiMessages*/)
{
    juce::ScopedNoDenormals noDenormals;

    int totalNumInputChannels  = getTotalNumInputChannels();
    int totalNumOutputChannels = getTotalNumOutputChannels();
    int numSamples = buffer.getNumSamples();

    // Clear unused output channels
    for (int i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, numSamples);

    // Security Audio Gate: Silence audio completely if license is invalid
    if (!licenseManager.isLicensed())
    {
        for (int i = 0; i < totalNumOutputChannels; ++i)
            buffer.clear (i, 0, numSamples);
        return;
    }

    if (numSamples == 0 || totalNumInputChannels == 0)
        return;

    // Read parameter values
    bool  enabled        = p_enabled.load();
    int   keyIndex       = p_key.load();
    int   scaleIndex     = p_scale.load();
    float speed          = p_speed.load();
    float amount         = p_amount.load();
    int   voiceRange     = p_voiceRange.load();
    bool  preserveTimbre = p_preserveTimbre.load();
    float referenceHz    = p_referenceHz.load();
    int   customMask     = p_customMask.load();

    pitchShifter.setPreserveTimbre (preserveTimbre);

    // Compute monophonic analysis signal for pitch tracking
    const float* inL = buffer.getReadPointer (0);
    const float* inR = (totalNumInputChannels > 1) ? buffer.getReadPointer (1) : inL;

    EasyPitch::PitchDetectionResult detResult;
    for (int i = 0; i < numSamples; ++i)
    {
        // Coherent mono mix for detection
        float monoSample = 0.5f * (inL[i] + inR[i]);

        if (pitchDetector.processSample (monoSample, detResult, voiceRange))
        {
            // Frame analysis ready with acoustic vibrato preservation and custom note mask
            auto qResult = scaleQuantizer.quantize (detResult.pitchHz, keyIndex, scaleIndex, referenceHz, speed, customMask);

            pitchShifter.setTargetShift (qResult.centsCorrection, speed, amount, detResult.isVoiced, detResult.pitchHz);

            // Update live metrics snapshot
            liveRMS.store (detResult.rmsLevel);
            liveIsVoiced.store (detResult.isVoiced);
            liveCentsShift.store (pitchShifter.getCurrentAppliedCents());

            if (detResult.isVoiced)
            {
                liveInputMidi.store (EasyPitch::ScaleQuantizer::hzToMidi (detResult.pitchHz, referenceHz));
                liveTargetMidi.store (qResult.targetMidiNote);

                const juce::ScopedLock sl (notesLock);
                liveInputNote  = qResult.inputNoteName;
                liveTargetNote = qResult.targetNoteName;
            }
            else
            {
                const juce::ScopedLock sl (notesLock);
                liveInputNote  = "--";
                liveTargetNote = "--";
            }
        }
    }

    // Determine if we should bypass
    bool shouldBypass = !enabled;
    pitchShifter.processBlock (buffer, shouldBypass);
}

// ── Bridge Communication ─────────────────────────────────────────────────────
void EasyPitchAudioProcessor::setParamFromUI (const juce::String& paramId, float value)
{
    if (paramId == "enabled")
        p_enabled.store (value > 0.5f);
    else if (paramId == "key")
        p_key.store (static_cast<int> (value));
    else if (paramId == "scale")
        p_scale.store (static_cast<int> (value));
    else if (paramId == "speed")
        p_speed.store (value);
    else if (paramId == "amount")
        p_amount.store (value);
    else if (paramId == "voiceRange")
        p_voiceRange.store (static_cast<int> (value));
    else if (paramId == "preserveTimbre")
        p_preserveTimbre.store (value > 0.5f);
    else if (paramId == "referenceHz")
        p_referenceHz.store (value);
    else if (paramId == "customMask")
        p_customMask.store (static_cast<int> (value));
    else if (paramId == "preset")
        loadPresetByIndex (static_cast<int> (value));
}

float EasyPitchAudioProcessor::getParamValue (const juce::String& paramId) const
{
    if (paramId == "enabled")        return p_enabled.load() ? 1.0f : 0.0f;
    if (paramId == "key")            return static_cast<float> (p_key.load());
    if (paramId == "scale")          return static_cast<float> (p_scale.load());
    if (paramId == "speed")          return p_speed.load();
    if (paramId == "amount")         return p_amount.load();
    if (paramId == "voiceRange")     return static_cast<float> (p_voiceRange.load());
    if (paramId == "preserveTimbre") return p_preserveTimbre.load() ? 1.0f : 0.0f;
    if (paramId == "referenceHz")    return p_referenceHz.load();
    if (paramId == "customMask")     return static_cast<float> (p_customMask.load());

    return 0.0f;
}

EasyPitch::LiveMetrics EasyPitchAudioProcessor::getLiveMetrics() const
{
    EasyPitch::LiveMetrics metrics;
    metrics.inputMidi  = liveInputMidi.load();
    metrics.targetMidi = liveTargetMidi.load();
    metrics.centsShift = liveCentsShift.load();
    metrics.rmsLevel   = liveRMS.load();
    metrics.isVoiced   = liveIsVoiced.load();
    metrics.customMask = p_customMask.load();

    const juce::ScopedLock sl (notesLock);
    metrics.inputNote  = liveInputNote;
    metrics.targetNote = liveTargetNote;

    return metrics;
}

// ── State Persistence (DAW session recall) ───────────────────────────────────
void EasyPitchAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    juce::XmlElement xml ("EasyPitchSettings");
    xml.setAttribute ("version", 1);
    xml.setAttribute ("enabled",        p_enabled.load());
    xml.setAttribute ("key",            p_key.load());
    xml.setAttribute ("scale",          p_scale.load());
    xml.setAttribute ("speed",          static_cast<double> (p_speed.load()));
    xml.setAttribute ("amount",         static_cast<double> (p_amount.load()));
    xml.setAttribute ("voiceRange",     p_voiceRange.load());
    xml.setAttribute ("preserveTimbre", p_preserveTimbre.load());
    xml.setAttribute ("referenceHz",    static_cast<double> (p_referenceHz.load()));
    xml.setAttribute ("customMask",     p_customMask.load());

    copyXmlToBinary (xml, destData);
}

void EasyPitchAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xml (getXmlFromBinary (data, sizeInBytes));
    if (xml != nullptr && xml->hasTagName ("EasyPitchSettings"))
    {
        p_enabled.store        (xml->getBoolAttribute ("enabled", true));
        p_key.store            (xml->getIntAttribute  ("key", 0));
        p_scale.store          (xml->getIntAttribute  ("scale", 0));
        p_speed.store          (static_cast<float> (xml->getDoubleAttribute ("speed", 65.0)));
        p_amount.store         (static_cast<float> (xml->getDoubleAttribute ("amount", 100.0)));
        p_voiceRange.store     (xml->getIntAttribute  ("voiceRange", 0));
        p_preserveTimbre.store (xml->getBoolAttribute ("preserveTimbre", true));
        p_referenceHz.store    (static_cast<float> (xml->getDoubleAttribute ("referenceHz", 440.0)));
        p_customMask.store     (xml->getIntAttribute  ("customMask", 0x0FFF));
    }
}

bool EasyPitchAudioProcessor::hasEditor() const { return true; }
juce::AudioProcessorEditor* EasyPitchAudioProcessor::createEditor()
{
    return new EasyPitchAudioProcessorEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new EasyPitchAudioProcessor();
}
