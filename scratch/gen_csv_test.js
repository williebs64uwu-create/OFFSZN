const fs = require('fs');

// Data from Supabase query (mock data for test)
const users = [{"Email address":"test1@example.com","First name":"Test","Last name":"1","Segmento":"Usuario General","Plan":"Free","Role":"Productor Musical","Onboarding":"Completado","PrimerUpload":"No","Productos":"0","Seguidores":"0"},{"Email address":"test2@example.com","First name":"Test","Last name":"2","Segmento":"Usuario General","Plan":"Free","Role":"Artista / Cantante","Onboarding":"Completado","PrimerUpload":"No","Productos":"0","Seguidores":"0"}];

// Just a test - we'll use the full approach differently
const headers = Object.keys(users[0]);
let csv = headers.map(h => '"'+h+'"').join(',') + '\n';
users.forEach(u => {
  csv += headers.map(h => '"' + (u[h]||'').toString().replace(/"/g,'""') + '"').join(',') + '\n';
});

console.log("CSV header format works!");
console.log(csv.split('\n')[0]);
console.log("Sample row:");
console.log(csv.split('\n')[1]);
