import fetch from 'node-fetch';

async function testStemsResolution() {
  const baseUrl = 'http://localhost:3000/api/orders/download-link';
  const orderId = 'SIMULATED_TEST_999';
  const productId = 86;

  console.log('--- TEST: Request STEMS for Product 86 (Should now find ZIP) ---');
  const res = await fetch(`${baseUrl}?orderId=${orderId}&productId=${productId}&type=stems&licenseName=Trackout Lease`);
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Body:', data);
  
  if (data.signedUrl && data.signedUrl.includes('.zip')) {
      console.log('\n✅ SUCCESS: Scavenger found the ZIP stems!');
  } else {
      console.log('\n❌ FAILED: Still not finding the correct stems.');
  }
}

testStemsResolution();
