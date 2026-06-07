const yts = require('yt-search');
const ytdl = require('ytdl-core');
const axios = require('axios');

const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function searchYouTube(query) {
  try {
    const result = await yts(query);
    return (result.all || []).map(v => ({
      title: v.title,
      url: v.url,
      duration: v.duration?.timestamp || '',
      thumbnail: v.thumbnail || '',
      views: v.views || 0,
      author: v.author?.name || '',
    }));
  } catch (_) { return []; }
}

async function downloadYouTube(url, format = 'audio') {
  try {
    const info = await ytdl.getInfo(url, { requestOptions: { headers: YT_HEADERS } });
    if (format === 'audio') {
      const af = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
      if (af?.url) return { url: af.url, title: info.videoDetails.title, thumbnail: info.videoDetails.thumbnails?.[0]?.url || '' };
    } else {
      const vf = ytdl.chooseFormat(info.formats, { filter: 'videoandaudio', quality: 'highest' });
      if (vf?.url) return { url: vf.url, title: info.videoDetails.title, thumbnail: info.videoDetails.thumbnails?.[0]?.url || '' };
    }
  } catch (_) {}
  return null;
}

async function searchSoundCloud(query) {
  try {
    const res = await axios.get(`https://api.dreaded.site/api/soundcloud/search?q=${encodeURIComponent(query)}`);
    return (res.data?.result || res.data?.data || []).slice(0, 5);
  } catch (_) { return []; }
}

async function downloadSoundCloud(url) {
  try {
    const res = await axios.get(`https://api.dreaded.site/api/soundcloud?url=${encodeURIComponent(url)}`);
    const u = res.data?.result?.url || res.data?.url;
    if (u) return { url: u, title: res.data?.result?.title || 'SoundCloud', thumbnail: res.data?.result?.thumbnail || '' };
  } catch (_) {}
  return null;
}

async function searchSpotify(query) {
  try {
    const res = await axios.get(`https://api.dreaded.site/api/spotify/search?q=${encodeURIComponent(query)}`);
    return (res.data?.result || res.data?.data || []).slice(0, 5);
  } catch (_) { return []; }
}

async function downloadSpotify(url) {
  try {
    const res = await axios.get(`https://api.dreaded.site/api/spotify?url=${encodeURIComponent(url)}`);
    const u = res.data?.result?.url || res.data?.url;
    if (u) return { url: u, title: res.data?.result?.title || 'Spotify', thumbnail: res.data?.result?.thumbnail || '' };
  } catch (_) {}
  return null;
}

module.exports = { searchYouTube, downloadYouTube, searchSoundCloud, downloadSoundCloud, searchSpotify, downloadSpotify };
