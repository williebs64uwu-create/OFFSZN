import 'dotenv/config';
import Replicate from 'replicate';

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

async function testReplicate() {
    console.log("Testing Replicate...");
    try {
        const output = await replicate.run(
            "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837fecfb1",
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
