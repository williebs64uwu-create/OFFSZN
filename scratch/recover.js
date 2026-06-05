const fs = require('fs');

const logPath = 'C:\\Users\\Willie\\.gemini\\antigravity-ide\\brain\\d77919f4-8688-4fe2-a681-097543855ac8\\.system_generated\\logs\\transcript.jsonl';
const outputPath = 'C:\\Users\\Willie\\Desktop\\OFFSZN\\scratch\\recovered_js.txt';

const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

for (const line of lines) {
    if (line.includes('initPSS') && line.includes('replace_file_content')) {
        try {
            const json = JSON.parse(line);
            if (json.tool_calls && json.tool_calls[0] && json.tool_calls[0].args && json.tool_calls[0].args.ReplacementContent) {
                // ReplacementContent contains raw escaped strings. In JSON it was a string with actual \n characters inside it. Let's write it.
                let content = json.tool_calls[0].args.ReplacementContent;
                
                // Parse it from JSON as a string if it's JSON encoded
                if (content.startsWith('"') && content.endsWith('"')) {
                    content = JSON.parse(content);
                }
                
                fs.writeFileSync(outputPath, content);
                console.log('Successfully recovered JS content to recovered_js.txt');
                break;
            }
        } catch (e) {
            console.error('Failed to parse line:', e);
        }
    }
}
