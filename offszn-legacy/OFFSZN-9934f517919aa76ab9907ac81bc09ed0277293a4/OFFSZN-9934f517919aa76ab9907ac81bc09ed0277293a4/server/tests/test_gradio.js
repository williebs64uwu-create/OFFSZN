async function testGradio() {
    console.log("Testing Gradio API for MusicGen...");
    const url = "https://facebook-musicgen.hf.space/--ads--/api/predict"; 
    // Nota: El subdominio y path varían, pero intentaremos el estándar.
    
    try {
        const response = await fetch("https://facebook-musicgen.hf.space/run/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: [
                    "lo-fi hip hop", // prompt
                    "melody", // model (small, medium, large)
                    5, // duration
                ]
            })
        });
        
        console.log(`Status: ${response.status}`);
        const json = await response.json();
        console.log("Output:", json);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testGradio();
