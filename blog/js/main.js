// js/main.js

// --- State Management ---
let zIndexCounter = 100;
let folderHistory = ['desktop'];
let allPosts = []; // 기존 posts 객체를 빈 배열로 대체
let safariState = { lastCategory: null, lastScrollPosition: 0 }; // 이 줄을 새로 추가!
let isDragging = false;
let isResizing = false; // 리사이징 상태 변수 추가
let currentWindow = null;
let dragOffsetX, dragOffsetY;
let initialWidth, initialHeight, initialMouseX, initialMouseY; // 리사이징을 위한 변수들 추가
let resizeDirection = ''; // 리사이징 방향을 저장할 변수 추가

// js/main.js

// --- 앱 초기화 ---
// main.js 파일의 document.addEventListener('DOMContentLoaded', ...) 안쪽을 수정합니다.

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./posts.json');
        const data = await response.json();
        allPosts = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        updateTime();
        setInterval(updateTime, 10000);

        // ▼▼▼ 각 창에 마우스 리스너를 추가하는 코드를 다시 추가(복구)합니다. ▼▼▼
        document.querySelectorAll('.window').forEach(win => {
            win.addEventListener('mousemove', handleWindowMouseMove);
            win.addEventListener('mouseleave', handleWindowMouseLeave);
        });

        document.addEventListener('mousedown', onInteractionStart);
        // ▼▼▼ 이벤트 핸들러를 다시 'onInteractionMove'로 변경합니다. ▼▼▼
        document.addEventListener('mousemove', onInteractionMove);
        document.addEventListener('touchmove', onInteractionMove, { passive: false });
        // ▲▲▲ 위 2줄을 변경합니다. ▲▲▲
        document.addEventListener('mouseup', onInteractionEnd);
        
    } catch (error) {
        console.error("블로그 글 목록을 불러오는 데 실패했습니다:", error);
        showNotification("Error: Could not load blog posts.");
    }
});


// --- Safari (Blog) Logic 수정 ---
async function showPost(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    try {
        const response = await fetch(post.path);
        const markdownContent = await response.text();
        const htmlContent = marked.parse(markdownContent); // marked.js로 파싱

        document.getElementById('safari-title').textContent = post.title;
        document.getElementById('blog-home').style.display = 'none';
        
        document.querySelectorAll('.blog-post').forEach(el => el.remove());
        
        const postEl = document.createElement('div');
        postEl.className = 'blog-post active';
        postEl.innerHTML = `
            <h2>${post.title}</h2>
            <div class="blog-post-meta">${post.date} | ${getCategoryProps(post.category).title}</div>
            <div class="blog-post-content">${htmlContent}</div>
        `;
        document.getElementById('blog-content').appendChild(postEl);

    } catch (error) {
        console.error("포스트를 불러오는 데 실패했습니다:", error);
        showNotification("Error: Could not load the post.");
    }
}

function safariGoBack() {
    showHome(safariState.lastCategory);
    setTimeout(() => {
        document.getElementById('blog-content').scrollTop = safariState.lastScrollPosition;
    }, 0);
}

function updatePostList(filterCategory = null) {
     const postList = document.getElementById('post-list');
     postList.innerHTML = '';
     
     const filteredPosts = allPosts.filter(p => !filterCategory || p.category === filterCategory);

     filteredPosts.forEach(post => {
         const li = document.createElement('div');
         li.className = 'post-list-item';
        //  li.onclick = () => showPost(post.id); // 인덱스 대신 고유 ID를 사용
         li.onclick = () => {
             // 1. 현재 카테고리와 스크롤 위치를 저장합니다.
             const contentArea = document.getElementById('blog-content');
             safariState.lastCategory = filterCategory;
             safariState.lastScrollPosition = contentArea.scrollTop;

             // 2. 그 다음, 글 보기 화면으로 이동합니다.
             showPost(post.id);
         };
         li.innerHTML = `
             <div class="post-list-title">${post.title}</div>
             <div class="post-list-meta">${post.date} | ${getCategoryProps(post.category).title}</div>
         `;
         postList.appendChild(li);
     });
}

// --- Folder (Finder) Logic 수정 ---
function updateFolderContent(category) {
    const { title, path } = getCategoryProps(category);
    document.getElementById('folder-title').textContent = title;
    document.getElementById('folder-path').textContent = path;
    const folderContent = document.getElementById('folder-content');
    folderContent.innerHTML = '';

    const items = (category === 'desktop') 
        ? [
            { name: 'Tech Blog', icon: '📁', type: 'folder', category: 'tech' },
            { name: 'Life Blog', icon: '📁', type: 'folder', category: 'life' },
        ]
        : allPosts
            .filter(post => post.category === category)
            .map(post => ({
                name: post.title,
                icon: '📄',
                type: 'file',
                action: () => openSafari(post.id) // 이렇게!
            }));
    
    // (기존 코드와 동일)
    if (items.length === 0) {
         folderContent.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #888; margin-top: 40px;">Folder is empty</div>`;
    } else {
         items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'folder-item';
            itemEl.innerHTML = `<div class="folder-item-icon">${item.icon}</div><div class="folder-item-name">${item.name}</div>`;
            itemEl.ondblclick = item.type === 'folder' ? () => navigateToFolder(item.category) : item.action;
            folderContent.appendChild(itemEl);
        });
    }
}



// --- "savePost" 기능에 대한 현실적인 대안 ---
// 클라이언트 측 JS는 서버에 파일을 쓸 수 없습니다.
// 대안 1: 작성한 내용을 .md 파일로 다운로드하게 하기
function savePost() {
    const editor = document.getElementById('post-editor');
    const content = editor.value.trim();
    if (!content) {
        showNotification('Content is empty!');
        return;
    }

    // 파일 이름 생성을 위한 간단한 로직 (예: title-slug.md)
    const titleLine = content.split('\n').find(l => l.toLowerCase().startsWith('title:')) || 'Title: new-post';
    const title = titleLine.substring(6).trim();
    const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

    // 다운로드용 Blob 생성
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    
    // 다운로드 링크 생성 및 클릭
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`'${fileName}'이 다운로드되었습니다. 서버의 posts 폴더에 업로드하고 posts.json을 업데이트해주세요.`);
    editor.value = '';
}

// --- Window Management ---
function bringToFront(windowId) {
    const windowEl = document.getElementById(windowId);
    if (windowEl) {
        zIndexCounter++;
        windowEl.style.zIndex = zIndexCounter;
    }
}

function openWindow(windowId) {
    const win = document.getElementById(windowId);
    win.classList.add('active');
    win.classList.remove('minimized');
    bringToFront(windowId);
    const dockIcon = document.querySelector(`.dock-icon[data-app='${windowId}']`);
    if (dockIcon) dockIcon.classList.add('running');
}

const openSafari = (postId = null) => {
    openWindow('safari-window');
    if (postId) {
        // postId가 있으면 바로 해당 포스트를 보여줍니다.
        showPost(postId);
    } else {
        // postId가 없으면(null) 홈 화면을 보여줍니다. (Dock에서 클릭 시)
        showHome();
    }
};
const openTextEdit = () => openWindow('textedit-window');
const openFolder = (category) => {
    openWindow('folder-window');
    navigateToFolder(category);
};
const openFinder = () => {
    openWindow('folder-window');
    folderHistory = ['desktop'];
    navigateToFolder('desktop');
};

function closeWindow(windowId) {
    document.getElementById(windowId).classList.remove('active');
    const dockIcon = document.querySelector(`.dock-icon[data-app='${windowId}']`);
    if (dockIcon) dockIcon.classList.remove('running');
}

function minimizeWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    windowEl.classList.add('minimized');
    setTimeout(() => {
        windowEl.classList.remove('active');
    }, 300);
}

function maximizeWindow(windowId) {
    const win = document.getElementById(windowId);
    win.classList.toggle('maximized');
    if (win.classList.contains('maximized')) {
         win.style.width = '100%';
         win.style.height = `calc(100% - 23px)`;
         win.style.top = '23px';
         win.style.left = '0';
    } else {
        win.style.width = '';
        win.style.height = '';
        win.style.top = '';
        win.style.left = '';
    }
}

// --- Folder (Finder) Logic ---
function navigateToFolder(category) {
    if (folderHistory[folderHistory.length - 1] !== category) {
         folderHistory.push(category);
    }
    updateFolderContent(category);
    updateFolderBackButton();
}

function folderGoBack() {
    if (folderHistory.length > 1) {
        folderHistory.pop();
        const previousLocation = folderHistory[folderHistory.length - 1];
        updateFolderContent(previousLocation);
        updateFolderBackButton();
    }
}

function updateFolderBackButton() {
    const backBtn = document.getElementById('folder-back-btn');
    backBtn.classList.toggle('active', folderHistory.length > 1);
}

function getCategoryProps(category) {
     const props = {
        tech: { title: 'Tech Blog', path: '/Desktop/Tech Blog' },
        life: { title: 'Life Blog', path: '/Desktop/Life Blog' },
        desktop: { title: 'Desktop', path: '/Desktop' }
    };
    return props[category] || props.desktop;
}

// --- Safari (Blog) Logic ---
function parsePostContent(content) {
    return content
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/__(.*?)__/g, '<u>$1</u>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>');
}

function showCategory(category) {
    showHome(category);
    document.getElementById('safari-title').textContent = `${getCategoryProps(category).title} - My Blog`;
     // Update active bookmark
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.toggle('active', item.textContent.toLowerCase() === category);
    });
}

function showHome(filterCategory = null) {
    document.getElementById('safari-title').textContent = 'My Blog';
    document.querySelectorAll('.blog-post').forEach(el => el.remove());
    document.getElementById('blog-home').style.display = 'block';
    updatePostList(filterCategory);

    // Update active bookmark
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.toggle('active', !filterCategory && item.textContent === 'Home');
        if (filterCategory) {
            item.classList.toggle('active', item.textContent.toLowerCase() === filterCategory);
        }
    });
}

// --- Utilities ---
function showNotification(message) {
    const notification = document.getElementById('notification-area');
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' +
                       now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    document.querySelector('.menu-time').textContent = timeString;
}

// --- Event Listeners for Dragging ---
function onInteractionStart(e) {
    const target = e.target;
    currentWindow = target.closest('.window');
    if (!currentWindow || !currentWindow.classList.contains('active')) return;

    const event = e.touches ? e.touches[0] : e;
    bringToFront(currentWindow.id);

    // 리사이즈 시작 지점을 감지하는 로직을 완전히 변경합니다.
    if (target.classList.contains('resize-grip')) {
        isResizing = true;
        resizeDirection = 'se'; // 리사이즈 방향은 항상 남동(se)입니다.
        
        const rect = currentWindow.getBoundingClientRect();
        initialWidth = rect.width;
        initialHeight = rect.height;
        initialMouseX = event.clientX;
        initialMouseY = event.clientY;
        e.preventDefault();
        
    } else if (target.closest('.window-header')) {
        isDragging = true;
        const rect = currentWindow.getBoundingClientRect();
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
    }
    currentWindow.style.transition = 'none';
}


function onInteractionMove(e) {
    const event = e.touches ? e.touches[0] : e;
    if (isResizing && currentWindow) {
        const dx = event.clientX - initialMouseX;
        const dy = event.clientY - initialMouseY;
        
        // 남동(se) 방향 리사이즈 로직만 남깁니다.
        const newWidth = Math.max(320, initialWidth + dx);
        const newHeight = Math.max(200, initialHeight + dy);

        currentWindow.style.width = newWidth + 'px';
        currentWindow.style.height = newHeight + 'px';
        e.preventDefault();

    } else if (isDragging && currentWindow) {
        let newLeft = event.clientX - dragOffsetX;
        let newTop = event.clientY - dragOffsetY;
        newTop = Math.max(23, newTop);
        currentWindow.style.left = `${newLeft}px`;
        currentWindow.style.top = `${newTop}px`;
        e.preventDefault();
    }
}

function onInteractionEnd() {
    if (currentWindow) currentWindow.style.transition = '';
    isDragging = false;
    isResizing = false;
    currentWindow = null;
}

function handleWindowMouseMove(e) {
    if (isDragging || isResizing) return;
    const windowEl = e.currentTarget;
    if (!windowEl.classList.contains('active')) return;

    // 가장자리 리사이즈 커서 로직을 삭제하고, 헤더의 'move' 커서만 남깁니다.
    if (e.target.closest('.window-header')) {
        windowEl.style.cursor = 'move';
    } else if (windowEl.style.cursor === 'move') {
        // 헤더 밖으로 나가면 기본 커서로 변경합니다.
        windowEl.style.cursor = 'default';
    }
}


function handleWindowMouseLeave(e) {
    e.currentTarget.style.cursor = 'default';
}