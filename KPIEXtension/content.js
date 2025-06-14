(async () => {
    console.log('Loading content.js');

    let loadingSuccess = false;
    const WORK_ITEM_KEY = 'WorkItemIds';
    const addedLinks = new Set();
    const svgAdd = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="green" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 1v14M1 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        `;

    const svgRemove = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="red" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 8h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        `;

    // Sử dụng hàm từ utils.js
    const storedItems = await getStoredIds(WORK_ITEM_KEY);
    storedItems.forEach(item => addedLinks.add(item.id));
    const userProfile = await getUserProfile();

    function createAddButton(workItemId, href) {
        const button = document.createElement('button');
        button.className = 'btn btn-default btn-sm gl-button';

        const updateButtonAppearance = () => {
            if (addedLinks.has(workItemId)) {
                button.innerHTML = svgRemove;
                button.classList.remove('btn-success');
                button.classList.add('btn-danger');
            } else {
                button.innerHTML = svgAdd;
                button.classList.remove('btn-danger');
                button.classList.add('btn-success');
            }
        };

        updateButtonAppearance();

        button.addEventListener('click', async (e) => {
            e.stopPropagation(); // chặn sự kiện lan lên DOM gốc
            e.preventDefault();  // tránh hành vi mặc định
            // Ngăn spam nút bằng cách vô hiệu hóa nó ngay khi nhấn
            button.disabled = true;

            try {
                // Get group name
                if (addedLinks.has(workItemId)) {
                    await removeIdFromStorage(WORK_ITEM_KEY, workItemId);
                    addedLinks.delete(workItemId);
                } else {
                    const today = new Date().toLocaleString();
                    await addIdToStorage(WORK_ITEM_KEY, workItemId, href, today);
                    addedLinks.add(workItemId);
                }
            } catch (error) {
                console.error('Error handling button click:', error);
            } finally {
                // Cho phép người dùng nhấn lại sau khi xử lý xong
                button.disabled = false;
            }

            updateButtonAppearance();
        });

        return button;
    }

    function createRefreshButton() {
        const taskHeader = document.querySelector('#tasks > .crud-header');

        // Tạo nút
        const button = document.createElement('button');
        button.className = 'btn btn-sm btn-default gl-button';
        button.title = 'Refresh';
        button.style.display = 'flex';
        button.style.alignItems = 'center';

        button.style.justifyContent = 'center';
        // SVG icon (biểu tượng refresh)
        button.innerHTML = `
        <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
            viewBox="0 0 32 32" enable-background="new 0 0 32 32" xml:space="preserve">
        <path fill="none" stroke="#000000" stroke-width="2" stroke-miterlimit="10" d="M25.7,10.9C23.9,7.4,20.2,5,16,5
            c-4.7,0-8.6,2.9-10.2,7"/>
        <path fill="none" stroke="#000000" stroke-width="2" stroke-miterlimit="10" d="M6.2,21c1.8,3.5,5.5,6,9.8,6c4.7,0,8.6-2.9,10.2-7"
            />
        <polyline fill="none" stroke="#000000" stroke-width="2" stroke-miterlimit="10" points="26,5 26,11 20,11 "/>
        <polyline fill="none" stroke="#000000" stroke-width="2" stroke-miterlimit="10" points="6,27 6,21 12,21 "/>
        </svg>
    `;

        // Gán sự kiện click
        button.addEventListener('click', () => {
            processTasks();
        });

        // Gắn nút vào header (nếu chưa có)
        if (!taskHeader.querySelector('button[title="Refresh"]')) {
            taskHeader.append(button);
        }
    }


    function processTasks() {
        const taskSection = document.querySelector('#tasks > .crud-body');
        const taskItems = taskSection.querySelectorAll('ul[data-testid="child-items-container"] > li.tree-item');

        taskItems.forEach(li => {
            const container = li.querySelector('div[data-testid="links-child"]');
            const workItemId = container?.getAttribute('parent-work-item-id');
            const anchor = li.querySelector('a');

            if (!workItemId || !anchor) return;

            const avatarUrl = li.querySelector('div.gl-avatars-inline-child > a')?.getAttribute('href');

            if (userProfile && avatarUrl != userProfile.web_url) return;

            const position = li.querySelector('div[data-testid="child-contents-container"] > div[data-testid="links-child"]');

            // Kiểm tra nếu đã có nút thì bỏ qua
            if (position.querySelector('.custom-add-button')) return;

            const addButton = createAddButton(workItemId, anchor.href);
            addButton.classList.add('custom-add-button'); // Gắn class để kiểm tra sau này

            position.prepend(addButton);
        });
    }


    // Bắt đầu quan sát từ phần tử gốc (ví dụ: body)
    const observer = new MutationObserver((mutations, obs) => {
        const targetElement = document.querySelector("ul[data-testid='child-items-container']");

        if (targetElement) {
            processTasks();
            createRefreshButton();
            obs.disconnect(); // Ngừng quan sát sau khi phát hiện
        }
    });

    // Cấu hình observer
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    async function addIdToStorage(key, id, href, createAt) {
        const items = await getStoredIds(key);
        if (!items.some(item => item.id === id)) {
            items.push({ id, href, createAt });
            await chrome.storage.local.set({ [key]: items });
        }
    }

})();
