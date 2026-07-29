async function test() {
  try {
    const health = await fetch('http://localhost:5000/api/health');
    const healthData = await health.json();
    console.log('Health:', JSON.stringify(healthData, null, 2));

    const noToken = await fetch('http://localhost:5000/api/attendance?classId=000000000000000000000000&date=2026-07-28');
    const noTokenData = await noToken.json();
    console.log('No Token:', JSON.stringify(noTokenData, null, 2));

    const TOKEN = 'test-jwt-token';

    const attendGet = await fetch('http://localhost:5000/api/attendance?classId=000000000000000000000000&date=2026-07-28', {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const attendData = await attendGet.json();
    console.log('GET Attendance:', JSON.stringify(attendData, null, 2));

    const attendPost = await fetch('http://localhost:5000/api/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({})
    });
    const postData = await attendPost.json();
    console.log('POST Validation:', JSON.stringify(postData, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
