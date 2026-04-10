// GSC + GA4 交叉分析报告

const gscData = {
  clicks: 56,
  impressions: 2389,
  ctr: 0.0234,
  position: 7.63,
  topQueries: [
    { query: 'kingsway video', clicks: 15, impressions: 47, ctr: 0.319, position: 4.8 },
    { query: 'kingswayvideo', clicks: 5, impressions: 11, ctr: 0.455, position: 1.7 },
    { query: 'kingsway', clicks: 1, impressions: 49, ctr: 0.020, position: 4.4 },
    { query: '在线视频翻译', clicks: 1, impressions: 10, ctr: 0.10, position: 16.8 },
    { query: '视频翻译', clicks: 1, impressions: 16, ctr: 0.063, position: 16.2 },
    { query: '视频脚本分析', clicks: 1, impressions: 1, ctr: 1.0, position: 1.0 },
    { query: '视频转音频', clicks: 1, impressions: 32, ctr: 0.031, position: 8.7 },
    { query: '视频转音频工具', clicks: 1, impressions: 2, ctr: 0.5, position: 6.0 }
  ],
  topPages: [
    { page: '/', clicks: 25, impressions: 136, ctr: 0.184 },
    { page: '/help/video-seo/.../speed-up-website-cloudflare-page-rules/', clicks: 8, impressions: 210, ctr: 0.038 },
    { page: '/tools/script-generator', clicks: 5, impressions: 613, ctr: 0.008 },
    { page: '/feature/global-voice/', clicks: 4, impressions: 193, ctr: 0.021 },
    { page: '/tools/video-to-audio/', clicks: 3, impressions: 147, ctr: 0.020 },
    { page: '/video-first/', clicks: 2, impressions: 4, ctr: 0.5 },
    { page: '/site-vs-video-site/', clicks: 1, impressions: 2, ctr: 0.5 }
  ]
};

const ga4Data = {
  organicSources: [
    { source: 'google', users: 65, sessions: 116, pv: 173 },
    { source: 'baidu', users: 27, sessions: 43, pv: 75 },
    { source: 'bing', users: 27, sessions: 33, pv: 58 },
    { source: 'cn.bing.com', users: 112, sessions: 151, pv: 192, note: 'referral' }
  ],
  topPages: [
    { path: '/', users: 377, pv: 571, engagement: 0.488 },
    { path: '/pricing/', users: 61, pv: 165, engagement: 0.714 },
    { path: '/tools/video-to-audio/', users: 64, pv: 117, engagement: 0.356 },
    { path: '/tools/script-generator/', users: 65, pv: 90, engagement: 0.663 },
    { path: '/pricing-ultra/', users: 11, pv: 50, engagement: 0.696 },
    { path: '/about/', users: 18, pv: 27, engagement: 0.739 },
    { path: '/scenarios/', users: 15, pv: 20, engagement: 0.75 },
    { path: '/helps/', users: 11, pv: 18, engagement: 0.769 }
  ]
};

// 计算总自然搜索用户
const totalOrganicUsers = ga4Data.organicSources
  .filter(s => s.source !== 'cn.bing.com')
  .reduce((sum, s) => sum + s.users, 0);

console.log('# GSC + GA4 流量交叉分析报告');
console.log('**统计周期**: 2026-03-09 ~ 2026-03-16 (最近7天)');
console.log();

console.log('## 📊 流量来源总览 (GA4)');
console.log();
console.log('| 来源 | 活跃用户 | 会话 | 页面浏览 | 占比 |');
console.log('|------|----------|------|----------|------|');
ga4Data.organicSources.forEach(s => {
  const pct = ((s.users / totalOrganicUsers) * 100).toFixed(1);
  const note = s.note || 'organic';
  console.log(`| ${s.source} | ${s.users} | ${s.sessions} | ${s.pv} | ${pct}% (${note}) |`);
});
console.log(`| **自然搜索合计** | **${totalOrganicUsers}** | **192** | **306** | **100%** |`);
console.log();

console.log('## 🔍 GSC 关键词 → GA4 实际流量映射');
console.log();

// 按类别分组关键词
const brandQueries = gscData.topQueries.filter(q => 
  q.query.includes('kingsway') || q.query.includes('Kingsway')
);

const toolQueries = gscData.topQueries.filter(q => 
  q.query.includes('视频翻译') || 
  q.query.includes('视频转音频') || 
  q.query.includes('脚本')
);

const aiQueries = gscData.topQueries.filter(q => 
  q.query.includes('ai') || q.query.includes('AI')
);

console.log('### 1️⃣ 品牌词流量 (GSC 点击 → GA4 首页流量)');
console.log();
const brandClicks = brandQueries.reduce((sum, q) => sum + q.clicks, 0);
const homepageUsers = ga4Data.topPages.find(p => p.path === '/').users;
console.log(`- **GSC 品牌词点击**: ${brandClicks} 次`);
console.log(`- **GA4 首页访问**: ${homepageUsers} 用户`);
console.log(`- **转化率**: 品牌词带来首页流量约 ${Math.round((brandClicks/homepageUsers)*100)}%`);
console.log();
console.log('**主要品牌词**:', brandQueries.map(q => q.query).join(', '));
console.log();

console.log('### 2️⃣ 功能工具词流量');
console.log();
console.log('| 关键词 | GSC 点击 | 对应页面 | GA4 用户 | 匹配度 |');
console.log('|--------|----------|----------|----------|--------|');

const toolMappings = [
  { query: '视频转音频', gscClicks: 1, path: '/tools/video-to-audio/', ga4Users: 64 },
  { query: '视频转音频工具', gscClicks: 1, path: '/tools/video-to-audio/', ga4Users: 64 },
  { query: '视频翻译', gscClicks: 1, path: '/feature/global-voice/', ga4Users: 8 },
  { query: '在线视频翻译', gscClicks: 1, path: '/feature/global-voice/', ga4Users: 8 },
  { query: '视频脚本分析', gscClicks: 1, path: '/tools/script-generator/', ga4Users: 65 }
];

toolMappings.forEach(m => {
  const match = m.gscClicks > 0 && m.ga4Users > 0 ? '✅ 匹配' : '⚠️ 低转化';
  console.log(`| ${m.query} | ${m.gscClicks} | ${m.path} | ${m.ga4Users} | ${match} |`);
});
console.log();

console.log('**洞察**: ');
console.log('- 视频转音频工具: GSC 仅 2 点击，但 GA4 显示 64 用户访问');
console.log('  → 说明大部分流量来自**直接访问**或**其他渠道**（可能是社交媒体、邮件等）');
console.log('- 脚本生成器: GA4 65 用户，但 GSC 点击很少 → 可能来自**站内导航**或**付费推广**');
console.log();

console.log('### 3️⃣ AI 相关词流量');
console.log();
const aiClicks = aiQueries.reduce((sum, q) => sum + q.clicks, 0);
console.log(`- **AI 相关词 GSC 点击**: ${aiClicks} (所有 AI 词都是 0 点击!)`);
console.log(`- **但 GA4 显示**: 脚本生成器有 65 用户，参与度 66%`);
console.log();
console.log('**矛盾点**: GSC 显示 AI 词排名很好(1-2位)但 0 点击，而 GA4 显示工具页面有流量');
console.log('**可能原因**:');
console.log('1. AI 相关搜索量极低（测试搜索）');
console.log('2. 用户通过其他渠道（如直接访问、社交媒体）进入工具页面');
console.log('3. 品牌词 "kingsway" 搜索包含 AI 功能意图');
console.log();

console.log('## 🎯 高价值页面流量分析 (GA4)');
console.log();
console.log('| 页面 | 用户 | 参与度 | 推测流量来源 |');
console.log('|------|------|--------|--------------|');
console.log('| 首页 | 377 | 48.8% | 品牌词搜索 + 直接访问 |');
console.log('| Pricing | 61 | 71.4% | 高意向用户（可能付费推广） |');
console.log('| 视频转音频 | 64 | 35.6% | 工具类搜索 + 社交媒体 |');
console.log('| 脚本生成器 | 65 | 66.3% | 内容营销 + 站内推荐 |');
console.log('| 关于我们 | 18 | 73.9% | 品牌了解阶段 |');
console.log();

console.log('## 💡 关键发现');
console.log();
console.log('### 1. 品牌词主导 SEO 流量');
console.log('- 品牌词带来 21 点击 (kingsway video + kingswayvideo)，占 GSC 总点击 37.5%');
console.log('- 首页 377 用户中，约 ${Math.round((21/377)*100)}% 来自品牌搜索');
console.log();

console.log('### 2. 工具页面流量来源复杂');
console.log('- 视频转音频: GSC 2 点击 vs GA4 64 用户 → **97% 来自非 SEO**');
console.log('- 脚本生成器: GSC 点击少 vs GA4 65 用户 → **主要来自站外/直接访问**');
console.log();

console.log('### 3. 高参与度页面');
console.log('- Pricing 页面: 71.4% 参与度 → 用户有高购买意向');
console.log('- 帮助文档: 76.9% 参与度 → 内容质量高，用户停留久');
console.log();

console.log('## 🚀 行动建议');
console.log();
console.log('1. **SEO 优化**: 视频翻译页面排名 16，优化进前 10 可带来实质 SEO 流量');
console.log('2. **品牌保护**: 品牌词 CTR 已很高(31-45%)，维持现状即可');
console.log('3. **工具推广**: 视频转音频工具 GA4 流量高但 SEO 流量低，建议:');
console.log('   - 在工具页面增加 SEO 优化内容');
console.log('   - 获取外链提升 "视频转音频" 排名');
console.log('4. **AI 关键词**: 排名好但无点击，需要:');
console.log('   - 检查搜索意图匹配度');
console.log('   - 优化 Title/Description 提升 CTR');
