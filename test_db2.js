const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URI);
async function test() {
  await client.connect();
  const db = client.db('life-lessons');
  const user = await db.collection('user').findOne({_id: new ObjectId('6a3a9606e504939d396ed4de')});
  console.log("User found:", user);
  // Also check if better-auth created a table with a string _id?
  const stringUser = await db.collection('user').findOne({_id: '6a3a9606e504939d396ed4de'});
  console.log("String User found:", stringUser);
  await client.close();
}
test().catch(console.error);
