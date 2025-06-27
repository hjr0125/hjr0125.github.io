// js/main.js

// --- State Management ---
let homeState = {
    category: 'all',
    sort: 'newest',
    page: 1,
};
let safariHistory = []; // Add this new line
let blogCategories = new Map(); // Add this new line
let zIndexCounter = 100;
let folderHistory = ['desktop'];
let allPosts = [];
let safariState = { lastCategory: null, lastScrollPosition: 0 };
let isDragging = false;
let isResizing = false;
let currentWindow = null;
let dragOffsetX, dragOffsetY;
let initialWidth, initialHeight, initialMouseX, initialMouseY;
let resizeDirection = '';

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('./posts.json');
        const data = await response.json();
        allPosts = data.posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Dynamically discover categories
        allPosts.forEach(post => {
            if (!blogCategories.has(post.category)) {
                // Capitalize the first letter for the title
                const title = post.category.charAt(0).toUpperCase() + post.category.slice(1);
                blogCategories.set(post.category, {
                    title: `${title} Blog`,
                    path: `/Desktop/${title} Blog`
                });
            }
        });

        // Dynamically build the UI
        generateDesktopIcons();
        generateBookmarkItems();

        updateTime();
        setInterval(updateTime, 10000);
        
        // ... (the rest of the function remains the same)
        
        showHome(); // Initial load

    } catch (error) {
        console.error("블로그 글 목록을 불러오는 데 실패했습니다:", error);
        showNotification("Error: Could not load blog posts.");
    }
});



// --- Safari (Blog) Logic ---
async function showPost(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    try {
        const response = await fetch(post.path);
        const markdownContent = await response.text();
        const htmlContent = marked.parse(markdownContent);

        document.getElementById('safari-title').textContent = post.title;
        document.getElementById('blog-home').style.display = 'none';
        
        document.querySelectorAll('.blog-post').forEach(el => el.remove());
        
        const postEl = document.createElement('div');
        postEl.className = 'blog-post active';

        // Generate the HTML for the main article and the related posts
        const articleHtml = `
            <h2>${post.title}</h2>
            <div class="blog-post-meta">${post.date} | ${getCategoryProps(post.category).title}</div>
            <div class="blog-post-content">${htmlContent}</div>
        `;
        const relatedPostsHtml = renderRelatedPosts(post.category, post.id);

        // Combine them and set the innerHTML
        postEl.innerHTML = articleHtml + relatedPostsHtml;

        document.getElementById('blog-content').appendChild(postEl);
        document.getElementById('blog-content').scrollTop = 0;

    } catch (error) {
        console.error("포스트를 불러오는 데 실패했습니다:", error);
        showNotification("Error: Could not load the post.");
    }
}

function safariGoBack() {
    if (safariHistory.length > 1) {
        safariHistory.pop();
        const destination = safariHistory[safariHistory.length - 1];

        if (destination === 'home') {
            showHome(true);
        } else if (blogCategories.has(destination)) { // Generic check
            showCategory(destination, true);
        } else {
            showPost(destination);
        }
        
        updateSafariBackButton();
    }
}

function updatePostList(filterCategory = null) {
     const postList = document.getElementById('post-list');
     postList.innerHTML = '';
     
     const filteredPosts = allPosts.filter(p => !filterCategory || p.category === filterCategory);

     filteredPosts.forEach(post => {
         const li = document.createElement('div');
         li.className = 'post-list-item';
         li.onclick = () => {
             const contentArea = document.getElementById('blog-content');
             safariState.lastCategory = filterCategory;
             safariState.lastScrollPosition = contentArea.scrollTop;
             showPost(post.id);
         };
         li.innerHTML = `
             <div class="post-list-title">${post.title}</div>
             <div class="post-list-meta">${post.date} | ${getCategoryProps(post.category).title}</div>
         `;
         postList.appendChild(li);
     });
}

// --- Folder (Finder) Logic ---
function updateFolderContent(category) {
    const props = getCategoryProps(category) || {};
    document.getElementById('folder-title').textContent = props.title || category;
    document.getElementById('folder-path').textContent = props.path || `/Desktop/${category}`;
    const folderContent = document.getElementById('folder-content');
    folderContent.innerHTML = '';

    let items = [];
    if (category === 'desktop') {
        blogCategories.forEach((props, cat) => {
            items.push({ name: props.title, icon: '📁', type: 'folder', category: cat });
        });
    } else {
        items = allPosts
            .filter(post => post.category === category)
            .map(post => ({
                name: post.title,
                icon: '📄',
                type: 'file',
                // THIS IS THE CORRECTED ACTION
                action: () => openSafari(post.id) 
            }));
    }

    if (items.length === 0) {
        folderContent.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #888; margin-top: 40px;">Folder is empty</div>`;
    } else {
        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'folder-item';
            itemEl.innerHTML = `
                <div class="folder-item-icon">${item.icon}</div>
                <div class="folder-item-name">${item.name}</div>
            `;
            
            const eventAction = item.type === 'folder'
                ? () => navigateToFolder(item.category)
                : item.action;

            if (window.innerWidth <= 768) {
                itemEl.onclick = eventAction;
            } else {
                itemEl.ondblclick = eventAction;
            }

            folderContent.appendChild(itemEl);
        });
    }
}



// --- "savePost" (Download) ---
function savePost() {
    const editor = document.getElementById('post-editor');
    const content = editor.value.trim();
    if (!content) {
        showNotification('Content is empty!');
        return;
    }

    const titleLine = content.split('\n').find(l => l.toLowerCase().startsWith('title:')) || 'Title: new-post';
    const title = titleLine.substring(6).trim();
    const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`'${fileName}' downloaded. Please upload it to the posts folder and update posts.json.`);
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
    openWindow('safari-window'); // This makes the Safari window visible and brings it to the front
    if (postId) {
        // When opening a file from the Finder, we start a new navigation path.
        // The "back" button should take the user to the main blog page.
        safariHistory = ['home']; // Set the base of the history to the homepage
        navigateToPost(postId);   // Navigate to the post, which adds it to the history
    } else {
        // If opening Safari with no specific post, just show the home page
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
    if (window.innerWidth <= 768) return;

    const win = document.getElementById(windowId);
    win.classList.toggle('maximized');
    if (win.classList.contains('maximized')) {
         win.style.width = '100%';
         win.style.height = `calc(100% - 23px - 80px)`; // 상단바, 하단 독 높이 제외
         win.style.top = '23px';
         win.style.left = '0';
    } else {
        win.style.width = '';
        win.style.height = '';
        win.style.top = '';
        win.style.left = '';
    }
}


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
    if (blogCategories.has(category)) {
        return blogCategories.get(category);
    }
    // Fallbacks for special cases
    return {
        all: { title: 'All' },
        desktop: { title: 'Desktop', path: '/Desktop' }
    }[category];
}


// --- Safari (Blog) Logic ---
function showCategory(category, fromHistory = false) {
    document.getElementById('blog-home').style.display = 'block';
    document.querySelectorAll('.blog-post').forEach(el => el.remove());

    homeState.category = category;
    homeState.page = 1;
    renderHomepage();

    if (!fromHistory) {
        // This is a new navigation, so reset the history to the category
        safariHistory = [category];
        updateSafariBackButton();
    }

    document.getElementById('safari-title').textContent = getCategoryProps(category).title;
    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.toggle('active', item.textContent.toLowerCase() === category);
    });
}

function showHome(fromHistory = false) {
    document.getElementById('safari-title').textContent = 'My Blog';
    document.querySelectorAll('.blog-post').forEach(el => el.remove());
    document.getElementById('blog-home').style.display = 'block';

    homeState = { category: 'all', sort: 'newest', page: 1 };
    renderHomepage();

    if (!fromHistory) {
        // This is a new navigation, so reset the history to 'home'
        safariHistory = ['home'];
        updateSafariBackButton();
    }

    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.classList.toggle('active', item.textContent === 'Home');
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
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');

    const timeString = `${month}월 ${day}일 (${dayOfWeek}) ${hours}:${minutes}`;
    document.querySelector('.menu-time').textContent = timeString;
}

/// --- Event Listeners for Dragging/Resizing ---

// This function now correctly sets the active window before any other logic.
function onInteractionStart(e) {
    if (window.innerWidth <= 768) return;

    const target = e.target;
    const clickedWindow = target.closest('.window');

    // If no window was clicked, do nothing.
    if (!clickedWindow) {
        currentWindow = null;
        return;
    }
    
    // Set the globally tracked window
    currentWindow = clickedWindow;

    // Bring it to the front immediately
    bringToFront(currentWindow.id);

    const event = e.touches ? e.touches[0] : e;
    isDragging = false;
    isResizing = false;
    
    // Check if the user is trying to resize
    if (target.classList.contains('resize-grip')) {
        isResizing = true;
        const rect = currentWindow.getBoundingClientRect();
        initialWidth = rect.width;
        initialHeight = rect.height;
        initialMouseX = event.clientX;
        initialMouseY = event.clientY;
        e.preventDefault();
    
    // Check if the user is trying to drag from the header
    } else if (target.closest('.window-header')) {
        isDragging = true;
        const rect = currentWindow.getBoundingClientRect();
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        e.preventDefault();
    }
    
    // For performance, remove transitions during drag/resize
    if (isDragging || isResizing) {
        currentWindow.style.transition = 'none';
    }
}


function onInteractionMove(e) {
    if (window.innerWidth <= 768 || !currentWindow) return;

    const event = e.touches ? e.touches[0] : e;
    
    if (isResizing) {
        const dx = event.clientX - initialMouseX;
        const dy = event.clientY - initialMouseY;
        
        currentWindow.style.width = Math.max(320, initialWidth + dx) + 'px';
        currentWindow.style.height = Math.max(200, initialHeight + dy) + 'px';
        e.preventDefault();

    } else if (isDragging) {
        let newLeft = event.clientX - dragOffsetX;
        let newTop = event.clientY - dragOffsetY;
        
        // Constrain the window to the screen
        newTop = Math.max(23, newTop); // Keep it below the menu bar
        
        currentWindow.style.left = `${newLeft}px`;
        currentWindow.style.top = `${newTop}px`;
        e.preventDefault();
    }
}

function onInteractionEnd() {
    if (currentWindow) {
        // Restore transitions when the user lets go
        currentWindow.style.transition = '';
    }
    isDragging = false;
    isResizing = false;
    // Do not reset currentWindow to null here, it's needed for other interactions.
}

// These two functions are no longer needed and have been removed 
// to prevent conflicts. The logic is handled by the main listeners.
// handleWindowMouseMove() - REMOVED
// handleWindowMouseLeave() - REMOVED

// for related posts
// REPLACE the old generatePostListHTML function with this one
function generatePostListHTML(category, currentPostId, page = 1) {
    const relatedPosts = allPosts.filter(p => p.category === category && p.id !== currentPostId);
    const postsPerPage = 5;
    const totalPages = Math.ceil(relatedPosts.length / postsPerPage);

    const startIndex = (page - 1) * postsPerPage;
    const paginatedPosts = relatedPosts.slice(startIndex, startIndex + postsPerPage);

    let listHtml = paginatedPosts.map(post => `
        <div class="related-post-item" onclick="navigateToPost('${post.id}')">
            <div class="related-post-title">${post.title}</div>
            <div class="related-post-meta">${post.date}</div>
        </div>
    `).join('');

    if (paginatedPosts.length === 0) {
        listHtml = '<div style="color: #888; padding: 10px 0;">No other articles in this section.</div>';
    }

    let paginationHtml = '';
    if (totalPages > 1) {
        paginationHtml = `
            <div class="related-pagination">
                <button class="pagination-btn" onclick="updateRelatedPosts('${category}', '${currentPostId}', ${page - 1})" ${page === 1 ? 'disabled' : ''}>
                    Previous
                </button>
                <button class="pagination-btn" onclick="updateRelatedPosts('${category}', '${currentPostId}', ${page + 1})" ${page === totalPages ? 'disabled' : ''}>
                    Next
                </button>
            </div>
        `;
    }

    return `
        <div class="related-post-list">${listHtml}</div>
        ${paginationHtml}
    `;
}

// Add related posts rendering
function renderRelatedPosts(activeCategory, currentPostId) {
    const categories = Array.from(blogCategories.keys()); // Get all categories dynamically
    const tabsHtml = categories.map(cat => {
        const catProps = getCategoryProps(cat);
        return `<div class="related-tab ${cat === activeCategory ? 'active' : ''}" onclick="updateRelatedPosts('${cat}', '${currentPostId}', 1)">${catProps.title.replace(' Blog','')}</div>`;
    }).join('');

    const postListHtml = generatePostListHTML(activeCategory, currentPostId, 1);

    return `
        <div class="related-posts-section">
            <hr class="related-separator">
            <div class="related-tabs">${tabsHtml}</div>
            <div class="related-post-list-wrapper">${postListHtml}</div>
        </div>
    `;
}

// ADD this new function to main.js
function updateRelatedPosts(newCategory, currentPostId, page = 1) {
    const newContentHtml = generatePostListHTML(newCategory, currentPostId, page);
    
    const wrapper = document.querySelector('.related-post-list-wrapper');
    if (wrapper) {
        wrapper.innerHTML = newContentHtml;
    }
    
    document.querySelectorAll('.related-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === getCategoryProps(newCategory).title);
    });
}

function renderHomepage() {
    // 1. Filter posts based on the current category from homeState
    const filteredPosts = homeState.category === 'all'
        ? [...allPosts]
        : allPosts.filter(p => p.category === homeState.category);

    // 2. Sort the filtered posts based on homeState
    filteredPosts.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return homeState.sort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // 3. Paginate the results
    const postsPerPage = 5;
    const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
    const startIndex = (homeState.page - 1) * postsPerPage;
    const paginatedPosts = filteredPosts.slice(startIndex, startIndex + postsPerPage);

    // 4. Render the list of posts
    const postListEl = document.getElementById('post-list');
    if (paginatedPosts.length > 0) {
        postListEl.innerHTML = paginatedPosts.map(post => `
            <div class="post-list-item" onclick="navigateToPost('${post.id}')">
                <div class="post-list-title">${post.title}</div>
                <div class="post-list-meta">${post.date} | ${getCategoryProps(post.category).title}</div>
            </div>
        `).join('');
    } else {
        postListEl.innerHTML = '<div style="text-align: center; color: #888; padding: 40px 0;">No posts found.</div>';
    }

    // 5. Render ONLY the sorting dropdown
    const controlsEl = document.getElementById('blog-controls');
    controlsEl.innerHTML = `
        <select class="sort-select" onchange="changeSortAndRender(this.value)">
            <option value="newest" ${homeState.sort === 'newest' ? 'selected' : ''}>Sort by Newest</option>
            <option value="oldest" ${homeState.sort === 'oldest' ? 'selected' : ''}>Sort by Oldest</option>
        </select>
    `;

    // 6. Render the numeric pagination
    const paginationEl = document.getElementById('pagination-container');
    if (totalPages > 1) {
        let paginationHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<div class="pagination-link ${homeState.page === i ? 'active' : ''}" onclick="changePageAndRender(${i})">${i}</div>`;
        }
        paginationEl.innerHTML = paginationHTML;
    } else {
        paginationEl.innerHTML = '';
    }
}

// ADD these two new, smaller helper functions
function changeSortAndRender(sortOrder) {
    homeState.sort = sortOrder;
    homeState.page = 1; // Reset to first page when sorting changes
    renderHomepage();
}

function changePageAndRender(pageNumber) {
    homeState.page = pageNumber;
    renderHomepage();
}

// ADD these two new functions to js/main.js

function navigateToPost(postId) {
    // Avoid adding duplicate entries if the user re-clicks the same link
    if (safariHistory[safariHistory.length - 1] !== postId) {
        safariHistory.push(postId);
    }
    updateSafariBackButton();
    showPost(postId);
}

function updateSafariBackButton() {
    const backBtn = document.getElementById('safari-back-btn');
    // The button is disabled if there are 1 or 0 items in history (nowhere to go back to)
    backBtn.disabled = safariHistory.length <= 1;
}

// ADD these two new functions to js/main.js

function generateDesktopIcons() {
    const container = document.getElementById('desktop-icons');
    if (!container) return;
    
    let topPos = 30;
    blogCategories.forEach((props, category) => {
        const iconEl = document.createElement('div');
        iconEl.className = 'desktop-icon folder-icon';
        iconEl.style.top = `${topPos}px`;
        iconEl.style.left = '30px'; // Or dynamically position them
        iconEl.setAttribute('ondblclick', `openFolder('${category}')`);
        iconEl.innerHTML = `
            <div class="icon-image">📁</div>
            <div class="icon-label">${props.title}</div>
        `;
        container.appendChild(iconEl);
        topPos += 100; // Stagger them vertically
    });
}

function generateBookmarkItems() {
    const container = document.getElementById('bookmark-bar');
    if (!container) return;

    blogCategories.forEach((props, category) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'bookmark-item';
        itemEl.setAttribute('onclick', `showCategory('${category}')`);
        itemEl.textContent = props.title.replace(' Blog', ''); // e.g., "Tech"
        container.appendChild(itemEl);
    });
}