// static/lyrics.js
window.LyricsEngine = (function() {
    let parsedLyrics = [];
    let manualScrolling = false;
    let resumeTimer = null;
    let dragStartY = 0;
    let startOffset = 0;
    let wrapperEl = null;
    let containerEl = null;
    let lastActiveIndex = -1;
    let animationFrameId = null; // 🌟 新增：追踪 60FPS 渲染帧

    function init(wrapperId, containerId) {
        wrapperEl = document.getElementById(wrapperId);
        containerEl = document.getElementById(containerId);
        bindEvents();
        startLoop(); // 🌟 新增：初始化时启动高频监听
    }

    // 🌟 核心：60 帧/秒的超高频同步引擎，彻底解决快歌跳帧
    function startLoop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        function loop() {
            const audioEl = document.getElementById('audio');
            // 只要在播放且没有手动滑动歌词，就以 60FPS 实时同步
            if (audioEl && !audioEl.paused && !manualScrolling) {
                sync(audioEl.currentTime);
            }
            animationFrameId = requestAnimationFrame(loop);
        }
        loop();
    }

    function parse(lrcString) {
        parsedLyrics = [];
        lastActiveIndex = -1;

        if (typeof window.updateMediaSessionLyric === 'function') {
            window.updateMediaSessionLyric(null);
        }

        if (!lrcString) {
            containerEl.innerHTML = '<div class="no-lyrics">暂无歌词，请欣赏音乐吧</div>';
            containerEl.style.transform = `translateY(0px)`;
            return;
        }

        const lines = lrcString.split('\n');
        const timeRegex = /\[(\d{2,}):(\d{2}(?:\.\d{1,3})?)\](.*)/;

        lines.forEach(line => {
            const match = timeRegex.exec(line);
            if (match) {
                const baseTime = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
                let text = match[3].trim();
                if (!text) return;

                let words = [];
                let pureText = '';
                // KTV 逐字歌词识别，支持两种实际歌词格式：
                //   格式B(上游原逻辑): word[[mm:ss.xx]]word[[mm:ss.xx]]...   —— 双括号
                //   格式A(实测单括号): word[mm:ss.xxx]word[mm:ss.xxx]...     —— 每个字自带绝对时间
                let isKtv = text.includes('[[') || /\]\S+\[\d{1,2}:\d{2}/.test(text);

                if (isKtv) {
                    if (text.includes('[[')) {
                        // —— 格式B：双括号逐字解析（保持上游逻辑不变）——
                        const parts = text.split('[[');

                        parts.forEach((part, index) => {
                            if (index === 0) {
                                if (part) {
                                    words.push({ offset: 0, text: part, duration: 0 });
                                    pureText += part;
                                }
                            } else {
                                const closeIdx = part.indexOf(']]');
                                if (closeIdx !== -1) {
                                    const timeParts = part.substring(0, closeIdx).split(':');
                                    const absTime = parseInt(timeParts[0], 10) * 60 + parseFloat(timeParts[1]);
                                    // 🌟 智能判断：如果括号内的时间远小于行首时间，说明它是相对时间(格式2)，直接用；否则是绝对时间(格式1)，减去行首。
                                    const offset = (absTime < baseTime - 1) ? absTime : Math.max(0, absTime - baseTime);
                                    const wText = part.substring(closeIdx + 2);

                                    words.push({ offset: offset, text: wText, duration: 0 });
                                    pureText += wText;
                                }
                            }
                        });
                    } else {
                        // —— 格式A：单括号逐字解析。例：
                        //    [00:37.465]让[00:37.652]我[00:37.877]再[00:38.134]看[00:38.440]你
                        //    行内每个 [mm:ss.xxx] 为该字绝对时间，以行首时间换算相对 offset ——
                        const segRegex = /([^\[]+?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
                        let segMatch;
                        let lastAbs = null;
                        let lastSegEnd = 0;
                        while ((segMatch = segRegex.exec(text)) !== null) {
                            const abs = parseInt(segMatch[2], 10) * 60 + parseFloat(segMatch[3]);
                            const wText = segMatch[1];
                            words.push({ offset: Math.max(0, abs - baseTime), text: wText, duration: 0 });
                            pureText += wText;
                            lastAbs = abs;
                            lastSegEnd = segRegex.lastIndex;
                        }
                        // 最后一个字后通常没有时间标签，作为尾部词条并入
                        // 注意: exec 返回 null 会重置 lastIndex 为 0，故用 lastSegEnd 保存最后一轮值
                        const tail = text.slice(lastSegEnd);
                        if (tail) {
                            words.push({ offset: (lastAbs !== null ? Math.max(0, lastAbs - baseTime) : 0), text: tail, duration: 0 });
                            pureText += tail;
                        }
                    }

                    for (let i = 0; i < words.length - 1; i++) {
                        // 加 0.01 下限，防止同时间戳相邻字出现 0 时长导致进度除零
                        words[i].duration = Math.max(0.01, words[i+1].offset - words[i].offset);
                    }
                } else {
                    // 行尾结束时间标记处理："词[mm:ss.xxx]" 且尾标签晚于行首 → 属行时长标记，剥掉避免原文展示
                    const endMark = /^(.*?)\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]$/.exec(text);
                    if (endMark && endMark[1] && (parseInt(endMark[2], 10) * 60 + parseFloat(endMark[3])) > baseTime) {
                        pureText = endMark[1];
                    } else {
                        pureText = text;
                    }
                }

                parsedLyrics.push({ time: baseTime, text: pureText, isKtv, words });
            }
        });

        for (let i = 0; i < parsedLyrics.length; i++) {
            if (parsedLyrics[i].isKtv && parsedLyrics[i].words.length > 0) {
                const words = parsedLyrics[i].words;
                const lastWord = words[words.length - 1];
                if (i < parsedLyrics.length - 1) {
                    const maxDur = parsedLyrics[i+1].time - (parsedLyrics[i].time + lastWord.offset);
                    lastWord.duration = Math.max(0.1, Math.min(maxDur, 2.0));
                } else {
                    lastWord.duration = 1.5;
                }
            }
        }

        if (parsedLyrics.length > 0) {
            parsedLyrics = [
                { time: 0, text: '\u200B', isKtv: false, words: [] },
                { time: 0.1, text: '\u200B', isKtv: false, words: [] },
                ...parsedLyrics
            ];
        }

        containerEl.innerHTML = parsedLyrics.map((lyric, idx) => {
            if (lyric.isKtv) {
                const wordsHtml = lyric.words.map((w, wIdx) =>
                    `<span class="ktv-word" id="ktv-word-${idx}-${wIdx}">${w.text}</span>`
                ).join('');
                return `<div class="lyric-line ktv-mode" id="lyric-${idx}">${wordsHtml}</div>`;
            }
            return `<div class="lyric-line" id="lyric-${idx}">${lyric.text}</div>`;
        }).join('');
    }

    function sync(currentTime) {
        if (parsedLyrics.length === 0 || manualScrolling) return;
        let activeIndex = -1;
        for (let i = 0; i < parsedLyrics.length; i++) {
            if (currentTime >= parsedLyrics[i].time) activeIndex = i;
            else break;
        }

        if (activeIndex !== -1) {
            if (activeIndex !== lastActiveIndex) {
                lastActiveIndex = activeIndex;
                const oldActive = document.querySelector('.lyric-line.active');
                if (oldActive) oldActive.classList.remove('active');
                const currentLine = document.getElementById(`lyric-${activeIndex}`);

                if (currentLine) {
                    currentLine.classList.add('active');
                    const offset = currentLine.offsetTop - (wrapperEl.offsetHeight / 2) + (currentLine.offsetHeight / 2);
                    containerEl.style.transform = `translateY(-${Math.max(0, offset)}px)`;

                    if (typeof window.updateMediaSessionLyric === 'function') {
                        const lyricText = parsedLyrics[activeIndex].text;
                        window.updateMediaSessionLyric((lyricText && lyricText.trim() && lyricText !== '\u200B') ? lyricText : null);
                    }
                }
            }

            const currentLyric = parsedLyrics[activeIndex];
            if (currentLyric && currentLyric.isKtv) {
                const relativeTime = currentTime - currentLyric.time;
                currentLyric.words.forEach((w, wIdx) => {
                    const wordEl = document.getElementById(`ktv-word-${activeIndex}-${wIdx}`);
                    if (wordEl) {
                        let progress = 0;
                        if (relativeTime >= w.offset + w.duration) {
                            progress = 100;
                            wordEl.className = 'ktv-word sung'; // 给手机跳动用
                        } else if (relativeTime > w.offset) {
                            progress = ((relativeTime - w.offset) / w.duration) * 100;
                            wordEl.className = 'ktv-word singing'; // 给手机跳动用
                        } else {
                            wordEl.className = 'ktv-word';
                        }
                        // 🌟 核心恢复：必须把计算好的百分比喂给 CSS，非沉浸/平板模式靠它扫光！
                        wordEl.style.setProperty('--progress', `${progress}%`);
                    }
                });
            }
        }
    }

    function getOffset() {
        const m = /translateY\(-?(\d+(?:\.\d+)?)px\)/.exec(containerEl.style.transform || '');
        return m ? parseFloat(m[1]) : 0;
    }

    function getMaxOffset() {
        return Math.max(0, containerEl.scrollHeight - wrapperEl.offsetHeight);
    }

    function bindEvents() {
        if (!wrapperEl) return;

        function onDragStart(e) {
            if (e.type === 'mousedown' && e.button !== 0) return;
            if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
            manualScrolling = true;
            dragStartY = (e.touches ? e.touches[0].clientY : e.clientY);
            startOffset = getOffset();
            containerEl.style.transition = 'none';
            wrapperEl.classList.add('dragging');
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            if (e.type === 'mousedown') e.preventDefault();
        }

        function onDragMove(e) {
            if (!manualScrolling || (e.type === 'mousemove' && e.buttons !== 1)) return;
            e.preventDefault();
            const delta = (e.touches ? e.touches[0].clientY : e.clientY) - dragStartY;
            containerEl.style.transform = `translateY(-${Math.max(0, Math.min(getMaxOffset(), startOffset - delta))}px)`;
        }

        function onDragEnd() {
            if (!manualScrolling) return;
            containerEl.style.transition = '';
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            wrapperEl.classList.remove('dragging');
            if (resumeTimer) clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => { resumeTimer = null; manualScrolling = false; }, 2000);
        }

        wrapperEl.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        wrapperEl.addEventListener('touchstart', onDragStart, { passive: false });
        wrapperEl.addEventListener('touchmove', onDragMove, { passive: false });
        wrapperEl.addEventListener('touchend', onDragEnd);
    }

    return { init, parse, sync };
})();