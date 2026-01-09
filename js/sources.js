/**
 * IPTV Live - 数据源配置
 * 预设的IPTV数据源列表
 */

const IPTV_SOURCES = {
    // 预设数据源 - 2025年1月最新更新
    presets: [
        {
            id: 'zbds-ipv4',
            name: '🔥 每日更新源 IPv4 (推荐)',
            url: 'https://live.zbds.top/tv/iptv4.m3u',
            description: '每6小时自动更新，2025年1月最新',
            enabled: true
        },
        {
            id: 'free-tv',
            name: '📺 Free-TV 全球源',
            url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
            description: '全球免费频道，2025年更新',
            enabled: false
        },
        {
            id: 'suxuang-ipv4',
            name: '📡 suxuang央视卫视',
            url: 'https://gh-proxy.com/raw.githubusercontent.com/suxuang/myIPTV/main/ipv4.m3u',
            description: '2025年1月21日更新央视卫视（代理加速）',
            enabled: false
        },
        {
            id: 'yuechan',
            name: '📺 YueChan直播源',
            url: 'https://raw.githubusercontent.com/YueChan/Live/main/IPTV.m3u',
            description: '央视卫视直播源',
            enabled: false
        },
        {
            id: 'vbskycn',
            name: '🌐 vbskycn直播源',
            url: 'https://raw.githubusercontent.com/vbskycn/iptv/master/tv/iptv4.m3u',
            description: '2025年1月更新，支持双栈',
            enabled: false
        },
        {
            id: 'zbds-ipv6',
            name: '🌐 每日更新源 IPv6',
            url: 'https://live.zbds.top/tv/iptv6.m3u',
            description: '每6小时自动更新，IPv6专用',
            enabled: false
        },
        {
            id: 'fanmingming-itv',
            name: '📺 范明明源',
            url: 'https://live.fanmingming.com/tv/m3u/itv.m3u',
            description: '央视卫视高清源',
            enabled: false
        },
        {
            id: 'fanmingming-ipv6',
            name: '📺 范明明源 IPv6',
            url: 'https://live.fanmingming.cn/tv/m3u/ipv6.m3u',
            description: '央视卫视IPv6高清源',
            enabled: false
        }
    ],

    // 频道分类映射 - 用于识别分类
    categoryMapping: {
        // 央视
        '央视': ['CCTV', '央视', 'cctv'],
        // 卫视
        '卫视': ['卫视', '湖南', '浙江', '江苏', '东方', '北京', '广东', '深圳', '上海', '天津', '山东', '河南', '四川', '重庆', '湖北', '安徽', '江西', '黑龙江', '吉林', '辽宁', '河北', '山西', '陕西', '甘肃', '青海', '内蒙古', '新疆', '西藏', '广西', '云南', '贵州', '海南', '福建'],
        // 体育
        '体育': ['体育', 'Sport', 'SPORT', 'sports', '足球', 'NBA', 'ESPN', '五星体育'],
        // 电影
        '电影': ['电影', 'Movie', 'MOVIE', 'CHC', '影视', '剧场'],
        // 新闻
        '新闻': ['新闻', 'News', 'NEWS', 'CGTN', 'CNN', 'BBC'],
        // 少儿
        '少儿': ['少儿', '卡通', '动画', 'Kids', 'Cartoon', '金鹰卡通'],
        // 纪录
        '纪录': ['纪录', 'Discovery', 'National Geographic', '探索', '地理'],
        // 音乐
        '音乐': ['音乐', 'Music', 'MTV'],
        // 国际
        '国际': ['HBO', 'FOX', 'ABC', 'NBC', 'CBS', 'NHK', 'KBS', 'TVB', 'ViuTV']
    },

    // 频道图标映射
    iconMapping: {
        'CCTV': '📺',
        '卫视': '📡',
        '体育': '⚽',
        '电影': '🎬',
        '新闻': '📰',
        '少儿': '🧸',
        '纪录': '🌍',
        '音乐': '🎵',
        '国际': '🌐',
        '默认': '📺'
    },

    // CORS代理配置（用于解决跨域问题）
    corsProxies: [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        ''  // 直接访问（部分源支持CORS）
    ],

    // 更新间隔（毫秒）
    updateInterval: 60 * 60 * 1000, // 1小时

    // 本地存储键名
    storageKeys: {
        channels: 'iptv_channels',
        favorites: 'iptv_favorites',
        lastUpdate: 'iptv_last_update',
        customSources: 'iptv_custom_sources',
        enabledSources: 'iptv_enabled_sources',
        guovinUsername: 'iptv_guovin_username',
        currentChannel: 'iptv_current_channel'
    }
};

/**
 * 数据源管理器
 */
class SourceManager {
    constructor() {
        this.sources = [...IPTV_SOURCES.presets];
        this.customSources = this.loadCustomSources();
        this.enabledSources = this.loadEnabledSources();
        this.guovinUsername = this.loadGuovinUsername();
    }

    /**
     * 加载自定义数据源
     */
    loadCustomSources() {
        try {
            const stored = localStorage.getItem(IPTV_SOURCES.storageKeys.customSources);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    /**
     * 保存自定义数据源
     */
    saveCustomSources() {
        localStorage.setItem(
            IPTV_SOURCES.storageKeys.customSources,
            JSON.stringify(this.customSources)
        );
    }

    /**
     * 添加自定义数据源
     */
    addCustomSource(name, url) {
        const id = 'custom_' + Date.now();
        const source = {
            id,
            name: name || '自定义源',
            url,
            description: '用户添加的数据源',
            enabled: true,
            custom: true
        };
        this.customSources.push(source);
        this.saveCustomSources();
        return source;
    }

    /**
     * 删除自定义数据源
     */
    removeCustomSource(id) {
        this.customSources = this.customSources.filter(s => s.id !== id);
        this.saveCustomSources();
    }

    /**
     * 加载已启用的数据源ID列表
     */
    loadEnabledSources() {
        try {
            const stored = localStorage.getItem(IPTV_SOURCES.storageKeys.enabledSources);
            if (stored) {
                const parsed = JSON.parse(stored);
                // 检查存储的源是否仍然有效
                const validIds = IPTV_SOURCES.presets.map(s => s.id);
                const validStored = parsed.filter(id => validIds.includes(id));
                if (validStored.length > 0) {
                    return validStored;
                }
            }
            // 默认启用第一个源（范明明源）
            return IPTV_SOURCES.presets.filter(s => s.enabled).map(s => s.id);
        } catch {
            return ['zbds-ipv4'];
        }
    }

    /**
     * 保存已启用的数据源
     */
    saveEnabledSources() {
        localStorage.setItem(
            IPTV_SOURCES.storageKeys.enabledSources,
            JSON.stringify(this.enabledSources)
        );
    }

    /**
     * 切换数据源启用状态
     */
    toggleSource(id) {
        const index = this.enabledSources.indexOf(id);
        if (index > -1) {
            this.enabledSources.splice(index, 1);
        } else {
            this.enabledSources.push(id);
        }
        this.saveEnabledSources();
    }

    /**
     * 获取所有数据源
     */
    getAllSources() {
        const guovinSources = this.getGuovinSources();
        return [...this.sources, ...guovinSources, ...this.customSources];
    }

    /**
     * 获取已启用的数据源
     */
    getEnabledSources() {
        const allSources = this.getAllSources();
        return allSources.filter(s => this.enabledSources.includes(s.id));
    }

    /**
     * 加载Guovin用户名
     */
    loadGuovinUsername() {
        return localStorage.getItem(IPTV_SOURCES.storageKeys.guovinUsername) || '';
    }

    /**
     * 保存Guovin用户名
     */
    saveGuovinUsername(username) {
        this.guovinUsername = username;
        localStorage.setItem(IPTV_SOURCES.storageKeys.guovinUsername, username);
    }

    /**
     * 获取Guovin数据源
     */
    getGuovinSources() {
        if (!this.guovinUsername) return [];

        return [
            {
                id: 'guovin-ipv4',
                name: `Guovin源 IPv4 (${this.guovinUsername})`,
                url: `https://raw.githubusercontent.com/${this.guovinUsername}/iptv-api/main/output/result.m3u`,
                description: 'Guovin IPTV-API 生成的IPv4源',
                enabled: true
            },
            {
                id: 'guovin-txt',
                name: `Guovin源 TXT (${this.guovinUsername})`,
                url: `https://raw.githubusercontent.com/${this.guovinUsername}/iptv-api/main/output/result.txt`,
                description: 'Guovin IPTV-API 生成的TXT格式',
                enabled: false
            }
        ];
    }
}

// 导出全局实例
window.IPTV_SOURCES = IPTV_SOURCES;
window.SourceManager = SourceManager;
