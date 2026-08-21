import fs from 'fs';

const filePath = 'D:/!OFFSZN/PROYECTOS/PLUGINS/COCA COLA/Source/PluginEditor.cpp';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the GUI path resolution block
const searchSnippet = 'juce::File guiDir = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)';
const endIndex = content.indexOf('webComponent->goToURL (url);');

if (content.includes(searchSnippet) && endIndex !== -1) {
  const startIndex = content.indexOf(searchSnippet);
  
  const replacement = `// Local GUI resolution (Checks both user and system Application Support on macOS)
    juce::File userGuiDir   = juce::File::getSpecialLocation (juce::File::userApplicationDataDirectory)
                                  .getChildFile ("OFFSZN").getChildFile ("COCA_COLAGui");
    juce::File commonGuiDir = juce::File::getSpecialLocation (juce::File::commonApplicationDataDirectory)
                                  .getChildFile ("OFFSZN").getChildFile ("COCA_COLAGui");

    juce::File guiFile = userGuiDir.getChildFile ("mockup.html");
    if (!guiFile.existsAsFile() && commonGuiDir.getChildFile ("mockup.html").existsAsFile())
    {
        guiFile = commonGuiDir.getChildFile ("mockup.html");
    }

    if (!guiFile.existsAsFile())
    {
        juce::File exeDir = juce::File::getSpecialLocation (juce::File::currentExecutableFile).getParentDirectory();
        juce::File src = exeDir.getChildFile ("mockup.html");
        if (src.existsAsFile())
        {
            userGuiDir.createDirectory();
            src.copyFileTo (userGuiDir.getChildFile ("mockup.html"));
            guiFile = userGuiDir.getChildFile ("mockup.html");
        }
    }

    const juce::String url = guiFile.existsAsFile()
        ? "file:///" + guiFile.getFullPathName().replaceCharacter ('\\\\', '/')
        : "https://offszn.lat/plugins/coca-cola-mockup?v=1";

    `;

  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  content = before + replacement + after;
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESSFULLY_UPDATED_PLUGIN_EDITOR');
} else {
  console.error('SEARCH_SNIPPET_NOT_FOUND');
}
