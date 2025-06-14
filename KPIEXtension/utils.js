async function deletelocalStorage(key) {
    await chrome.storage.local.remove(key);
}

async function getStoredIds(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] || []);
        });
    });
}

async function getAccessToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['AccessToken'], (result) => {
            resolve(result['AccessToken']);
        });
    });
}

async function removeIdFromStorage(key, id) {
    const items = await getStoredIds(key);
    const filtered = items.filter(item => item.id !== id);
    await chrome.storage.local.set({ [key]: filtered });
}

async function getUserProfile() {
    if (!getAccessToken()) return;

    return new Promise((resolve) => {
        chrome.storage.local.get(['UserProfile'], (result) => {
            resolve(result['UserProfile']);
        });
    });
}

function compareDate(first, second) {
    return new Date(second) - new Date(first);
}

function formatDate(dateStr) {
    if (!dateStr) {
        return '';
    }

    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

function isInPreviousWeek(date) {
    const [day, month, year] = date.split('/');
    const currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(today.getDate() - dayOfWeek + 1);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);

    return currentDate <= endOfLastWeek;
}

function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => {
        const safeUrl = url.replace(/"/g, '&quot;'); // Tránh lỗi HTML injection
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

function getCurrentWeekDates() {
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay(); // 0 (CN) → 6 (T7)
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    monday.setDate(today.getDate() + diffToMonday);

    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const label = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
        const value = d.toISOString().split('T')[0]; // YYYY-MM-DD
        days.push({ label, value });
    }
    return days;
}