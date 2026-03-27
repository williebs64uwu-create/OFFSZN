const url1 = "https://ik.imagekit.io/6gzqp4xam/banners/banner_18f1d12c-8268-4898-bf6a-a660b9df117d.jpg";
const url2 = "https://ik.imagekit.io/6gzqp4xam/banner_18f1d12c-8268-4898-bf6a-a660b9df117d.jpg";

async function check(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        console.log(`[${res.status}] ${url}`);
    } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
    }
}

async function run() {
    await check(url1);
    await check(url2);
}
run();
