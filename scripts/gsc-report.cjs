#!/usr/bin/env node

/**
 * GSC Report - Google Search Console 数据查询
 *
 * 用法:
 *   node gsc-report.cjs [站点代号] [天数]                  查询并自动存档
 *   node gsc-report.cjs [站点代号] [天数] --queries         拉取 Top 500 关键词（含完整排名数据）
 *   node gsc-report.cjs [站点代号] [天数] --daily           按 date 维度拆分（每日数据，用于趋势追踪）
 *   node gsc-report.cjs [站点代号] [天数] --query "关键词"  查询特定关键词的完整表现
 *   node gsc-report.cjs [站点代号] --queries --start-date=2026-03-23 --end-date=2026-03-29  自定义日期范围
 *
 * 示例:
 *   node gsc-report.cjs default 7
 *   node gsc-report.cjs default 30 --queries
 *   node gsc-report.cjs default 30 --daily
 *   node gsc-report.cjs default 30 --query "video hosting"
 *   node gsc-report.cjs default --queries --start-date=2026-03-23 --end-date=2026-03-29
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// 解析命令行参数
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const siteCode = args.find(a => !a.startsWith('--')) || 'default';
const days = parseInt(args.find(a => !a.startsWith('--') && a !== siteCode)) || 7;
const queryFlag = flags.find(f => f.startsWith('--query='));
const queryValue = queryFlag ? queryFlag.split('=')[1] : null;
const startDateFlag = flags.find(f => f.startsWith('--start-date='));
const endDateFlag = flags.find(f => f.startsWith('--end-date='));
const mode = flags.includes('--queries') ? 'queries' :
             flags.includes('--daily') ? 'daily' :
             queryValue ? 'singleQuery' : 'overview';

// 加载配置
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const expandPath = (p) => p.replace(/^~/, process.env.HOME);

const siteConfig = config.sites[siteCode];
if (!siteConfig) {
  console.error(JSON.stringify({ error: `站点代号 "${siteCode}" 未在 config.json 中配置` }));
  process.exit(1);
}

const credentialsPath = expandPath(config.credentials.gcp_key_path);

// 计算日期范围（支持自定义日期范围）
let endDate, startDate, computedDays;
if (startDateFlag && endDateFlag) {
  startDate = new Date(startDateFlag.split('=')[1]);
  endDate = new Date(endDateFlag.split('=')[1]);
  computedDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
} else {
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  computedDays = days;
}

const formatDate = (d) => d.toISOString().split('T')[0];

// 历史记录存档目录
const HISTORY_DIR = path.join(__dirname, '..', 'history');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

function saveToHistory(result) {
  const safeSource = 'gsc_' + siteCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeSource}_${result.period.start}_${result.period.end}.json`;
  const filepath = path.join(HISTORY_DIR, filename);
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    return filepath;
  }
  return 'already_exists';
}

async function getGSCData() {
  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const baseParams = {
      siteUrl: siteConfig.gsc_url,
      requestBody: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        searchType: 'web'
      }
    };

    // ========== 概览模式（默认） ==========
    if (mode === 'overview') {
      const overallResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, aggregationType: 'auto' }
      });
      const overall = overallResponse.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

      const queryResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, dimensions: ['query'], rowLimit: 20 }
      });

      const pageResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, dimensions: ['page'], rowLimit: 20 }
      });

      const result = {
        _source: 'gsc',
        site: siteConfig.gsc_url,
        period: { start: formatDate(startDate), end: formatDate(endDate), days: computedDays },
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

      const saved = saveToHistory(result);
      result._savedTo = saved;
      console.log(JSON.stringify(result, null, 2));
    }

    // ========== 完整关键词模式（Top 500） ==========
    else if (mode === 'queries') {
      const queryResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, dimensions: ['query'], rowLimit: 500 }
      });

      const result = {
        _source: 'gsc',
        site: siteConfig.gsc_url,
        period: { start: formatDate(startDate), end: formatDate(endDate), days: computedDays },
        totalQueries: (queryResponse.data.rows || []).length,
        queries: (queryResponse.data.rows || []).map(row => ({
          query: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: Math.round(row.ctr * 10000) / 100,
          avgPosition: Math.round(row.position * 100) / 100
        })).sort((a, b) => b.impressions - a.impressions)
      };

      const saved = saveToHistory(result);
      result._savedTo = saved;
      console.log(JSON.stringify(result, null, 2));
    }

    // ========== 每日数据模式（用于趋势分析） ==========
    else if (mode === 'daily') {
      const dailyResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, dimensions: ['date'], rowLimit: 100 }
      });

      const dailyRows = (dailyResponse.data.rows || []).map(row => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        avgPosition: Math.round(row.position * 100) / 100
      })).sort((a, b) => a.date.localeCompare(b.date));

      const result = {
        _source: 'gsc',
        site: siteConfig.gsc_url,
        period: { start: formatDate(startDate), end: formatDate(endDate), days: computedDays },
        daily: dailyRows
      };

      const saved = saveToHistory(result);
      result._savedTo = saved;
      console.log(JSON.stringify(result, null, 2));
    }

    // ========== 单关键词查询模式 ==========
    else if (mode === 'singleQuery') {
      const queryResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: {
          ...baseParams.requestBody,
          dimensions: ['date'],
          rowLimit: 100
        }
      });

      const dailyRows = (queryResponse.data.rows || []).map(row => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: Math.round(row.ctr * 10000) / 100,
        avgPosition: Math.round(row.position * 100) / 100
      })).sort((a, b) => a.date.localeCompare(b.date));

      const totalClicks = dailyRows.reduce((s, r) => s + r.clicks, 0);
      const totalImp = dailyRows.reduce((s, r) => s + r.impressions, 0);

      const result = {
        _source: 'gsc',
        site: siteConfig.gsc_url,
        query: queryValue,
        period: { start: formatDate(startDate), end: formatDate(endDate), days: computedDays },
        total: {
          clicks: totalClicks,
          impressions: totalImp,
          ctr: totalImp ? Math.round(totalClicks / totalImp * 10000) / 100 : 0,
          avgPosition: dailyRows.length > 0
            ? Math.round(dailyRows.reduce((s, r) => s + r.avgPosition, 0) / dailyRows.length * 100) / 100
            : 0
        },
        daily: dailyRows
      };

      console.log(JSON.stringify(result, null, 2));
    }

    // ========== 自定义日期范围模式 ==========
    else if (mode === 'overview' && startDateFlag && endDateFlag) {
      const queryResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, dimensions: ['query'], rowLimit: 500 }
      });

      const pageResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, dimensions: ['page'], rowLimit: 20 }
      });

      const overallResponse = await searchconsole.searchanalytics.query({
        ...baseParams,
        requestBody: { ...baseParams.requestBody, aggregationType: 'auto' }
      });
      const overall = overallResponse.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

      const result = {
        _source: 'gsc',
        site: siteConfig.gsc_url,
        period: { start: formatDate(startDate), end: formatDate(endDate), days: computedDays },
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
        })).sort((a, b) => b.impressions - a.impressions),
        topPages: (pageResponse.data.rows || []).map(row => ({
          page: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: Math.round(row.ctr * 1000) / 10,
          avgPosition: Math.round(row.position * 100) / 100
        })),
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

      const saved = saveToHistory(result);
      result._savedTo = saved;
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

getGSCData();
