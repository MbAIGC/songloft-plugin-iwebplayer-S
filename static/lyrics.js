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
    // AudioContext 精确时间补偿
    //
    // 浏览器 audio.currentTime 反映的是解码缓冲区位置，比扬声器
    // 实际输出提前 50-150ms。通过 AudioContext 获取硬件输出时钟
    // 来抵消这个延迟，让歌词与听到的声音同步。
    // ------------------------------------------------------------

    let audioCtx = null;
    let audioSource = null;

    function initAudioContext() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            audioCtx = new AC();
            audioSource = audioCtx.createMediaElementSource(audioEl);
            audioSource.connect(audioCtx.destination);
        } catch (e) {
            // createMediaElementSource 只能调用一次，被占用则回退
            audioCtx = null;
            audioSource = null;
        }
    }

    // 获取扬声器实际输出时刻对应的媒体时间
    function getSpeakerTime() {
        if (audioCtx && audioCtx.state === 'running' && audioEl) {
            try {
                const ts = audioCtx.getOutputTimestamp();
                // ts.contextTime = AudioContext 时钟上此刻正在输出的位置
                // audioCtx.currentTime - ts.contextTime = 缓冲区延迟（秒）
                const bufferLatency = audioCtx.currentTime - ts.contextTime;
                // 扬声器输出 ≈ 解码位置 - 缓冲区延迟
                if (bufferLatency >= 0 && bufferLatency < 1) {
                    return audioEl.currentTime - bufferLatency;
                }
            } catch (e) {
                // getOutputTimestamp 不可用，回退
            }
        }
        return audioEl ? audioEl.currentTime : 0;
    }

    // ------------------------------------------------------------
    // 初始化
    // ------------------------------------------------------------

    function init(wrapperId, containerId) {
        wrapperEl = document.getElementById(wrapperId);
        containerEl = document.getElementById(containerId);
        audioEl = document.getElementById('audio');

        initAudioContext();

        bindEvents();
        startLoop();
    }

    // ------------------------------------------------------------
    // RAF 同步循环
    //
    // 音频 currentTime 是唯一时间基准。
    // RAF 只负责尽可能高频地把当前时间反映到歌词 UI。
    // ------------------------------------------------------------

    function startLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        function loop() {
            if (!audioEl || !document.contains(audioEl)) {
                audioEl = document.getElementById('audio');
            }

            // AudioContext 被挂起时尝试恢复（自动播放策略）
            if (audioCtx && audioCtx.state === 'suspended' && audioEl && !audioEl.paused) {
                audioCtx.resume();
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

        loop();
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

                    while (
                        (segMatch = segRegex.exec(text)) !== null
                    ) {
                        const abs =
                            parseInt(segMatch[2], 10) * 60 +
                            parseFloat(segMatch[3]);

                        const wText = segMatch[1];

                        words.push({
                            offset: Math.max(
                                0,
                                abs - baseTime
                            ),
                            text: wText,
                            duration: 0
                        });

                        pureText += wText;

                        lastAbs = abs;
                        lastSegEnd = segRegex.lastIndex;
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
        }

        // ------------------------------------------------------------
        // 构建 DOM
        // ------------------------------------------------------------

        containerEl.innerHTML =
            parsedLyrics.map((lyric, idx) => {

                if (lyric.isKtv) {

                    const wordsHtml =
                        lyric.words.map((w, wIdx) =>
                            `<span class="ktv-word" id="ktv-word-${idx}-${wIdx}">${w.text}</span>`
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
                    >${lyric.text}</div>
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