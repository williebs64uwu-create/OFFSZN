cmake_minimum_required(VERSION 3.22)

project(VOCAL_PRESET VERSION 1.0.0)

if(APPLE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum OS X version")
    set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "Universal architectures")
endif()

# ── Localización de JUCE ──────────────────────────────────────────────────────
if(DEFINED ENV{JUCE_DIR})
    set(JUCE_DIR "$ENV{JUCE_DIR}")
elseif(APPLE)
    set(JUCE_DIR "/opt/homebrew/share/JUCE")
else()
    set(JUCE_DIR "C:/Users/Willie/Downloads/juce-8.0.13-windows/JUCE")
endif()

if(EXISTS ${JUCE_DIR}/CMakeLists.txt)
    add_subdirectory(${JUCE_DIR} ${CMAKE_BINARY_DIR}/JUCE)
endif()

set(EXTRA_PLUGIN_OPTIONS "")
if(WIN32)
    set(EXTRA_PLUGIN_OPTIONS NEEDS_WEBVIEW2 TRUE)
endif()

# ── Declaración del Plugin JUCE 8 ─────────────────────────────────────────────
# Fabricante: Ofsz | Código de Producto: VcPr (OFFSZN Vocal Preset)
juce_add_plugin(VOCAL_PRESET
    COMPANY_NAME "OFFSZN"
    BUNDLE_ID "com.offszn.vocalpreset"
    PLUGIN_MANUFACTURER_CODE Ofsz
    PLUGIN_CODE Vpst
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "Vocal Preset"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    ${EXTRA_PLUGIN_OPTIONS}
)

juce_generate_juce_header(VOCAL_PRESET)

target_sources(VOCAL_PRESET
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginProcessor.h
        Source/PluginEditor.cpp
        Source/PluginEditor.h
        Source/CommandParser.cpp
        Source/CommandParser.h
        Source/VocalEngine.cpp
        Source/VocalEngine.h
)

target_link_libraries(VOCAL_PRESET
    PRIVATE
        juce::juce_audio_utils
        juce::juce_gui_extra
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
)

target_compile_definitions(VOCAL_PRESET
    PUBLIC
        JUCE_WEB_BROWSER=1
        $<$<BOOL:${WIN32}>:JUCE_USE_WIN_WEBVIEW2=1>
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
)

# Copia de mockup.html tras compilación
if(WIN32)
    add_custom_command(TARGET VOCAL_PRESET_Standalone POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "${CMAKE_SOURCE_DIR}/mockup.html"
            "$<TARGET_FILE_DIR:VOCAL_PRESET_Standalone>/mockup.html"
        COMMENT "Copiando mockup.html a carpeta de build..."
    )
endif()
