chrome.runtime.onInstalled.addListener(async () => {
    chrome.alarms.create("checkTodos", { periodInMinutes: 1 });

    // Đặt cấu hình mặc định nếu chưa có
    const defaults = await chrome.storage.local.get(['reminderMinutesBefore', 'reminderRepeatMinutes']);
    if (!defaults.reminderMinutesBefore) {
        await chrome.storage.local.set({
            reminderMinutesBefore: 30,
            reminderRepeatMinutes: 10,
            lastNotifiedMap: {}
        });
    }
});

chrome.runtime.onStartup.addListener(() => {
    chrome.alarms.create("checkTodos", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== "checkTodos") return;

    const { todos = [], reminderMinutesBefore = 30, reminderRepeatMinutes = 10, lastNotifiedMap = {} } = await chrome.storage.local.get([
        'todos',
        'reminderMinutesBefore',
        'reminderRepeatMinutes',
        'lastNotifiedMap'
    ]);

    const now = new Date();
    const updatedLastNotifiedMap = { ...lastNotifiedMap };
    const gracePeriodAfterDeadline = 30; // số phút cho phép nhắc sau deadline

    todos.forEach(todo => {
        if (!todo.deadline || todo.completed) return;

        const deadline = new Date(todo.deadline);
        const timeLeft = deadline - now;
        const minutesLeft = timeLeft / (60 * 1000);

        const lastNotifiedTime = updatedLastNotifiedMap[todo.id] ? new Date(updatedLastNotifiedMap[todo.id]) : null;
        const timeSinceLastNotification = lastNotifiedTime ? (now - lastNotifiedTime) / (60 * 1000) : Infinity;

        if (
            Math.abs(minutesLeft) <= reminderMinutesBefore && // nhắc cả trước và sau deadline
            timeSinceLastNotification >= reminderRepeatMinutes
        ) {
            chrome.notifications.create(todo.id, {
                type: "basic",
                iconUrl: "icon48.png",
                title: "🔔 Nhắc nhở công việc",
                message: `👉 "${todo.title}" ${minutesLeft < 0 ? "đã quá hạn" : "sắp đến hạn"} lúc ${deadline.toLocaleTimeString()}`,
                priority: 2
            });

            updatedLastNotifiedMap[todo.id] = now.toISOString();
        }
    });

    await chrome.storage.local.set({ lastNotifiedMap: updatedLastNotifiedMap });
});
