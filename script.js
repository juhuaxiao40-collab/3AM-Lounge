// ==================== DOM元素 ====================
const startScreen = document.getElementById('startScreen');
const startButton = document.getElementById('startButton');
const dialogueBox = document.querySelector('.dialogue-box');
const characterName = document.getElementById('characterName');
const dialogueText = document.getElementById('dialogueText');
const continueHint = document.getElementById('continueHint');
const choicesContainer = document.getElementById('choicesContainer');
const bgmButton = document.getElementById('bgmButton');
const bgmIcon = document.getElementById('bgmIcon');
const assetLayer = document.getElementById('assetLayer');

// ==================== 游戏状态 ====================
let gameStarted = false;
let isTyping = false; // 是否正在打字
let canContinue = false; // 是否可以继续
let typewriterSpeed = 50; // 打字速度（毫秒）
let currentText = ''; // 当前完整文本
let typingTimer = null; // 打字计时器
let currentNodeId = 'start'; // 当前剧情节点ID
let isShowingChoices = false; // 是否正在显示选项
let bgmPlaying = false; // BGM播放状态
let currentBGM = null; // 当前播放的BGM ID
let bgmAudioElements = {}; // BGM音频元素缓存
let currentAssets = {}; // 当前显示的素材 { type: element }
let assetElements = {}; // 素材元素缓存

// ==================== 音效系统 ====================
const soundEffects = {
    click: null,  // 点击音效
    choice: null  // 选项音效
};

// 初始化音效
function initSoundEffects() {
    // 创建点击音效（水泡破裂"啵"声）
    soundEffects.click = createBubbleSound();

    // 创建选项音效（清脆"叮"声）
    soundEffects.choice = createDingSound();
}

// 生成水泡破裂音效（柔和治愈）
function createBubbleSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    return function() {
        // 创建柔和的和声
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // 低通滤波器，让声音更柔和
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);

        // 主音：温柔的中频
        oscillator1.frequency.setValueAtTime(523, audioContext.currentTime); // C5
        oscillator1.frequency.exponentialRampToValueAtTime(659, audioContext.currentTime + 0.08);
        oscillator1.frequency.exponentialRampToValueAtTime(392, audioContext.currentTime + 0.18);

        // 和声：柔和的泛音
        oscillator2.frequency.setValueAtTime(659, audioContext.currentTime); // E5
        oscillator2.frequency.exponentialRampToValueAtTime(784, audioContext.currentTime + 0.08);
        oscillator2.frequency.exponentialRampToValueAtTime(494, audioContext.currentTime + 0.18);

        // 柔和的音量包络
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        // 使用正弦波获得柔和音色
        oscillator1.type = 'sine';
        oscillator2.type = 'sine';

        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);

        oscillator1.stop(audioContext.currentTime + 0.2);
        oscillator2.stop(audioContext.currentTime + 0.2);
    };
}

// 生成叮声音效（温暖木琴）
function createDingSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    return function() {
        // 创建温暖的木琴音色
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // 低通滤波器
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);

        // 基频：温暖的中高频
        oscillator1.frequency.setValueAtTime(880, audioContext.currentTime); // A5
        oscillator1.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.35);

        // 和声：柔和的三度音
        oscillator2.frequency.setValueAtTime(1047, audioContext.currentTime); // C6
        oscillator2.frequency.exponentialRampToValueAtTime(1047, audioContext.currentTime + 0.35);

        // 温柔的音量包络
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

        // 使用正弦波
        oscillator1.type = 'sine';
        oscillator2.type = 'sine';

        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);

        oscillator1.stop(audioContext.currentTime + 0.4);
        oscillator2.stop(audioContext.currentTime + 0.4);
    };
}

// 播放音效
function playSound(soundType) {
    try {
        if (soundEffects[soundType]) {
            soundEffects[soundType]();
        }
    } catch (error) {
        console.log('音效播放失败:', error);
    }
}



// 初始化音效系统
initSoundEffects();

// ==================== 开始游戏 ====================
startButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    dialogueBox.style.display = 'block';
    gameStarted = true;

    // 从第一个节点开始
    loadNode('start');
});

// ==================== 加载剧情节点 ====================
function loadNode(nodeId) {
    const node = storyData[nodeId];

    if (!node) {
        console.error('节点不存在:', nodeId);
        return;
    }

    currentNodeId = nodeId;

    // 检查并切换BGM
    if (typeof bgmConfig !== 'undefined' && node.bgm) {
        switchBGM(node.bgm);
    }

    // 显示素材
    showAssets(node);

    if (node.type === 'dialogue') {
        // 普通对话
        showDialogue(node.name, node.text, node.next);
    } else if (node.type === 'choice') {
        // 显示选择
        showDialogue(node.name, node.text, null, node.choices);
    } else if (node.type === 'ending') {
        // 结局
        showEnding(node.name, node.text, node.endingTitle);
    }
}

// ==================== 显示素材 ====================
function showAssets(node) {
    // 隐藏所有当前素材
    Object.keys(currentAssets).forEach(type => {
        if (currentAssets[type]) {
            currentAssets[type].style.display = 'none';
        }
    });

    // 显示场景素材（支持单个或多个）
    if (typeof assetConfig !== 'undefined') {
        // 场景素材
        if (node.scenes && Array.isArray(node.scenes)) {
            node.scenes.forEach(assetId => showAsset(assetId, 'scene'));
        } else if (node.scene) {
            showAsset(node.scene, 'scene');
        }
        
        // 人物素材
        if (node.characters && Array.isArray(node.characters)) {
            node.characters.forEach(assetId => showAsset(assetId, 'character'));
        } else if (node.character) {
            showAsset(node.character, 'character');
        }
        
        // 道具素材
        if (node.props && Array.isArray(node.props)) {
            node.props.forEach(assetId => showAsset(assetId, 'prop'));
        } else if (node.prop) {
            showAsset(node.prop, 'prop');
        }
    }
}

// ==================== 显示单个素材 ====================
function showAsset(assetId, assetType) {
    const asset = assetConfig[assetId];
    if (!asset || !asset.file) return;

    // 如果已有该素材元素，直接显示
    if (assetElements[assetId]) {
        currentAssets[assetType] = assetElements[assetId];
        assetElements[assetId].style.display = 'block';
        return;
    }

    // 创建素材元素
    const isVideo = asset.fileType === 'video';
    const isGif = asset.name && asset.name.match(/\.gif$/i);
    const loopCount = asset.loopCount || -1;

    let element;
    if (isVideo) {
        element = document.createElement('video');
        element.src = asset.file;
        element.className = `asset-${assetType}`;
        element.style.maxWidth = '100%';
        element.style.maxHeight = '100%';
        
        // 设置静音
        element.muted = asset.muted || false;
        
        // 设置循环
        if (loopCount === -1) {
            element.loop = true;
        } else {
            element.loop = false;
            let playCount = 0;
            element.addEventListener('ended', () => {
                playCount++;
                if (playCount < loopCount) {
                    element.currentTime = 0;
                    element.play();
                }
            });
        }
        
        element.play().catch(() => {});
    } else {
        element = document.createElement('img');
        element.src = asset.file;
        element.className = `asset-${assetType}`;
        
        // GIF循环控制（通过CSS或JavaScript）
        if (isGif && loopCount > 0) {
            // 通过重新加载实现有限循环
            let playCount = 0;
            const originalSrc = asset.file;
            
            element.addEventListener('load', () => {
                if (playCount > 0) {
                    playCount++;
                    if (playCount >= loopCount) {
                        // 循环结束，显示静态帧
                        element.src = '';
                        // 创建canvas获取最后一帧
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = element.naturalWidth;
                        canvas.height = element.naturalHeight;
                        ctx.drawImage(element, 0, 0);
                        element.src = canvas.toDataURL();
                    }
                }
            });
            
            element.addEventListener('animationiteration', () => {
                playCount++;
                if (playCount >= loopCount) {
                    element.style.animationIterationCount = '1';
                }
            });
        }
    }

    // 缓存元素
    assetElements[assetId] = element;
    currentAssets[assetType] = element;
    
    // 添加到DOM
    assetLayer.appendChild(element);
}

// ==================== 打字机效果 ====================
function typeWriter(name, text, callback) {
    // 重置状态
    isTyping = true;
    canContinue = false;
    isShowingChoices = false;
    currentText = text;
    characterName.textContent = name;
    dialogueText.textContent = '';
    continueHint.style.display = 'none';
    choicesContainer.style.display = 'none';

    let charIndex = 0;

    // 清除之前的计时器
    if (typingTimer) {
        clearInterval(typingTimer);
    }

    // 开始打字
    typingTimer = setInterval(() => {
        if (charIndex < text.length) {
            dialogueText.textContent += text.charAt(charIndex);
            charIndex++;
        } else {
            // 打字完成
            clearInterval(typingTimer);
            isTyping = false;
            canContinue = true;

            if (callback) {
                callback();
            }
        }
    }, typewriterSpeed);
}

// ==================== 跳过打字动画 ====================
function skipTyping() {
    if (isTyping) {
        clearInterval(typingTimer);
        dialogueText.textContent = currentText;
        isTyping = false;
        canContinue = true;
    }
}

// ==================== 显示对话 ====================
function showDialogue(name, text, nextNodeId = null, choices = null) {
    typeWriter(name, text, () => {
        if (choices) {
            // 如果有选项，显示选项
            showChoices(choices);
        } else if (nextNodeId) {
            // 如果有下一个节点，显示继续提示
            continueHint.style.display = 'block';
        }
    });
}

// ==================== 显示选项 ====================
function showChoices(choices) {
    isShowingChoices = true;
    canContinue = false;
    continueHint.style.display = 'none';
    choicesContainer.innerHTML = '';
    choicesContainer.style.display = 'flex';

    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.textContent = choice.text;
        button.addEventListener('click', () => {
            // 播放选项音效
            playSound('choice');
            // 点击选项后，加载对应的下一个节点
            loadNode(choice.next);
        });
        choicesContainer.appendChild(button);
    });
}

// ==================== 显示结局 ====================
function showEnding(name, text, endingTitle) {
    typeWriter(name, text, () => {
        // 显示结局标题
        setTimeout(() => {
            continueHint.textContent = `【${endingTitle}】`;
            continueHint.style.display = 'block';
            continueHint.style.color = 'rgba(168, 192, 224, 0.9)';
            continueHint.style.fontSize = '16px';
            continueHint.style.animation = 'none';
        }, 1000);
    });
}

// ==================== 继续下一句对话 ====================
function nextDialogue() {
    if (!canContinue || isShowingChoices) return;

    const node = storyData[currentNodeId];

    if (node && node.next) {
        loadNode(node.next);
    }
}

// ==================== 点击对话框事件 ====================
dialogueBox.addEventListener('click', () => {
    // 播放点击音效
    playSound('click');

    if (isTyping) {
        // 如果正在打字，跳过动画
        skipTyping();

        // 跳过后检查是否需要显示选项
        const node = storyData[currentNodeId];
        if (node && node.type === 'choice' && node.choices) {
            showChoices(node.choices);
        } else if (node && node.next) {
            continueHint.style.display = 'block';
        }
    } else if (canContinue && !isShowingChoices) {
        // 如果可以继续且不在显示选项，显示下一句
        nextDialogue();
    }
});

// ==================== 空格键快捷操作 ====================
document.addEventListener('keydown', (e) => {
    if (!gameStarted) return;

    if (e.code === 'Space') {
        e.preventDefault();
        if (isTyping) {
            skipTyping();

            // 跳过后检查是否需要显示选项
            const node = storyData[currentNodeId];
            if (node && node.type === 'choice' && node.choices) {
                showChoices(node.choices);
            } else if (node && node.next) {
                continueHint.style.display = 'block';
            }
        } else if (canContinue && !isShowingChoices) {
            nextDialogue();
        }
    }
});

// ==================== 点击星星特效 - 流光效果 ====================
function createClickStars(x, y) {
    // 每次点击生成6-9个小星星
    const starCount = Math.floor(Math.random() * 4) + 6;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'click-star';

        // 设置初始位置
        star.style.left = x + 'px';
        star.style.top = y + 'px';

        // 随机方向（360度均匀分布 + 随机偏移）
        const angle = (Math.PI * 2 * i) / starCount + (Math.random() - 0.5) * 0.3;
        const distance = 40 + Math.random() * 30; // 飞行距离
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        star.style.setProperty('--tx', tx + 'px');
        star.style.setProperty('--ty', ty + 'px');

        // 设置尾迹角度（朝向飞行方向）
        const angleDeg = (angle * 180 / Math.PI);
        star.style.setProperty('--angle', angleDeg + 'deg');

        // 随机延迟，让星星不是同时出现
        star.style.animationDelay = (Math.random() * 0.1) + 's';

        // 添加到页面
        document.body.appendChild(star);

        // 动画结束后移除元素
        setTimeout(() => {
            star.remove();
        }, 900);
    }
}

// 监听点击事件（鼠标）
document.addEventListener('click', (e) => {
    // 检查是否点击在对话框或选项按钮上
    const isDialogueClick = e.target.closest('.dialogue-box');
    const isChoiceClick = e.target.closest('.choice-button');
    const isBGMClick = e.target.closest('.bgm-control');

    // 只在点击背景区域时显示星星特效
    if (!isDialogueClick && !isChoiceClick && !isBGMClick) {
        createClickStars(e.clientX, e.clientY);
    }
});

// 监听触摸事件（移动端）
document.addEventListener('touchstart', (e) => {
    // 阻止默认行为，避免双重触发
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        createClickStars(touch.clientX, touch.clientY);
    }
});

// ==================== BGM控制 ====================
function toggleBGM() {
    bgmPlaying = !bgmPlaying;

    if (bgmPlaying) {
        bgmIcon.textContent = '🔊';
        bgmButton.classList.add('playing');
        // 如果有当前BGM，恢复播放
        if (currentBGM && bgmAudioElements[currentBGM]) {
            bgmAudioElements[currentBGM].play().catch(err => {
                console.log('播放失败:', err);
            });
        }
        console.log('BGM 开始播放');
    } else {
        bgmIcon.textContent = '🔇';
        bgmButton.classList.remove('playing');
        // 暂停所有BGM
        Object.values(bgmAudioElements).forEach(audio => {
            audio.pause();
        });
        console.log('BGM 已暂停');
    }
}

// ==================== 切换BGM ====================
function switchBGM(bgmId) {
    // 如果BGM配置不存在，直接返回
    if (typeof bgmConfig === 'undefined' || !bgmConfig[bgmId]) {
        console.log('BGM配置不存在:', bgmId);
        return;
    }

    // 如果已经在播放这个BGM，不需要切换
    if (currentBGM === bgmId) {
        return;
    }

    // 淡出当前BGM
    if (currentBGM && bgmAudioElements[currentBGM]) {
        fadeOutAudio(bgmAudioElements[currentBGM]);
    }

    // 创建或获取新的音频元素
    if (!bgmAudioElements[bgmId]) {
        const audio = new Audio();
        audio.loop = true;
        audio.volume = 0.3;

        // 从Base64数据创建音频
        const bgmData = bgmConfig[bgmId];
        if (bgmData && bgmData.file) {
            audio.src = bgmData.file;
            bgmAudioElements[bgmId] = audio;
        } else {
            console.error('BGM数据不存在:', bgmId);
            return;
        }
    }

    // 如果BGM开关是开启状态，播放新BGM
    if (bgmPlaying) {
        const newAudio = bgmAudioElements[bgmId];
        newAudio.volume = 0;
        newAudio.play().then(() => {
            fadeInAudio(newAudio);
        }).catch(err => {
            console.log('BGM播放失败:', err);
        });
    }

    currentBGM = bgmId;
    console.log('切换BGM到:', bgmId);
}

// ==================== 音频淡入 ====================
function fadeInAudio(audio, duration = 1000) {
    const targetVolume = 0.3;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
        currentStep++;
        audio.volume = Math.min(volumeStep * currentStep, targetVolume);

        if (currentStep >= steps) {
            clearInterval(fadeInterval);
        }
    }, stepTime);
}

// ==================== 音频淡出 ====================
function fadeOutAudio(audio, duration = 1000) {
    const startVolume = audio.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0);

        if (currentStep >= steps) {
            clearInterval(fadeInterval);
            audio.pause();
            audio.currentTime = 0;
        }
    }, stepTime);
}
