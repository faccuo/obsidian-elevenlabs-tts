const https = require('https');

const apiKey = 'sk_c27adaf877fb4b9b9db7dc8c7a9d8d6f1a4c4b519326c131';
const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const text = 'Hello, this is a test for timestamps.';

const options = {
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'xi-api-key': apiKey
  }
};

const req = https.request(options, (res) => {
  console.log(`StatusCode: ${res.statusCode}`);
  
  let chunks = [];

  res.on('data', (d) => {
    chunks.push(d);
  });

  res.on('end', () => {
    const body = Buffer.concat(chunks);
    try {
        const json = JSON.parse(body.toString());
        console.log('Response keys:', Object.keys(json));
        if (json.alignment) {
            console.log('Alignment found:', JSON.stringify(json.alignment, null, 2));
        } else {
            console.log('No alignment found. Body preview:', body.toString().slice(0, 200));
        }
    } catch (e) {
        console.log('Response is not JSON (likely audio binary if successful without timestamps, but we expect JSON with timestamps endpoint)');
        console.log('Body length:', body.length);
    }
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(JSON.stringify({
  text: text,
  model_id: 'eleven_multilingual_v2'
}));

req.end();
