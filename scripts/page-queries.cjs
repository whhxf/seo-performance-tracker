#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const expandPath = (p) => p.replace(/^~/, process.env.HOME);
const credentialsPath = expandPath(config.credentials.gcp_key_path);
const siteConfig = config.sites.default;

const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

async function getPageQueries() {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
  });
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const end = new Date('2026-03-04');
  const start = new Date('2026-02-02');
  const fmt = d => d.toISOString().split('T')[0];

  // 按页面+查询维度查询
  const response = await searchconsole.searchanalytics.query({
    siteUrl: siteConfig.gsc_url,
    requestBody: {
      startDate: fmt(start), endDate: fmt(end),
      searchType: 'web',
      dimensions: ['page', 'query'],
      rowLimit: 500
    }
  });

  // 核心业务页面关键词
  const coreKeywords = [
    'embed-video',      // 视频嵌入
    'speed-up',         // 独立站速度
    'boost-video-seo',  // 视频SEO
    'video-hosting',    // 视频托管
    'wordpress-plugin', // WordPress插件
    'cloudflare-301',   // Cloudflare 301
    'siteground',       // SiteGround 相关
    'video-indexing',   // 视频收录
  ];

  const rows = response.data.rows || [];
  const filtered = rows.filter(r => {
    const page = r.keys[0];
    return coreKeywords.some(kw => page.includes(kw));
  });

  // 按页面分组
  const byPage = {};
  filtered.forEach(r => {
    const page = r.keys[0];
    const query = r.keys[1];
    if (!byPage[page]) byPage[page] = { queries: [], total: { clicks: 0, impressions: 0 } };
    byPage[page].queries.push({
      query,
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 1000) / 10,
      position: Math.round(r.position * 100) / 100
    });
    byPage[page].total.clicks += r.clicks;
    byPage[page].total.impressions += r.impressions;
  });

  // 每个页面只保留 top 10 queries
  Object.keys(byPage).forEach(page => {
    byPage[page].queries.sort((a, b) => b.impressions - a.impressions);
    byPage[page].queries = byPage[page].queries.slice(0, 10);
  });

  console.log(JSON.stringify(byPage, null, 2));
}

getPageQueries();