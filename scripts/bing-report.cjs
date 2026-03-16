#!/usr/bin/env node

/**
 * Bing Report - Bing Webmaster Tools 数据查询
 *
 * 用法: node bing-report.cjs [站点代号] [天数]
 * 示例: node bing-report.cjs default 7
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 解析命令行参数
const siteCode = process.argv[2] || 'default';
const days = parseInt(process.argv[3]) || 7;

// 加载配置
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 展开路径中的 ~
const expandPath = (p) => p ? p.replace(/^~/, process.env.HOME) : '';

const siteConfig = config.sites[siteCode];
if (!siteConfig) {
  console.error(JSON.stringify({ error: `站点代号 "${siteCode}" 未在 config.json 中配置` }));
  process.exit(1);
}

// 读取 Bing API Key
const apiKeyPath = expandPath(config.credentials.bing_api_key_path);
if (!fs.existsSync(apiKeyPath)) {
  console.error(JSON.stringify({ error: `Bing API Key 文件不存在: ${apiKeyPath}` }));
  process.exit(1);
}
const apiKey = fs.readFileSync(apiKeyPath, 'utf-8').trim();

// 计算日期范围
const endDate = new Date();
const startDate = new Date();
startDate.setDate(startDate.getDate() - days);

const formatDate = (d) => d.toISOString().split('T')[0];

// 从 GSC URL 提取纯域名
function extractDomain(gscUrl) {
  if (gscUrl.startsWith('sc-domain:')) {
    return gscUrl.replace('sc-domain:', '');
  }
  if (gscUrl.startsWith('http')) {
    return new URL(gscUrl).hostname;
  }
  return gscUrl;
}

// 简单 XML 解析器
function parseXML(xml) {
  const result = {};
  const regex = /<([\w:]+)>([^<]*)<\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const key = match[1].replace(/^\w+:/, '');
    const value = match[2].trim();
    result[key] = value;
  }
  return result;
}

// Bing Webmaster API 请求封装
function bingAPIRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const queryParams = new URLSearchParams({
      apikey: apiKey,
      ...params
    }).toString();

    const url = `https://www.bing.com/webmaster/api.svc/json/${method}?${queryParams}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // 尝试解析为 JSON
          if (data.trim().startsWith('{')) {
            const json = JSON.parse(data);
            if (json.Message || json.Error) {
              reject(new Error(json.Message || json.Error));
            } else {
              resolve({ type: 'json', data: json });
            }
          } else if (data.trim().startsWith('<')) {
            // XML 响应
            resolve({ type: 'xml', data: parseXML(data) });
          } else {
            resolve({ type: 'text', data: data.trim() });
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// 解析 Microsoft JSON Date 格式 /Date(timestamp)/
function parseMsDate(dateStr) {
  const match = dateStr.match(/\/Date\((\d+)([+-]\d{4})\)\//);
  if (match) {
    return new Date(parseInt(match[1]));
  }
  return null;
}

// 汇总爬取统计数据
function summarizeCrawlStats(crawlData) {
  if (!crawlData || !crawlData.d || !Array.isArray(crawlData.d)) {
    return null;
  }

  const stats = crawlData.d;
  const summary = {
    totalDays: stats.length,
    totalCrawledPages: 0,
    avgCrawledPages: 0,
    totalInIndex: 0,
    avgInIndex: 0,
    totalInLinks: 0,
    avgInLinks: 0,
    totalErrors: 0,
    http2xx: 0,
    http301: 0,
    http4xx: 0,
    http5xx: 0,
    blockedByRobots: 0,
    dailyStats: []
  };

  stats.forEach(day => {
    summary.totalCrawledPages += day.CrawledPages || 0;
    summary.totalInIndex = Math.max(summary.totalInIndex, day.InIndex || 0);
    summary.totalInLinks = Math.max(summary.totalInLinks, day.InLinks || 0);
    summary.totalErrors += day.CrawlErrors || 0;
    summary.http2xx += day.Code2xx || 0;
    summary.http301 += day.Code301 || 0;
    summary.http4xx += day.Code4xx || 0;
    summary.http5xx += day.Code5xx || 0;
    summary.blockedByRobots += day.BlockedByRobotsTxt || 0;

    summary.dailyStats.push({
      date: parseMsDate(day.Date)?.toISOString().split('T')[0],
      crawledPages: day.CrawledPages,
      inIndex: day.InIndex,
      inLinks: day.InLinks,
      crawlErrors: day.CrawlErrors
    });
  });

  if (stats.length > 0) {
    summary.avgCrawledPages = Math.round(summary.totalCrawledPages / stats.length);
    summary.avgInIndex = Math.round(summary.totalInIndex / stats.length);
    summary.avgInLinks = Math.round(summary.totalInLinks / stats.length);
  }

  return summary;
}

async function getBingData() {
  try {
    const siteUrl = extractDomain(siteConfig.gsc_url || siteConfig.bing_url);

    // 并行获取多个数据
    const [trafficStats, crawlStats, keywordStats] = await Promise.allSettled([
      // 获取流量统计
      bingAPIRequest('GetTrafficStats', {
        siteUrl: `https://${siteUrl}`,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }),
      // 获取爬取统计
      bingAPIRequest('GetCrawlStats', {
        siteUrl: `https://${siteUrl}`
      }),
      // 获取关键词统计 (Top 10)
      bingAPIRequest('GetKeywordStats', {
        siteUrl: `https://${siteUrl}`,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      })
    ]);

    // 处理流量数据
    let traffic = null;
    if (trafficStats.status === 'fulfilled') {
      const t = trafficStats.value;
      if (t.type === 'xml' && t.data) {
        traffic = {
          clicks: parseInt(t.data.Clicks) || 0,
          impressions: parseInt(t.data.Impressions) || 0,
          ctr: parseFloat(t.data.Ctr) || 0,
          avgPosition: parseFloat(t.data.AvgPosition) || 0
        };
      } else {
        traffic = t.data;
      }
    } else {
      traffic = { error: trafficStats.reason?.message };
    }

    // 处理爬取数据
    let crawl = null;
    if (crawlStats.status === 'fulfilled') {
      crawl = summarizeCrawlStats(crawlStats.value.data);
    } else {
      crawl = { error: crawlStats.reason?.message };
    }

    // 处理关键词数据
    let keywords = null;
    if (keywordStats.status === 'fulfilled') {
      keywords = keywordStats.value.data;
    } else {
      keywords = { error: keywordStats.reason?.message };
    }

    // 构建结果
    const result = {
      site: siteUrl,
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
        days: days
      },
      dataSource: 'Bing Webmaster API',
      traffic,
      crawl,
      keywords
    };

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

getBingData();
