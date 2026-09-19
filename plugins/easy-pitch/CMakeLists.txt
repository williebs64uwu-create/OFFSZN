cmake_minimum_required(VERSION 3.22)

project(EASY_PITCH VERSION 1.0.0)

if(APPLE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum OS X version")
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "Universal architectures")
endif()

# ── Localización de JUCE ──────────────────────────────────────────────────────
if(DEFINED ENV{JUCE_DIR})
    set(JUCE_DIR "$ENV{JUCE_DIR}")
elseif(EXISTS "C:/Users/Willie/Downloads/JUCE/CMakeLists.txt")
    set(JUCE_DIR "C:/Users/Willie/Downloads/JUCE")
elseif(EXISTS "C:/Users/Willie/Downloads/juce-8.0.13-windows/JUCE/CMakeLists.txt")
    set(JUCE_DIR "C:/Users/Willie/Downloads/juce-8.0.13-windows/JUCE")
elseif(APPLE)
    set(JUCE_DIR "/opt/homebrew/share/JUCE")
else()
    set(JUCE_DIR "C:/Users/Willie/Downloads/JUCE")
endif()

if(EXISTS ${JUCE_DIR}/CMakeLists.txt)
    add_subdirectory(${JUCE_DIR} ${CMAKE_BINARY_DIR}/JUCE)
else()
    message(FATAL_ERROR "No se encontró JUCE en ${JUCE_DIR}. Por favor define JUCE_DIR.")
endif()

# ── Declaración del Plugin JUCE 8 ─────────────────────────────────────────────
# Fabricante: Ofsz | Código de Producto: Espt (OFFSZN EASY PITCH)
juce_add_plugin(EASY_PITCH
    COMPANY_NAME "OFFSZN"
    BUNDLE_ID "com.offszn.easypitch"
    PLUGIN_MANUFACTURER_CODE Ofsz
    PLUGIN_CODE Espt
    FORMATS VST3 Standalone
    PRODUCT_NAME "EASY PITCH"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    NEEDS_WEBVIEW2 TRUE
)

juce_generate_juce_header(EASY_PITCH)

target_sources(EASY_PITCH
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginProcessor.h
        Source/PluginEditor.cpp
        Source/PluginEditor.h
        Source/dsp/PitchDetector.cpp
        Source/dsp/PitchDetector.h
        Source/dsp/ScaleQuantizer.cpp
        Source/dsp/ScaleQuantizer.h
        Source/dsp/PitchShifter.cpp
        Source/dsp/PitchShifter.h
        Source/licensing/LicenseManager.cpp
        Source/licensing/LicenseManager.h
)

target_include_directories(EASY_PITCH
    PRIVATE
        Source
        Source/dsp
        Source/licensing
)

target_link_libraries(EASY_PITCH
    PRIVATE
        juce::juce_audio_utils
        juce::juce_gui_extra
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
)

target_compile_definitions(EASY_PITCH
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
)

# ── Copia de mockup.html tras compilación ──────────────────────────────────────
if(WIN32)
    add_custom_command(TARGET EASY_PITCH_Standalone POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${CMAKE_SOURCE_DIR}/mockup.html"
            "$<TARGET_FILE_DIR:EASY_PITCH_Standalone>/mockup.html"
        COMMENT "Copiando mockup.html a carpeta de build de Standalone..."
    )
endif()
