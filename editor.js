// ==================== 全局变量 ====================
let currentEditingNodeId = null;
let storyDataCopy = JSON.parse(JSON.stringify(storyData)); // 深拷贝数据
let bgmDatabase = {}; // BGM数据库 { bgmId: { name, file, nodes: [] } }
let currentUploadedBGM = null; // 当前上传的BGM临时存储
let assetDatabase = {}; // 素材数据库 { assetId: { name, type, file, nodes: [], position: {x, y} } }
let currentUploadedAsset = null; // 当前上传的素材临时存储
let currentAssetFilter = 'all'; // 当前素材筛选类型
let positionHistory = []; // 位置历史记录 [{x, y, label}]

// ==================== 持久化存储 ====================
function savePersistedData() {
    try {
        const dataToSave = {
            bgmDatabase: bgmDatabase,
            assetDatabase: assetDatabase,
            storyDataCopy: storyDataCopy,
            timestamp: Date.now()
        };
        localStorage.setItem('editorPersistedData', JSON.stringify(dataToSave));
        console.log('✅ 编辑器数据已保存到本地存储');
    } catch (e) {
        console.error('❌ 保存数据失败:', e);
    }
}

function loadPersistedData() {
    try {
        const saved = localStorage.getItem('editorPersistedData');
        if (saved) {
            const data = JSON.parse(saved);

            // 恢复BGM数据库
            if (data.bgmDatabase && Object.keys(data.bgmDatabase).length > 0) {
                bgmDatabase = data.bgmDatabase;
                console.log('✅ 已恢复BGM配置:', Object.keys(bgmDatabase).length, '个');
            }

            // 恢复素材数据库
            if (data.assetDatabase && Object.keys(data.assetDatabase).length > 0) {
                assetDatabase = data.assetDatabase;
                console.log('✅ 已恢复素材配置:', Object.keys(assetDatabase).length, '个');
            }

            // 恢复剧情数据（如果有修改）
            if (data.storyDataCopy) {
                storyDataCopy = data.storyDataCopy;
                console.log('✅ 已恢复剧情数据');
            }

            const savedTime = new Date(data.timestamp).toLocaleString('zh-CN');
            console.log('📅 上次保存时间:', savedTime);
        }
    } catch (e) {
        console.error('❌ 加载数据失败:', e);
    }
}

function clearPersistedData() {
    if (confirm('⚠️ 确定要清除所有本地保存的编辑记录吗？\n\n这将删除：\n- 所有BGM配置\n- 所有素材配置\n- 剧情修改记录\n\n此操作不可恢复！')) {
        localStorage.removeItem('editorPersistedData');
        alert('✅ 本地数据已清除！\n\n请刷新页面重新开始。');
        location.reload();
    }
}

// 加载位置历史
function loadPositionHistory() {
    const saved = localStorage.getItem('assetPositionHistory');
    if (saved) {
        positionHistory = JSON.parse(saved);
    } else {
        // 默认位置预设
        positionHistory = [
            { x: 50, y: 80, label: '底部居中' },
            { x: 20, y: 80, label: '左下' },
            { x: 80, y: 80, label: '右下' },
            { x: 50, y: 50, label: '居中' },
            { x: 20, y: 50, label: '左中' },
            { x: 80, y: 50, label: '右中' }
        ];
        savePositionHistory();
    }
}

// 保存位置历史
function savePositionHistory() {
    localStorage.setItem('assetPositionHistory', JSON.stringify(positionHistory));
}

// 添加位置到历史
function addToPositionHistory(x, y) {
    const exists = positionHistory.some(p => p.x === x && p.y === y);
    if (!exists) {
        positionHistory.unshift({ x, y, label: `${x}%, ${y}%` });
        if (positionHistory.length > 10) {
            positionHistory.pop();
        }
        savePositionHistory();
        renderPositionHistory();
    }
}

// 渲染位置历史
function renderPositionHistory() {
    const container = document.getElementById('positionHistoryList');
    if (!container) return;
    
    if (positionHistory.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: rgba(150, 170, 200, 0.5); font-size: 12px;">暂无位置记录</div>';
        return;
    }
    
    container.innerHTML = positionHistory.map((pos, index) => `
        <div class="position-history-item" onclick="applyPositionHistory(${pos.x}, ${pos.y})">
            <span>${pos.label}</span>
            ${index === 0 ? '<span class="recent">最近</span>' : ''}
        </div>
    `).join('');
}

// 应用位置历史
function applyPositionHistory(x, y) {
    document.getElementById('positionX').value = x;
    document.getElementById('positionXValue').textContent = `${x}%`;
    document.getElementById('positionY').value = y;
    document.getElementById('positionYValue').textContent = `${y}%`;
    currentUploadedAsset.position = { x, y };
    updatePositionPreview();
}

// 设置位置
function setPosition(x, y) {
    document.getElementById('positionX').value = x;
    document.getElementById('positionXValue').textContent = `${x}%`;
    document.getElementById('positionY').value = y;
    document.getElementById('positionYValue').textContent = `${y}%`;
    currentUploadedAsset.position = { x, y };
    addToPositionHistory(x, y);
    updatePositionPreview();
}

// 更新游戏界面实时预览
function updatePositionPreview() {
    const gamePreviewAssets = document.getElementById('gamePreviewAssets');
    const gamePreviewCoords = document.getElementById('gamePreviewCoords');

    if (!gamePreviewAssets || !gamePreviewCoords) return;

    const position = currentUploadedAsset?.position || { x: 50, y: 80 };
    const size = currentUploadedAsset?.size || { width: 100, height: 100 };

    // 更新坐标和大小显示
    gamePreviewCoords.textContent = `X: ${position.x}% | Y: ${position.y}% | W: ${size.width}% | H: ${size.height}%`;

    if (!currentUploadedAsset || !currentUploadedAsset.file) {
        gamePreviewAssets.innerHTML = '';
        return;
    }

    const assetType = currentUploadedAsset.type;
    const isVideo = currentUploadedAsset.fileType === 'video';

    // 根据素材类型设置样式，完全复制script.js的逻辑
    if (assetType === 'scene') {
        // 场景素材填充整个预览区域
        const sceneHTML = isVideo ?
            `<video src="${currentUploadedAsset.file}" ${currentUploadedAsset.muted ? 'muted' : ''} loop autoplay playsinline style="width: 100%; height: 100%; object-fit: contain; object-position: center;">您的浏览器不支持视频播放</video>` :
            `<img src="${currentUploadedAsset.file}" alt="预览" style="width: 100%; height: 100%; object-fit: contain; object-position: center;">`;

        gamePreviewAssets.innerHTML = `
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;">
                ${sceneHTML}
            </div>
        `;
    } else if (assetType === 'character' || assetType === 'prop') {
        // 人物和道具素材：使用与script.js完全相同的百分比计算方式
        const baseMaxWidth = assetType === 'character' ? 45 : 30;   // 百分比
        const baseMaxHeight = assetType === 'character' ? 55 : 30;  // 百分比

        // 按照script.js中的公式计算实际尺寸
        const actualMaxWidth = (size.width / 100) * baseMaxWidth;
        const actualMaxHeight = (size.height / 100) * baseMaxHeight;

        const mediaHTML = isVideo ?
            `<video src="${currentUploadedAsset.file}" ${currentUploadedAsset.muted ? 'muted' : ''} loop autoplay playsinline style="display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain;">您的浏览器不支持视频播放</video>` :
            `<img src="${currentUploadedAsset.file}" alt="预览" style="width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain;">`;

        gamePreviewAssets.innerHTML = `
            <div style="position: absolute; left: ${position.x}%; top: ${position.y}%; transform: translate(-50%, -50%); max-width: ${actualMaxWidth}%; max-height: ${actualMaxHeight}%; width: auto; height: auto; z-index: ${assetType === 'character' ? 10 : 11}; border: 2px dashed rgba(106, 183, 255, 0.5); border-radius: 8px; box-shadow: 0 0 10px rgba(106, 183, 255, 0.3);">
                ${mediaHTML}
            </div>
        `;
    }
}

// 设置素材大小
function setAssetSize(width, height) {
    document.getElementById('assetWidth').value = width;
    document.getElementById('assetWidthValue').textContent = `${width}%`;
    document.getElementById('assetHeight').value = height;
    document.getElementById('assetHeightValue').textContent = `${height}%`;
    if (currentUploadedAsset) {
        currentUploadedAsset.size = { width, height };
        updatePositionPreview();
    }
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 加载持久化数据
    loadPersistedData();

    renderNodeList();
    loadBGMFromStory();
    loadAssetsFromStory();
    loadPositionHistory();
    renderPositionHistory();
    updateBGMCount();
    updateAssetCount();
    
    // 设置位置滑块事件
    const positionX = document.getElementById('positionX');
    const positionY = document.getElementById('positionY');
    const positionXValue = document.getElementById('positionXValue');
    const positionYValue = document.getElementById('positionYValue');
    
    positionX?.addEventListener('input', (e) => {
        positionXValue.textContent = `${e.target.value}%`;
        if (currentUploadedAsset) {
            currentUploadedAsset.position = currentUploadedAsset.position || { x: 50, y: 80 };
            currentUploadedAsset.position.x = parseInt(e.target.value);
            updatePositionPreview();
        }
    });
    
    positionY?.addEventListener('input', (e) => {
        positionYValue.textContent = `${e.target.value}%`;
        if (currentUploadedAsset) {
            currentUploadedAsset.position = currentUploadedAsset.position || { x: 50, y: 80 };
            currentUploadedAsset.position.y = parseInt(e.target.value);
            updatePositionPreview();
        }
    });
    
    // 设置大小滑块事件
    const assetWidth = document.getElementById('assetWidth');
    const assetHeight = document.getElementById('assetHeight');
    const assetWidthValue = document.getElementById('assetWidthValue');
    const assetHeightValue = document.getElementById('assetHeightValue');
    
    assetWidth?.addEventListener('input', (e) => {
        assetWidthValue.textContent = `${e.target.value}%`;
        if (currentUploadedAsset) {
            currentUploadedAsset.size = currentUploadedAsset.size || { width: 100, height: 100 };
            currentUploadedAsset.size.width = parseInt(e.target.value);
            updatePositionPreview();
        }
    });
    
    assetHeight?.addEventListener('input', (e) => {
        assetHeightValue.textContent = `${e.target.value}%`;
        if (currentUploadedAsset) {
            currentUploadedAsset.size = currentUploadedAsset.size || { width: 100, height: 100 };
            currentUploadedAsset.size.height = parseInt(e.target.value);
            updatePositionPreview();
        }
    });
});

// ==================== 从剧情数据加载素材配置 ====================
function loadAssetsFromStory() {
    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];

        // 加载场景素材
        if (node.scene) {
            const assetId = node.scene;
            if (!assetDatabase[assetId]) {
                assetDatabase[assetId] = {
                    name: assetId,
                    type: 'scene',
                    file: null,
                    nodes: []
                };
            }
            if (!assetDatabase[assetId].nodes.includes(nodeId)) {
                assetDatabase[assetId].nodes.push(nodeId);
            }
        }

        // 加载人物素材
        if (node.character) {
            const assetId = node.character;
            if (!assetDatabase[assetId]) {
                assetDatabase[assetId] = {
                    name: assetId,
                    type: 'character',
                    file: null,
                    nodes: [],
                    position: { x: 50, y: 80 }
                };
            }
            if (!assetDatabase[assetId].nodes.includes(nodeId)) {
                assetDatabase[assetId].nodes.push(nodeId);
            }
        }

        // 加载道具素材
        if (node.prop) {
            const assetId = node.prop;
            if (!assetDatabase[assetId]) {
                assetDatabase[assetId] = {
                    name: assetId,
                    type: 'prop',
                    file: null,
                    nodes: [],
                    position: { x: 50, y: 50 }
                };
            }
            if (!assetDatabase[assetId].nodes.includes(nodeId)) {
                assetDatabase[assetId].nodes.push(nodeId);
            }
        }
    });
}

// ==================== 节点列表渲染 ====================
function renderNodeList() {
    const container = document.getElementById('nodeListContainer');
    container.innerHTML = '';

    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        const div = document.createElement('div');
        div.className = `node-item ${currentEditingNodeId === nodeId ? 'active' : ''}`;
        div.onclick = () => renderEditor(nodeId);

        const typeClass = node.type || 'dialogue';
        const typeText = {
            'dialogue': '对话',
            'choice': '选择',
            'ending': '结局'
        }[typeClass] || '对话';

        div.innerHTML = `
            <div class="node-id">${nodeId}</div>
            <span class="node-type ${typeClass}">${typeText}</span>
            <div style="color: rgba(200, 210, 230, 0.7); font-size: 13px; margin-top: 5px;">
                ${node.text ? node.text.substring(0, 50) + (node.text.length > 50 ? '...' : '') : ''}
            </div>
        `;

        container.appendChild(div);
    });
}

// ==================== 渲染编辑器 ====================
function renderEditor(nodeId) {
    currentEditingNodeId = nodeId;
    const node = storyDataCopy[nodeId];
    const container = document.getElementById('editorContent');

    if (!node) {
        container.innerHTML = '<div class="empty-state"><p>❌ 节点不存在</p></div>';
        return;
    }

    renderNodeList();

    const typeText = {
        'dialogue': '对话',
        'choice': '选择',
        'ending': '结局'
    }[node.type] || '对话';

    let html = `
        <h2>编辑节点: ${nodeId}</h2>
        
        <div class="form-group">
            <label>节点类型</label>
            <select id="nodeType" onchange="changeNodeType('${nodeId}')">
                <option value="dialogue" ${node.type === 'dialogue' ? 'selected' : ''}>对话</option>
                <option value="choice" ${node.type === 'choice' ? 'selected' : ''}>选择</option>
                <option value="ending" ${node.type === 'ending' ? 'selected' : ''}>结局</option>
            </select>
        </div>

        <div class="form-group">
            <label>节点ID</label>
            <input type="text" id="nodeIdInput" value="${nodeId}" readonly style="background: rgba(20, 25, 35, 0.6);">
        </div>
    `;

    if (node.type !== 'choice') {
        html += `
            <div class="form-group">
                <label>说话角色</label>
                <input type="text" id="nodeName" value="${node.name || ''}" placeholder="输入角色名称">
            </div>

            <div class="form-group">
                <label>对话内容</label>
                <textarea id="nodeText" rows="4" placeholder="输入对话内容">${node.text || ''}</textarea>
            </div>
        `;
    }

    if (node.type === 'choice') {
        html += `
            <div class="form-group">
                <label>选择提示</label>
                <textarea id="nodeText" rows="2" placeholder="输入选择提示">${node.text || ''}</textarea>
            </div>
            <div class="choices-editor">
                <h3>选项</h3>
                <div id="choicesList"></div>
                <button class="btn" onclick="addChoice('${nodeId}')" style="margin-top: 10px;">+ 添加选项</button>
            </div>
        `;
    }

    if (node.type === 'ending') {
        html += `
            <div class="form-group">
                <label>结局标题</label>
                <input type="text" id="nodeEndingTitle" value="${node.endingTitle || ''}" placeholder="输入结局标题">
            </div>
        `;
    }

    html += `
        <div class="form-group">
            <label>下一个节点</label>
            <input type="text" id="nodeNext" value="${node.next || ''}" placeholder="输入下一个节点ID">
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="btn btn-primary" onclick="saveNode('${nodeId}')">💾 保存修改</button>
            <button class="btn btn-danger" onclick="deleteNode('${nodeId}')">🗑️ 删除节点</button>
        </div>

        <div class="node-connections">
            <strong>连接到此节点的节点:</strong>
            ${getIncomingConnections(nodeId).map(id => 
                `<span class="connection-badge" onclick="renderEditor('${id}')">${id}</span>`
            ).join('')}
        </div>
    `;

    container.innerHTML = html;

    if (node.type === 'choice' && node.choices) {
        renderChoicesEditor(node.choices);
    }
}

// ==================== 节点操作 ====================
function changeNodeType(nodeId) {
    const newType = document.getElementById('nodeType').value;
    if (newType === 'choice' && !storyDataCopy[nodeId].choices) {
        storyDataCopy[nodeId].choices = [
            { text: '选项 1', next: '节点ID' },
            { text: '选项 2', next: '节点ID' }
        ];
    }
    storyDataCopy[nodeId].type = newType;
    renderEditor(nodeId);
}

function saveNode(nodeId) {
    const node = storyDataCopy[nodeId];
    
    if (node.type !== 'choice') {
        node.name = document.getElementById('nodeName').value;
        node.text = document.getElementById('nodeText').value;
    }
    
    if (node.type === 'ending') {
        node.endingTitle = document.getElementById('nodeEndingTitle').value;
    }
    
    node.next = document.getElementById('nodeNext').value;
    
    alert('✅ 节点保存成功');
    renderNodeList();
}

function deleteNode(nodeId) {
    if (!confirm(`确定要删除节点 ${nodeId} 吗？`)) return;
    
    // 清理引用
    Object.keys(storyDataCopy).forEach(id => {
        const node = storyDataCopy[id];
        if (node.next === nodeId) node.next = '';
        if (node.choices) {
            node.choices.forEach(choice => {
                if (choice.next === nodeId) choice.next = '';
            });
        }
    });
    
    delete storyDataCopy[nodeId];
    currentEditingNodeId = null;
    document.getElementById('editorContent').innerHTML = '<div class="empty-state"><p>👈 请从左侧选择一个节点开始编辑</p></div>';
    renderNodeList();
    alert('🗑️ 节点已删除');
}

function addNewNode() {
    const baseId = 'new_node';
    let counter = 1;
    while (storyDataCopy[`${baseId}_${counter}`]) {
        counter++;
    }
    const newId = `${baseId}_${counter}`;
    
    storyDataCopy[newId] = {
        id: newId,
        type: 'dialogue',
        name: '',
        text: '',
        next: ''
    };
    
    renderNodeList();
    renderEditor(newId);
    alert(`✅ 新节点 "${newId}" 已创建`);
}

function getIncomingConnections(nodeId) {
    const connections = [];
    Object.keys(storyDataCopy).forEach(id => {
        const node = storyDataCopy[id];
        if (node.next === nodeId) {
            connections.push(id);
        }
        if (node.choices) {
            node.choices.forEach(choice => {
                if (choice.next === nodeId) {
                    connections.push(id);
                }
            });
        }
    });
    return connections;
}

// ==================== 选择节点编辑 ====================
function renderChoicesEditor(choices) {
    const container = document.getElementById('choicesList');
    container.innerHTML = '';
    
    choices.forEach((choice, index) => {
        const div = document.createElement('div');
        div.className = 'choice-item';
        div.innerHTML = `
            <div class="choice-item-header">
                <span>选项 ${index + 1}</span>
                <button class="btn btn-small btn-danger" onclick="removeChoice('${currentEditingNodeId}', ${index})">删除</button>
            </div>
            <div class="form-group">
                <input type="text" id="choiceText_${index}" value="${choice.text}" placeholder="选项文字">
            </div>
            <div class="form-group">
                <input type="text" id="choiceNext_${index}" value="${choice.next}" placeholder="跳转节点ID">
            </div>
        `;
        container.appendChild(div);
    });
}

function addChoice(nodeId) {
    if (!storyDataCopy[nodeId].choices) {
        storyDataCopy[nodeId].choices = [];
    }
    
    storyDataCopy[nodeId].choices.push({
        text: `选项 ${storyDataCopy[nodeId].choices.length + 1}`,
        next: ''
    });
    
    renderChoicesEditor(storyDataCopy[nodeId].choices);
}

function removeChoice(nodeId, index) {
    if (confirm('确定要删除这个选项吗？')) {
        storyDataCopy[nodeId].choices.splice(index, 1);
        renderChoicesEditor(storyDataCopy[nodeId].choices);
    }
}

// ==================== 导出JSON ====================
function exportJSON() {
    const dataStr = JSON.stringify(storyDataCopy, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'story_data.json';
    a.click();
    URL.revokeObjectURL(url);
    alert('JSON数据已导出！');
}

// ==================== 导入JSON ====================
function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        alert('请选择JSON文件！');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            if (typeof importedData !== 'object' || importedData === null) {
                throw new Error('JSON格式不正确');
            }

            let hasValidNode = false;
            for (let key in importedData) {
                if (importedData[key].id && importedData[key].type) {
                    hasValidNode = true;
                    break;
                }
            }

            if (!hasValidNode) {
                throw new Error('JSON文件中没有有效的剧情节点');
            }

            if (confirm('确定要导入这个JSON文件吗？\n当前的编辑内容将被替换！\n\n文件包含 ' + Object.keys(importedData).length + ' 个节点。')) {
                storyDataCopy = importedData;
                currentEditingNodeId = null;
                renderNodeList();

                document.getElementById('editorContent').innerHTML = '<div class="empty-state"><p>✅ JSON导入成功！<br>共导入 ' + Object.keys(importedData).length + ' 个节点<br><br>👈 请从左侧选择一个节点开始编辑</p></div>';

                alert('✅ 导入成功！共导入 ' + Object.keys(importedData).length + ' 个节点');
            }
        } catch (error) {
            alert('❌ 导入失败：' + error.message + '\n\n请确保JSON文件格式正确。');
            console.error('导入错误：', error);
        }
    };

    reader.onerror = function() {
        alert('❌ 文件读取失败，请重试。');
    };

    reader.readAsText(file);
    event.target.value = '';
}

// ==================== 保存到文件 ====================
function saveStory() {
    const jsContent = `// ==================== 剧情数据结构 ====================

const storyData = ${JSON.stringify(storyDataCopy, null, 4)};

// BGM配置数据
const bgmConfig = ${JSON.stringify(bgmDatabase, null, 4)};

// 素材配置数据
const assetConfig = ${JSON.stringify(assetDatabase, null, 4)};

// 导出数据（如果在浏览器环境中使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { storyData, bgmConfig, assetConfig };
}
`;

    const blob = new Blob([jsContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'story.js';
    a.click();
    URL.revokeObjectURL(url);

    alert('剧情文件已保存！请将下载的 story.js 替换项目中的文件。');
}

// ==================== BGM管理功能 ====================
function openBGMManager() {
    document.getElementById('bgmModal').classList.add('active');
    renderBGMList();
}

function closeBGMManager() {
    document.getElementById('bgmModal').classList.remove('active');
    currentUploadedBGM = null;
    document.getElementById('nodeSelectorSection').style.display = 'none';
    document.getElementById('uploadedFileName').textContent = '';
}

function handleBGMUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|ogg|wav)$/i)) {
        alert('请上传有效的音频文件（MP3, OGG, WAV）');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const bgmId = `bgm_${Date.now()}`;
        currentUploadedBGM = {
            id: bgmId,
            name: file.name,
            file: e.target.result,
            nodes: []
        };

        document.getElementById('uploadedFileName').textContent = `✅ 已选择: ${file.name}`;
        document.getElementById('nodeSelectorSection').style.display = 'block';
        renderBGMNodeCheckboxList();
    };

    reader.readAsDataURL(file);
}

function renderBGMNodeCheckboxList() {
    const container = document.getElementById('nodeCheckboxList');
    container.innerHTML = '';

    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        const item = document.createElement('div');
        item.className = 'node-checkbox-item';

        const typeText = {
            'dialogue': '对话',
            'choice': '选择',
            'ending': '结局'
        }[node.type] || '对话';

        item.innerHTML = `
            <label>
                <input type="checkbox" value="${nodeId}" ${currentUploadedBGM && currentUploadedBGM.nodes.includes(nodeId) ? 'checked' : ''}>
                <span><strong>${nodeId}</strong> (${typeText}) - ${node.text ? node.text.substring(0, 30) + '...' : ''}</span>
            </label>
        `;

        container.appendChild(item);
    });
}

function selectAllNodes() {
    const checkboxes = document.querySelectorAll('#nodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllNodes() {
    const checkboxes = document.querySelectorAll('#nodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

function saveBGMAssignment() {
    if (!currentUploadedBGM) {
        alert('请先上传BGM文件');
        return;
    }

    const checkboxes = document.querySelectorAll('#nodeCheckboxList input[type="checkbox"]:checked');
    const selectedNodes = Array.from(checkboxes).map(cb => cb.value);

    if (selectedNodes.length === 0) {
        alert('请至少选择一个节点');
        return;
    }

    currentUploadedBGM.nodes = selectedNodes;
    bgmDatabase[currentUploadedBGM.id] = currentUploadedBGM;

    selectedNodes.forEach(nodeId => {
        if (storyDataCopy[nodeId]) {
            storyDataCopy[nodeId].bgm = currentUploadedBGM.id;
        }
    });

    alert(`✅ BGM配置成功！\n已应用到 ${selectedNodes.length} 个节点\n\n💾 配置已自动保存到本地存储`);

    // 保存到本地存储
    savePersistedData();

    currentUploadedBGM = null;
    document.getElementById('nodeSelectorSection').style.display = 'none';
    document.getElementById('uploadedFileName').textContent = '';
    document.getElementById('bgmFileInput').value = '';

    renderBGMList();
    updateBGMCount();
}

function renderBGMList() {
    const container = document.getElementById('bgmListContainer');

    const bgmIds = Object.keys(bgmDatabase);
    
    if (bgmIds.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: rgba(200, 210, 230, 0.5);">暂无配置的BGM</div>';
        return;
    }

    container.innerHTML = bgmIds.map(bgmId => {
        const bgm = bgmDatabase[bgmId];
        return `
            <div class="bgm-item">
                <div class="bgm-item-header">
                    <span class="bgm-name">🎵 ${bgm.name}</span>
                    <button class="btn btn-small btn-danger" onclick="deleteBGM('${bgmId}')">删除</button>
                </div>
                <div class="bgm-nodes">
                    应用节点: ${bgm.nodes.length} 个
                </div>
            </div>
        `;
    }).join('');
}

function deleteBGM(bgmId) {
    if (!confirm('确定要删除这个BGM吗？\n相关节点的BGM设置也会被清除。')) return;

    const bgm = bgmDatabase[bgmId];

    if (bgm && bgm.nodes) {
        bgm.nodes.forEach(nodeId => {
            if (storyDataCopy[nodeId] && storyDataCopy[nodeId].bgm === bgmId) {
                delete storyDataCopy[nodeId].bgm;
            }
        });
    }

    delete bgmDatabase[bgmId];

    renderBGMList();
    updateBGMCount();
    alert('BGM已删除');
}

function loadBGMFromStory() {
    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        if (node.bgm) {
            const bgmId = node.bgm;
            if (!bgmDatabase[bgmId]) {
                bgmDatabase[bgmId] = {
                    id: bgmId,
                    name: bgmId,
                    file: null,
                    nodes: []
                };
            }
            if (!bgmDatabase[bgmId].nodes.includes(nodeId)) {
                bgmDatabase[bgmId].nodes.push(nodeId);
            }
        }
    });
}

function updateBGMCount() {
    document.getElementById('bgmCount').textContent = Object.keys(bgmDatabase).length;
}

// ==================== 素材管理功能 ====================
function openAssetManager() {
    document.getElementById('assetModal').classList.add('active');
    currentAssetFilter = 'all';
    updateFilterButtons();
    renderAssetList();
}

function closeAssetManager() {
    document.getElementById('assetModal').classList.remove('active');
    currentUploadedAsset = null;
    document.getElementById('assetNodeSelectorSection').style.display = 'none';
    document.getElementById('uploadedAssetName').textContent = '';
}

function handleAssetUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type) || file.name.match(/\.(mp4|webm|ogv|mov)$/i);
    const isAnimated = isVideo || file.name.match(/\.gif$/i);

    if (!isImage && !isVideo) {
        alert('请上传有效的图片或视频文件（图片: JPG, PNG, GIF, WebP | 视频: MP4, WebM, OGV, MOV）');
        return;
    }

    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`${isVideo ? '视频' : '图片'}文件不能超过${isVideo ? '50MB' : '5MB'}，请压缩后再上传`);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const assetType = document.getElementById('assetTypeSelect').value;
        const assetId = `${assetType}_${Date.now()}`;
        const fileType = isVideo ? 'video' : 'image';

        currentUploadedAsset = {
            id: assetId,
            name: file.name,
            type: assetType,
            file: e.target.result,
            fileType: fileType,
            loopCount: -1,
            muted: false,
            nodes: [],
            position: { x: 50, y: assetType === 'character' ? 80 : 50 },
            size: { width: 100, height: 100 }
        };

        const typeLabel = assetType === 'scene' ? '场景' : assetType === 'character' ? '人物' : '道具';
        document.getElementById('uploadedAssetName').textContent = `✅ 已选择: ${file.name} (${typeLabel} - ${fileType === 'video' ? '视频' : '图片'})`;
        
        if (isAnimated) {
            document.getElementById('loopSettings').style.display = 'block';
            document.getElementById('loopCountSelect').value = '-1';
        } else {
            document.getElementById('loopSettings').style.display = 'none';
            currentUploadedAsset.loopCount = -1;
        }
        
        if (isVideo) {
            document.getElementById('videoMuteSettings').style.display = 'block';
            document.getElementById('videoMuteSelect').value = 'false';
        } else {
            document.getElementById('videoMuteSettings').style.display = 'none';
            currentUploadedAsset.muted = false;
        }
        
        if (assetType === 'character' || assetType === 'prop') {
            document.getElementById('positionSettings').style.display = 'block';
            document.getElementById('positionX').value = 50;
            document.getElementById('positionXValue').textContent = '50%';
            document.getElementById('positionY').value = assetType === 'character' ? 80 : 50;
            document.getElementById('positionYValue').textContent = `${assetType === 'character' ? 80 : 50}%`;
            document.getElementById('assetWidth').value = 100;
            document.getElementById('assetWidthValue').textContent = '100%';
            document.getElementById('assetHeight').value = 100;
            document.getElementById('assetHeightValue').textContent = '100%';
            renderPositionHistory();
            updatePositionPreview();
        } else {
            document.getElementById('positionSettings').style.display = 'none';
            currentUploadedAsset.position = null;
            currentUploadedAsset.size = null;
        }
        
        document.getElementById('assetNodeSelectorSection').style.display = 'block';
        renderAssetNodeCheckboxList();
    };

    reader.onerror = function() {
        alert('文件读取失败，请重试');
    };

    reader.readAsDataURL(file);
}

function renderAssetNodeCheckboxList() {
    const container = document.getElementById('assetNodeCheckboxList');
    container.innerHTML = '';

    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        const item = document.createElement('div');
        item.className = 'node-checkbox-item';

        const typeText = {
            'dialogue': '对话',
            'choice': '选择',
            'ending': '结局'
        }[node.type] || '对话';

        item.innerHTML = `
            <label>
                <input type="checkbox" value="${nodeId}" ${currentUploadedAsset && currentUploadedAsset.nodes.includes(nodeId) ? 'checked' : ''}>
                <span><strong>${nodeId}</strong> (${typeText}) - ${node.text ? node.text.substring(0, 30) + '...' : ''}</span>
            </label>
        `;

        container.appendChild(item);
    });
}

function selectAllNodesForAsset() {
    const checkboxes = document.querySelectorAll('#assetNodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

function deselectAllNodesForAsset() {
    const checkboxes = document.querySelectorAll('#assetNodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

function saveAssetAssignment() {
    if (!currentUploadedAsset) {
        alert('请先上传素材文件');
        return;
    }

    const checkboxes = document.querySelectorAll('#assetNodeCheckboxList input[type="checkbox"]:checked');
    const selectedNodes = Array.from(checkboxes).map(cb => cb.value);

    if (selectedNodes.length === 0) {
        alert('请至少选择一个节点');
        return;
    }

    const loopCountSelect = document.getElementById('loopCountSelect');
    if (loopCountSelect && loopCountSelect.style.display !== 'none') {
        currentUploadedAsset.loopCount = parseInt(loopCountSelect.value);
    }

    const videoMuteSelect = document.getElementById('videoMuteSelect');
    if (videoMuteSelect && videoMuteSelect.style.display !== 'none') {
        currentUploadedAsset.muted = videoMuteSelect.value === 'true';
    }

    const assetType = currentUploadedAsset.type;
    const fieldName = assetType + 's';
    
    if (currentUploadedAsset.isEditing) {
        const oldAsset = assetDatabase[currentUploadedAsset.id];
        if (oldAsset && oldAsset.nodes) {
            oldAsset.nodes.forEach(oldNodeId => {
                if (storyDataCopy[oldNodeId] && Array.isArray(storyDataCopy[oldNodeId][fieldName])) {
                    const index = storyDataCopy[oldNodeId][fieldName].indexOf(currentUploadedAsset.id);
                    if (index > -1) {
                        storyDataCopy[oldNodeId][fieldName].splice(index, 1);
                    }
                }
            });
        }
        delete currentUploadedAsset.isEditing;
    }

    currentUploadedAsset.nodes = selectedNodes;

    assetDatabase[currentUploadedAsset.id] = currentUploadedAsset;

    selectedNodes.forEach(nodeId => {
        if (storyDataCopy[nodeId]) {
            if (!storyDataCopy[nodeId][fieldName]) {
                storyDataCopy[nodeId][fieldName] = [];
            }
            if (Array.isArray(storyDataCopy[nodeId][fieldName])) {
                if (!storyDataCopy[nodeId][fieldName].includes(currentUploadedAsset.id)) {
                    storyDataCopy[nodeId][fieldName].push(currentUploadedAsset.id);
                }
            } else {
                const oldId = storyDataCopy[nodeId][fieldName];
                storyDataCopy[nodeId][fieldName] = [oldId, currentUploadedAsset.id];
            }
        }
    });

    const typeText = assetType === 'scene' ? '场景' : assetType === 'character' ? '人物' : '道具';
    const loopInfo = currentUploadedAsset.loopCount === -1 ? '（无限循环）' : `（循环${currentUploadedAsset.loopCount}次）`;
    const muteInfo = currentUploadedAsset.muted ? '（已静音）' : '';
    const posInfo = currentUploadedAsset.position ? `（位置: ${currentUploadedAsset.position.x}%, ${currentUploadedAsset.position.y}%）` : '';
    const sizeInfo = currentUploadedAsset.size ? `（大小: ${currentUploadedAsset.size.width}% × ${currentUploadedAsset.size.height}%）` : '';
    alert(`✅ ${typeText}素材配置成功！${loopInfo}${muteInfo}${posInfo}${sizeInfo}\n已应用到 ${selectedNodes.length} 个节点\n\n💾 配置已自动保存到本地存储\n📥 请在完成所有素材添加后，点击顶部「保存到文件」按钮下载配置`);

    // 保存到本地存储
    savePersistedData();

    currentUploadedAsset = null;
    document.getElementById('assetNodeSelectorSection').style.display = 'none';
    document.getElementById('loopSettings').style.display = 'none';
    document.getElementById('videoMuteSettings').style.display = 'none';
    document.getElementById('positionSettings').style.display = 'none';
    document.getElementById('uploadedAssetName').textContent = '';
    document.getElementById('assetFileInput').value = '';

    renderAssetList();
    updateAssetCount();
    if (currentEditingNodeId) {
        renderEditor(currentEditingNodeId);
    }
}

function renderAssetList() {
    const container = document.getElementById('assetListContainer');

    let filteredAssets = Object.keys(assetDatabase);
    if (currentAssetFilter !== 'all') {
        filteredAssets = filteredAssets.filter(id => assetDatabase[id].type === currentAssetFilter);
    }
    
    if (filteredAssets.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: rgba(200, 210, 230, 0.5);">暂无配置的素材</div>';
        return;
    }

    container.innerHTML = filteredAssets.map(assetId => {
        const asset = assetDatabase[assetId];
        const typeLabel = asset.type === 'scene' ? '🌆' : asset.type === 'character' ? '👤' : '📦';
        const typeClass = asset.type === 'scene' ? 'scene' : asset.type === 'character' ? 'character' : 'prop';
        
        let previewHTML = '';
        if (asset.file) {
            if (asset.fileType === 'video') {
                previewHTML = `<video src="${asset.file}" style="width: 100%; height: 100%; object-fit: cover;" muted></video>`;
            } else {
                previewHTML = `<img src="${asset.file}" alt="${asset.name}">`;
            }
        }

        return `
            <div class="asset-item">
                <div class="asset-item-preview">
                    <div class="asset-preview">
                        ${previewHTML || '<div style="width:120px;height:120px;background:rgba(100,150,200,0.2);display:flex;align-items:center;justify-content:center;color:rgba(150,170,200,0.5);">无预览</div>'}
                    </div>
                </div>
                <div class="asset-item-content">
                    <div class="asset-item-header">
                        <span class="asset-name">
                            ${typeLabel} ${asset.name}
                            <span class="asset-type-badge asset-type-${typeClass}">${typeClass === 'scene' ? '场景' : typeClass === 'character' ? '人物' : '道具'}</span>
                        </span>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-small btn-primary" onclick="editAsset('${assetId}')">编辑</button>
                            <button class="btn btn-small btn-danger" onclick="deleteAsset('${assetId}')">删除</button>
                        </div>
                    </div>
                    <div class="asset-nodes">
                        ${asset.nodes.length} 个节点
                        ${asset.position ? `<br>位置: ${asset.position.x}%, ${asset.position.y}%` : ''}
                        ${asset.size ? `<br>大小: ${asset.size.width}% × ${asset.size.height}%` : ''}
                        ${asset.loopCount !== undefined && asset.loopCount !== -1 ? `<br>循环: ${asset.loopCount}次` : ''}
                        ${asset.muted ? '<br>🔇 已静音' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function editAsset(assetId) {
    const asset = assetDatabase[assetId];
    if (!asset) return;

    currentUploadedAsset = JSON.parse(JSON.stringify(asset));
    currentUploadedAsset.isEditing = true;

    const typeLabel = asset.type === 'scene' ? '场景' : asset.type === 'character' ? '人物' : '道具';
    const fileType = asset.fileType === 'video' ? '视频' : '图片';
    document.getElementById('uploadedAssetName').textContent = `✏️ 正在编辑: ${asset.name} (${typeLabel} - ${fileType})`;

    const isAnimated = asset.fileType === 'video' || (asset.name && asset.name.match(/\.gif$/i));
    if (isAnimated) {
        document.getElementById('loopSettings').style.display = 'block';
        document.getElementById('loopCountSelect').value = asset.loopCount || '-1';
    } else {
        document.getElementById('loopSettings').style.display = 'none';
    }

    if (asset.fileType === 'video') {
        document.getElementById('videoMuteSettings').style.display = 'block';
        document.getElementById('videoMuteSelect').value = asset.muted ? 'true' : 'false';
    } else {
        document.getElementById('videoMuteSettings').style.display = 'none';
    }

    if (asset.type === 'character' || asset.type === 'prop') {
        document.getElementById('positionSettings').style.display = 'block';
        
        const pos = asset.position || { x: 50, y: asset.type === 'character' ? 80 : 50 };
        document.getElementById('positionX').value = pos.x;
        document.getElementById('positionXValue').textContent = `${pos.x}%`;
        document.getElementById('positionY').value = pos.y;
        document.getElementById('positionYValue').textContent = `${pos.y}%`;
        
        const size = asset.size || { width: 100, height: 100 };
        document.getElementById('assetWidth').value = size.width;
        document.getElementById('assetWidthValue').textContent = `${size.width}%`;
        document.getElementById('assetHeight').value = size.height;
        document.getElementById('assetHeightValue').textContent = `${size.height}%`;
        
        renderPositionHistory();
        updatePositionPreview();
    } else {
        document.getElementById('positionSettings').style.display = 'none';
    }

    document.getElementById('assetNodeSelectorSection').style.display = 'block';
    renderAssetNodeCheckboxList();
}

function deleteAsset(assetId) {
    if (!confirm('确定要删除这个素材配置吗？\n相关节点的素材设置也会被清除。')) return;

    const asset = assetDatabase[assetId];

    if (asset && asset.nodes) {
        const fieldName = asset.type + 's';
        asset.nodes.forEach(nodeId => {
            if (storyDataCopy[nodeId] && Array.isArray(storyDataCopy[nodeId][fieldName])) {
                const index = storyDataCopy[nodeId][fieldName].indexOf(assetId);
                if (index > -1) {
                    storyDataCopy[nodeId][fieldName].splice(index, 1);
                }
            }
        });
    }

    delete assetDatabase[assetId];

    renderAssetList();
    updateAssetCount();
    if (currentEditingNodeId) {
        renderEditor(currentEditingNodeId);
    }

    alert('素材已删除');
}

function filterAssets(type) {
    currentAssetFilter = type;
    updateFilterButtons();
    renderAssetList();
}

function updateFilterButtons() {
    ['filterAll', 'filterScene', 'filterCharacter', 'filterProp'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });

    const buttonMap = {
        'all': 'filterAll',
        'scene': 'filterScene',
        'character': 'filterCharacter',
        'prop': 'filterProp'
    };

    document.getElementById(buttonMap[currentAssetFilter]).classList.add('active');
}

function updateAssetCount() {
    document.getElementById('assetCount').textContent = Object.keys(assetDatabase).length;
}

// ==================== 素材预览功能 ====================
function openPreviewModal() {
    document.getElementById('previewModal').classList.add('active');
    populatePreviewNodeSelect();
    updatePreview();
}

function closePreviewModal() {
    document.getElementById('previewModal').classList.remove('active');
    const previewArea = document.getElementById('previewArea');
    previewArea.innerHTML = '<div class="preview-background"><!-- 预览素材会在这里显示 --></div>';
}

function populatePreviewNodeSelect() {
    const select = document.getElementById('previewNodeSelect');
    select.innerHTML = '<option value="">请选择节点</option>';
    
    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        const hasAssets = node.scene || node.scenes || node.character || node.characters || node.prop || node.props;
        if (hasAssets) {
            const typeText = {
                'dialogue': '对话',
                'choice': '选择',
                'ending': '结局'
            }[node.type] || '对话';
            const option = document.createElement('option');
            option.value = nodeId;
            option.textContent = `${nodeId} (${typeText})`;
            select.appendChild(option);
        }
    });
}

function updatePreview() {
    const nodeId = document.getElementById('previewNodeSelect').value;
    const previewArea = document.getElementById('previewArea');
    
    if (!nodeId) {
        previewArea.innerHTML = '<div class="preview-background"><div style="text-align: center; color: rgba(150, 170, 200, 0.5); padding: 50px;">请选择一个节点进行预览</div></div>';
        return;
    }
    
    const node = storyDataCopy[nodeId];
    if (!node) return;
    
    const sceneIds = node.scenes || (node.scene ? [node.scene] : []);
    const characterIds = node.characters || (node.character ? [node.character] : []);
    const propIds = node.props || (node.prop ? [node.prop] : []);
    
    let html = '<div class="preview-background">';
    
    sceneIds.forEach(assetId => {
        const asset = assetDatabase[assetId];
        if (asset) {
            html += getAssetPreviewHTML(asset, 'scene');
        }
    });
    
    characterIds.forEach(assetId => {
        const asset = assetDatabase[assetId];
        if (asset) {
            html += getAssetPreviewHTML(asset, 'character');
        }
    });
    
    propIds.forEach(assetId => {
        const asset = assetDatabase[assetId];
        if (asset) {
            html += getAssetPreviewHTML(asset, 'prop');
        }
    });
    
    html += '</div>';
    previewArea.innerHTML = html;
    
    setTimeout(() => {
        previewArea.querySelectorAll('video').forEach(video => {
            video.play().catch(() => {});
        });
    }, 100);
}

function getAssetPreviewHTML(asset, assetType) {
    const position = asset.position || { x: 50, y: assetType === 'character' ? 80 : 50 };
    
    if (asset.fileType === 'video') {
        return `
            <div class="preview-asset preview-${assetType}" style="left: ${position.x}%; top: ${position.y}%;">
                <video src="${asset.file}" ${asset.muted ? 'muted' : ''} ${asset.loopCount === -1 ? 'loop' : ''} playsinline>
                </video>
                <div class="preview-asset-label">${asset.name}</div>
            </div>
        `;
    } else {
        return `
            <div class="preview-asset preview-${assetType}" style="left: ${position.x}%; top: ${position.y}%;">
                <img src="${asset.file}" alt="${asset.name}">
                <div class="preview-asset-label">${asset.name}</div>
            </div>
        `;
    }
}
