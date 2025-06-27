// --- State Management ---
let homeState = {
    category: 'all',
    sort: 'newest',
    page: 1,
};
let safariHistory = []; 
let blogCategories = new Map(); 
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
        
        // Add event listeners for window dragging and resizing
        document.addEventListener('mousedown', onInteractionStart);
        document.addEventListener('mousemove', onInteractionMove);
        document.addEventListener('mouseup', onInteractionEnd);
        document.addEventListener('touchstart', onInteractionStart);
        document.addEventListener('touchmove', onInteractionMove);
        document.addEventListener('touchend', onInteractionEnd);
        
        showHome(); // Initial load

    } catch (error) {
        console.error("블로그 글 목록을 불러오는 데 실패했습니다:", error);
        showNotification("Error: Could not load blog posts.");
    }
});

// --- Desktop Icons and Bookmarks ---
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
const openTextEdit = () => {
    openWindow('textedit-window');
    setupTextEditor();
};

function setupTextEditor() {
    // Populate category dropdown
    const categorySelect = document.getElementById('post-category');
    categorySelect.innerHTML = ''; // Clear existing options

    blogCategories.forEach((props, category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = props.title.replace(' Blog', '');
        categorySelect.appendChild(option);
    });

    const newCategoryOption = document.createElement('option');
    newCategoryOption.value = 'new-category';
    newCategoryOption.textContent = 'New Category...';
    categorySelect.appendChild(newCategoryOption);

    // Add event listener for "New Category"
    categorySelect.onchange = (e) => {
        if (e.target.value === 'new-category') {
            const newCategoryName = prompt("Enter new category name (e.g., 'life', 'dev'):");
            if (newCategoryName && newCategoryName.trim() !== '') {
                const newCatKey = newCategoryName.trim().toLowerCase();
                if (!blogCategories.has(newCatKey)) {
                    const title = newCatKey.charAt(0).toUpperCase() + newCatKey.slice(1);
                    blogCategories.set(newCatKey, {
                        title: `${title} Blog`,
                        path: `/Desktop/${title} Blog`
                    });
                    // Re-setup the editor to reflect the new category
                    setupTextEditor();
                    // Set the new category as selected
                    categorySelect.value = newCatKey;
                } else {
                    alert("Category already exists.");
                    categorySelect.value = Array.from(blogCategories.keys())[0];
                }
            } else {
                categorySelect.value = Array.from(blogCategories.keys())[0];
            }
        }
    };

    // Setup real-time markdown preview
    const markdownInput = document.getElementById('markdown-input');
    const markdownPreview = document.getElementById('markdown-preview');
    markdownInput.onkeyup = () => {
        markdownPreview.innerHTML = marked.parse(markdownInput.value);
    };
    
    // Clear fields for a new post
    document.getElementById('post-title').value = '';
    markdownInput.value = '';
    markdownPreview.innerHTML = '';

    // Handle Image Attachment
    const attachBtn = document.getElementById('attach-image-btn');
    const imageInput = document.getElementById('image-upload-input');
    attachBtn.onclick = () => imageInput.click();

    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                // For demonstration, we'll use the base64 data URL.
                // In a real scenario, you'd upload this and get back a URL.
                const imageUrl = event.target.result;
                const imageName = file.name.split('.')[0];
                const markdownForImage = `![${imageName}](${imageUrl})\n`;
                
                // Insert the markdown at the current cursor position
                const start = markdownInput.selectionStart;
                const end = markdownInput.selectionEnd;
                markdownInput.value = markdownInput.value.substring(0, start) + markdownForImage + markdownInput.value.substring(end);
                
                // Trigger preview update
                markdownPreview.innerHTML = marked.parse(markdownInput.value);

                showNotification("Image attached. Note: This is a local preview.");
            };
            reader.readAsDataURL(file);
        }
    };
}

function publishPost() {
    const title = document.getElementById('post-title').value.trim();
    const category = document.getElementById('post-category').value;
    const content = document.getElementById('markdown-input').value.trim();

    if (!title || !category || !content) {
        showNotification("Title, category, and content are required.");
        return;
    }

    // --- File & JSON Generation ---
    const now = new Date();
    const dateString = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    const newPostId = `${category}-${Math.floor(Math.random() * 1000)}`;
    const filePath = `./posts/${category}/${fileName}`;

    // Create the new post object for posts.json
    const newPostEntry = {
      id: newPostId,
      category: category,
      title: title,
      date: dateString,
      path: filePath
    };

    // Create a deep copy of the current posts and add the new one
    const updatedPosts = JSON.parse(JSON.stringify(allPosts));
    updatedPosts.unshift(newPostEntry); // Add to the beginning

    const updatedPostsJson = JSON.stringify({ posts: updatedPosts }, null, 2);

    // --- Display Instructions to User ---
    const instructionMessage = `
        <h3>Post Ready to Publish!</h3>
        <p>Because this is a static site, you need to manually add the files.</p>
        <ol>
            <li>
                <strong>Create the Markdown File:</strong>
                <p>Create a new file named <code>${fileName}</code> inside the <code>/posts/${category}/</code> folder.</p>
                <p>Copy the content below into it:</p>
                <textarea readonly style="width: 100%; height: 150px; margin-top: 5px;">${content}</textarea>
            </li>
            <li>
                <strong>Update posts.json:</strong>
                <p>Replace the entire content of your <code>posts.json</code> file with the following:</p>
                <textarea readonly style="width: 100%; height: 200px; margin-top: 5px;">${updatedPostsJson}</textarea>
            </li>
             <li>
                <strong>Image Handling:</strong>
                <p>If you attached images, save them in <code>/posts/${category}/imgs/</code> and update the image paths in your new Markdown file from the long 'data:image/...' URL to the relative path (e.g., <code>./imgs/your-image.png</code>).</p>
            </li>
        </ol>
        <p>After saving, the new post will appear on your blog.</p>
    `;

    // Display this message in a new, temporary window or a modal.
    // For simplicity, we'll use the Safari window to display the output.
    openWindow('safari-window');
    document.getElementById('safari-title').textContent = 'Publishing Instructions';
    document.getElementById('blog-home').style.display = 'none';
    const contentArea = document.getElementById('blog-content');
    contentArea.innerHTML = `<div class="blog-post active" style="padding: 20px;">${instructionMessage}</div>`;
    contentArea.scrollTop = 0;
}


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

function changeSortAndRender(sortOrder) {
    homeState.sort = sortOrder;
    homeState.page = 1; // Reset to first page when sorting changes
    renderHomepage();
}

function changePageAndRender(pageNumber) {
    homeState.page = pageNumber;
    renderHomepage();
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

// for related posts
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


