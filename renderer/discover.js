'use strict';
// 每日发现卡：好书 / 好电影 / 好音乐 / 格言 / 知识点，挂在绳尾的小纸条。
// 内容离线内置；按日期播种确定当日顺序，每 5 分钟自动轮换，点击手动换。
(function () {
  const CATS = {
    book:      { label: '好书',   c1: '#8b5cf6', c2: '#5b21b6', icon: 'book' },
    film:      { label: '电影',   c1: '#ef6a6a', c2: '#b91c1c', icon: 'film' },
    music:     { label: '音乐',   c1: '#38bdf8', c2: '#0369a1', icon: 'music' },
    quote:     { label: '格言',   c1: '#f59e0b', c2: '#b45309', icon: 'quote' },
    knowledge: { label: '知识',   c1: '#34d399', c2: '#047857', icon: 'bulb' },
  };

  // 精选内容池（离线内置，人工挑选的经典）
  const POOL = [
    { cat: 'book', title: '《人类群星闪耀时》', by: '斯蒂芬·茨威格', line: '一个人生命中最大的幸运，莫过于在他年富力强时，发现了自己的使命。' },
    { cat: 'book', title: '《月亮与六便士》', by: '毛姆', line: '满地都是六便士，他却抬头看见了月亮。' },
    { cat: 'book', title: '《小王子》', by: '圣埃克苏佩里', line: '真正重要的东西，用眼睛是看不见的。' },
    { cat: 'book', title: '《平凡的世界》', by: '路遥', line: '生活不能等待别人来安排，要自己去争取和奋斗。' },
    { cat: 'book', title: '《置身事内》', by: '兰小欢', line: '看懂中国经济，从理解地方政府的激励开始。' },
    { cat: 'film', title: '《肖申克的救赎》', by: '弗兰克·德拉邦特', line: '希望是美好的事物，也许是世上最美好的东西。' },
    { cat: 'film', title: '《千与千寻》', by: '宫崎骏', line: '一直向前走，千万别向后看，否则就永远回不去那个世界了。' },
    { cat: 'film', title: '《死亡诗社》', by: '彼得·威尔', line: 'Carpe Diem——抓住今天，让你的生命不同寻常。' },
    { cat: 'film', title: '《海上钢琴师》', by: '朱塞佩·托纳多雷', line: '陆地对我来说是一艘太大的船，是一段太长的旅程。' },
    { cat: 'film', title: '《心灵奇旅》', by: '皮克斯', line: '火花不是人生目标，是你想要生活的那一刻。' },
    { cat: 'music', title: '《月光》', by: '德彪西', line: '一百多年来最温柔的钢琴夜色，适合晾着心的傍晚。' },
    { cat: 'music', title: '《Vienna》', by: 'Billy Joel', line: '慢慢来——你不必在二十几岁就抵达维也纳。' },
    { cat: 'music', title: '《天空之城》', by: '久石让', line: '一响起就想起飞行与告别主题的永恒旋律。' },
    { cat: 'music', title: '《Here Comes The Sun》', by: 'The Beatles', line: ' little darling，冰冷的冬天终会过去。' },
    { cat: 'music', title: '《夜空中最亮的星》', by: '逃跑计划', line: '给我再去相信的勇气，越过谎言去拥抱你。' },
    { cat: 'quote', title: '木心', by: '《文学回忆录》', line: '岁月不饶人，我亦未曾饶过岁月。' },
    { cat: 'quote', title: '罗曼·罗兰', by: '《米开朗琪罗传》', line: '世界上只有一种真正的英雄主义，就是认清生活的真相后依然热爱生活。' },
    { cat: 'quote', title: '尼采', by: '《查拉图斯特拉如是说》', line: '每一个不曾起舞的日子，都是对生命的辜负。' },
    { cat: 'quote', title: '苏轼', by: '《定风波》', line: '竹杖芒鞋轻胜马，谁怕？一蓑烟雨任平生。' },
    { cat: 'quote', title: '加缪', by: '《西西弗神话》', line: '登上顶峰的斗争本身，就足以充实人的心灵。' },
    { cat: 'knowledge', title: '番茄工作法', by: '弗朗西斯科·西里洛', line: '25 分钟专注 + 5 分钟休息，把大任务切成不吓人的小块。' },
    { cat: 'knowledge', title: '两分钟法则', by: '大卫·艾伦《GTD》', line: '两分钟内能做完的事，立刻做掉，别写进清单占地方。' },
    { cat: 'knowledge', title: '费曼技巧', by: '理查德·费曼', line: '用最简单的话讲给外行听——讲不清的地方，就是你没懂的地方。' },
    { cat: 'knowledge', title: '蔡格尼克效应', by: '心理学', line: '未完成的任务最占内存——开始做，比做完更容易。' },
    { cat: 'knowledge', title: '复利思维', by: '数学', line: '每天进步 1%，一年是 37 倍；每天退步 1%，只剩 0.03。' },
    { cat: 'knowledge', title: '复述记忆', by: '认知科学', line: '睡前回忆一遍今天的内容，记忆巩固效率翻倍。' },
    { cat: 'quote', title: '王阳明', by: '《传习录》', line: '人须在事上磨练，做功夫乃有益。' },
    { cat: 'book', title: '《被讨厌的勇气》', by: '岸见一郎 / 古贺史健', line: '人生不是与他人的比赛，只要自己不断前进即可。' },
    { cat: 'film', title: '《楚门的世界》', by: '彼得·威尔', line: '万一再也见不到你，祝你早安、午安、晚安。' },
    { cat: 'music', title: '《Canon in D》', by: '帕赫贝尔', line: '循环往复却步步向上——这就是坚持的形状。' },
  ];

  const ICONS = {
    book: '<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2V5Zm14 0v14a2 2 0 0 1-2 2h-5V3h5a2 2 0 0 1 2 2Z" fill="rgba(255,255,255,0.92)"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2" fill="rgba(255,255,255,0.92)"/><rect x="6.5" y="8" width="11" height="8" rx="1" fill="CURRENT"/><path d="M3 5l3.5 3M21 5l-3.5 3M3 19l3.5-3M21 19l-3.5-3" stroke="rgba(0,0,0,0.25)" stroke-width="1.2"/>',
    music: '<path d="M9 18V6l10-2v11" stroke="rgba(255,255,255,0.92)" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.6" fill="rgba(255,255,255,0.92)"/><circle cx="16.5" cy="15" r="2.6" fill="rgba(255,255,255,0.92)"/>',
    quote: '<path d="M7 7h5v5c0 3-2 5-5 5v-2c1.5 0 2.5-1 2.5-2H5V7h2Zm9 0h5v5c0 3-2 5-5 5v-2c1.5 0 2.5-1 2.5-2h-4.5V7H16Z" fill="rgba(255,255,255,0.92)"/>',
    bulb: '<path d="M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1.4-1 2.2V17h-6v-1.3c0-.8-.3-1.6-1-2.2A6 6 0 0 1 12 3Z" fill="rgba(255,255,255,0.92)"/><rect x="9.5" y="18" width="5" height="2.4" rx="1.2" fill="rgba(255,255,255,0.85)"/>',
  };

  function iconSvg(cat, cur) {
    return '<svg viewBox="0 0 24 24" width="22" height="22">' + (ICONS[cat] || ICONS.quote).replace(/CURRENT/g, cur) + '</svg>';
  }

  // 当日顺序：以日期为种子的确定性洗牌（每天一套新组合）
  function dayOrder(len) {
    const d = new Date();
    let seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const arr = Array.from({ length: len }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  window.DISCOVER = {
    CATS,
    // 当前应展示的条目：todayIdx 按 5 分钟一轮推进；点击 next 可手动换
    current(todayIdx) {
      const order = dayOrder(POOL.length);
      return POOL[order[todayIdx % POOL.length]];
    },
    cardHTML(entry) {
      const m = CATS[entry.cat] || CATS.quote;
      return '<div class="discover-card" style="background:linear-gradient(150deg,' + m.c1 + ',' + m.c2 + ')" title="每日发现 · 点击换一条">' +
        '<div class="dc-top">' + iconSvg(entry.cat, m.c1) + '<span class="dc-cat">' + m.label + '</span></div>' +
        '<div class="dc-title">' + window.escapeHtml(entry.title) + '</div>' +
        '<div class="dc-by">' + window.escapeHtml(entry.by) + '</div>' +
        '<div class="dc-line">' + window.escapeHtml(entry.line) + '</div>' +
        '<div class="dc-foot">每日发现 ◐</div>' +
        '</div>';
    },
    POOL_LENGTH: POOL.length,
  };
})();
