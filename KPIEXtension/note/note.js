
(async () => {
    const STORAGE_KEY = 'Notes';
    let pastedImageData = null;

    displayNotes();

    document.getElementById("addBtn").addEventListener("click", async () => {
        const input = document.getElementById("noteInput");
        const imageInput = document.getElementById("imageInput");
        const text = input.value.trim();

        let imageBase64 = pastedImageData; // ưu tiên ảnh đã dán

        if (!imageBase64 && imageInput.files.length > 0) {
            imageBase64 = await convertToBase64(imageInput.files[0]);
        }

        if (!text && !imageBase64) return;

        const note = {
            id: Date.now(),
            text: text,
            timestamp: new Date().toISOString(),
            image: imageBase64
        };

        await saveNote(STORAGE_KEY, note);
        input.value = "";
        imageInput.value = "";
        pastedImageData = null;
        document.getElementById("imagePreview").innerHTML = "";

        displayNotes();
    });

    async function displayNotes() {
        const container = document.getElementById("notesContainer");
        container.innerHTML = "";

        const notes = await getStoredIds(STORAGE_KEY);
        for (const note of notes) {
            const card = document.createElement("div");
            card.className = "note-card";

            // Format ngày giờ
            const date = new Date(note.timestamp);
            const formattedTime = date.toLocaleString('vi-VN', {
                hour12: false,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            card.innerHTML = `
                <p>${linkify(note.text)}</p>
                <small class="note-time">🕒 ${formattedTime}</small>
                <button class="delete-btn" data-id="${note.id}">&times;</button>
            `;
            container.appendChild(card);

            if (note.image) {
                const img = document.createElement("img");
                img.src = note.image;
                img.className = "note-image";
                card.appendChild(img);
            }
        }

        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const id = parseInt(e.target.getAttribute("data-id"));
                await deleteNoteById(STORAGE_KEY, id);
                displayNotes();
            });
        });
    }

    document.getElementById("clearAllBtn").addEventListener("click", async () => {
        const confirmed = confirm("Bạn có chắc muốn xóa toàn bộ ghi chú?");
        if (!confirmed) return;

        await chrome.storage.local.remove(STORAGE_KEY);
        displayNotes();
    });

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    document.getElementById("noteInput").addEventListener("paste", async (event) => {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") === 0) {
                const file = item.getAsFile();
                const base64 = await convertToBase64(file);

                // Hiển thị ảnh tạm (hoặc lưu vào biến tạm để gắn vào note khi user nhấn nút Thêm)
                pastedImageData = base64;

                // Gợi ý ảnh đã dán
                showImagePreview(base64);
            }
        }
    });



    function showImagePreview(base64) {
        const preview = document.getElementById("imagePreview");
        preview.innerHTML = `<img src="${base64}" class="note-image" />`;
    }


    async function saveNote(key, newNote) {
        const notes = await getStoredIds(key);
        notes.push(newNote);
        chrome.storage.local.set({ [key]: notes });
    }

    async function deleteNoteById(key, id) {
        let notes = await getStoredIds(key);
        notes = notes.filter(note => note.id !== id);
        chrome.storage.local.set({ [key]: notes });
    }

})();
