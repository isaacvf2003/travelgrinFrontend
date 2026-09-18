const fs = require('fs');

async function checkSite(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      }
    });
    console.log(url, 'status:', res.status);
    const html = await res.text();
    const imgs = [];
    const regex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      imgs.push(match[1]);
    }
    console.log(url, 'total images:', imgs.length);
    const logoCandidates = imgs.filter(src => /logo|header|brand|identidad|emblema/i.test(src));
    console.log(url, 'logo candidates:', logoCandidates);
    return { status: res.status, htmlLength: html.length, logoCandidates };
  } catch (e) {
    console.error(url, 'error:', e.message);
  }
}

async function main() {
  console.log('--- Checking UBA ---');
  await checkSite('https://www.uba.ar');
  console.log('--- Checking Garrahan ---');
  await checkSite('https://www.garrahan.gov.ar');
}

main();
