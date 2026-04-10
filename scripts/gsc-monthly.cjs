#!/usr/bin/env node

/**
 * GSC Monthly Query - 按月份查询 GSC 数据
 *
 * 用法: node gsc-monthly.cjs [站点代号] [年份]
 * 示例: node gsc-monthly.cjs cn 2026
 *
 * 输出指定年份 Q1-Q4 每个月的 GSC 数据，包含环比增长率
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const siteCode = process.argv[2] || 'default';
const year = parseInt(process.argv[3]) || 2026;

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const expandPath = (p) => p.replace(/^~/, process.env.HOME);

const siteConfig = config.sites[siteCode];
if (!siteConfig) {
  console.error(JSON.stringify({ error: `站点代号 "${siteCode}" 未在 config.json 中配置` }));
  process.exit(1);
}

const credentialsPath = expandPath(config.credentials.gcp_key_path);

// 定义月份范围
const months = [
  { name: '1月', start: `${year}-01-01`, end: `${year}-01-31` },
  { name: '2月', start: `${year}-02-01`, end: `${year}-02-28` },
  { name: '3月', start: `${year}-03-01`, end: `${year}-03-31` },
  { name: '4月', start: `${year}-04-01`, end: `${year}-04-30` },
  { name: '5月', start: `${year}-05-01`, end: `${year}-05-31` },
  { name: '6月', start: `${year}-06-01`, end: `${year}-06-30` },
  { name: '7月', start: `${year}-07-01`, end: `${year}-07-31` },
  { name: '8月', start: `${year}-08-01`, end: `${year}-08-31` },
  { name: '9月', start: `${year}-09-01`, end: `${year}-09-30` },
  { name: '10月', start: `${year}-10-01`, end: `${year}-10-31` },
  { name: '11月', start: `${year}-11-01`, end: `${year}-11-30` },
  { name: '12月', start: `${year}-12-01`, end: `${year}-12-31` },
];

async function queryMonth(month) {
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // 查询总体数据
    const overallResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteConfig.gsc_url,
      requestBody: {
        startDate: month.start,
        endDate: month.end,
        searchType: 'web',
        aggregationType: 'auto',
      },
    });

    const overall = overallResponse.data.rows?.[0] || {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    };

    // 查询 Top 关键词
    const queryResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteConfig.gsc_url,
      requestBody: {
        startDate: month.start,
        endDate: month.end,
        searchType: 'web',
        dimensions: ['query'],
        rowLimit: 30,
      },
    });

    return {
      month: month.name,
      startDate: month.start,
      endDate: month.end,
      clicks: overall.clicks || 0,
      impressions: overall.impressions || 0,
      ctr: Math.round((overall.ctr || 0) * 1000) / 10,
      avgPosition: Math.round((overall.position || 0) * 100) / 100,
      topQueries: (queryResponse.data.rows || []).map((row) => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 1000) / 10,
        avgPosition: Math.round(row.position * 100) / 100,
      })),
    };
  } catch (error) {
    return {
      month: month.name,
      startDate: month.start,
      endDate: month.end,
      error: error.message,
    };
  }
}

async function main() {
  // Q1 = 1-3月
  const q1Months = months.slice(0, 3);
  const results = [];

  for (const month of q1Months) {
    const data = await queryMonth(month);
    results.push(data);
  }

  // 计算环比增长率
  const output = {
    site: siteConfig.gsc_url,
    year: year,
    quarter: 'Q1',
    monthlyData: results.map((data, index) => {
      const prev = index > 0 ? results[index - 1] : null;
      const momClicksGrowth =
        prev && prev.clicks > 0
          ? Math.round(((data.clicks - prev.clicks) / prev.clicks) * 1000) / 10
          : null;
      const momImpressionsGrowth =
        prev && prev.impressions > 0
          ? Math.round(((data.impressions - prev.impressions) / prev.impressions) * 1000) / 10
          : null;

      return {
        month: data.month,
        period: `${data.startDate} ~ ${data.endDate}`,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.ctr,
        avgPosition: data.avgPosition,
        momClicksGrowth: momClicksGrowth !== null ? `${momClicksGrowth > 0 ? '+' : ''}${momClicksGrowth}%` : 'N/A (首月)',
        momImpressionsGrowth: momImpressionsGrowth !== null ? `${momImpressionsGrowth > 0 ? '+' : ''}${momImpressionsGrowth}%` : 'N/A (首月)',
        topQueries: (data.topQueries || []).slice(0, 15),
      };
    }),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
