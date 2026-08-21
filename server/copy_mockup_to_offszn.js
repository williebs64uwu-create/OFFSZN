import fs from 'fs';

const src = 'D:/!OFFSZN/PROYECTOS/PLUGINS/COCA COLA/mockup.html';
const dest = 'D:/!OFFSZN/PROYECTOS/OFFSZN/plugins/coca-cola-mockup.html';

fs.copyFileSync(src, dest);
console.log('COPIED_MOCKUP_TO_OFFSZN_PLUGINS');
