const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../n8n_sync_emailoctopus_v2_upsert.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Find index of GET Pagina 5
const getPage5Index = data.nodes.findIndex(n => n.name === 'GET Pagina 5');
const getPage5 = data.nodes[getPage5Index];

const newNodes = [];
for (let i = 6; i <= 10; i++) {
  newNodes.push({
    parameters: {
      method: "GET",
      url: `https://emailoctopus.com/api/1.6/lists/91e49a0c-8039-11f0-9189-a3a9ba454fed/contacts?api_key=eo_9671055e75489046132311c715f75ba003e61fabb018bacf367d0fd875a3ccb7&limit=100&page=${i}`,
      authentication: "none",
      options: {}
    },
    id: `get-page${i}`,
    name: `GET Pagina ${i}`,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.1,
    position: [getPage5.position[0] + (i - 5) * 200, 300]
  });
}

// Insert new nodes after GET Pagina 5
data.nodes.splice(getPage5Index + 1, 0, ...newNodes);

// Update Javascript code
const codeNode = data.nodes.find(n => n.name === 'Mapear y Preparar');
codeNode.parameters.jsCode = codeNode.parameters.jsCode.replace(
  "const pageNodes = ['GET Pagina 1', 'GET Pagina 2', 'GET Pagina 3', 'GET Pagina 4', 'GET Pagina 5'];",
  "const pageNodes = ['GET Pagina 1', 'GET Pagina 2', 'GET Pagina 3', 'GET Pagina 4', 'GET Pagina 5', 'GET Pagina 6', 'GET Pagina 7', 'GET Pagina 8', 'GET Pagina 9', 'GET Pagina 10'];"
);

// Update connections
data.connections['GET Pagina 5'] = { "main": [[{ "node": "GET Pagina 6", "type": "main", "index": 0 }]] };
data.connections['GET Pagina 6'] = { "main": [[{ "node": "GET Pagina 7", "type": "main", "index": 0 }]] };
data.connections['GET Pagina 7'] = { "main": [[{ "node": "GET Pagina 8", "type": "main", "index": 0 }]] };
data.connections['GET Pagina 8'] = { "main": [[{ "node": "GET Pagina 9", "type": "main", "index": 0 }]] };
data.connections['GET Pagina 9'] = { "main": [[{ "node": "GET Pagina 10", "type": "main", "index": 0 }]] };
data.connections['GET Pagina 10'] = { "main": [[{ "node": "Postgres", "type": "main", "index": 0 }]] };

// Shift Postgres and other nodes to the right so they look nice
const nodesToShift = ['Postgres', 'Mapear y Preparar', 'Update o Create?', 'Bulk Update (PUT)', 'Crear Nuevo (POST)'];
for (const name of nodesToShift) {
  const n = data.nodes.find(n => n.name === name);
  if (n) {
    n.position[0] += 1000; // shift 1000px right
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Done!');
