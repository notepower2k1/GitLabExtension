(async () => {
    const userProfile = await getUserProfile();

    if (userProfile) {
        renderUserProfile(userProfile);
    } else {
        document.getElementById("user-screen").style.display = "none";
    }

    document.getElementById("login-btn").addEventListener("click", async () => {
        const token = document.getElementById("token").value;

        if (!token) {
            alert("Vui lòng nhập token");
            return;
        }

        // Giả lập gọi API lấy thông tin user từ token
        await fetchUserProfile(token).then(user => {
            if (user) {
                renderUserProfile(user);
            } else {
                alert("Token không hợp lệ!");
            }
        });
        await addAccessToken(token);
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
        document.getElementById("user-screen").style.display = "none";
        document.getElementById("login-screen").style.display = "flex"; // hoặc "block"

        deletelocalStorage('AccessToken');
        deletelocalStorage('UserProfile');
    });

    document.getElementById("tutorial-btn").addEventListener("click", () => {
        // Open new tab
        // chrome.tabs.create({ url: "https://gitlab.widosoft.com/-/user_settings/personal_access_tokens" });
        chrome.tabs.create({ url: chrome.runtime.getURL("../tutorial/tutorial.html") });
    })


    async function renderUserProfile(user) {
        // Hiện user info
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("user-screen").style.display = "block";

        // Cập nhật thông tin
        document.getElementById("avatar").src = user.avatar_url;
        document.getElementById("username").textContent = user.username;
        document.getElementById("avatar-link").href = user.web_url;

        document.getElementById("manage-btn").onclick = () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("../page/page.html") });
        };

        document.getElementById("note-btn").onclick = () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("../note/note.html") });
        };

        document.getElementById("todo-btn").onclick = () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("../todo/todo.html") });
        };

        // Xử lý chuyển tab
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                // Xoá class active khỏi tất cả
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

                // Thêm class active cho tab hiện tại
                btn.classList.add("active");
                document.getElementById(btn.dataset.tab).classList.add("active");
            });
        });


        document.getElementById("exportTask-btn").addEventListener("click", async () => {
            const data = await getStoredIds('WorkItemIds');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "task_backup.txt";
            a.click();
            URL.revokeObjectURL(url);
        });

        document.getElementById("importTask-btn").addEventListener("click", () => {
            document.getElementById("importFile").click();
        });

        document.getElementById("importFile").addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const text = await file.text();
            try {
                const items = JSON.parse(text);

                // Ghi đè dữ liệu cũ bằng dữ liệu mới
                if (Array.isArray(items)) {
                    await chrome.storage.local.set({ ['WorkItemIds']: items });
                    alert("Import thành công!");
                } else {
                    alert("File không đúng định dạng.");
                }
            } catch (err) {
                console.error(err);
                alert("Đọc file thất bại.");
            }
        });

        const kpiStats = await getStoredIds('KpiStats');

        // Cập nhật thống kê
        if (kpiStats == null || kpiStats == undefined || kpiStats.length == 0) {
            document.getElementById("stats-box").style.display = "none";
        } else {
            document.getElementById("stats-box").style.display = "block";
            document.getElementById("stats-time").textContent = kpiStats.lastUpdated != '' ? new Date(kpiStats.lastUpdated).toISOString().split('T')[0] : '';
            document.getElementById("total-tasks").textContent = kpiStats.totalTask > 0 ? kpiStats.totalTask : 0;
            document.getElementById("estimate-time").textContent = kpiStats.totalEstimate > 0 ? kpiStats.totalEstimate : 0;
            document.getElementById("spent-time").textContent = kpiStats.totalSpent > 0 ? kpiStats.totalSpent : 0;

            document.getElementById("estimate-time-daily").textContent = kpiStats.dailySpentTime > 0 ? kpiStats.dailySpentTime + ' giờ' + '/8 giờ' : '0 giờ/8 giờ';

            const totalSpentDaily = kpiStats.dailySpentTime > 0 ? kpiStats.dailySpentTime : 0;
            // Tính tiến độ
            const dailyProgress = Math.min((totalSpentDaily / 8) * 100, 100);

            document.getElementById("progress-fill-daily").style.width = `${dailyProgress}%`;
            document.getElementById("progress-text-daily").textContent = `${dailyProgress.toFixed(1)}%`;

            document.getElementById("estimate-time-total").textContent = kpiStats.totalEstimate > 0 ? kpiStats.totalEstimate + ' giờ' + '/48 giờ' : '0 giờ/48 giờ';
            const totalSpent = kpiStats.totalSpent > 0 ? kpiStats.totalSpent : 0;
            const totalTimeWorkingInCompany = kpiStats.totalTimeWorkingInCompany > 0 ? kpiStats.totalTimeWorkingInCompany : 48;
            // Tính tiến độ
            const progress = Math.min((totalSpent / totalTimeWorkingInCompany) * 100, 100);

            document.getElementById("progress-fill").style.width = `${progress}%`;
            document.getElementById("progress-text").textContent = `${progress.toFixed(1)}%`;
        }


    }

    async function fetchUserProfile(token) {
        const res = await fetch(`https://gitlab.widosoft.com/api/v4/user`, { headers: { 'PRIVATE-TOKEN': token } });
        const response = await res.json();

        if (response.message == '401 Unauthorized') {
            return null;
        }

        await saveUserProfile(response);
        return response;
    }


    async function saveUserProfile(userProfile) {
        await chrome.storage.local.set({ ['UserProfile']: userProfile });
    }


    async function addAccessToken(accessToken) {
        await chrome.storage.local.set({ ['AccessToken']: accessToken });
    }

    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        const usedKB = (bytesInUse / 1024).toFixed(2);
        const maxKB = (chrome.storage.local.QUOTA_BYTES / 1024).toFixed(0);

        document.getElementById("used-bytes").textContent = usedKB;
        document.getElementById("max-bytes").textContent = maxKB;
    });
})();
