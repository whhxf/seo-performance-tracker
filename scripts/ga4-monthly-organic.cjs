#!/usr/bin/env node

/**
 * GA4 Monthly Organic Traffic - 按月查询自然流量来源
 *
 * 用法: node ga4-monthly-organic.cjs [站点代号] [年份]
 * 示例: node ga4-monthly-organic.cjs cn 2026
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

const months = [
  { name: '1月', start: `${year}-01-01`, end: `${year}-01-31` },
  { name: '2月', start: `${year}-02-01`, end: `${year}-02-28` },
  { name: '3月', start: `${year}-03-01`, end: `${year}-03-31` },
];

const getMetricValue = (row, index) => parseFloat(row.metricValues[index]?.value || 0);

async function queryMonth(month) {
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });
    const authClient = await auth.getClient();
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
    const propertyId = siteConfig.ga4_property_id;

    // 查询 1: 自然流量来源（organic 渠道）
    const organicResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: month.start, endDate: month.end }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 50,
      },
    });

    // 查询 2: 仅 organic 流量（过滤 sessionMedium = organic）
    const organicOnlyResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: month.start, endDate: month.end }],
        dimensionFilter: {
          filter: {
            fieldName: 'sessionMedium',
            stringFilter: { matchType: 'EXACT', value: 'organic', caseSensitive: false },
          },
        },
        dimensions: [{ name: 'sessionSource' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 20,
      },
    });

    // 查询 3: 总体概览
    const overviewResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: month.start, endDate: month.end }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'newUsers' },
        ],
      },
    });

    const totalActiveUsers = getMetricValue(overviewResponse.data.rows?.[0] || {}, 0);
    const totalSessions = getMetricValue(overviewResponse.data.rows?.[0] || {}, 1);
    const totalPageViews = getMetricValue(overviewResponse.data.rows?.[0] || {}, 2);
    const totalEngagementRate = getMetricValue(overviewResponse.data.rows?.[0] || {}, 3);
    const totalNewUsers = getMetricValue(overviewResponse.data.rows?.[0] || {}, 4);

    // 计算 organic 总量
    const organicTotal = organicOnlyResponse.data.rows?.reduce(
      (acc, row) => ({
        activeUsers: acc.activeUsers + getMetricValue(row, 0),
        sessions: acc.sessions + getMetricValue(row, 1),
        pageViews: acc.pageViews + getMetricValue(row, 2),
      }),
      { activeUsers: 0, sessions: 0, pageViews: 0 }
    ) || { activeUsers: 0, sessions: 0, pageViews: 0 };

    const organicShare = totalActiveUsers > 0 ? Math.round((organicTotal.activeUsers / totalActiveUsers) * 1000) / 10 : 0;

    // 所有流量来源
    const allSources = (organicResponse.data.rows || []).map((row) => ({
      source: row.dimensionValues[0]?.value || '(none)',
      medium: row.dimensionValues[1]?.value || '(none)',
      activeUsers: getMetricValue(row, 0),
      sessions: getMetricValue(row, 1),
      pageViews: getMetricValue(row, 2),
      engagementRate: Math.round(getMetricValue(row, 3) * 1000) / 10,
    }));

    // 仅 organic 来源
    const organicSources = (organicOnlyResponse.data.rows || []).map((row) => ({
      source: row.dimensionValues[0]?.value || '(none)',
      activeUsers: getMetricValue(row, 0),
      sessions: getMetricValue(row, 1),
      pageViews: getMetricValue(row, 2),
      engagementRate: Math.round(getMetricValue(row, 3) * 1000) / 10,
    }));

    return {
      month: month.name,
      period: `${month.start} ~ ${month.end}`,
      overview: {
        activeUsers: totalActiveUsers,
        sessions: totalSessions,
        pageViews: totalPageViews,
        engagementRate: Math.round(totalEngagementRate * 1000) / 10,
        newUsers: totalNewUsers,
        organicActiveUsers: organicTotal.activeUsers,
        organicShare: `${organicShare}%`,
      },
      organicSources,
      allSources: allSources.slice(0, 15),
    };
  } catch (error) {
    return {
      month: month.name,
      period: `${month.start} ~ ${month.end}`,
      error: error.message,
    };
  }
}

async function main() {
  const results = [];
  for (const month of months) {
    console.error(`Querying ${month.name}...`);
    const data = await queryMonth(month);
    results.push(data);
  }

  // 计算环比
  const output = {
    site: siteConfig.ga4_property_id,
    year,
    quarter: 'Q1',
    monthlyData: results.map((data, index) => {
      const prev = index > 0 ? results[index - 1] : null;
      const prevOverview = prev?.overview;
      const curr = data.overview;

      const calcGrowth = (currVal, prevVal) => {
        if (!prevVal || prevVal === 0 || currVal === undefined) return 'N/A';
        const g = Math.round(((currVal - prevVal) / prevVal) * 1000) / 10;
        return `${g > 0 ? '+' : ''}${g}%`;
      };

      if (!curr) {
        return {
          month: data.month,
          period: data.period,
          error: data.error || 'No data',
          overview: null,
          organicSources: [],
          allSources: [],
        };
      }

      return {
        month: data.month,
        period: data.period,
        overview: {
          ...curr,
          momActiveUsersGrowth: prevOverview ? calcGrowth(curr.activeUsers, prevOverview.activeUsers) : 'N/A (首月)',
          momSessionsGrowth: prevOverview ? calcGrowth(curr.sessions, prevOverview.sessions) : 'N/A (首月)',
          momPageViewsGrowth: prevOverview ? calcGrowth(curr.pageViews, prevOverview.pageViews) : 'N/A (首月)',
          momOrganicUsersGrowth: prevOverview ? calcGrowth(curr.organicActiveUsers, prevOverview.organicActiveUsers) : 'N/A (首月)',
        },
        organicSources: (data.organicSources || []).slice(0, 10),
        allSources: (data.allSources || []).slice(0, 15),
        error: data.error || null,
      };
    }),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
