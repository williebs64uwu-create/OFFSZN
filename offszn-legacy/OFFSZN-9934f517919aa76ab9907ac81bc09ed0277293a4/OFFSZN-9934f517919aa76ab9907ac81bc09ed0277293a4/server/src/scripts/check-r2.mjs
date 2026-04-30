import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3ClientV2 = new S3Client({
    region: "auto",
    endpoint: "https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com",
    forcePathStyle: false,
    credentials: {
        accessKeyId: "090fc361ac3433dfeacd5b062dc37e69",
        secretAccessKey: "82e3f0be0d50bd786b61ab36cfbc0f1d9dde953e2575672f3d20b62e8571dd6f",
    }
});

async function listFiles() {
    const bucket = "offsznlatbucket";
    const prefixOptions = [
        "products/secure-products/0382a813",
        "secure-products/products/0382a813",
        "secure-products/0382a813",
        "products/0382a813",
        "0382a813",
        "products/secure-products"
    ];

    for (const prefix of prefixOptions) {
        console.log(`Checking prefix: ${prefix}`);
        try {
            const command = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix
            });
            const response = await s3ClientV2.send(command);
            if (response.Contents && response.Contents.length > 0) {
                console.log(`Found ${response.Contents.length} files under prefix ${prefix}:`);
                response.Contents.forEach(c => console.log(` - ${c.Key}`));
            } else {
                console.log(`No files found.`);
            }
        } catch (err) {
            console.error(`Error checking prefix ${prefix}:`, err.message);
        }
    }
}

listFiles();
