const { YoutubeTranscript } = require('youtube-transcript');
async function fetchYoutubeTranscript(url) {
const videoId = extractVideoId(url);
const transcript = await YoutubeTranscript.fetchTranscript(videoId);
return transcript.map(t => t.text).join(' ');
}
function extractVideoId(url) {
const match = url.match(/(?:v=|youtu\.be\/)([^&\n?#]+)/);
if (!match) throw new Error('Invalid YouTube URL');
return match[1];
}