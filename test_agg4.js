const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URI);
async function test() {
  await client.connect();
  const db = client.db('life-lessons');
  const l = await db.collection('lessons').findOne({title: "Premium Strategy: Architecting Long-term Networks"});
  console.log("CreatorId:", l.creatorId);
  
  const user = await db.collection('user').findOne({_id: new require('mongodb').ObjectId(l.creatorId)});
  console.log("User found for this creatorId?", user ? "Yes" : "No");

  await client.close();
}
test().catch(console.error);
