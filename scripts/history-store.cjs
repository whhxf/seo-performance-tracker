#!/usr/bin/env node

/**
 * History Store - 历史数据存储与趋势分析工具
 *
 * 功能：
 *   save      - 将查询结果保存到 history/ 目录
 *   list      - 列出历史查询记录
 *   compare   - 对比两个时间段的排名变化
 *   trend     - 生成某个关键词的排名趋势
 *
 * 用法:
 *   node history-store.cjs save <source> <json-data>
 *   node history-store.cjs list [source] [limit]
 *   node history-store.cjs compare <query> [days-back]
 *   node history-store.cjs trend <query> [format=json|md|csv]
 *   node history-store.cjs export [format=json|md|csv] [days-back]
 */

const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '..', 'history');
const OUTPUTS_DIR = path.join(__dirname, '..', 'outputs');

// 确保目录存在
[HISTORY_DIR, OUTPUTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * 生成历史文件名: {source}_{startDate}_{endDate}.json
 */
function makeFilename(source, startDate, endDate) {
  const safeSource = source.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeSource}_${startDate}_${endDate}.json`;
}

/**
 * 保存数据到 history/
 */
function saveData(source, jsonData) {
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  const { start, end } = data.period || {};
  if (!start || !end) {
    console.error(JSON.stringify({ error: '数据缺少 period.start 和 period.end 字段' }));
    process.exit(1);
  }

  const filename = makeFilename(source, start, end);
  const filepath = path.join(HISTORY_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(JSON.stringify({ saved: filepath, entries: (data.topQueries || []).length }));
}

/**
 * 列出历史记录
 */
function listHistory(source, limit) {
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => source ? f.includes(source) : true)
    .sort()
    .reverse()
    .slice(0, limit || 20);

  const records = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
    const qArr = data.topQueries || data.queries || [];
    return {
      file: f,
      source: data._source || 'gsc',
      site: data.site,
      period: data.period,
      clicks: data.overall?.clicks,
      impressions: data.overall?.impressions,
      queries: qArr.length
    };
  });

  console.log(JSON.stringify(records, null, 2));
}

/**
 * 对比某个关键词在不同时期的排名
 */
function compareQuery(query, daysBack) {
  const days = parseInt(daysBack) || 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json') && f.includes('gsc'))
    .sort();

  const trends = [];

  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
    const startDate = new Date(data.period.start);
    if (startDate < cutoff) continue;

    const match = (data.topQueries || data.queries || []).find(q => q.query.toLowerCase() === query.toLowerCase());
    const prev = trends.length > 0 ? trends[trends.length - 1] : null;

    trends.push({
      period: data.period,
      query: query,
      position: match ? match.avgPosition : null,
      clicks: match ? match.clicks : 0,
      impressions: match ? match.impressions : 0,
      ctr: match ? match.ctr : 0,
      positionChange: prev ? (match ? match.avgPosition - prev.position : 'N/A') : null,
    });
  }

  if (trends.length === 0) {
    console.log(JSON.stringify({
      query,
      message: `未找到 ${days} 天内包含 "${query}" 的历史记录`,
      note: '请先运行 gsc-report.cjs 查询以积累历史数据'
    }));
    return;
  }

  const summary = {
    query,
    periods: trends.length,
    firstPosition: trends.find(t => t.position !== null)?.position || null,
    latestPosition: [...trends].reverse().find(t => t.position !== null)?.position || null,
    trend: null,
  };

  // 计算趋势
  const positions = trends.filter(t => t.position !== null).map(t => t.position);
  if (positions.length >= 2) {
    const first = positions[0];
    const last = positions[positions.length - 1];
    const diff = last - first; // 负数=上升，正数=下降
    summary.trend = diff < -0.5 ? 'up' : diff > 0.5 ? 'down' : 'stable';
    summary.positionChange = -diff; // 正数=上升
  }

  console.log(JSON.stringify({ summary, details: trends }, null, 2));
}

/**
 * 生成某个词的排名趋势报告
 */
function queryTrend(query, format) {
  const fmt = format || 'json';
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json') && f.includes('gsc'))
    .sort();

  const allData = [];

  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
    const match = (data.topQueries || data.queries || []).find(q => q.query.toLowerCase() === query.toLowerCase());
    if (match || data.period) {
      allData.push({
        period: data.period,
        query: match?.query || query,
        position: match?.avgPosition || null,
        clicks: match?.clicks || 0,
        impressions: match?.impressions || 0,
        ctr: match?.ctr || 0,
        found: !!match,
      });
    }
  }

  if (allData.length === 0) {
    console.log(JSON.stringify({ error: `没有找到 "${query}" 的历史数据` }));
    return;
  }

  if (fmt === 'csv') {
    const lines = ['period_start,period_end,query,position,clicks,impressions,ctr,found'];
    for (const d of allData) {
      lines.push(`${d.period.start},${d.period.end},"${d.query}",${d.position ?? 'N/A'},${d.clicks},${d.impressions},${d.ctr},${d.found}`);
    }
    const csv = lines.join('\n');
    const outfile = path.join(OUTPUTS_DIR, `trend-${query.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
    fs.writeFileSync(outfile, csv);
    console.log(JSON.stringify({ exported: outfile }));
  } else if (fmt === 'md') {
    const positions = allData.filter(d => d.position !== null);
    const first = positions[0];
    const last = positions[positions.length - 1];
    const change = first && last ? (first.position - last.position).toFixed(2) : 'N/A';

    let md = `# 关键词排名趋势: ${query}\n\n`;
    md += `数据覆盖: ${allData.length} 个时间段\n\n`;
    if (change !== 'N/A') {
      const direction = parseFloat(change) > 0 ? '上升' : parseFloat(change) < 0 ? '下降' : '持平';
      md += `**排名变化: ${change} 位 (${direction})**\n\n`;
    }

    md += '| 时间段 | 排名 | 展示 | 点击 | CTR |\n';
    md += '|--------|------|------|------|-----|\n';
    for (const d of allData) {
      const pos = d.position !== null ? `#${d.position}` : 'N/A';
      md += `| ${d.period.start} ~ ${d.period.end} | ${pos} | ${d.impressions} | ${d.clicks} | ${d.ctr}% |\n`;
    }

    const outfile = path.join(OUTPUTS_DIR, `trend-${query.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-')}-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(outfile, md);
    console.log(JSON.stringify({ exported: outfile }));
  } else {
    console.log(JSON.stringify({ query, data: allData }, null, 2));
  }
}

/**
 * 导出所有历史数据为 CSV
 */
function exportAll(format, daysBack) {
  const fmt = format || 'json';
  const days = parseInt(daysBack) || 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json') && f.includes('gsc'))
    .sort()
    .filter(f => {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
      return new Date(data.period.start) >= cutoff;
    });

  const today = new Date().toISOString().split('T')[0];

  if (fmt === 'csv') {
    const lines = ['period_start,period_end,query,position,clicks,impressions,ctr'];
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
      for (const q of data.topQueries || data.queries || []) {
        lines.push(`${data.period.start},${data.period.end},"${q.query}",${q.avgPosition},${q.clicks},${q.impressions},${q.ctr}`);
      }
    }
    const csv = lines.join('\n');
    const outfile = path.join(OUTPUTS_DIR, `gsc-all-queries-${today}.csv`);
    fs.writeFileSync(outfile, csv);
    console.log(JSON.stringify({ exported: outfile, queries: lines.length - 1, periods: files.length }));
  } else if (fmt === 'md') {
    let md = `# GSC 历史排名汇总\n\n生成时间: ${new Date().toISOString()}\n`;
    md += `覆盖: ${files.length} 个时间段\n\n`;

    // 按查询词汇总
    const queryMap = {};
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
      for (const q of data.topQueries || data.queries || []) {
        if (!queryMap[q.query]) queryMap[q.query] = [];
        queryMap[q.query].push({ period: data.period, ...q });
      }
    }

    // 按展示量排序
    const sorted = Object.entries(queryMap)
      .sort((a, b) => {
        const maxA = Math.max(...a[1].map(r => r.impressions));
        const maxB = Math.max(...b[1].map(r => r.impressions));
        return maxB - maxA;
      })
      .slice(0, 50);

    md += '| 关键词 | 最新排名 | 首次排名 | 最高展示 | 最近展示 |\n';
    md += '|--------|----------|----------|----------|----------|\n';
    for (const [query, records] of sorted) {
      const latest = records[records.length - 1];
      const first = records[0];
      const maxImp = Math.max(...records.map(r => r.impressions));
      md += `| ${query} | #${latest.avgPosition} | #${first.avgPosition} | ${maxImp} | ${latest.impressions} |\n`;
    }

    const outfile = path.join(OUTPUTS_DIR, `gsc-summary-${today}.md`);
    fs.writeFileSync(outfile, md);
    console.log(JSON.stringify({ exported: outfile, queries: sorted.length, periods: files.length }));
  } else {
    // JSON: 合并所有时间段
    const all = [];
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf-8'));
      all.push(data);
    }
    const outfile = path.join(OUTPUTS_DIR, `gsc-history-${today}.json`);
    fs.writeFileSync(outfile, JSON.stringify(all, null, 2));
    console.log(JSON.stringify({ exported: outfile, periods: files.length }));
  }
}

// 命令分发
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'save':
    saveData(args[0], args[1]);
    break;
  case 'list':
    listHistory(args[0], args[1]);
    break;
  case 'compare':
    compareQuery(args[0], args[1]);
    break;
  case 'trend':
    queryTrend(args[0], args[1]);
    break;
  case 'export':
    exportAll(args[0], args[1]);
    break;
  default:
    console.log(`用法:
  node history-store.cjs save <source> <json-data>     保存查询结果到 history/
  node history-store.cjs list [source] [limit]          列出历史记录
  node history-store.cjs compare <关键词> [天数]         对比关键词排名变化
  node history-store.cjs trend <关键词> [json|md|csv]   生成排名趋势报告
  node history-store.cjs export [json|md|csv] [天数]    导出历史数据`);
    break;
}
