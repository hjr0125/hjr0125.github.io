// js/main.js

// --- State Management ---
let zIndexCounter = 100;
let folderHistory = ['desktop'];
let allPosts = []; // 기존 posts 객체를 빈 배열로 대체
let safariState = { lastCategory: null, lastScrollPosition: 0 }; // 이 줄을 새로 추가!
// js/main.js

// --- 초기화 함수 ---
async function initializeApp() {
    try {
        const response = await fetch('./posts.json');
        const data = await response.json();
        allPosts = data.posts.sort((a,b) => new Date(b.date) - new Date(a.date));

        // 앱 초기화
        updateTime();
        setInterval(updateTime, 10000);
        // 바탕화면 아이콘 설정 등 기존 초기화 코드...
        document.querySelectorAll('.desktop-icon').forEach(icon => {
             icon.addEventListener('dblclick', () => {
                const classList = icon.classList;
                if(classList.contains('folder-icon')) {
                     const category = icon.textContent.includes('Tech') ? 'tech' : 'life';
                     openFolder(category);
                }
             });
        });

    } catch (error) {
        console.error("블로그 글 목록을 불러오는 데 실패했습니다:", error);
        showNotification("Error: Could not load blog posts.");
    }
}


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

// --- 최종 초기화 ---
// DOMContentLoaded 이벤트 리스너에서 initializeApp()을 호출합니다.
document.addEventListener('DOMContentLoaded', initializeApp);

// (기존의 다른 함수들: openWindow, closeWindow, drag-and-drop 로직 등은 대부분 그대로 사용 가능합니다)
// js/main.js 파일 맨 아래에 이어서 붙여넣기

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
let isDragging = false;
let currentWindow = null;
let dragOffsetX, dragOffsetY;

function onDragStart(e) {
    const target = e.target;
    const event = e.touches ? e.touches[0] : e;

    if (target.classList.contains('window-header') || target.closest('.window-header')) {
        currentWindow = target.closest('.window');
        if (!currentWindow) return;

        bringToFront(currentWindow.id);
        isDragging = true;
        
        const rect = currentWindow.getBoundingClientRect();
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        
        currentWindow.style.transition = 'none';
    }
}

function onDrag(e) {
    if (isDragging && currentWindow) {
        e.preventDefault();
        const event = e.touches ? e.touches[0] : e;

        let newLeft = event.clientX - dragOffsetX;
        let newTop = event.clientY - dragOffsetY;
        
        const minTop = 23;
        newTop = Math.max(minTop, newTop);
        
        currentWindow.style.left = `${newLeft}px`;
        currentWindow.style.top = `${newTop}px`;
    }
}

function onDragEnd() {
    if (currentWindow) {
        currentWindow.style.transition = '';
    }
    isDragging = false;
    currentWindow = null;
}

document.addEventListener('mousedown', onDragStart);
document.addEventListener('mousemove', onDrag);
document.addEventListener('mouseup', onDragEnd);
document.addEventListener('touchstart', onDragStart, { passive: false });
document.addEventListener('touchmove', onDrag, { passive: false });
document.addEventListener('touchend', onDragEnd);

function safariGoBack() {
    // 1. 저장해둔 마지막 카테고리로 글 목록을 다시 보여줍니다.
    showHome(safariState.lastCategory);

    // 2. DOM이 업데이트된 후, 저장된 스크롤 위치로 이동시킵니다.
    // setTimeout을 사용해 스크롤 위치 복원을 다음 렌더링 사이클로 넘겨 안정성을 높입니다.
    setTimeout(() => {
        document.getElementById('blog-content').scrollTop = safariState.lastScrollPosition;
    }, 0);
}