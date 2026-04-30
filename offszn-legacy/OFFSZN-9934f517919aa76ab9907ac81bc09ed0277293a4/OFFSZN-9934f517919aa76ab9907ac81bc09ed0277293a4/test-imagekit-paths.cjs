const paths = [
  'https://ik.imagekit.io/6gzqp4xam/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/Avatars/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/avatars%20image%20kit/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/avatars_image_kit/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg',
  'https://ik.imagekit.io/6gzqp4xam/legal/avatar_0382a813-85c7-46c3-8d2c-61a5692adffd_vkCmhNcg7.jpeg'
];
async function check() {
  for (const p of paths) {
    const res = await fetch(p);
    console.log(p, res.status);
  }
}
check();
