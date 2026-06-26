const { YoutubeTranscript } = require('youtube-transcript');

async function main() {
  const videoId = 'hD_MOQShN-s';
  console.log('Testing transcript fetching for videoId:', videoId);
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log('✅ Transcript fetched successfully! Text length:', transcript.map(t => t.text).join(' ').length);
  } catch (err) {
    console.error('❌ Failed to fetch transcript:', err.message);
  }
}

main().catch(console.error);
