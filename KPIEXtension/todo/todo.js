(async () => {
    document.getElementById('add-btn').addEventListener('click', handleAddTodo);
    renderTodos();

    // Load cài đặt khi mở popup
    const reminderBeforeInput = document.getElementById('reminder-before');
    const reminderRepeatInput = document.getElementById('reminder-repeat');

    const { reminderMinutesBefore = 30, reminderRepeatMinutes = 10 } = await chrome.storage.local.get([
        'reminderMinutesBefore',
        'reminderRepeatMinutes'
    ]);

    reminderBeforeInput.value = reminderMinutesBefore;
    reminderRepeatInput.value = reminderRepeatMinutes;

    async function saveTodo(key, newTodo) {
        const todos = await getStoredIds(key);
        todos.push(newTodo);
        await chrome.storage.local.set({ [key]: todos });
    }

    async function deleteTodo(key, idToDelete) {
        const todos = await getStoredIds(key);
        const updated = todos.filter(todo => todo.id !== idToDelete);
        await chrome.storage.local.set({ [key]: updated });
    }

    async function toggleTodoCompleted(key, idToToggle) {
        const todos = await getStoredIds(key);
        const updated = todos.map(todo =>
            todo.id === idToToggle ? { ...todo, completed: !todo.completed } : todo
        );
        await chrome.storage.local.set({ [key]: updated });
    }

    async function handleAddTodo() {
        const title = document.getElementById('todo-input').value.trim();
        const deadline = document.getElementById('deadline-input').value;
        if (!title) return alert("Vui lòng nhập nội dung!");

        const newTodo = {
            id: Date.now().toString(),
            title,
            deadline,
            completed: false
        };
        await saveTodo('todos', newTodo);

        document.getElementById('todo-input').value = '';
        document.getElementById('deadline-input').value = '';
        renderTodos();
    }

    document.getElementById('clear-btn').addEventListener('click', async () => {
        if (confirm("Bạn có chắc chắn muốn xoá toàn bộ danh sách?")) {
            await chrome.storage.local.remove('todos');
            renderTodos();
        }
    });


    document.getElementById('save-settings').addEventListener('click', async () => {
        const reminderBefore = parseInt(reminderBeforeInput.value) || 30;
        const reminderRepeat = parseInt(reminderRepeatInput.value) || 10;

        await chrome.storage.local.set({
            reminderMinutesBefore: reminderBefore,
            reminderRepeatMinutes: reminderRepeat
        });

        alert("✅ Đã lưu cấu hình nhắc việc!");
    });
    async function renderTodos() {
        const todos = await getStoredIds('todos');
        const list = document.getElementById('todo-list');
        list.innerHTML = '';

        todos.forEach(todo => {
            const card = document.createElement('div');
            card.className = 'todo-card' + (todo.completed ? ' completed' : '');

            const isOverdue = todo.deadline && !todo.completed && new Date(todo.deadline) < new Date();

            if (isOverdue) {
                card.classList.add('overdue');
            }

            const isNearDeadline = todo.deadline &&
                !todo.completed &&
                new Date(todo.deadline) - new Date() <= 2 * 60 * 60 * 1000 &&
                new Date(todo.deadline) > new Date();

            if (isNearDeadline) {
                card.classList.add('near-deadline');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'custom-checkbox'; // Thêm class này
            checkbox.checked = todo.completed;
            checkbox.addEventListener('change', async () => {
                await toggleTodoCompleted('todos', todo.id);
                renderTodos();
            });

            const contentDiv = document.createElement('div');
            contentDiv.className = 'todo-content' + (todo.completed ? ' completed' : '');
            contentDiv.innerHTML = `
                <div class="todo-header"><strong>${todo.title}</strong></div>
                <small>⏰ ${todo.deadline ? new Date(todo.deadline).toLocaleString() : 'Không có thời hạn'}</small>
                `;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'todo-delete';
            deleteBtn.innerHTML = '❌';
            deleteBtn.addEventListener('click', async () => {
                await deleteTodo('todos', todo.id);
                renderTodos();
            });


            card.appendChild(checkbox);
            card.appendChild(contentDiv);
            card.appendChild(deleteBtn);
            list.appendChild(card);
        });
    }

})();
