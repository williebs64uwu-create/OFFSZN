import fetch from 'node-fetch';

async function testFinalFix() {
  const baseUrl = 'http://localhost:3000/api/orders/download-link';
  const orderId = 'SIMULATED_TEST_999';

  const cases = [
    { id: 94, type: 'wav', lic: 'Premium Lease', label: '1. Old (Feb) - Supabase -> R2' },
    { id: 463, type: 'stems', lic: 'Trackout Lease', label: '2. March - Full R2 URL' },
    { id: 655, type: 'stems', lic: 'Trackout Lease', label: '3. Newest - Full R2 URL' }
  ];

  for (const c of cases) {
    console.log(`\n--- ${c.label} ---`);
    const res = await fetch(`${baseUrl}?orderId=${orderId}&productId=${c.id}&type=${c.type}&licenseName=${c.lic}`);
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('URL:', data.signedUrl || data.url);
    
    const url = data.signedUrl || data.url || '';
    if (url.includes('%3A//') || url.includes('https://https://')) {
        console.log('❌ FAILED: Found nested/corrupted link.');
    } else if (url.startsWith('https://')) {
        console.log('✅ SUCCESS: Clean URL generated.');
    } else {
        console.log('❌ FAILED: No URL generated.');
    }
  }
}

testFinalFix();
