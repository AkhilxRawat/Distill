const { YoutubeTranscript } = require('youtube-transcript');

async function fetchYoutubeTranscript(url) {
  const videoId = extractVideoId(url);
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript.map(t => t.text).join(' ');
  } catch (err) {
    throw new Error(`Transcript unavailable for this video. Please paste the text directly. (${err.message})`);
  }
}

function extractVideoId(url) {
  const match = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
  if (!match) throw new Error('Invalid YouTube URL');
  return match[1];
}

module.exports = { fetchYoutubeTranscript };