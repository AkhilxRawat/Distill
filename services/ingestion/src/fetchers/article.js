const axios = require('axios');
const cheerio = require('cheerio');

async function fetchArticle(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  $('script, style, nav, footer').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}
module.exports = { fetchArticle };