import 'dotenv/config';
import Replicate from 'replicate';

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function testReplicate() {
    console.log("Testing Replicate (no version hash)...");
    try {
        const output = await replicate.run(
            "meta/musicgen",
            {
                input: {
                    prompt: "lo-fi hip hop beat",
                    duration: 5
                }
            }
        );
        console.log("Output:", output);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testReplicate();
