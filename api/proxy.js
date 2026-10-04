'use strict';
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();
  let url;
  try {
    url = new URL(req.query.url);
    if (url.protocol !== 'https:' || !['i.imgur.com','imgur.com'].includes(url.hostname) || url.port || url.username || url.password) throw Error();
  } catch { return res.status(400).json({error:'Only HTTPS Imgur image URLs are supported'}); }
  try {
    const response = await fetch(url, {redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'image/*'}});
    if (!response.ok) return res.status(response.status).end();
    const type = response.headers.get('content-type') || '';
    if (!/^image\/(png|jpeg|webp|gif|avif)(;|$)/i.test(type)) return res.status(415).end();
    let bytes=0; const chunks=[];
    for await (const chunk of response.body) {
      bytes+=chunk.length; if (bytes>10*1024*1024) return res.status(413).end(); chunks.push(chunk);
    }
    res.setHeader('Content-Type',type);
    res.setHeader('Cache-Control','public, max-age=86400');
    res.status(200).send(Buffer.concat(chunks));
  } catch { res.status(502).json({error:'Image unavailable'}); }
};
