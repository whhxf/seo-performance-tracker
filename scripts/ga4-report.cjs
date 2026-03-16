#!/usr/bin/env node

/**
 * GA4 Report - Google Analytics 4 数据查询
 *
 * 用法: node ga4-report.cjs [站点代号] [天数]
 * 示例: node ga4-report.cjs default 7
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// 解析命令行参数
const siteCode = process.argv[2] || 'default';
const days = parseInt(process.argv[3]) || 7;

// 加载配置
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 展开路径中的 ~
const expandPath = (p) => p.replace(/^~/, process.env.HOME);

const siteConfig = config.sites[siteCode];
if (!siteConfig) {
  console.error(JSON.stringify({ error: `站点代号 "${siteCode}" 未在 config.json 中配置` }));
  process.exit(1);
}

const credentialsPath = expandPath(config.credentials.gcp_key_path);

// 计算日期范围
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - days);

const formatDate = (d) => d.toISOString().split('T')[0];

async function getGA4Data() {
  try {
    // 读取 Service Account 凭证
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    // 创建认证客户端
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly']
    });

    // 获取认证客户端
    const authClient = await auth.getClient();

    // 创建 Analytics Data API 客户端
    const analyticsData = google.analyticsdata({
      version: 'v1beta',
      auth: authClient
    });

    const propertyId = siteConfig.ga4_property_id;

    // 查询 1: 总体活跃用户与流量来源
    const overviewResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
        dimensions: [
          { name: 'sessionSource' },
          { name: 'sessionMedium' }
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' }
        ],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10
      }
    });

    // 查询 2: Top 页面
    const pagesResponse = await analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'pageTitle' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'engagementRate' }
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 20
      }
    });

    // 辅助函数：解析 metric 值
    const getMetricValue = (row, index) => row.metricValues[index]?.value || '0';

    // 构建输出 JSON
    const result = {
      property: propertyId,
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
        days: days
      },
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
      // 汇总统计
      summary: {
        totalActiveUsers: overviewResponse.data.rows?.reduce((sum, row) => sum + parseInt(getMetricValue(row, 0)), 0) || 0,
        totalSessions: overviewResponse.data.rows?.reduce((sum, row) => sum + parseInt(getMetricValue(row, 1)), 0) || 0,
        totalPageViews: overviewResponse.data.rows?.reduce((sum, row) => sum + parseInt(getMetricValue(row, 2)), 0) || 0
      }
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(JSON.stringify({ error: error.message, details: error.errors }));
    process.exit(1);
  }
}

getGA4Data();
