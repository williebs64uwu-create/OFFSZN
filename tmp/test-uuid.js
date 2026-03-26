const nickname = '0382a813-85c7-46c3-8d2c-61a5692adffd';
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nickname);
console.log('Is UUID:', isUuid);

const nickname2 = 'willieinspired';
const isUuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nickname2);
console.log('Is UUID 2:', isUuid2);
