const jwt = 'eyJhbGciOiJFZERTQSIsImtpZCI6IjZhM2FkMTU0MTcwMGUwMzY4MGNhYTZkYiJ9.eyJpYXQiOjE3ODIyNzkyMjMsIm5hbWUiOiJQcmF0aWsgQmFydWEiLCJlbWFpbCI6InByYXRpa2JhcnVhNTJAZ21haWwuY29tIiwiZW1haWxWZXJpZmllZCI6dHJ1ZSwiaW1hZ2UiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJOXFOYnRDaGp3ZTV3NVloTV9qZXVfdnZIeE91YS1ZRzZWR095d25qLTk2U01BSU0xSD1zOTYtYyIsImNyZWF0ZWRBdCI6IjIwMjYtMDYtMjNUMTQ6MTk6NTAuMjY2WiIsInVwZGF0ZWRBdCI6IjIwMjYtMDYtMjNUMTQ6MTk6NTAuMjY2WiIsInJvbGUiOiJ1c2VyIiwiaXNCYW5uZWQiOmZhbHNlLCJpZCI6IjZhM2E5NjA2ZTUwNDkzOWQzOTZlZDRkZSIsInN1YiI6IjZhM2E5NjA2ZTUwNDkzOWQzOTZlZDRkZSIsImV4cCI6MTc4MjI4MDEyMywiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwIiwiYXVkIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwIn0.bxNpHY4vmXS1tlrzC7RSXAx2Lbz9fYTaNqN0l8ej-Ux3WCTVFF8JWikZJbaj99Gsk1Y51WHPnYcpgIEA3_eQAw';
const userId = '6a3a9606e504939d396ed4de';

async function test() {
  console.log("1. Creating a Lesson...");
  let res = await fetch('http://localhost:3100/api/lessons', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Lesson', description: 'Testing the endpoints', category: 'Mindfulness', emotionalTone: 'Calm', visibility: 'Public', accessLevel: 'Free', creatorId: userId })
  });
  let data = await res.json();
  console.log(data);
  const lessonId = data.lessonId;

  console.log("\n2. Liking the Lesson...");
  res = await fetch(`http://localhost:3100/api/lessons/${lessonId}/like`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId })
  });
  console.log(await res.json());

  console.log("\n3. Adding a comment...");
  res = await fetch(`http://localhost:3100/api/lessons/${lessonId}/comments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'This is a test comment!', authorId: userId })
  });
  data = await res.json();
  console.log(data);
  const commentId = data.commentId;

  console.log("\n4. Editing the Lesson...");
  res = await fetch(`http://localhost:3100/api/lessons/${lessonId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Lesson (Edited)', requesterId: userId })
  });
  console.log(await res.json());

  console.log("\n5. Toggling Favorite...");
  res = await fetch(`http://localhost:3100/api/favorites/toggle`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId: lessonId, userId: userId })
  });
  console.log(await res.json());

  console.log("\n6. Creating Report...");
  res = await fetch(`http://localhost:3100/api/reports`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId: lessonId, reporterUserId: userId, reportedUserEmail: 'test@example.com', reason: 'Spam' })
  });
  console.log(await res.json());
}
test().catch(console.error);
