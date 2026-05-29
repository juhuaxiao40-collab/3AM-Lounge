// ==================== 全局变量 ====================
let currentEditingNodeId = null;
let storyDataCopy = JSON.parse(JSON.stringify(storyData)); // 深拷贝数据
let bgmDatabase = {}; // BGM数据库 { bgmId: { name, file, nodes: [] } }
let currentUploadedBGM = null; // 当前上传的BGM临时存储
let assetDatabase = {}; // 素材数据库 { assetId: { name, type, file, nodes: [] } }
let currentUploadedAsset = null; // 当前上传的素材临时存储
let currentAssetFilter = 'all'; // 当前素材筛选类型

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    renderNodeList();
    loadBGMFromStory();
    loadAssetsFromStory();
    updateBGMCount();
    updateAssetCount();
});

// ==================== 从剧情数据加载素材配置 ====================
function loadAssetsFromStory() {
    // 从节点中提取素材信息
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
                    nodes: []
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
                    nodes: []
                };
            }
            if (!assetDatabase[assetId].nodes.includes(nodeId)) {
                assetDatabase[assetId].nodes.push(nodeId);
            }
        }
    });
}

// ==================== 从剧情数据加载BGM配置 ====================
function loadBGMFromStory() {
    // 从节点中提取BGM信息
    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        if (node.bgm) {
            const bgmId = node.bgm;
            if (!bgmDatabase[bgmId]) {
                bgmDatabase[bgmId] = {
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

// ==================== 渲染节点列表 ====================
function renderNodeList() {
    const container = document.getElementById('nodeListContainer');
    container.innerHTML = '';

    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];
        const nodeItem = document.createElement('div');
        nodeItem.className = 'node-item';
        if (currentEditingNodeId === nodeId) {
            nodeItem.classList.add('active');
        }

        const typeClass = node.type || 'dialogue';
        const typeText = {
            'dialogue': '对话',
            'choice': '选择',
            'ending': '结局'
        }[typeClass] || '对话';

        nodeItem.innerHTML = `
            <div class="node-id">${nodeId}</div>
            <span class="node-type ${typeClass}">${typeText}</span>
            <div style="font-size: 12px; color: rgba(200, 210, 230, 0.7); margin-top: 5px;">
                ${node.text ? node.text.substring(0, 30) + '...' : ''}
            </div>
        `;

        nodeItem.onclick = () => {
            currentEditingNodeId = nodeId;
            renderNodeList();
            renderEditor(nodeId);
        };

        container.appendChild(nodeItem);
    });
}

// ==================== 渲染编辑器 ====================
function renderEditor(nodeId) {
    const node = storyDataCopy[nodeId];
    const container = document.getElementById('editorContent');

    if (!node) {
        container.innerHTML = '<div class="empty-state"><p>节点不存在</p></div>';
        return;
    }

    let html = `
        <h2>编辑节点: ${nodeId}</h2>

        <div class="form-group">
            <label>节点ID</label>
            <input type="text" id="edit_id" value="${node.id}" onchange="updateNodeField('id', this.value)">
        </div>

        <div class="form-group">
            <label>节点类型</label>
            <select id="edit_type" onchange="updateNodeType(this.value)">
                <option value="dialogue" ${node.type === 'dialogue' ? 'selected' : ''}>对话 (dialogue)</option>
                <option value="choice" ${node.type === 'choice' ? 'selected' : ''}>选择 (choice)</option>
                <option value="ending" ${node.type === 'ending' ? 'selected' : ''}>结局 (ending)</option>
            </select>
        </div>

        <div class="form-group">
            <label>角色名字</label>
            <input type="text" id="edit_name" value="${node.name || ''}" onchange="updateNodeField('name', this.value)">
        </div>

        <div class="form-group">
            <label>对话内容</label>
            <textarea id="edit_text" onchange="updateNodeField('text', this.value)">${node.text || ''}</textarea>
        </div>
    `;

    // 如果是对话或选择类型，显示下一个节点
    if (node.type === 'dialogue') {
        html += `
            <div class="form-group">
                <label>下一个节点ID</label>
                <input type="text" id="edit_next" value="${node.next || ''}" onchange="updateNodeField('next', this.value)">
                <small style="color: rgba(200, 210, 230, 0.6); display: block; margin-top: 5px;">
                    对话结束后跳转到的节点
                </small>
            </div>
        `;
    }

    // 如果是结局类型，显示结局标题
    if (node.type === 'ending') {
        html += `
            <div class="form-group">
                <label>结局标题</label>
                <input type="text" id="edit_endingTitle" value="${node.endingTitle || ''}" onchange="updateNodeField('endingTitle', this.value)">
            </div>
        `;
    }

    // BGM配置
    html += `
        <div class="form-group">
            <label>背景音乐 (BGM)</label>
            <input type="text" id="edit_bgm" value="${node.bgm || ''}" onchange="updateNodeField('bgm', this.value)" placeholder="输入BGM ID，留空则不播放">
            <small style="color: rgba(200, 210, 230, 0.6); display: block; margin-top: 5px;">
                提示：在BGM管理器中上传音频后会自动生成ID
            </small>
        </div>
    `;

    // 素材配置
    html += `
        <div class="form-group">
            <label>场景素材</label>
            <input type="text" id="edit_scene" value="${node.scene || ''}" onchange="updateNodeField('scene', this.value)" placeholder="输入场景素材ID">
        </div>
        <div class="form-group">
            <label>人物素材</label>
            <input type="text" id="edit_character" value="${node.character || ''}" onchange="updateNodeField('character', this.value)" placeholder="输入人物素材ID">
        </div>
        <div class="form-group">
            <label>道具素材</label>
            <input type="text" id="edit_prop" value="${node.prop || ''}" onchange="updateNodeField('prop', this.value)" placeholder="输入道具素材ID">
        </div>
    `;

    // 如果是选择类型，显示选项编辑器
    if (node.type === 'choice') {
        html += `
            <div class="form-group">
                <label>选项列表</label>
                <div class="choices-editor" id="choicesEditor">
                    ${renderChoicesEditor(node.choices || [])}
                </div>
                <button class="btn btn-small" onclick="addChoice()" style="margin-top: 10px;">➕ 添加选项</button>
            </div>
        `;
    }

    // 预览区域
    html += `
        <div class="preview-section">
            <h3>📋 节点预览</h3>
            <div class="preview-text">
                <strong>${node.name || '未命名'}：</strong>${node.text || '无内容'}
            </div>
            ${renderNodeConnections(node)}
        </div>
    `;

    container.innerHTML = html;
}

// ==================== 渲染选项编辑器 ====================
function renderChoicesEditor(choices) {
    if (!choices || choices.length === 0) {
        return '<p style="color: rgba(200, 210, 230, 0.5); text-align: center; padding: 20px;">暂无选项</p>';
    }

    return choices.map((choice, index) => `
        <div class="choice-item">
            <div class="choice-item-header">
                <strong style="color: #a8c0e0;">选项 ${index + 1}</strong>
                <button class="btn btn-small btn-danger" onclick="removeChoice(${index})">删除</button>
            </div>
            <div class="form-group" style="margin-bottom: 10px;">
                <label>选项文本</label>
                <input type="text" value="${choice.text || ''}" onchange="updateChoice(${index}, 'text', this.value)">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>跳转到节点</label>
                <input type="text" value="${choice.next || ''}" onchange="updateChoice(${index}, 'next', this.value)">
            </div>
        </div>
    `).join('');
}

// ==================== 渲染节点连接 ====================
function renderNodeConnections(node) {
    let html = '<div style="margin-top: 15px;"><strong style="color: #a8c0e0;">节点连接：</strong><div class="node-connections">';

    if (node.next) {
        html += `<span class="connection-badge" onclick="jumpToNode('${node.next}')">→ ${node.next}</span>`;
    }

    if (node.choices && node.choices.length > 0) {
        node.choices.forEach(choice => {
            if (choice.next) {
                html += `<span class="connection-badge" onclick="jumpToNode('${choice.next}')">${choice.text.substring(0, 15)}... → ${choice.next}</span>`;
            }
        });
    }

    html += '</div></div>';
    return html;
}

// ==================== 更新节点字段 ====================
function updateNodeField(field, value) {
    if (!currentEditingNodeId) return;

    const node = storyDataCopy[currentEditingNodeId];

    // 如果是修改ID，需要特殊处理
    if (field === 'id' && value !== currentEditingNodeId) {
        // 创建新节点
        storyDataCopy[value] = { ...node, id: value };
        // 删除旧节点
        delete storyDataCopy[currentEditingNodeId];
        // 更新所有引用
        updateAllReferences(currentEditingNodeId, value);
        currentEditingNodeId = value;
        renderNodeList();
        renderEditor(value);
    } else {
        node[field] = value;
        renderNodeList();
    }
}

// ==================== 更新节点类型 ====================
function updateNodeType(newType) {
    if (!currentEditingNodeId) return;

    const node = storyDataCopy[currentEditingNodeId];
    node.type = newType;

    // 根据类型清理不需要的字段
    if (newType === 'dialogue') {
        delete node.choices;
        delete node.endingTitle;
        if (!node.next) node.next = '';
    } else if (newType === 'choice') {
        delete node.endingTitle;
        if (!node.choices) node.choices = [];
    } else if (newType === 'ending') {
        delete node.next;
        delete node.choices;
        if (!node.endingTitle) node.endingTitle = '';
    }

    renderEditor(currentEditingNodeId);
    renderNodeList();
}

// ==================== 更新选项 ====================
function updateChoice(index, field, value) {
    if (!currentEditingNodeId) return;

    const node = storyDataCopy[currentEditingNodeId];
    if (!node.choices || !node.choices[index]) return;

    node.choices[index][field] = value;
}

// ==================== 添加选项 ====================
function addChoice() {
    if (!currentEditingNodeId) return;

    const node = storyDataCopy[currentEditingNodeId];
    if (!node.choices) node.choices = [];

    node.choices.push({
        text: '新选项',
        next: ''
    });

    renderEditor(currentEditingNodeId);
}

// ==================== 删除选项 ====================
function removeChoice(index) {
    if (!currentEditingNodeId) return;
    if (!confirm('确定要删除这个选项吗？')) return;

    const node = storyDataCopy[currentEditingNodeId];
    if (!node.choices) return;

    node.choices.splice(index, 1);
    renderEditor(currentEditingNodeId);
}

// ==================== 跳转到节点 ====================
function jumpToNode(nodeId) {
    if (!storyDataCopy[nodeId]) {
        alert('节点不存在: ' + nodeId);
        return;
    }

    currentEditingNodeId = nodeId;
    renderNodeList();
    renderEditor(nodeId);

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== 更新所有引用 ====================
function updateAllReferences(oldId, newId) {
    Object.keys(storyDataCopy).forEach(nodeId => {
        const node = storyDataCopy[nodeId];

        // 更新 next 字段
        if (node.next === oldId) {
            node.next = newId;
        }

        // 更新 choices 中的引用
        if (node.choices) {
            node.choices.forEach(choice => {
                if (choice.next === oldId) {
                    choice.next = newId;
                }
            });
        }
    });
}

// ==================== 添加新节点 ====================
function addNewNode() {
    const nodeId = prompt('请输入新节点的ID（例如：new_node_1）：');

    if (!nodeId) return;

    if (storyDataCopy[nodeId]) {
        alert('该ID已存在，请使用其他ID');
        return;
    }

    storyDataCopy[nodeId] = {
        id: nodeId,
        type: 'dialogue',
        name: '岚',
        text: '新对话内容',
        next: ''
    };

    currentEditingNodeId = nodeId;
    renderNodeList();
    renderEditor(nodeId);
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

    // 检查文件类型
    if (!file.name.endsWith('.json')) {
        alert('请选择JSON文件！');
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // 验证数据格式
            if (typeof importedData !== 'object' || importedData === null) {
                throw new Error('JSON格式不正确');
            }

            // 验证是否包含有效的节点
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

            // 确认导入
            if (confirm('确定要导入这个JSON文件吗？\n当前的编辑内容将被替换！\n\n文件包含 ' + Object.keys(importedData).length + ' 个节点。')) {
                storyDataCopy = importedData;
                currentEditingNodeId = null;
                renderNodeList();

                // 清空编辑器
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

    // 重置文件输入，允许重复导入同一文件
    event.target.value = '';
}

// ==================== 保存到文件 ====================
function saveStory() {
    const jsContent = `// ==================== 剧情数据结构 ====================
// 每个剧情节点包含：
// - id: 节点唯一标识
// - type: 'dialogue'(对话) 或 'choice'(选择) 或 'ending'(结局)
// - name: 说话角色名字
// - text: 对话内容
// - next: 下一个节点id
// - choices: 选项数组（仅type为'choice'时使用）
// - bgm: 背景音乐ID（可选）
// - scene: 场景素材ID（可选）
// - character: 人物素材ID（可选）
// - prop: 道具素材ID（可选）

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

// 打开BGM管理器
function openBGMManager() {
    document.getElementById('bgmModal').classList.add('active');
    renderBGMList();
}

// 关闭BGM管理器
function closeBGMManager() {
    document.getElementById('bgmModal').classList.remove('active');
    currentUploadedBGM = null;
    document.getElementById('nodeSelectorSection').style.display = 'none';
    document.getElementById('uploadedFileName').textContent = '';
}

// 处理BGM文件上传
function handleBGMUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|ogg|wav)$/i)) {
        alert('请上传有效的音频文件（MP3, OGG, WAV）');
        return;
    }

    // 读取文件为Base64
    const reader = new FileReader();
    reader.onload = function(e) {
        const bgmId = 'bgm_' + Date.now();
        currentUploadedBGM = {
            id: bgmId,
            name: file.name,
            file: e.target.result, // Base64数据
            nodes: []
        };

        document.getElementById('uploadedFileName').textContent = `✅ 已选择: ${file.name}`;
        document.getElementById('nodeSelectorSection').style.display = 'block';
        renderNodeCheckboxList();
    };

    reader.onerror = function() {
        alert('文件读取失败，请重试');
    };

    reader.readAsDataURL(file);
}

// 渲染节点复选框列表
function renderNodeCheckboxList() {
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

// 全选节点
function selectAllNodes() {
    const checkboxes = document.querySelectorAll('#nodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

// 取消全选
function deselectAllNodes() {
    const checkboxes = document.querySelectorAll('#nodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// 保存BGM分配
function saveBGMAssignment() {
    if (!currentUploadedBGM) {
        alert('请先上传BGM文件');
        return;
    }

    // 获取选中的节点
    const checkboxes = document.querySelectorAll('#nodeCheckboxList input[type="checkbox"]:checked');
    const selectedNodes = Array.from(checkboxes).map(cb => cb.value);

    if (selectedNodes.length === 0) {
        alert('请至少选择一个节点');
        return;
    }

    currentUploadedBGM.nodes = selectedNodes;

    // 保存到BGM数据库
    bgmDatabase[currentUploadedBGM.id] = currentUploadedBGM;

    // 更新节点的BGM字段
    selectedNodes.forEach(nodeId => {
        if (storyDataCopy[nodeId]) {
            storyDataCopy[nodeId].bgm = currentUploadedBGM.id;
        }
    });

    alert(`✅ BGM配置成功！\n已应用到 ${selectedNodes.length} 个节点`);

    // 重置状态
    currentUploadedBGM = null;
    document.getElementById('nodeSelectorSection').style.display = 'none';
    document.getElementById('uploadedFileName').textContent = '';
    document.getElementById('bgmFileInput').value = '';

    // 刷新显示
    renderBGMList();
    updateBGMCount();
    if (currentEditingNodeId) {
        renderEditor(currentEditingNodeId);
    }
}

// 渲染BGM列表
function renderBGMList() {
    const container = document.getElementById('bgmListContainer');

    if (Object.keys(bgmDatabase).length === 0) {
        container.innerHTML = '<p style="color: rgba(200, 210, 230, 0.5); text-align: center; padding: 20px;">暂无BGM配置</p>';
        return;
    }

    container.innerHTML = '';

    Object.keys(bgmDatabase).forEach(bgmId => {
        const bgm = bgmDatabase[bgmId];
        const item = document.createElement('div');
        item.className = 'bgm-item';

        item.innerHTML = `
            <div class="bgm-item-header">
                <div>
                    <div class="bgm-name">🎵 ${bgm.name}</div>
                    <div class="bgm-nodes">应用于 ${bgm.nodes.length} 个节点: ${bgm.nodes.join(', ')}</div>
                </div>
                <button class="btn btn-small btn-danger" onclick="deleteBGM('${bgmId}')">删除</button>
            </div>
        `;

        container.appendChild(item);
    });
}

// 删除BGM
function deleteBGM(bgmId) {
    if (!confirm('确定要删除这个BGM配置吗？\n相关节点的BGM设置也会被清除。')) return;

    const bgm = bgmDatabase[bgmId];

    // 清除节点中的BGM引用
    if (bgm && bgm.nodes) {
        bgm.nodes.forEach(nodeId => {
            if (storyDataCopy[nodeId]) {
                delete storyDataCopy[nodeId].bgm;
            }
        });
    }

    // 从数据库删除
    delete bgmDatabase[bgmId];

    // 刷新显示
    renderBGMList();
    updateBGMCount();
    if (currentEditingNodeId) {
        renderEditor(currentEditingNodeId);
    }

    alert('BGM已删除');
}

// 更新BGM计数
function updateBGMCount() {
    document.getElementById('bgmCount').textContent = Object.keys(bgmDatabase).length;
}

// ==================== 素材管理功能 ====================

// 打开素材管理器
function openAssetManager() {
    document.getElementById('assetModal').classList.add('active');
    currentAssetFilter = 'all';
    updateFilterButtons();
    renderAssetList();
}

// 关闭素材管理器
function closeAssetManager() {
    document.getElementById('assetModal').classList.remove('active');
    currentUploadedAsset = null;
    document.getElementById('assetNodeSelectorSection').style.display = 'none';
    document.getElementById('uploadedAssetName').textContent = '';
}

// 处理素材文件上传
function handleAssetUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 检查文件类型
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type) || file.name.match(/\.(mp4|webm|ogv|mov)$/i);
    const isAnimated = isVideo || file.name.match(/\.gif$/i); // GIF或视频

    if (!isImage && !isVideo) {
        alert('请上传有效的图片或视频文件（图片: JPG, PNG, GIF, WebP | 视频: MP4, WebM, OGV, MOV）');
        return;
    }

    // 检查文件大小（图片限制5MB，视频限制50MB）
    const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
        alert(`${isVideo ? '视频' : '图片'}文件不能超过${isVideo ? '50MB' : '5MB'}，请压缩后再上传`);
        return;
    }

    // 读取文件为Base64
    const reader = new FileReader();
    reader.onload = function(e) {
        const assetType = document.getElementById('assetTypeSelect').value;
        const assetId = `${assetType}_${Date.now()}`;
        const fileType = isVideo ? 'video' : 'image';

        currentUploadedAsset = {
            id: assetId,
            name: file.name,
            type: assetType,
            file: e.target.result, // Base64数据
            fileType: fileType,
            loopCount: -1, // 默认无限循环
            muted: false, // 默认不静音
            nodes: []
        };

        const typeLabel = assetType === 'scene' ? '场景' : assetType === 'character' ? '人物' : '道具';
        document.getElementById('uploadedAssetName').textContent = `✅ 已选择: ${file.name} (${typeLabel} - ${fileType === 'video' ? '视频' : '图片'})`;
        
        // 显示循环设置（仅视频和GIF）
        if (isAnimated) {
            document.getElementById('loopSettings').style.display = 'block';
            document.getElementById('loopCountSelect').value = '-1';
        } else {
            document.getElementById('loopSettings').style.display = 'none';
            currentUploadedAsset.loopCount = -1;
        }
        
        // 显示静音设置（仅视频）
        if (isVideo) {
            document.getElementById('videoMuteSettings').style.display = 'block';
            document.getElementById('videoMuteSelect').value = 'false';
        } else {
            document.getElementById('videoMuteSettings').style.display = 'none';
            currentUploadedAsset.muted = false;
        }
        
        document.getElementById('assetNodeSelectorSection').style.display = 'block';
        renderAssetNodeCheckboxList();
    };

    reader.onerror = function() {
        alert('文件读取失败，请重试');
    };

    reader.readAsDataURL(file);
}

// 渲染素材节点复选框列表
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

// 全选节点（素材）
function selectAllNodesForAsset() {
    const checkboxes = document.querySelectorAll('#assetNodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
}

// 取消全选（素材）
function deselectAllNodesForAsset() {
    const checkboxes = document.querySelectorAll('#assetNodeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// 保存素材分配
function saveAssetAssignment() {
    if (!currentUploadedAsset) {
        alert('请先上传素材文件');
        return;
    }

    // 获取选中的节点
    const checkboxes = document.querySelectorAll('#assetNodeCheckboxList input[type="checkbox"]:checked');
    const selectedNodes = Array.from(checkboxes).map(cb => cb.value);

    if (selectedNodes.length === 0) {
        alert('请至少选择一个节点');
        return;
    }

    // 获取循环次数设置
    const loopCountSelect = document.getElementById('loopCountSelect');
    if (loopCountSelect && loopCountSelect.style.display !== 'none') {
        currentUploadedAsset.loopCount = parseInt(loopCountSelect.value);
    }

    // 获取静音设置
    const videoMuteSelect = document.getElementById('videoMuteSelect');
    if (videoMuteSelect && videoMuteSelect.style.display !== 'none') {
        currentUploadedAsset.muted = videoMuteSelect.value === 'true';
    }

    currentUploadedAsset.nodes = selectedNodes;

    // 保存到素材数据库
    assetDatabase[currentUploadedAsset.id] = currentUploadedAsset;

    // 更新节点的素材字段（支持叠加多个素材）
    const assetType = currentUploadedAsset.type;
    const fieldName = assetType + 's'; // 'scenes', 'characters', 'props'

    selectedNodes.forEach(nodeId => {
        if (storyDataCopy[nodeId]) {
            // 如果字段不存在，初始化为数组
            if (!storyDataCopy[nodeId][fieldName]) {
                storyDataCopy[nodeId][fieldName] = [];
            }
            // 如果是数组，添加新素材（避免重复）
            if (Array.isArray(storyDataCopy[nodeId][fieldName])) {
                if (!storyDataCopy[nodeId][fieldName].includes(currentUploadedAsset.id)) {
                    storyDataCopy[nodeId][fieldName].push(currentUploadedAsset.id);
                }
            } else {
                // 如果是旧格式（单个ID），转换为数组
                const oldId = storyDataCopy[nodeId][fieldName];
                storyDataCopy[nodeId][fieldName] = [oldId, currentUploadedAsset.id];
            }
        }
    });

    const typeText = assetType === 'scene' ? '场景' : assetType === 'character' ? '人物' : '道具';
    const loopInfo = currentUploadedAsset.loopCount === -1 ? '（无限循环）' : `（循环${currentUploadedAsset.loopCount}次）`;
    const muteInfo = currentUploadedAsset.muted ? '（已静音）' : '';
    alert(`✅ ${typeText}素材配置成功！${loopInfo}${muteInfo}\n已应用到 ${selectedNodes.length} 个节点`);

    // 重置状态
    currentUploadedAsset = null;
    document.getElementById('assetNodeSelectorSection').style.display = 'none';
    document.getElementById('loopSettings').style.display = 'none';
    document.getElementById('videoMuteSettings').style.display = 'none';
    document.getElementById('uploadedAssetName').textContent = '';
    document.getElementById('assetFileInput').value = '';

    // 刷新显示
    renderAssetList();
    updateAssetCount();
    if (currentEditingNodeId) {
        renderEditor(currentEditingNodeId);
    }
}

// 渲染素材列表
function renderAssetList() {
    const container = document.getElementById('assetListContainer');

    // 筛选素材
    let filteredAssets = Object.keys(assetDatabase);
    if (currentAssetFilter !== 'all') {
        filteredAssets = filteredAssets.filter(assetId => assetDatabase[assetId].type === currentAssetFilter);
    }

    if (filteredAssets.length === 0) {
        container.innerHTML = '<p style="color: rgba(200, 210, 230, 0.5); text-align: center; padding: 20px;">暂无素材配置</p>';
        return;
    }

    container.innerHTML = '';

    filteredAssets.forEach(assetId => {
        const asset = assetDatabase[assetId];
        const item = document.createElement('div');
        item.className = 'asset-item';

        const typeText = asset.type === 'scene' ? '场景' : asset.type === 'character' ? '人物' : '道具';
        const typeIcon = asset.type === 'scene' ? '🌆' : asset.type === 'character' ? '👤' : '📦';
        const typeBadgeClass = `asset-type-${asset.type}`;
        const isVideo = asset.fileType === 'video';

        // 生成节点标签
        const nodeBadges = asset.nodes.map(nodeId => `<span class="node-badge">${nodeId}</span>`).join('');

        // 预览内容
        let previewContent;
        if (isVideo) {
            previewContent = `
                <video src="${asset.file}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(150, 170, 200, 0.3);" controls preload="metadata">
                    您的浏览器不支持视频预览
                </video>
            `;
        } else {
            previewContent = asset.file ? `<img src="${asset.file}" alt="${asset.name}">` : '<div style="width: 120px; height: 120px; background: rgba(100, 100, 100, 0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: rgba(200, 200, 200, 0.5);">无预览</div>';
        }

        // 循环次数显示
        const isAnimated = isVideo || asset.name.match(/\.gif$/i);
        const loopCount = asset.loopCount || -1;
        const loopText = loopCount === -1 ? '🔄 无限循环' : `🔄 循环${loopCount}次`;
        const loopBadge = isAnimated ? `<span class="asset-type-badge" style="background: rgba(100, 200, 150, 0.3); color: #90ee90;">${loopText}</span>` : '';

        item.innerHTML = `
            <div class="asset-item-preview">
                ${previewContent}
            </div>
            <div class="asset-item-content">
                <div class="asset-item-header">
                    <div class="asset-name">
                        ${typeIcon} ${asset.name}
                        <span class="asset-type-badge ${typeBadgeClass}">${typeText}</span>
                        ${isVideo ? '<span class="asset-type-badge" style="background: rgba(255, 100, 100, 0.3); color: #ff6b6b;">🎬 视频</span>' : ''}
                        ${asset.name.match(/\.gif$/i) ? '<span class="asset-type-badge" style="background: rgba(255, 200, 100, 0.3); color: #ffd700;">🎨 GIF</span>' : ''}
                        ${loopBadge}
                    </div>
                    <button class="btn btn-small btn-danger" onclick="deleteAsset('${assetId}')">删除</button>
                </div>
                <div class="asset-nodes">
                    应用于 ${asset.nodes.length} 个节点:<br>
                    ${nodeBadges}
                </div>
            </div>
        `;

        container.appendChild(item);
    });
}

// 删除素材
function deleteAsset(assetId) {
    if (!confirm('确定要删除这个素材配置吗？\n相关节点的素材设置也会被清除。')) return;

    const asset = assetDatabase[assetId];

    // 清除节点中的素材引用
    if (asset && asset.nodes) {
        const fieldName = asset.type; // 'scene', 'character', 'prop'
        asset.nodes.forEach(nodeId => {
            if (storyDataCopy[nodeId]) {
                delete storyDataCopy[nodeId][fieldName];
            }
        });
    }

    // 从数据库删除
    delete assetDatabase[assetId];

    // 刷新显示
    renderAssetList();
    updateAssetCount();
    if (currentEditingNodeId) {
        renderEditor(currentEditingNodeId);
    }

    alert('素材已删除');
}

// 筛选素材
function filterAssets(type) {
    currentAssetFilter = type;
    updateFilterButtons();
    renderAssetList();
}

// 更新筛选按钮状态
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

// 更新素材计数
function updateAssetCount() {
    document.getElementById('assetCount').textContent = Object.keys(assetDatabase).length;
}
