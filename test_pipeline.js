const { MongoClient } = require('mongodb');
require('dotenv').config();
const client = new MongoClient(process.env.MONGO_URI);
async function test() {
  await client.connect();
  const db = client.db('life-lessons');
  const pipeline = [
      { $match: { title: "Test Lesson (Edited)" } },
      {
        $lookup: {
          from: 'user',
          let: { creatorIdString: "$creatorId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", { $toObjectId: "$$creatorIdString" }]
                }
              }
            }
          ],
          as: 'authorInfo'
        }
      },
      {
        $addFields: {
          authorName: { $arrayElemAt: ['$authorInfo.name', 0] },
          authorImage: { $arrayElemAt: ['$authorInfo.image', 0] },
          authorPhotoURL: { $arrayElemAt: ['$authorInfo.photoURL', 0] } // Fetching both possible image fields
        }
      },
      {
        $project: {
          authorInfo: 0 // Exclude the raw array to keep the payload clean
        }
      }
    ];
  const res = await db.collection('lessons').aggregate(pipeline).toArray();
  console.log("Full lesson:", res[0]);
  await client.close();
}
test().catch(console.error);
