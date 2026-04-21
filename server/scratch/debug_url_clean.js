const buckets = ['offszn-storage', 'offsznlatbucket', 'bucket3lat'];

function cleanUrl(cleanPath) {
    if (cleanPath.startsWith('http')) {
        if (cleanPath.includes('supabase.co')) {
            const publicParts = cleanPath.split('/v1/object/public/');
            if (publicParts.length > 1) {
                cleanPath = publicParts[1];
            } else {
                const signParts = cleanPath.split('/v1/object/sign/');
                if (signParts.length > 1) cleanPath = signParts[1].split('?')[0];
            }
        } else if (cleanPath.includes('cloudflarestorage.com')) {
            const baseUrl = cleanPath.split('?')[0];
            
            const subMatch = baseUrl.match(/^https?:\/\/(?:offszn-storage|offsznlatbucket|bucket3lat)\.[^\/]+\/(.+)/i);
            const pathMatch = baseUrl.match(/^https?:\/\/[^\/]+\/(?:offszn-storage|offsznlatbucket|bucket3lat)\/(.+)/i);
            
            if (subMatch) {
                cleanPath = subMatch[1];
            } else if (pathMatch) {
                cleanPath = pathMatch[1];
            }
        }
    }
    return cleanPath;
}

const urls = [
    "https://offsznlatbucket.42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com/secure-products/beats/stems/a37b0d68-8cd2-444b-9889-a3386b60bea3/1776739330143_blame_me.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=090fc361ac3433dfeacd5b062dc37e69%2F20260421%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260421T025734Z&X-Amz-Expires=3600&X-Amz-Signature=a56f7486f89a9b27c44da536a5d3c028f9585664bbcb5e055914732e87817501&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%221776739330143_blame_me.zip%22&x-id=GetObject",
    "https://42fc23b11a6c329b76b2babc20afcbf7.r2.cloudflarestorage.com/offsznlatbucket/secure-products/beats/stems/33475582-34d4-449c-bf91-2d39b2f83125/1773346360238_Stems-BATALLA--120BPM-Fm-_Daniel_Alonso_.rar?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=090fc361ac3433dfeacd5b062dc37e69%2F20260404%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260404T125527Z&X-Amz-Expires=3600&X-Amz-Signature=64682f7d43cb0bc1286016cad6a0576f5870114503de03ce4f6d4ba344cda7e5&X-Amz-SignedHeaders=host&x-id=GetObject"
];

console.log('--- DEBUG URL CLEANING ---');
urls.forEach((u, i) => {
    console.log(`\nURL ${i+1}:`, u.substring(0, 80) + '...');
    const result = cleanUrl(u);
    console.log(`Result ${i+1}:`, result);
    if (result.startsWith('http')) {
        console.log('❌ FAILED TO CLEAN');
    } else {
        console.log('✅ CLEANED SUCCESSFULLY');
    }
});
