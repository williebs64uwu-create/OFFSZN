
import 'dotenv/config';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fetch from 'node-fetch';

async function testMinimalSigning() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME;
    const key = 'beats/mp3/047faefe-c743-456c-bfe2-7b5f670b0834/1772388754126_DENIAL.mp3';

    const client = new S3Client({
        region: "auto",
        endpoint: endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
        // Try disabling new features
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED"
    });

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    // Disable unhoistable headers if any
    const url = await getSignedUrl(client, command, { 
        expiresIn: 3600,
        signableHeaders: new Set(['host']) // Only sign host
    });
    
    console.log(`Minimal URL: ${url}`);

    const res = await fetch(url, { method: 'HEAD' });
    console.log(`Status: ${res.status} ${res.statusText}`);
    
    if (res.status === 403) {
        const text = await res.text();
        console.log('Error Body:', text);
    }
}

testMinimalSigning();
