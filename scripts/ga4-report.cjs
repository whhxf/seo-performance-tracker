#!/usr/bin/env node

/**
 * GA4 Report - Google Analytics 4 数据查询
 *
 * 用法:
 *   node ga4-report.cjs [站点代号] [天数]
 *   node ga4-report.cjs [站点代号] [天数] --conversions  包含转化数据
 *
 * 示例: node ga4-report.cjs default 7
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const siteCode = args.find(a => !a.startsWith('--')) || 'default';
const days = parseInt(args.find(a => !a.startsWith('--') && a !== siteCode)) || 7;

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const expandPath = (p) => p.replace(/^~/, process.env.HOME);

const siteConfig = config.sites[siteCode];
if (!siteConfig) {
  console.error(JSON.stringify({ error: `站点代号 "${siteCode}" 未在 config.json 中配置` }));
  process.exit(1);
}

const credentialsPath = path.resolve(__dirname, config.credentials.gcp_key_path);

const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - days);
const formatDate = (d) => d.toISOString().split('T')[0];

const HISTORY_DIR = path.join(__dirname, '..', 'history');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

function saveToHistory(result) {
  const safeSource = 'ga4_' + siteCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeSource}_${result.period.start}_${result.period.end}.json`;
  const filepath = path.join(HISTORY_DIR, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    return filepath;
  }
  return 'already_exists';
}

async function getGA4Data() {
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly']
    });

    const authClient = await auth.getClient();
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });
    const propertyId = siteConfig.ga4_property_id;

    const overviewResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
        dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10
      }
    });

    const pagesResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'engagementRate' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 20
      }
    });

    const getMetricValue = (row, index) => row.metricValues[index]?.value || '0';

    const result = {
      _source: 'ga4',
      property: propertyId,
      period: { start: formatDate(startDate), end: formatDate(endDate), days },
      trafficSources: overviewResponse.data.rows?.map(row => ({
        source: row.dimensionValues[0]?.value || '(none)',
        medium: row.dimensionValues[1]?.value || '(none)',
        activeUsers: parseInt(getMetricValue(row, 0)),
        sessions: parseInt(getMetricValue(row, 1)),
        pageViews: parseInt(getMetricValue(row, 2))
      })) || [],
      topPages: pagesResponse.data.rows?.map(row => ({
        path: row.dimensionValues[0]?.value || '/',
        title: row.dimensionValues[1]?.value || '(not set)',
        pageViews: parseInt(getMetricValue(row, 0)),
        activeUsers: parseInt(getMetricValue(row, 1)),
        engagementRate: parseFloat(getMetricValue(row, 2)) || 0
      })) || [],
      summary: {
        totalActiveUsers: overviewResponse.data.rows?.reduce((sum, row) => sum + parseInt(getMetricValue(row, 0)), 0) || 0,
        totalSessions: overviewResponse.data.rows?.reduce((sum, row) => sum + parseInt(getMetricValue(row, 1)), 0) || 0,
        totalPageViews: overviewResponse.data.rows?.reduce((sum, row) => sum + parseInt(getMetricValue(row, 2)), 0) || 0
      }
    };

    if (flags.includes('--conversions')) {
      const conversionResponse = await analyticsData.properties.runReport({
        property: propertyId,
        requestBody: {
          dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
          dimensions: [{ name: 'eventName' }],
          metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
          limit: 20
        }
      });

      result.conversions = (conversionResponse.data.rows || []).map(row => ({
        event: row.dimensionValues[0]?.value || '(none)',
        eventCount: parseInt(row.metricValues[0]?.value || '0'),
        activeUsers: parseInt(row.metricValues[1]?.value || '0')
      }));
    }

    const saved = saveToHistory(result);
    result._savedTo = saved;

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(JSON.stringify({ error: error.message, details: error.errors }));
    process.exit(1);
  }
}

getGA4Data();
