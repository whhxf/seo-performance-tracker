#!/usr/bin/env node

/**
 * GSC Report - Google Search Console 数据查询
 *
 * 用法: node gsc-report.cjs [站点代号] [天数]
 * 示例: node gsc-report.cjs default 7
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

async function getGSCData() {
  try {
    // 读取 Service Account 凭证
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    // 创建认证客户端
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    // 创建 Search Console 客户端
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // 查询 1: 总体统计
    const overallResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteConfig.gsc_url,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        searchType: 'web',
        aggregationType: 'auto'
      }
    });

    const overall = overallResponse.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    // 查询 2: 按查询维度（Top 关键词）
    const queryResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteConfig.gsc_url,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        searchType: 'web',
        dimensions: ['query'],
        rowLimit: 20
      }
    });

    // 查询 3: 按页面维度（Top 页面）
    const pageResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteConfig.gsc_url,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        searchType: 'web',
        dimensions: ['page'],
        rowLimit: 20
      }
    });

    // 构建输出 JSON
    const result = {
      site: siteConfig.gsc_url,
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
        days: days
      },
      overall: {
        clicks: overall.clicks || 0,
        impressions: overall.impressions || 0,
        ctr: Math.round((overall.ctr || 0) * 1000) / 10,
        avgPosition: Math.round((overall.position || 0) * 100) / 100
      },
      topQueries: (queryResponse.data.rows || []).map(row => ({
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 1000) / 10,
        avgPosition: Math.round(row.position * 100) / 100
      })),
      topPages: (pageResponse.data.rows || []).map(row => ({
        page: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 1000) / 10,
        avgPosition: Math.round(row.position * 100) / 100
      })),
      // 机会词：高展示低点击
      opportunities: (queryResponse.data.rows || [])
        .filter(row => row.impressions >= 100 && row.ctr < 0.05)
        .map(row => ({
          query: row.keys[0],
          impressions: row.impressions,
          clicks: row.clicks,
          ctr: Math.round(row.ctr * 1000) / 10,
          avgPosition: Math.round(row.position * 100) / 100
        }))
        .slice(0, 10)
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

getGSCData();
