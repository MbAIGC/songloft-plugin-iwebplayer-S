// static/lyrics.js
window.LyricsEngine = (function () {
    let parsedLyrics = [];

    let manualScrolling = false;
    let resumeTimer = null;

    let dragStartY = 0;
    let startOffset = 0;

    let wrapperEl = null;
    let containerEl = null;
    let audioEl = null;

    let animationFrameId = null;

    // 当前歌词行
    let lastActiveIndex = -1;
    let activeLineEl = null;

    // 当前逐字
    let activeWordIndex = -1;
    let activeWordLineIndex = -1;

    // DOM 缓存
    let lineElements = [];
    let wordElements = [];

    // ============================================================
    // 初始化
    // ============================================================

    function init(wrapperId, containerId) {
        wrapperEl = document.getElementById(wrapperId);
        containerEl = document.getElementById(containerId);
        audioEl = document.getElementById('audio');

        bindEvents();
        startLoop();
    }

    // ============================================================
    // RAF
    //
    // 保留 currentTime 作为真实播放时间。
    // 不人为 +50ms / +100ms，避免不同设备产生固定偏移。
    // ============================================================

    function startLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }

        function loop() {
            if (!audioEl || !document.contains(audioEl)) {
                audioEl = document.getElementById('audio');
            }

            if (
                audioEl &&
                !audioEl.paused &&
                !manualScrolling
            ) {
                sync(audioEl.currentTime);
            }

            animationFrameId =
                requestAnimationFrame(loop);
        }

        animationFrameId =
            requestAnimationFrame(loop);
    }

    // ============================================================
    // 时间标签
    // ============================================================

    function parseTime(str) {
        const parts = str.split(':');

        if (parts.length < 2) {
            return NaN;
        }

        return (
            parseInt(parts[0], 10) * 60 +
            parseFloat(parts[1])
        );
    }

    // ============================================================
    // HTML 转义
    // ============================================================

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ============================================================
    // 解析歌词
    // ============================================================

    function parse(lrcString) {
        parsedLyrics = [];

        lastActiveIndex = -1;
        activeLineEl = null;

        activeWordIndex = -1;
        activeWordLineIndex = -1;

        lineElements = [];
        wordElements = [];

        if (
            typeof window.updateMediaSessionLyric ===
            'function'
        ) {
            window.updateMediaSessionLyric(null);
        }

        if (!lrcString) {
            if (containerEl) {
                containerEl.innerHTML =
                    '<div class="no-lyrics">暂无歌词，请欣赏音乐吧</div>';

                containerEl.style.transform =
                    'translateY(0px)';
            }

            return;
        }

        const lines =
            lrcString.split(/\r?\n/);

        /*
         * 行首时间：
         *
         * [00:37.465]让[00:37.652]我...
         *
         * 注意：
         * 行首时间已经被这个正则吃掉。
         *
         * 因此后面的第一个字“让”
         * 必须继承 baseTime = 37.465。
         */
        const lineRegex =
            /^\[(\d{2,}):(\d{2}(?:\.\d{1,3})?)\](.*)$/;

        lines.forEach(line => {
            const match =
                lineRegex.exec(line);

            if (!match) {
                return;
            }

            const baseTime =
                parseInt(match[1], 10) * 60 +
                parseFloat(match[2]);

            const rawText =
                match[3];

            if (!rawText.trim()) {
                return;
            }

            let text =
                rawText.trim();

            let words = [];
            let pureText = '';

            // ========================================================
            // KTV 判断
            // ========================================================

            const isKtv =
                text.includes('[[') ||
                /\]\s*\S*\[\d{1,2}:\d{2}/.test(text);

            // ========================================================
            // KTV
            // ========================================================

            if (isKtv) {

                // ----------------------------------------------------
                // 格式 B
                //
                // 例如：
                //
                // 让[[00:37.465]]我[[00:37.652]]再[[00:37.877]]
                //
                // 或：
                //
                // 让[[00:00.100]]我[[00:00.287]]
                // ----------------------------------------------------

                if (text.includes('[[')) {

                    const parts =
                        text.split('[[');

                    // 第一个片段是第一个时间点之前的文字
                    //
                    // 如果它存在，默认从 offset 0 开始。
                    if (parts[0]) {
                        words.push({
                            offset: 0,
                            text: parts[0],
                            duration: 0
                        });

                        pureText +=
                            parts[0];
                    }

                    for (
                        let i = 1;
                        i < parts.length;
                        i++
                    ) {
                        const part =
                            parts[i];

                        const closeIdx =
                            part.indexOf(']]');

                        if (closeIdx === -1) {
                            continue;
                        }

                        const timeText =
                            part.substring(
                                0,
                                closeIdx
                            );

                        const absTime =
                            parseTime(timeText);

                        if (!Number.isFinite(absTime)) {
                            continue;
                        }

                        /*
                         * 同时兼容：
                         *
                         * 绝对时间：
                         * 00:37.465
                         *
                         * 相对时间：
                         * 00:00.120
                         */
                        const offset =
                            absTime < baseTime - 1
                                ? absTime
                                : Math.max(
                                    0,
                                    absTime - baseTime
                                );

                        const wordText =
                            part.substring(
                                closeIdx + 2
                            );

                        if (!wordText) {
                            continue;
                        }

                        words.push({
                            offset,
                            text: wordText,
                            duration: 0
                        });

                        pureText +=
                            wordText;
                    }

                } else {

                    // ------------------------------------------------
                    // ★★★ 关键修复：格式 A ★★★
                    //
                    // 原 dev：
                    //
                    // [00:37.465]让[00:37.652]我[00:37.877]再
                    //
                    // 原代码会：
                    //
                    // 让 -> 37.652
                    // 我 -> 37.877
                    //
                    // 正确应该：
                    //
                    // 让 -> 37.465
                    // 我 -> 37.652
                    // 再 -> 37.877
                    //
                    // ------------------------------------------------

                    /*
                     * 这里匹配：
                     *
                     * [时间]文字
                     *
                     * 因为行首 [00:37.465]
                     * 已经被 lineRegex 消耗掉，
                     * 所以 rawText 开始的第一个字
                     * 必须使用 baseTime。
                     */

                    const segRegex =
                        /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;

                    let cursor = 0;
                    let first = true;

                    let matchTime;

                    while (
                        (
                            matchTime =
                                segRegex.exec(text)
                        ) !== null
                    ) {

                        const absTime =
                            parseTime(
                                matchTime[1] +
                                ':' +
                                matchTime[2]
                            );

                        if (!Number.isFinite(absTime)) {
                            continue;
                        }

                        /*
                         * 当前时间标签之前的文字。
                         *
                         * 第一轮：
                         *
                         * text =
                         * 让[00:37.652]我...
                         *
                         * cursor = 0
                         *
                         * 得到：
                         *
                         * 让
                         *
                         * 它必须使用 baseTime。
                         */

                        const before =
                            text.substring(
                                cursor,
                                matchTime.index
                            );

                        if (before) {

                            const offset =
                                first
                                    ? 0
                                    : Math.max(
                                        0,
                                        absTime -
                                        baseTime
                                    );

                            words.push({
                                offset,
                                text: before,
                                duration: 0
                            });

                            pureText += before;

                            first = false;
                        }

                        cursor =
                            segRegex.lastIndex;

                        /*
                         * 注意：
                         *
                         * 第一个时间标签已经出现在
                         * rawText 内部。
                         *
                         * 它描述的是“下一个字”。
                         *
                         * 因此时间标签本身不立即生成字，
                         * 而是在下一轮处理它后面的文字。
                         *
                         * 为此暂存时间。
                         */
                        if (!words.length) {
                            // 理论上不会发生，因为第一字
                            // 通常就是行首之后的文字。
                        }
                    }

                    /*
                     * 上面的处理需要更精确地构建：
                     *
                     * 第一个文字 = baseTime
                     * 后续文字 = 后面的时间标签
                     *
                     * 所以重新使用更直接的解析方式。
                     */

                    words = [];
                    pureText = '';

                    const timeTokenRegex =
                        /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;

                    const tokens = [];

                    let token;

                    while (
                        (
                            token =
                                timeTokenRegex.exec(text)
                        ) !== null
                    ) {
                        tokens.push({
                            index: token.index,
                            end:
                                timeTokenRegex.lastIndex,
                            time:
                                parseTime(
                                    token[1] +
                                    ':' +
                                    token[2]
                                )
                        });
                    }

                    if (tokens.length > 0) {

                        /*
                         * 第一个 token 后面的文字
                         * 对应第二个 token 的时间。
                         *
                         * 而第一个 token 是行首时间的
                         * 重复标签，因此第一个字应该
                         * 从 offset 0 开始。
                         */

                        for (
                            let i = 0;
                            i < tokens.length;
                            i++
                        ) {

                            const start =
                                tokens[i].end;

                            const end =
                                i + 1 <
                                tokens.length
                                    ? tokens[i + 1].index
                                    : text.length;

                            const wordText =
                                text.substring(
                                    start,
                                    end
                                );

                            if (!wordText) {
                                continue;
                            }

                            const absTime =
                                tokens[i].time;

                            const offset =
                                Math.max(
                                    0,
                                    absTime -
                                    baseTime
                                );

                            /*
                             * 如果第一个内部时间标签
                             * 就是行首 baseTime，
                             * 那么 offset = 0。
                             *
                             * 这正是正确行为。
                             */
                            words.push({
                                offset,
                                text: wordText,
                                duration: 0
                            });

                            pureText +=
                                wordText;
                        }

                        /*
                         * 如果歌词系统的行首时间已经被
                         * lineRegex 吃掉，那么实际 text
                         * 是：
                         *
                         * 让[00:37.652]我...
                         *
                         * 不存在第一个 [00:37.465]。
                         *
                         * 这种情况上面的 token[0]
                         * 实际上是第二个字的时间。
                         *
                         * 因此必须特殊修正。
                         */
                        if (
                            tokens.length > 0 &&
                            !text.startsWith('[')
                        ) {

                            const corrected = [];

                            /*
                             * 第一段文字：
                             *
                             * 从 text 开头到第一个时间标签
                             *
                             * 它必须从 offset 0 开始。
                             */
                            const firstText =
                                text.substring(
                                    0,
                                    tokens[0].index
                                );

                            if (firstText) {
                                corrected.push({
                                    offset: 0,
                                    text: firstText,
                                    duration: 0
                                });
                            }

                            /*
                             * 后续：
                             *
                             * [37.652]我
                             *
                             * 对应 37.652
                             */
                            for (
                                let i = 0;
                                i < tokens.length;
                                i++
                            ) {

                                const start =
                                    tokens[i].end;

                                const end =
                                    i + 1 <
                                    tokens.length
                                        ? tokens[i + 1].index
                                        : text.length;

                                const wordText =
                                    text.substring(
                                        start,
                                        end
                                    );

                                if (!wordText) {
                                    continue;
                                }

                                corrected.push({
                                    offset: Math.max(
                                        0,
                                        tokens[i].time -
                                        baseTime
                                    ),
                                    text: wordText,
                                    duration: 0
                                });
                            }

                            words =
                                corrected;

                            pureText =
                                corrected
                                    .map(w => w.text)
                                    .join('');
                        }
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
                    const duration =
                        words[i + 1].offset -
                        words[i].offset;

                    words[i].duration =
                        Math.max(
                            0.01,
                            duration
                        );
                }

            } else {

                // ====================================================
                // 普通歌词
                // ====================================================

                const endMark =
                    /^(.*?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]$/
                        .exec(text);

                if (
                    endMark &&
                    endMark[1] &&
                    parseTime(
                        endMark[2] +
                        ':' +
                        endMark[3]
                    ) > baseTime
                ) {
                    pureText =
                        endMark[1];
                } else {
                    pureText =
                        text;
                }
            }

            parsedLyrics.push({
                time: baseTime,
                text: pureText,
                isKtv,
                words
            });
        });

        // ============================================================
        // 确保歌词按时间排序
        // ============================================================

        parsedLyrics.sort(
            (a, b) =>
                a.time - b.time
        );

        // ============================================================
        // 最后一个字持续时间
        // ============================================================

        for (
            let i = 0;
            i < parsedLyrics.length;
            i++
        ) {
            const lyric =
                parsedLyrics[i];

            if (
                !lyric.isKtv ||
                !lyric.words.length
            ) {
                continue;
            }

            const lastWord =
                lyric.words[
                    lyric.words.length - 1
                ];

            if (
                i <
                parsedLyrics.length - 1
            ) {

                const maxDur =
                    parsedLyrics[i + 1].time -
                    (
                        lyric.time +
                        lastWord.offset
                    );

                lastWord.duration =
                    Math.max(
                        0.1,
                        Math.min(
                            maxDur,
                            2.0
                        )
                    );

            } else {

                lastWord.duration = 1.5;
            }
        }

        // ============================================================
        // 占位行
        // ============================================================

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
        }

        // ============================================================
        // 构建 DOM
        // ============================================================

        containerEl.innerHTML =
            parsedLyrics
                .map((lyric, idx) => {

                    if (lyric.isKtv) {

                        const wordsHtml =
                            lyric.words
                                .map(
                                    (word, wIdx) =>
                                        `<span class="ktv-word" id="ktv-word-${idx}-${wIdx}">${escapeHtml(word.text)}</span>`
                                )
                                .join('');

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
                        >${escapeHtml(lyric.text)}</div>
                    `;
                })
                .join('');

        // ============================================================
        // DOM 缓存
        // ============================================================

        lineElements =
            parsedLyrics.map(
                (_, idx) =>
                    document.getElementById(
                        `lyric-${idx}`
                    )
            );

        wordElements =
            parsedLyrics.map(
                (lyric, idx) => {

                    if (!lyric.isKtv) {
                        return [];
                    }

                    return lyric.words.map(
                        (_, wIdx) =>
                            document.getElementById(
                                `ktv-word-${idx}-${wIdx}`
                            )
                    );
                }
            );
    }

    // ============================================================
    // 二分查找歌词行
    // ============================================================

    function findActiveLine(currentTime) {
        let low = 0;
        let high =
            parsedLyrics.length - 1;

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

    // ============================================================
    // 二分查找当前字
    // ============================================================

    function findActiveWord(
        words,
        relativeTime
    ) {
        let low = 0;
        let high =
            words.length - 1;

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

    // ============================================================
    // 更新字状态
    // ============================================================

    function setWordState(
        lineIndex,
        wordIndex,
        state,
        progress
    ) {
        const el =
            wordElements[lineIndex] &&
            wordElements[lineIndex][wordIndex];

        if (!el) return;

        const cls =
            state === 'sung'
                ? 'ktv-word sung'
                : state === 'singing'
                    ? 'ktv-word singing'
                    : 'ktv-word';

        if (el.className !== cls) {
            el.className = cls;
        }

        if (
            progress !== undefined
        ) {
            el.style.setProperty(
                '--progress',
                `${progress}%`
            );
        }
    }

    // ============================================================
    // 字切换时才刷新整行
    // ============================================================

    function refreshWordStates(
        lineIndex,
        activeWordIndex
    ) {
        const lyric =
            parsedLyrics[lineIndex];

        if (
            !lyric ||
            !lyric.isKtv
        ) {
            return;
        }

        for (
            let i = 0;
            i < lyric.words.length;
            i++
        ) {

            if (
                i < activeWordIndex
            ) {
                setWordState(
                    lineIndex,
                    i,
                    'sung',
                    100
                );

            } else if (
                i === activeWordIndex
            ) {
                setWordState(
                    lineIndex,
                    i,
                    'singing',
                    0
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

    // ============================================================
    // 当前字进度
    // ============================================================

    function updateCurrentWord(
        lineIndex,
        wordIndex,
        relativeTime
    ) {
        const lyric =
            parsedLyrics[lineIndex];

        if (
            !lyric ||
            !lyric.words[wordIndex]
        ) {
            return;
        }

        const word =
            lyric.words[wordIndex];

        const el =
            wordElements[lineIndex] &&
            wordElements[lineIndex][wordIndex];

        if (!el) return;

        let progress = 0;

        if (
            relativeTime >=
            word.offset +
            word.duration
        ) {

            progress = 100;

            if (
                el.className !==
                'ktv-word sung'
            ) {
                el.className =
                    'ktv-word sung';
            }

        } else if (
            relativeTime >
            word.offset
        ) {

            progress =
                (
                    (
                        relativeTime -
                        word.offset
                    ) /
                    word.duration
                ) * 100;

            progress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        progress
                    )
                );

            if (
                el.className !==
                'ktv-word singing'
            ) {
                el.className =
                    'ktv-word singing';
            }

        } else {

            progress = 0;

            if (
                el.className !==
                'ktv-word'
            ) {
                el.className =
                    'ktv-word';
            }
        }

        el.style.setProperty(
            '--progress',
            `${progress}%`
        );
    }

    // ============================================================
    // 核心同步
    // ============================================================

    function sync(currentTime) {

        if (
            !parsedLyrics.length ||
            manualScrolling
        ) {
            return;
        }

        const activeIndex =
            findActiveLine(currentTime);

        if (
            activeIndex < 0
        ) {
            return;
        }

        // ========================================================
        // 歌词行切换
        // ========================================================

        if (
            activeIndex !==
            lastActiveIndex
        ) {

            if (activeLineEl) {
                activeLineEl.classList.remove(
                    'active'
                );
            }

            lastActiveIndex =
                activeIndex;

            activeLineEl =
                lineElements[activeIndex];

            if (activeLineEl) {

                activeLineEl.classList.add(
                    'active'
                );

                const offset =
                    activeLineEl.offsetTop -
                    (
                        wrapperEl.offsetHeight /
                        2
                    ) +
                    (
                        activeLineEl.offsetHeight /
                        2
                    );

                containerEl.style.transform =
                    `translateY(-${Math.max(
                        0,
                        offset
                    )}px)`;

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

            activeWordIndex = -1;
            activeWordLineIndex =
                activeIndex;
        }

        // ========================================================
        // 当前歌词
        // ========================================================

        const currentLyric =
            parsedLyrics[activeIndex];

        if (
            !currentLyric ||
            !currentLyric.isKtv ||
            !currentLyric.words.length
        ) {
            return;
        }

        const relativeTime =
            currentTime -
            currentLyric.time;

        const wordIndex =
            findActiveWord(
                currentLyric.words,
                relativeTime
            );

        // ========================================================
        // 只有当前字改变时才遍历整行
        // ========================================================

        if (
            wordIndex !==
            activeWordIndex ||
            activeWordLineIndex !==
            activeIndex
        ) {

            activeWordIndex =
                wordIndex;

            activeWordLineIndex =
                activeIndex;

            refreshWordStates(
                activeIndex,
                wordIndex
            );
        }

        // ========================================================
        // 每帧只更新当前字
        // ========================================================

        if (
            wordIndex >= 0
        ) {
            updateCurrentWord(
                activeIndex,
                wordIndex,
                relativeTime
            );
        }
    }

    // ============================================================
    // 手动滚动
    // ============================================================

    function getOffset() {

        const m =
            /translateY\(-?(\d+(?:\.\d+)?)px\)/
                .exec(
                    containerEl.style.transform ||
                    ''
                );

        return m
            ? parseFloat(m[1])
            : 0;
    }

    function getMaxOffset() {

        return Math.max(
            0,
            containerEl.scrollHeight -
            wrapperEl.offsetHeight
        );
    }

    function bindEvents() {

        if (!wrapperEl) {
            return;
        }

        function onDragStart(e) {

            if (
                e.type === 'mousedown' &&
                e.button !== 0
            ) {
                return;
            }

            if (resumeTimer) {
                clearTimeout(
                    resumeTimer
                );

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
                currentY -
                dragStartY;

            const nextOffset =
                Math.max(
                    0,
                    Math.min(
                        getMaxOffset(),
                        startOffset -
                        delta
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
                clearTimeout(
                    resumeTimer
                );
            }

            resumeTimer =
                setTimeout(() => {

                    resumeTimer = null;

                    manualScrolling = false;

                    if (
                        audioEl &&
                        !audioEl.paused
                    ) {
                        sync(
                            audioEl.currentTime
                        );
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

    return {
        init,
        parse,
        sync
    };

})();