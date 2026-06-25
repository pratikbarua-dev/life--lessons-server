const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URI);
async function test() {
  await client.connect();
  const db = client.db('life-lessons');
  const l = await db.collection('lessons').findOne({title: "Premium Strategy: Architecting Long-term Networks"});
  console.log("CreatorId type:", typeof l.creatorId, l.creatorId instanceof require('mongodb').ObjectId ? 'ObjectId' : 'not objectId');
  await client.close();
}
test().catch(console.error);
