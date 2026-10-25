// Only called after the named synthetic database manifest has been validated.
const fs = require('node:fs/promises');
const path = require('node:path');
const { catalogue } = require('../services/securityPostCatalogue');
async function upgradeDemoPosts(client) {
  for (const [legacyName, official] of [['DEMO Pos A', catalogue.posts[0]], ['DEMO Pos B', catalogue.posts[1]]]) {
    await client.query(`update tbl_pos_kawalan set nama_pos=$1,nama_bangunan=$2
      where nama_pos=$3 and nama_bangunan='Bangunan demonstrasi'`, [official.name,catalogue.building,legacyName]);
  }
  await client.query(await fs.readFile(path.join(__dirname,'../database/migrations/005_djm_security_posts.sql'),'utf8'));
}
module.exports = { upgradeDemoPosts };
