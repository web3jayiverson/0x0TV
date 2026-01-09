/**
 * IPTV Live - 主应用
 * 在线直播电视播放器
 */

class IPTVApp {
    constructor() {
        // 初始化管理器
        this.sourceManager = new SourceManager();

        // 状态
        this.channels = [];
        this.filteredChannels = [];
        this.categories = new Map();
        this.favorites = this.loadFavorites();
        this.currentChannel = null;
        this.currentCategory = 'all';
        this.isListView = false;
        this.isLoading = false;

        // HLS播放器
        this.hls = null;
        this.video = null;

        // DOM元素缓存
        this.elements = {};

        // 初始化
        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        this.cacheElements();
        this.bindEvents();
        this.initPlayer();
        this.renderPresetSources();
        this.renderCustomSources();

        // 检查是否需要更新
        const needsUpdate = this.checkNeedsUpdate();

        // 尝试加载缓存的频道
        const cachedChannels = this.loadCachedChannels();
        if (cachedChannels && cachedChannels.length > 0 && !needsUpdate) {
            this.channels = cachedChannels;
            this.processChannels();
            this.showToast('已加载缓存频道', 'success');
        } else {
            // 需要刷新数据
            await this.refreshSources();
        }

        // 恢复上次播放的频道
        this.restoreLastChannel();

        // 更新最后更新时间显示
        this.updateLastUpdateTime();

        // 键盘快捷键
        this.initKeyboardShortcuts();
    }

    /**
     * 缓存DOM元素
     */
    cacheElements() {
        this.elements = {
            // 搜索
            searchInput: document.getElementById('searchInput'),

            // 播放器
            videoPlayer: document.getElementById('videoPlayer'),
            playerWrapper: document.getElementById('playerWrapper'),
            playerOverlay: document.getElementById('playerOverlay'),
            playerLoading: document.getElementById('playerLoading'),
            playerError: document.getElementById('playerError'),
            errorMessage: document.getElementById('errorMessage'),
            retryBtn: document.getElementById('retryBtn'),
            currentChannelName: document.getElementById('currentChannelName'),
            favoriteCurrentBtn: document.getElementById('favoriteCurrentBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),

            // 分类
            categoryNav: document.getElementById('categoryNav'),
            dynamicCategories: document.getElementById('dynamicCategories'),
            channelCount: document.getElementById('channelCount'),
            countAll: document.getElementById('countAll'),
            countFavorites: document.getElementById('countFavorites'),
            currentCategoryTitle: document.getElementById('currentCategoryTitle'),

            // 频道网格
            channelGrid: document.getElementById('channelGrid'),
            emptyState: document.getElementById('emptyState'),
            loadSourceBtn: document.getElementById('loadSourceBtn'),

            // 视图切换
            gridViewBtn: document.getElementById('gridViewBtn'),
            listViewBtn: document.getElementById('listViewBtn'),

            // 头部按钮
            refreshBtn: document.getElementById('refreshBtn'),
            sourceBtn: document.getElementById('sourceBtn'),
            favoritesBtn: document.getElementById('favoritesBtn'),

            // 数据源模态框
            sourceModal: document.getElementById('sourceModal'),
            closeSourceModal: document.getElementById('closeSourceModal'),
            cancelSourceModal: document.getElementById('cancelSourceModal'),
            applySourceModal: document.getElementById('applySourceModal'),
            presetSources: document.getElementById('presetSources'),
            customSources: document.getElementById('customSources'),
            customSourceUrl: document.getElementById('customSourceUrl'),
            addCustomSource: document.getElementById('addCustomSource'),
            guovinUsername: document.getElementById('guovinUsername'),
            saveGuovinConfig: document.getElementById('saveGuovinConfig'),

            // 更新时间
            lastUpdateTime: document.getElementById('lastUpdateTime'),

            // Toast容器
            toastContainer: document.getElementById('toastContainer')
        };

        this.video = this.elements.videoPlayer;
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 搜索
        this.elements.searchInput.addEventListener('input',
            this.debounce(() => this.handleSearch(), 300)
        );

        // 播放器控制
        this.elements.retryBtn.addEventListener('click', () => this.retryPlay());
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.elements.favoriteCurrentBtn.addEventListener('click', () => this.toggleCurrentFavorite());

        // 视图切换
        this.elements.gridViewBtn.addEventListener('click', () => this.setView('grid'));
        this.elements.listViewBtn.addEventListener('click', () => this.setView('list'));

        // 头部按钮
        this.elements.refreshBtn.addEventListener('click', () => this.refreshSources());
        this.elements.sourceBtn.addEventListener('click', () => this.openSourceModal());
        this.elements.favoritesBtn.addEventListener('click', () => this.showFavorites());

        // 分类点击
        this.elements.categoryNav.addEventListener('click', (e) => {
            const categoryItem = e.target.closest('.category-item');
            if (categoryItem) {
                const category = categoryItem.dataset.category;
                this.selectCategory(category);
            }
        });

        // 频道网格点击
        this.elements.channelGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.channel-card');
            const favoriteBtn = e.target.closest('.channel-favorite');

            if (favoriteBtn) {
                e.stopPropagation();
                const channelId = favoriteBtn.dataset.channelId;
                this.toggleFavorite(channelId);
            } else if (card) {
                const channelId = card.dataset.channelId;
                this.playChannel(channelId);
            }
        });

        // 加载数据源按钮
        this.elements.loadSourceBtn.addEventListener('click', () => this.openSourceModal());

        // 模态框
        this.elements.closeSourceModal.addEventListener('click', () => this.closeSourceModal());
        this.elements.cancelSourceModal.addEventListener('click', () => this.closeSourceModal());
        this.elements.applySourceModal.addEventListener('click', () => this.applySourceSettings());
        document.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeSourceModal());

        // 添加自定义源
        this.elements.addCustomSource.addEventListener('click', () => this.handleAddCustomSource());
        this.elements.customSourceUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddCustomSource();
        });

        // Guovin配置
        this.elements.saveGuovinConfig.addEventListener('click', () => this.saveGuovinConfig());

        // 视频事件
        this.video.addEventListener('playing', () => this.onVideoPlaying());
        this.video.addEventListener('waiting', () => this.onVideoWaiting());
        this.video.addEventListener('error', (e) => this.onVideoError(e));
    }

    /**
     * 初始化HLS播放器
     */
    initPlayer() {
        if (Hls.isSupported()) {
            // HLS.js配置，包含代理设置
            const hlsConfig = {
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
                // 自定义XHR加载器，用于代理HTTP请求
                xhrSetup: (xhr, url) => {
                    // 如果是HTTPS页面且请求HTTP资源，使用代理
                    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
                        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
                        xhr.open('GET', proxyUrl, true);
                    }
                }
            };

            this.hls = new Hls(hlsConfig);

            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.warn('HLS错误:', data.type, data.details);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('网络错误，尝试恢复...');
                            // 网络错误时尝试切换到备用代理
                            this.hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('媒体错误，尝试恢复...');
                            this.hls.recoverMediaError();
                            break;
                        default:
                            this.showPlayerError('播放失败，频道可能不可用');
                            break;
                    }
                }
            });

            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.video.play().catch(() => {
                    // 自动播放被阻止，需要用户交互
                });
            });
        }
    }

    /**
     * 初始化键盘快捷键
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K 聚焦搜索
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.elements.searchInput.focus();
            }

            // Escape 关闭模态框
            if (e.key === 'Escape') {
                this.closeSourceModal();
            }

            // F 全屏
            if (e.key === 'f' && document.activeElement !== this.elements.searchInput) {
                this.toggleFullscreen();
            }
        });
    }

    /**
     * 检查是否需要更新
     */
    checkNeedsUpdate() {
        const lastUpdate = localStorage.getItem(IPTV_SOURCES.storageKeys.lastUpdate);
        if (!lastUpdate) return true;

        const elapsed = Date.now() - parseInt(lastUpdate);
        return elapsed > IPTV_SOURCES.updateInterval;
    }

    /**
     * 刷新数据源
     */
    async refreshSources() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.elements.refreshBtn.classList.add('loading');
        this.showToast('正在刷新数据源...', 'info');

        try {
            const enabledSources = this.sourceManager.getEnabledSources();

            if (enabledSources.length === 0) {
                this.showToast('请先选择至少一个数据源', 'warning');
                this.openSourceModal();
                return;
            }

            // 并行获取所有启用的源
            const results = await Promise.allSettled(
                enabledSources.map(source => this.fetchSource(source))
            );

            // 合并所有频道
            let allChannels = [];
            let successCount = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    allChannels = allChannels.concat(result.value);
                    successCount++;
                } else {
                    console.warn(`源 ${enabledSources[index].name} 加载失败`);
                }
            });

            if (allChannels.length > 0) {
                // 去重
                this.channels = this.deduplicateChannels(allChannels);
                this.processChannels();
                this.saveCachedChannels();
                this.updateLastUpdate();

                this.showToast(
                    `成功加载 ${this.channels.length} 个频道 (${successCount}/${enabledSources.length} 源)`,
                    'success'
                );
            } else {
                this.showToast('未能加载任何频道，请检查数据源设置', 'error');
            }
        } catch (error) {
            console.error('刷新源失败:', error);
            this.showToast('刷新失败，请稍后重试', 'error');
        } finally {
            this.isLoading = false;
            this.elements.refreshBtn.classList.remove('loading');
        }
    }

    /**
     * 获取单个数据源
     */
    async fetchSource(source) {
        const proxies = IPTV_SOURCES.corsProxies;

        for (const proxy of proxies) {
            try {
                const url = proxy + encodeURIComponent(source.url);
                const response = await fetch(proxy ? url : source.url, {
                    mode: 'cors',
                    cache: 'no-cache'
                });

                if (!response.ok) continue;

                const text = await response.text();
                const channels = this.parseM3U(text, source.id);

                if (channels.length > 0) {
                    return channels;
                }
            } catch (error) {
                console.warn(`代理 ${proxy || '直接访问'} 失败:`, error.message);
                continue;
            }
        }

        return [];
    }

    /**
     * 解析M3U格式
     */
    parseM3U(content, sourceId) {
        const channels = [];
        const lines = content.split('\n');

        let currentInfo = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('#EXTINF:')) {
                // 解析频道信息
                currentInfo = this.parseExtInf(line);
            } else if (line && !line.startsWith('#') && currentInfo) {
                // 这是URL行
                const channel = {
                    id: `${sourceId}_${channels.length}`,
                    name: currentInfo.name,
                    url: line,
                    logo: currentInfo.logo,
                    group: currentInfo.group || '其他',
                    tvgId: currentInfo.tvgId,
                    sourceId: sourceId
                };

                channels.push(channel);
                currentInfo = null;
            }
        }

        return channels;
    }

    /**
     * 解析EXTINF行
     */
    parseExtInf(line) {
        const info = {
            name: '',
            logo: '',
            group: '',
            tvgId: ''
        };

        // 提取tvg-logo
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        if (logoMatch) info.logo = logoMatch[1];

        // 提取group-title
        const groupMatch = line.match(/group-title="([^"]*)"/);
        if (groupMatch) info.group = groupMatch[1];

        // 提取tvg-id
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        if (tvgIdMatch) info.tvgId = tvgIdMatch[1];

        // 提取频道名称（最后一个逗号后的内容）
        const nameMatch = line.match(/,(.+)$/);
        if (nameMatch) info.name = nameMatch[1].trim();

        return info;
    }

    /**
     * 去重频道
     */
    deduplicateChannels(channels) {
        const seen = new Map();

        return channels.filter(channel => {
            // 使用名称+URL作为唯一标识
            const key = `${channel.name}_${channel.url}`;
            if (seen.has(key)) {
                return false;
            }
            seen.set(key, true);
            return true;
        });
    }

    /**
     * 处理频道数据
     */
    processChannels() {
        // 分类
        this.categories = new Map();

        this.channels.forEach(channel => {
            // 智能分类
            const category = this.detectCategory(channel);
            channel.category = category;

            if (!this.categories.has(category)) {
                this.categories.set(category, []);
            }
            this.categories.get(category).push(channel);
        });

        // 更新UI
        this.renderCategories();
        this.updateCounts();
        this.filterChannels();
    }

    /**
     * 智能检测频道分类
     */
    detectCategory(channel) {
        const name = channel.name.toUpperCase();
        const group = (channel.group || '').toUpperCase();

        for (const [category, keywords] of Object.entries(IPTV_SOURCES.categoryMapping)) {
            for (const keyword of keywords) {
                if (name.includes(keyword.toUpperCase()) || group.includes(keyword.toUpperCase())) {
                    return category;
                }
            }
        }

        // 如果有原始分组，使用它
        if (channel.group) {
            return channel.group;
        }

        return '其他';
    }

    /**
     * 获取分类图标
     */
    getCategoryIcon(category) {
        for (const [key, icon] of Object.entries(IPTV_SOURCES.iconMapping)) {
            if (category.includes(key)) {
                return icon;
            }
        }
        return IPTV_SOURCES.iconMapping['默认'];
    }

    /**
     * 渲染分类导航
     */
    renderCategories() {
        const container = this.elements.dynamicCategories;
        container.innerHTML = '';

        // 按频道数量排序
        const sortedCategories = [...this.categories.entries()]
            .sort((a, b) => b[1].length - a[1].length);

        sortedCategories.forEach(([category, channels]) => {
            const icon = this.getCategoryIcon(category);
            const button = document.createElement('button');
            button.className = 'category-item';
            button.dataset.category = category;
            button.innerHTML = `
                <span class="category-icon">${icon}</span>
                <span class="category-name">${category}</span>
                <span class="category-count">${channels.length}</span>
            `;
            container.appendChild(button);
        });
    }

    /**
     * 更新计数
     */
    updateCounts() {
        this.elements.channelCount.textContent = `${this.channels.length} 个频道`;
        this.elements.countAll.textContent = this.channels.length;
        this.elements.countFavorites.textContent = this.favorites.size;
    }

    /**
     * 选择分类
     */
    selectCategory(category) {
        this.currentCategory = category;

        // 更新激活状态
        document.querySelectorAll('.category-item').forEach(item => {
            item.classList.toggle('active', item.dataset.category === category);
        });

        // 更新标题
        if (category === 'all') {
            this.elements.currentCategoryTitle.textContent = '全部频道';
        } else if (category === 'favorites') {
            this.elements.currentCategoryTitle.textContent = '我的收藏';
        } else {
            this.elements.currentCategoryTitle.textContent = category;
        }

        this.filterChannels();
    }

    /**
     * 过滤频道
     */
    filterChannels() {
        const searchTerm = this.elements.searchInput.value.toLowerCase().trim();

        let filtered = this.channels;

        // 按分类过滤
        if (this.currentCategory === 'favorites') {
            filtered = filtered.filter(ch => this.favorites.has(ch.id));
        } else if (this.currentCategory !== 'all') {
            filtered = filtered.filter(ch => ch.category === this.currentCategory);
        }

        // 按搜索词过滤
        if (searchTerm) {
            filtered = filtered.filter(ch =>
                ch.name.toLowerCase().includes(searchTerm) ||
                (ch.group && ch.group.toLowerCase().includes(searchTerm))
            );
        }

        this.filteredChannels = filtered;
        this.renderChannels();
    }

    /**
     * 渲染频道列表
     */
    renderChannels() {
        const container = this.elements.channelGrid;

        if (this.filteredChannels.length === 0) {
            container.innerHTML = '';
            this.elements.emptyState.style.display = 'flex';
            return;
        }

        this.elements.emptyState.style.display = 'none';

        // 使用DocumentFragment优化性能
        const fragment = document.createDocumentFragment();

        this.filteredChannels.forEach(channel => {
            const card = this.createChannelCard(channel);
            fragment.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    /**
     * 创建频道卡片
     */
    createChannelCard(channel) {
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.dataset.channelId = channel.id;

        if (this.currentChannel && this.currentChannel.id === channel.id) {
            card.classList.add('playing');
        }

        const isFavorite = this.favorites.has(channel.id);
        const icon = this.getCategoryIcon(channel.category);

        card.innerHTML = `
            <button class="channel-favorite ${isFavorite ? 'favorited' : ''}" data-channel-id="${channel.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
            </button>
            <div class="channel-logo">
                ${channel.logo ? `<img src="${channel.logo}" alt="${channel.name}" onerror="this.parentElement.innerHTML='${icon}'">` : icon}
            </div>
            <div class="channel-info">
                <div class="channel-title" title="${channel.name}">${channel.name}</div>
                <div class="channel-group">${channel.group || channel.category}</div>
            </div>
        `;

        return card;
    }

    /**
     * 播放频道
     */
    playChannel(channelId) {
        const channel = this.channels.find(ch => ch.id === channelId);
        if (!channel) return;

        this.currentChannel = channel;

        // 保存当前频道
        localStorage.setItem(IPTV_SOURCES.storageKeys.currentChannel, channelId);

        // 更新UI
        this.elements.currentChannelName.textContent = channel.name;
        this.updateFavoriteButton();

        // 隐藏占位符，显示加载
        this.elements.playerOverlay.style.display = 'none';
        this.elements.playerError.classList.remove('show');
        this.elements.playerLoading.classList.add('show');

        // 更新卡片状态
        document.querySelectorAll('.channel-card').forEach(card => {
            card.classList.toggle('playing', card.dataset.channelId === channelId);
        });

        // 播放
        this.loadStream(channel.url);
    }

    /**
     * 加载流媒体
     */
    loadStream(url) {
        // 停止当前播放
        if (this.hls) {
            this.hls.stopLoad();
            this.hls.detachMedia();
        }

        // 处理HTTP流的HTTPS代理（解决Mixed Content问题）
        let streamUrl = url;
        if (window.location.protocol === 'https:' && url.startsWith('http://')) {
            // 在HTTPS页面上播放HTTP流需要使用代理
            streamUrl = this.getProxiedUrl(url);
            console.log('使用代理播放:', streamUrl);
        }

        // 判断流类型
        if (streamUrl.includes('.m3u8') || streamUrl.includes('m3u8') || url.includes('.m3u8')) {
            // HLS流
            if (Hls.isSupported()) {
                this.hls.loadSource(streamUrl);
                this.hls.attachMedia(this.video);
            } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari原生支持
                this.video.src = streamUrl;
            }
        } else {
            // 其他格式，直接播放
            this.video.src = streamUrl;
            this.video.play().catch(() => { });
        }
    }

    /**
     * 获取代理URL（解决HTTPS页面播放HTTP流的问题）
     */
    getProxiedUrl(url) {
        // 多个可用的HTTPS代理服务
        const streamProxies = [
            // 选项1: 使用公共CORS代理
            'https://corsproxy.io/?',
            // 选项2: 备用代理
            'https://api.allorigins.win/raw?url='
        ];

        // 使用第一个代理
        const proxy = streamProxies[0];
        return proxy + encodeURIComponent(url);
    }


    /**
     * 视频开始播放
     */
    onVideoPlaying() {
        this.elements.playerLoading.classList.remove('show');
        this.elements.playerError.classList.remove('show');
    }

    /**
     * 视频缓冲中
     */
    onVideoWaiting() {
        this.elements.playerLoading.classList.add('show');
    }

    /**
     * 视频错误
     */
    onVideoError(e) {
        console.error('视频播放错误:', e);
        this.showPlayerError('播放失败，请尝试其他频道');
    }

    /**
     * 显示播放器错误
     */
    showPlayerError(message) {
        this.elements.playerLoading.classList.remove('show');
        this.elements.errorMessage.textContent = message;
        this.elements.playerError.classList.add('show');
    }

    /**
     * 重试播放
     */
    retryPlay() {
        if (this.currentChannel) {
            this.playChannel(this.currentChannel.id);
        }
    }

    /**
     * 切换全屏
     */
    toggleFullscreen() {
        const wrapper = this.elements.playerWrapper;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            wrapper.requestFullscreen().catch(err => {
                console.error('无法进入全屏:', err);
            });
        }
    }

    /**
     * 恢复上次播放的频道
     */
    restoreLastChannel() {
        const lastChannelId = localStorage.getItem(IPTV_SOURCES.storageKeys.currentChannel);
        if (lastChannelId && this.channels.length > 0) {
            const channel = this.channels.find(ch => ch.id === lastChannelId);
            if (channel) {
                // 不自动播放，只更新UI
                this.currentChannel = channel;
                this.elements.currentChannelName.textContent = channel.name;
                this.updateFavoriteButton();
            }
        }
    }

    // ===================================
    // 收藏功能
    // ===================================

    /**
     * 加载收藏
     */
    loadFavorites() {
        try {
            const stored = localStorage.getItem(IPTV_SOURCES.storageKeys.favorites);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    }

    /**
     * 保存收藏
     */
    saveFavorites() {
        localStorage.setItem(
            IPTV_SOURCES.storageKeys.favorites,
            JSON.stringify([...this.favorites])
        );
    }

    /**
     * 切换收藏状态
     */
    toggleFavorite(channelId) {
        if (this.favorites.has(channelId)) {
            this.favorites.delete(channelId);
            this.showToast('已取消收藏', 'info');
        } else {
            this.favorites.add(channelId);
            this.showToast('已添加收藏', 'success');
        }

        this.saveFavorites();
        this.updateCounts();

        // 更新卡片状态
        const btn = document.querySelector(`.channel-favorite[data-channel-id="${channelId}"]`);
        if (btn) {
            btn.classList.toggle('favorited', this.favorites.has(channelId));
        }

        // 如果在收藏页面，重新过滤
        if (this.currentCategory === 'favorites') {
            this.filterChannels();
        }

        // 更新播放器收藏按钮
        this.updateFavoriteButton();
    }

    /**
     * 切换当前频道收藏
     */
    toggleCurrentFavorite() {
        if (this.currentChannel) {
            this.toggleFavorite(this.currentChannel.id);
        }
    }

    /**
     * 更新收藏按钮状态
     */
    updateFavoriteButton() {
        if (this.currentChannel) {
            const isFav = this.favorites.has(this.currentChannel.id);
            this.elements.favoriteCurrentBtn.classList.toggle('favorited', isFav);
        }
    }

    /**
     * 显示收藏页面
     */
    showFavorites() {
        this.selectCategory('favorites');
    }

    // ===================================
    // 搜索功能
    // ===================================

    /**
     * 处理搜索
     */
    handleSearch() {
        this.filterChannels();
    }

    // ===================================
    // 视图切换
    // ===================================

    /**
     * 设置视图模式
     */
    setView(mode) {
        this.isListView = mode === 'list';

        this.elements.gridViewBtn.classList.toggle('active', !this.isListView);
        this.elements.listViewBtn.classList.toggle('active', this.isListView);
        this.elements.channelGrid.classList.toggle('list-view', this.isListView);
    }

    // ===================================
    // 数据源管理
    // ===================================

    /**
     * 打开数据源模态框
     */
    openSourceModal() {
        this.elements.sourceModal.classList.add('show');
        this.elements.guovinUsername.value = this.sourceManager.guovinUsername;
    }

    /**
     * 关闭数据源模态框
     */
    closeSourceModal() {
        this.elements.sourceModal.classList.remove('show');
    }

    /**
     * 渲染预设数据源
     */
    renderPresetSources() {
        const container = this.elements.presetSources;
        container.innerHTML = '';

        const allSources = this.sourceManager.getAllSources().filter(s => !s.custom);

        allSources.forEach(source => {
            const isSelected = this.sourceManager.enabledSources.includes(source.id);
            const item = document.createElement('div');
            item.className = `source-item ${isSelected ? 'selected' : ''}`;
            item.dataset.sourceId = source.id;
            item.innerHTML = `
                <div class="source-checkbox">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="source-info">
                    <div class="source-name">${source.name}</div>
                    <div class="source-url">${source.description || source.url}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                item.classList.toggle('selected');
                this.sourceManager.toggleSource(source.id);
            });

            container.appendChild(item);
        });
    }

    /**
     * 渲染自定义数据源
     */
    renderCustomSources() {
        const container = this.elements.customSources;
        container.innerHTML = '';

        this.sourceManager.customSources.forEach(source => {
            const isSelected = this.sourceManager.enabledSources.includes(source.id);
            const item = document.createElement('div');
            item.className = `source-item ${isSelected ? 'selected' : ''}`;
            item.dataset.sourceId = source.id;
            item.innerHTML = `
                <div class="source-checkbox">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="source-info">
                    <div class="source-name">${source.name}</div>
                    <div class="source-url">${source.url}</div>
                </div>
                <button class="btn btn-icon btn-sm source-delete" data-source-id="${source.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.closest('.source-delete')) {
                    item.classList.toggle('selected');
                    this.sourceManager.toggleSource(source.id);
                }
            });

            const deleteBtn = item.querySelector('.source-delete');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.sourceManager.removeCustomSource(source.id);
                this.renderCustomSources();
            });

            container.appendChild(item);
        });
    }

    /**
     * 添加自定义数据源
     */
    handleAddCustomSource() {
        const url = this.elements.customSourceUrl.value.trim();

        if (!url) {
            this.showToast('请输入数据源地址', 'warning');
            return;
        }

        if (!url.startsWith('http')) {
            this.showToast('请输入有效的URL地址', 'warning');
            return;
        }

        // 提取名称
        let name = '自定义源';
        try {
            const urlObj = new URL(url);
            name = urlObj.hostname;
        } catch { }

        this.sourceManager.addCustomSource(name, url);
        this.elements.customSourceUrl.value = '';
        this.renderCustomSources();
        this.showToast('数据源已添加', 'success');
    }

    /**
     * 保存Guovin配置
     */
    saveGuovinConfig() {
        const username = this.elements.guovinUsername.value.trim();
        this.sourceManager.saveGuovinUsername(username);
        this.renderPresetSources();
        this.showToast('Guovin配置已保存', 'success');
    }

    /**
     * 应用数据源设置
     */
    async applySourceSettings() {
        this.closeSourceModal();
        await this.refreshSources();
    }

    // ===================================
    // 缓存管理
    // ===================================

    /**
     * 保存频道缓存
     */
    saveCachedChannels() {
        try {
            localStorage.setItem(
                IPTV_SOURCES.storageKeys.channels,
                JSON.stringify(this.channels)
            );
        } catch (e) {
            console.warn('保存缓存失败:', e);
        }
    }

    /**
     * 加载缓存的频道
     */
    loadCachedChannels() {
        try {
            const stored = localStorage.getItem(IPTV_SOURCES.storageKeys.channels);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    }

    /**
     * 更新最后更新时间
     */
    updateLastUpdate() {
        localStorage.setItem(IPTV_SOURCES.storageKeys.lastUpdate, Date.now().toString());
        this.updateLastUpdateTime();
    }

    /**
     * 更新最后更新时间显示
     */
    updateLastUpdateTime() {
        const lastUpdate = localStorage.getItem(IPTV_SOURCES.storageKeys.lastUpdate);
        if (lastUpdate) {
            const date = new Date(parseInt(lastUpdate));
            this.elements.lastUpdateTime.textContent = this.formatTime(date);
        }
    }

    /**
     * 格式化时间
     */
    formatTime(date) {
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)} 分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)} 小时前`;
        } else {
            return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    }

    // ===================================
    // Toast 通知
    // ===================================

    /**
     * 显示Toast通知
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        // 3秒后移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===================================
    // 工具函数
    // ===================================

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.iptvApp = new IPTVApp();
});
