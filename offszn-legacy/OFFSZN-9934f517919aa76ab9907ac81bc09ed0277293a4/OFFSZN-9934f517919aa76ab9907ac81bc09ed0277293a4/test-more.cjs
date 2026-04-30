const variations = [
  'https://ik.imagekit.io/6gzqp4xam/groups/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/banners/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/avatars/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/avatars/0382a813-85c7-46c3-8d2c-61a5692adffd.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd.jpeg'
];
async function testAll() {
  for (const v of variations) {
    try {
        const r = await fetch(v);
        console.log(v, r.status);
    } catch(e) {}
  }
}
testAll();
