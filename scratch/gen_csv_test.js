const fs = require('fs');

// Data from Supabase query (291 users)
const users = [{"Email address":"1975.espinosamilagros@gmail.com","First name":"jose","Last name":"0","Segmento":"Usuario General","Plan":"Free","Role":"Productor Musical","Onboarding":"Completado","PrimerUpload":"No","Productos":"0","Seguidores":"0"},{"Email address":"1xikoh@gmail.com","First name":"xikoo","Last name":"0","Segmento":"Usuario General","Plan":"Free","Role":"Artista / Cantante","Onboarding":"Completado","PrimerUpload":"No","Productos":"0","Seguidores":"0"},{"Email address":"2koziee@gmail.com","First name":"2kozie","Last name":"2","Segmento":"Usuario General","Plan":"Free","Role":"Productor Musical","Onboarding":"Completado","PrimerUpload":"No","Productos":"1","Seguidores":"2"},{"Email address":"4lbertguzman666@gmail.com","First name":"jxy","Last name":"0","Segmento":"Usuario General","Plan":"Free","Role":"Productor Musical","Onboarding":"Completado","PrimerUpload":"No","Productos":"1","Seguidores":"0"},{"Email address":"808salamamusic33@gmail.com","First name":"808salama","Last name":"1","Segmento":"Usuario General","Plan":"Free","Role":"Productor Musical","Onboarding":"Completado","PrimerUpload":"No","Productos":"3","Seguidores":"1"}];

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
