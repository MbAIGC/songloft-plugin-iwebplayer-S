// static/lyrics.js
window.LyricsEngine = (function() {
    let parsedLyrics = [];

    let manualScrolling = false;
    let resumeTimer = null;

    let dragStartY = 0;
    let startOffset = 0;

    let wrapperEl = null;
    let containerEl = null;
    let audioEl = null;

    let lastActiveIndex = -1;
    let activeLineEl = null;

    // 当前 KTV 行正在处理的字
    let activeWordIndex = -1;
    let activeWordLineIndex = -1;
    let activeWordEl = null;

    // 缓存歌词 DOM
    let lineElements = [];
    let wordElements = [];

    // RAF
    let animationFrameId = null;

    // 用于避免重复写入 CSS
    let lastProgress = -1;

    // ------------------------------------------------------------
    // 歌词时间基准（安全时钟）
    //
    // 🔐 不再用 AudioContext.createMediaElementSource 接管真实音频输出：
    // 该方案会把所有播放路由进 Web Audio 图，跨域且无 CORS 的音频
    // 会输出静音，AudioContext 挂起/恢复失败也可能影响播放。
    // 改为以 audio.currentTime 为唯一时间基准，叠加可配置的固定偏移
    // 粗略补偿解码缓冲区延迟（默认 0，可通过 config lyrics.offset_ms 调）。
    // ------------------------------------------------------------

    // 获取当前用于歌词渲染的媒体时间（永不接管真实输出，失败天然回退）
    function getSpeakerTime() {
        if (!audioEl) return 0;
        let offsetMs = 0;
        try {
            offsetMs = parseFloat(window.ConfigManager && window.ConfigManager.get('config', 'lyrics.offset_ms')) || 0;
        } catch (e) {}
        return Math.max(0, audioEl.currentTime - offsetMs / 1000);
    }

    // ------------------------------------------------------------
    // 初始化
    // ------------------------------------------------------------

    function init(wrapperId, containerId) {
        wrapperEl = document.getElementById(wrapperId);
        containerEl = document.getElementById(containerId);
        audioEl = document.getElementById('audio');

        bindEvents();

        // 🎬 RAF 按播放状态启停：播放中才跑，暂停/结束/页面隐藏即停
        if (audioEl) {
            const syncLoopState = () => {
                if (audioEl && !audioEl.paused) startLoop();
                else stopLoop();
            };
            audioEl.addEventListener('play', syncLoopState);
            audioEl.addEventListener('playing', syncLoopState);
            audioEl.addEventListener('pause', syncLoopState);
            audioEl.addEventListener('ended', stopLoop);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) stopLoop();
                else if (audioEl && !audioEl.paused) startLoop();
            });
            // 初始化时若音频已在播放（热重载/重复 init），补一次启动
            if (!audioEl.paused) startLoop();
        }
    }

    // ------------------------------------------------------------
    // RAF 同步循环（按播放状态启停）
    //
    // 音频 currentTime 是唯一时间基准。
    // RAF 只负责尽可能高频地把当前时间反映到歌词 UI；
    // 暂停/结束/页面隐藏时完全停止，避免无意义的 60fps 空转。
    // ------------------------------------------------------------

    function startLoop() {
        if (animationFrameId) return;

        function loop() {
            if (!audioEl || !document.contains(audioEl)) {
                audioEl = document.getElementById('audio');
            }

            if (
                audioEl &&
                !audioEl.paused &&
                !manualScrolling
            ) {
                sync(getSpeakerTime());
            }

            animationFrameId = requestAnimationFrame(loop);
        }

        animationFrameId = requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // ------------------------------------------------------------
    // LRC 解析
    // ------------------------------------------------------------

    function parse(lrcString) {
        parsedLyrics = [];

        lastActiveIndex = -1;
        activeLineEl = null;

        activeWordIndex = -1;
        activeWordLineIndex = -1;
        activeWordEl = null;

        lineElements = [];
        wordElements = [];

        lastProgress = -1;

        if (typeof window.updateMediaSessionLyric === 'function') {
            window.updateMediaSessionLyric(null);
        }

        if (!lrcString) {
            if (containerEl) {
                containerEl.innerHTML =
                    '<div class="no-lyrics">暂无歌词，请欣赏音乐吧</div>';

                containerEl.style.transform = 'translateY(0px)';
            }

            return;
        }

        const lines = lrcString.split('\n');

        const timeRegex =
            /\[(\d{2,}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

        lines.forEach(line => {
            const match = timeRegex.exec(line);

            if (!match) return;

            const baseTime =
                parseInt(match[1], 10) * 60 +
                parseFloat(match[2]);

            let text = match[3].trim();

            if (!text) return;

            let words = [];
            let pureText = '';

            // --------------------------------------------------------
            // KTV 逐字歌词识别
            //
            // 格式 B：
            // word[[mm:ss.xx]]word[[mm:ss.xx]]
            //
            // 格式 A：
            // word[mm:ss.xxx]word[mm:ss.xxx]
            // --------------------------------------------------------

            const isKtv =
                text.includes('[[') ||
                /\]\S+\[\d{1,2}:\d{2}/.test(text);

            if (isKtv) {

                // ----------------------------------------------------
                // 格式 B：双括号
                // ----------------------------------------------------

                if (text.includes('[[')) {

                    const parts = text.split('[[');

                    parts.forEach((part, index) => {

                        if (index === 0) {
                            if (part) {
                                words.push({
                                    offset: 0,
                                    text: part,
                                    duration: 0
                                });

                                pureText += part;
                            }

                            return;
                        }

                        const closeIdx = part.indexOf(']]');

                        if (closeIdx === -1) return;

                        const timeParts =
                            part
                                .substring(0, closeIdx)
                                .split(':');

                        const absTime =
                            parseInt(timeParts[0], 10) * 60 +
                            parseFloat(timeParts[1]);

                        // 兼容：
                        // 1. 绝对时间
                        // 2. 相对时间
                        const offset =
                            absTime < baseTime - 1
                                ? absTime
                                : Math.max(0, absTime - baseTime);

                        const wText =
                            part.substring(closeIdx + 2);

                        words.push({
                            offset,
                            text: wText,
                            duration: 0
                        });

                        pureText += wText;
                    });

                // ----------------------------------------------------
                // 格式 A：单括号
                // ----------------------------------------------------

                } else {

                    const segRegex =
                        /([^\[]+?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;

                    let segMatch;
                    let lastAbs = null;
                    let lastSegEnd = 0;
                    let firstWord = true;

                    while (
                        (segMatch = segRegex.exec(text)) !== null
                    ) {
                        const abs =
                            parseInt(segMatch[2], 10) * 60 +
                            parseFloat(segMatch[3]);

                        const wText = segMatch[1];

                        // 格式 A 语义：字[时间] 中的时间是该字的结束时间，
                        // 因此第一个字从行首开始，后续字的 offset = 前一个字的时间 - 行首
                        const offset = firstWord
                            ? 0
                            : Math.max(0, lastAbs - baseTime);

                        words.push({
                            offset,
                            text: wText,
                            duration: 0
                        });

                        pureText += wText;

                        lastAbs = abs;
                        lastSegEnd = segRegex.lastIndex;
                        firstWord = false;
                    }

                    // 最后一个没有时间标签的尾部
                    const tail = text.slice(lastSegEnd);

                    if (tail) {
                        words.push({
                            offset:
                                lastAbs !== null
                                    ? Math.max(
                                        0,
                                        lastAbs - baseTime
                                    )
                                    : 0,
                            text: tail,
                            duration: 0
                        });

                        pureText += tail;
                    }
                }

                // ----------------------------------------------------
                // 计算逐字持续时间
                // ----------------------------------------------------

                for (
                    let i = 0;
                    i < words.length - 1;
                    i++
                ) {
                    words[i].duration =
                        Math.max(
                            0.01,
                            words[i + 1].offset -
                            words[i].offset
                        );
                }

            } else {

                // ----------------------------------------------------
                // 普通歌词
                //
                // 兼容：
                // 词[mm:ss.xxx]
                // ----------------------------------------------------

                const endMark =
                    /^(.*?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]$/
                        .exec(text);

                if (
                    endMark &&
                    endMark[1] &&
                    (
                        parseInt(endMark[2], 10) * 60 +
                        parseFloat(endMark[3])
                    ) > baseTime
                ) {
                    pureText = endMark[1];
                } else {
                    pureText = text;
                }
            }

            parsedLyrics.push({
                time: baseTime,
                text: pureText,
                isKtv,
                words
            });
        });

        // ------------------------------------------------------------
        // 🔐 先稳定排序再二分
        //
        // LRC 文件时间戳可能乱序，而 findActiveLine 二分查找依赖
        // parsedLyrics 按 time 严格升序。ES2019+ sort 保证稳定。
        // ------------------------------------------------------------

        parsedLyrics.sort((a, b) => a.time - b.time);

        // ------------------------------------------------------------
        // 同时间戳合并规则
        //
        // 同一毫秒级时间戳的多行，只保留「文件中最后一次出现」的行
        // （稳定排序后同刻行相邻且保持文件序，保留最后一个即丢弃前面的重复）。
        // ------------------------------------------------------------

        if (parsedLyrics.length > 1) {
            const merged = [];
            for (let i = 0; i < parsedLyrics.length; i++) {
                const cur = parsedLyrics[i];
                const next = parsedLyrics[i + 1];
                if (next && next.time === cur.time) continue;
                merged.push(cur);
            }
            parsedLyrics = merged;
        }

        // ------------------------------------------------------------
        // 计算最后一个字的持续时间
        // ------------------------------------------------------------

        for (
            let i = 0;
            i < parsedLyrics.length;
            i++
        ) {
            const lyric = parsedLyrics[i];

            if (
                !lyric.isKtv ||
                lyric.words.length === 0
            ) {
                continue;
            }

            const words = lyric.words;
            const lastWord = words[words.length - 1];

            if (i < parsedLyrics.length - 1) {

                const maxDur =
                    parsedLyrics[i + 1].time -
                    (
                        lyric.time +
                        lastWord.offset
                    );

                lastWord.duration =
                    Math.max(
                        0.1,
                        Math.min(maxDur, 2.0)
                    );

            } else {

                lastWord.duration = 1.5;
            }
        }

        // ------------------------------------------------------------
        // 插入两个隐藏占位行
        // 保持原版行为
        // ------------------------------------------------------------

        if (parsedLyrics.length > 0) {
            parsedLyrics = [
                {
                    time: 0,
                    text: '\u200B',
                    isKtv: false,
                    words: []
                },
                {
                    time: 0.1,
                    text: '\u200B',
                    isKtv: false,
                    words: []
                },
                ...parsedLyrics
            ];
            // 🔐 占位行插入后再次稳定排序，保证任何起始时间的歌词都满足二分有序前提
            parsedLyrics.sort((a, b) => a.time - b.time);
        }

        // ------------------------------------------------------------
        // 构建 DOM
        // ------------------------------------------------------------

        containerEl.innerHTML =
            parsedLyrics.map((lyric, idx) => {

                if (lyric.isKtv) {

                    const wordsHtml =
                        lyric.words.map((w, wIdx) =>
                            `<span class="ktv-word" id="ktv-word-${idx}-${wIdx}">${window.escapeHtml(w.text)}</span>`
                        ).join('');

                    return `
                        <div
                            class="lyric-line ktv-mode"
                            id="lyric-${idx}"
                        >${wordsHtml}</div>
                    `;

                }

                return `
                    <div
                        class="lyric-line"
                        id="lyric-${idx}"
                    >${window.escapeHtml(lyric.text)}</div>
                `;

            }).join('');

        // ------------------------------------------------------------
        // DOM 缓存
        //
        // 原版每一帧 document.getElementById()
        // 这里解析完成后一次性缓存。
        // ------------------------------------------------------------

        lineElements = new Array(parsedLyrics.length);

        for (let i = 0; i < parsedLyrics.length; i++) {
            lineElements[i] =
                document.getElementById(`lyric-${i}`);
        }

        wordElements = new Array(parsedLyrics.length);

        for (let i = 0; i < parsedLyrics.length; i++) {

            if (!parsedLyrics[i].isKtv) {
                wordElements[i] = [];
                continue;
            }

            const words = parsedLyrics[i].words;
            const elements = new Array(words.length);

            for (let j = 0; j < words.length; j++) {
                elements[j] =
                    document.getElementById(
                        `ktv-word-${i}-${j}`
                    );
            }

            wordElements[i] = elements;
        }
    }

    // ------------------------------------------------------------
    // 二分查找当前歌词行
    //
    // 原版每一帧从头遍历整个 parsedLyrics。
    // 歌词很多时没有必要。
    // ------------------------------------------------------------

    function findActiveLine(currentTime) {
        let low = 0;
        let high = parsedLyrics.length - 1;
        let result = -1;

        while (low <= high) {

            const mid =
                (low + high) >> 1;

            if (
                currentTime >=
                parsedLyrics[mid].time
            ) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }

    // ------------------------------------------------------------
    // 找当前正在唱的字
    //
    // 这里同样采用二分查找。
    // ------------------------------------------------------------

    function findActiveWord(words, relativeTime) {
        if (!words || words.length === 0) {
            return -1;
        }

        let low = 0;
        let high = words.length - 1;
        let result = -1;

        while (low <= high) {

            const mid =
                (low + high) >> 1;

            if (
                relativeTime >=
                words[mid].offset
            ) {
                result = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return result;
    }

    // ------------------------------------------------------------
    // 设置某个 KTV 字的状态
    // ------------------------------------------------------------

    function setWordState(
        lineIndex,
        wordIndex,
        state,
        progress
    ) {
        const elements =
            wordElements[lineIndex];

        if (!elements) return;

        const el = elements[wordIndex];

        if (!el) return;

        if (state === 'sung') {

            if (el.className !== 'ktv-word sung') {
                el.className = 'ktv-word sung';
            }

            if (progress !== undefined) {
                el.style.setProperty(
                    '--progress',
                    `${progress}%`
                );
            }

        } else if (state === 'singing') {

            if (el.className !== 'ktv-word singing') {
                el.className = 'ktv-word singing';
            }

            if (progress !== undefined) {
                el.style.setProperty(
                    '--progress',
                    `${progress}%`
                );
            }

        } else {

            if (el.className !== 'ktv-word') {
                el.className = 'ktv-word';
            }

            if (progress !== undefined) {
                el.style.setProperty(
                    '--progress',
                    `${progress}%`
                );
            }
        }
    }

    // ------------------------------------------------------------
    // 初始化当前歌词行所有字
    //
    // 只在：
    // 1. 歌词行改变
    // 2. 当前字改变
    // 3. seek 导致字跳跃
    //
    // 时执行。
    //
    // 不再每一帧执行。
    // ------------------------------------------------------------

    function refreshWordStates(
        lineIndex,
        activeWordIndex
    ) {
        const lyric =
            parsedLyrics[lineIndex];

        if (!lyric || !lyric.isKtv) {
            return;
        }

        const words = lyric.words;
        const elements = wordElements[lineIndex];

        if (!elements) return;

        for (let i = 0; i < words.length; i++) {

            if (i < activeWordIndex) {

                setWordState(
                    lineIndex,
                    i,
                    'sung',
                    100
                );

            } else if (i === activeWordIndex) {

                setWordState(
                    lineIndex,
                    i,
                    'singing'
                );

            } else {

                setWordState(
                    lineIndex,
                    i,
                    'normal',
                    0
                );
            }
        }
    }

    // ------------------------------------------------------------
    // 更新当前字 progress
    //
    // 这是整个优化最重要的地方：
    //
    // 原版：
    // 每一帧 → 所有字
    //
    // 现在：
    // 每一帧 → 只更新当前字
    // ------------------------------------------------------------

    function updateCurrentWord(
        lineIndex,
        wordIndex,
        relativeTime
    ) {
        const lyric =
            parsedLyrics[lineIndex];

        if (!lyric || !lyric.words[wordIndex]) {
            return;
        }

        const word =
            lyric.words[wordIndex];

        const element =
            wordElements[lineIndex] &&
            wordElements[lineIndex][wordIndex];

        if (!element) return;

        let progress;

        if (
            relativeTime >=
            word.offset + word.duration
        ) {
            progress = 100;

            if (
                element.className !==
                'ktv-word sung'
            ) {
                element.className =
                    'ktv-word sung';
            }

        } else if (
            relativeTime >= word.offset
        ) {
            progress =
                (
                    (
                        relativeTime -
                        word.offset
                    ) /
                    word.duration
                ) * 100;

            // 防止浮点误差
            progress =
                Math.max(
                    0,
                    Math.min(100, progress)
                );

            if (
                element.className !==
                'ktv-word singing'
            ) {
                element.className =
                    'ktv-word singing';
            }

        } else {
            progress = 0;

            if (
                element.className !==
                'ktv-word'
            ) {
                element.className =
                    'ktv-word';
            }
        }

        // 🔐 无变化帧直接跳过，避免每帧重复写 CSS 变量
        if (progress === lastProgress) return;

        // 当前字每帧只修改一次 CSS 变量
        //
        // 不进行额外的时间补偿。
        element.style.setProperty(
            '--progress',
            `${progress}%`
        );

        lastProgress = progress;
    }

    // ------------------------------------------------------------
    // 歌词同步
    // ------------------------------------------------------------

    function sync(currentTime) {
        if (
            parsedLyrics.length === 0 ||
            manualScrolling
        ) {
            return;
        }

        const activeIndex =
            findActiveLine(currentTime);

        if (activeIndex === -1) {
            return;
        }

        // --------------------------------------------------------
        // 歌词行发生变化
        // --------------------------------------------------------

        if (
            activeIndex !==
            lastActiveIndex
        ) {
            lastActiveIndex =
                activeIndex;

            // 移除旧 active
            if (activeLineEl) {
                activeLineEl.classList.remove(
                    'active'
                );
            }

            const currentLine =
                lineElements[activeIndex];

            activeLineEl =
                currentLine || null;

            if (currentLine) {

                currentLine.classList.add(
                    'active'
                );

                // ------------------------------------------------
                // 自动居中
                // ------------------------------------------------

                const offset =
                    currentLine.offsetTop -
                    (
                        wrapperEl.offsetHeight /
                        2
                    ) +
                    (
                        currentLine.offsetHeight /
                        2
                    );

                containerEl.style.transform =
                    `translateY(-${Math.max(
                        0,
                        offset
                    )}px)`;

                // ------------------------------------------------
                // MediaSession
                // ------------------------------------------------

                if (
                    typeof window
                        .updateMediaSessionLyric ===
                    'function'
                ) {
                    const lyricText =
                        parsedLyrics[
                            activeIndex
                        ].text;

                    window.updateMediaSessionLyric(
                        (
                            lyricText &&
                            lyricText.trim() &&
                            lyricText !== '\u200B'
                        )
                            ? lyricText
                            : null
                    );
                }
            }

            // --------------------------------------------------------
            // 新歌词行
            // --------------------------------------------------------

            activeWordIndex = -1;
            activeWordLineIndex =
                activeIndex;
            activeWordEl = null;
            lastProgress = -1;
        }

        // --------------------------------------------------------
        // 当前歌词不是 KTV
        // --------------------------------------------------------

        const currentLyric =
            parsedLyrics[activeIndex];

        if (
            !currentLyric ||
            !currentLyric.isKtv ||
            currentLyric.words.length === 0
        ) {
            activeWordIndex = -1;
            activeWordEl = null;
            return;
        }

        // --------------------------------------------------------
        // 当前歌词的相对时间
        // --------------------------------------------------------

        const relativeTime =
            currentTime -
            currentLyric.time;

        const words =
            currentLyric.words;

        // --------------------------------------------------------
        // 找当前字
        // --------------------------------------------------------

        let wordIndex =
            findActiveWord(
                words,
                relativeTime
            );

        // 如果当前时间已经超过最后一个字的结束时间，
        // 仍然保持最后一个字 sung。
        if (
            wordIndex >= 0 &&
            wordIndex >= words.length
        ) {
            wordIndex =
                words.length - 1;
        }

        // --------------------------------------------------------
        // 字发生切换
        //
        // 只有这里才重新处理所有字的状态。
        // --------------------------------------------------------

        if (
            wordIndex !==
            activeWordIndex
        ) {
            activeWordIndex =
                wordIndex;

            activeWordLineIndex =
                activeIndex;

            activeWordEl =
                (
                    wordIndex >= 0 &&
                    wordElements[activeIndex]
                )
                    ? wordElements[
                        activeIndex
                    ][wordIndex]
                    : null;

            refreshWordStates(
                activeIndex,
                wordIndex
            );

            lastProgress = -1;
        }

        // --------------------------------------------------------
        // 没有开始任何字
        // --------------------------------------------------------

        if (wordIndex < 0) {
            return;
        }

        // --------------------------------------------------------
        // 当前字实时 progress
        //
        // 每一帧只操作一个 span。
        // --------------------------------------------------------

        updateCurrentWord(
            activeIndex,
            wordIndex,
            relativeTime
        );
    }

    // ------------------------------------------------------------
    // 获取当前歌词滚动偏移
    // ------------------------------------------------------------

    function getOffset() {
        const transform =
            containerEl.style.transform || '';

        const m =
            /translateY\(-?(\d+(?:\.\d+)?)px\)/
                .exec(transform);

        return m
            ? parseFloat(m[1])
            : 0;
    }

    // ------------------------------------------------------------
    // 获取最大滚动距离
    // ------------------------------------------------------------

    function getMaxOffset() {
        return Math.max(
            0,
            containerEl.scrollHeight -
            wrapperEl.offsetHeight
        );
    }

    // ------------------------------------------------------------
    // 拖动事件
    // ------------------------------------------------------------

    function bindEvents() {
        if (!wrapperEl) return;

        function onDragStart(e) {

            if (
                e.type === 'mousedown' &&
                e.button !== 0
            ) {
                return;
            }

            if (resumeTimer) {
                clearTimeout(resumeTimer);
                resumeTimer = null;
            }

            manualScrolling = true;

            dragStartY =
                e.touches
                    ? e.touches[0].clientY
                    : e.clientY;

            startOffset =
                getOffset();

            containerEl.style.transition =
                'none';

            wrapperEl.classList.add(
                'dragging'
            );

            document.body.style.userSelect =
                'none';

            document.body.style.webkitUserSelect =
                'none';

            if (
                e.type === 'mousedown'
            ) {
                e.preventDefault();
            }
        }

        function onDragMove(e) {

            if (
                !manualScrolling ||
                (
                    e.type === 'mousemove' &&
                    e.buttons !== 1
                )
            ) {
                return;
            }

            e.preventDefault();

            const currentY =
                e.touches
                    ? e.touches[0].clientY
                    : e.clientY;

            const delta =
                currentY - dragStartY;

            const nextOffset =
                Math.max(
                    0,
                    Math.min(
                        getMaxOffset(),
                        startOffset - delta
                    )
                );

            containerEl.style.transform =
                `translateY(-${nextOffset}px)`;
        }

        function onDragEnd() {

            if (!manualScrolling) {
                return;
            }

            containerEl.style.transition =
                '';

            document.body.style.userSelect =
                '';

            document.body.style.webkitUserSelect =
                '';

            wrapperEl.classList.remove(
                'dragging'
            );

            if (resumeTimer) {
                clearTimeout(resumeTimer);
            }

            resumeTimer = setTimeout(() => {
                resumeTimer = null;
                manualScrolling = false;

                // 手动滚动结束后立即重新同步一次，
                // 避免等待下一帧造成视觉跳动。
                if (
                    audioEl &&
                    !audioEl.paused
                ) {
                    sync(audioEl.currentTime);
                }

            }, 2000);
        }

        wrapperEl.addEventListener(
            'mousedown',
            onDragStart
        );

        document.addEventListener(
            'mousemove',
            onDragMove,
            { passive: false }
        );

        document.addEventListener(
            'mouseup',
            onDragEnd
        );

        wrapperEl.addEventListener(
            'touchstart',
            onDragStart,
            { passive: false }
        );

        wrapperEl.addEventListener(
            'touchmove',
            onDragMove,
            { passive: false }
        );

        wrapperEl.addEventListener(
            'touchend',
            onDragEnd
        );
    }

    // ------------------------------------------------------------
    // API
    // ------------------------------------------------------------

    return {
        init,
        parse,
        sync
    };

})();