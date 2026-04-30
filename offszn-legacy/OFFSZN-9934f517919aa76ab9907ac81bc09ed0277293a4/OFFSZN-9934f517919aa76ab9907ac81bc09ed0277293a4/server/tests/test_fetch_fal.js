const FAL_KEY = "e7548196-8fc7-45bb-bc43-5da8756b93a1:67c18b1538581108090393a27b1c3b3c";

async function testFetchFal() {
    console.log("Probando Fal.ai con FETCH directo...");
    try {
        const response = await fetch("https://queue.fal.run/fal-ai/stable-audio", {
            method: "POST",
            headers: {
                "Authorization": `Key ${FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: "ambient techno texture",
                seconds_total: 5
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        const { request_id } = await response.json();
        console.log(`Request ID: ${request_id}`);
        
        let result = null;
        while (!result) {
            const res = await fetch(`https://queue.fal.run/fal-ai/stable-audio/requests/${request_id}`, {
                headers: { "Authorization": `Key ${FAL_KEY}` }
            });
            const data = await res.json();
            console.log(`Estado: ${data.status}`);
            if (data.status === 'COMPLETED') result = data;
            else if (data.status === 'FAILED') throw new Error("Falló");
            else await new Promise(r => setTimeout(r, 2000));
        }

        console.log("ÉXITO!");
        console.log("Audio URL:", result.audio_file.url);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testFetchFal();
