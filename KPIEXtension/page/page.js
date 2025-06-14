(async () => {
    console.log('Loading page.js');
    const today = new Date();
    let allTaskInfo = [];
    await getAllTasks();

    if (allTaskInfo.length > 0) {
        await renderOldKpi();
    }

    const select = document.getElementById('weekdaySelect');
    const days = getCurrentWeekDates();

    days.forEach(({ label, value }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label.charAt(0).toUpperCase() + label.slice(1); // Viết hoa chữ cái đầu
        select.appendChild(option);
    });

    select.addEventListener('change', () => {
        const selectedDate = select.value;
        getAllTasks(selectedDate);
    });

    async function getAllTasks(filterDate = null) {
        const formatDate = dateStr => {
            const d = new Date(dateStr);
            return d.toISOString().split('T')[0]; // YYYY-MM-DD
        };

        const WORK_ITEM_KEY = 'WorkItemIds';
        const container = document.getElementById('allTaskContainer');
        container.innerHTML = ''; // Clear table mỗi lần render

        const storedItems = await getStoredIds(WORK_ITEM_KEY);

        const groups = {};
        allTaskInfo = []; // Reset lại mảng lưu thông tin

        storedItems.forEach(({ id, href, createAt }) => {
            const match = href.match(/gitlab\.widosoft\.com\/[^\/]+\/([^\/]+)\//);
            const groupName = match ? match[1] : 'Khác';

            if (!groups[groupName]) groups[groupName] = [];

            groups[groupName].push({ id, href });
            allTaskInfo.push({ href, id, groupName, createAt });
        });

        // Lọc theo ngày nếu có filterDate
        const filteredTasks = filterDate
            ? allTaskInfo.filter(task => formatDate(task.createAt) === filterDate)
            : allTaskInfo;

        if (filteredTasks.length === 0) {
            renderEmptyTable();
            return;
        };

        const table = document.createElement('table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>URL</th>
                    <th>Group name</th>
                    <th>Ngày tạo</th>
                    <th>Tác vụ</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        for (const taskInfo of filteredTasks) {
            const row = document.createElement('tr');

            const urlCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = taskInfo.href;
            link.textContent = taskInfo.href;
            link.target = '_blank';
            urlCell.appendChild(link);

            const groupNameCell = document.createElement('td');
            const groupLink = document.createElement('a');
            const newUrl = taskInfo.href.replace(/\/work_items\/\d+/, "/issues");
            groupLink.href = newUrl;
            groupLink.target = '_blank';
            groupLink.textContent = taskInfo.groupName;
            groupNameCell.appendChild(groupLink);

            const createDateCell = document.createElement('td');
            createDateCell.textContent = taskInfo.createAt;

            const deleteCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Xóa';
            deleteButton.style.color = 'white';
            deleteButton.style.backgroundColor = 'red';
            deleteButton.style.border = 'none';
            deleteButton.style.padding = '4px 10px';
            deleteButton.style.cursor = 'pointer';

            deleteButton.addEventListener('click', async () => {
                await removeIdFromStorage(WORK_ITEM_KEY, taskInfo.id);
                row.remove();
                allTaskInfo = allTaskInfo.filter(item => item.id !== taskInfo.id);

                if (tbody.children.length === 0) {
                    table.remove();
                    renderEmptyTable();
                }
            });

            deleteCell.appendChild(deleteButton);

            row.appendChild(urlCell);
            row.appendChild(groupNameCell);
            row.appendChild(createDateCell);
            row.appendChild(deleteCell);
            tbody.appendChild(row);
        }

        container.appendChild(table);
    }


    document.getElementById('getDetailBtn').addEventListener('click', async () => {
        const accessToken = getAccessToken();

        if (!accessToken) {
            alert('Chưa set access token');
            return;
        }

        document.getElementById('kpiContainer').innerHTML = '';
        document.getElementById('kpiStatsContainer').innerHTML = '';

        // Show loading spinner
        document.getElementById('spinner').style.display = 'block'; // Hiện loading

        console.log('Loading new data');

        // If update new data
        const kpiInfoPromises = allTaskInfo.map(({ createAt, href, id, groupName }) => {
            return getWorkItemDetailNew(createAt, href, groupName);
        });
        const kpiInfo = await Promise.all(kpiInfoPromises);

        if (kpiInfo.length === 0) {
            document.getElementById('spinner').style.display = 'none'; // Ẩn loading sau khi render xong
            document.getElementById('kpiContainer').innerHTML = ''; // Xóa nội dung cũ trước khi render
            return;
        }

        const lastUpdateTitle = document.createElement('h1');
        lastUpdateTitle.textContent = 'Lần thống kê cuối: ' + new Date().toLocaleString();
        document.getElementById('kpiContainer').appendChild(lastUpdateTitle);

        // Append divider
        const divider = document.createElement('div');
        divider.style.height = '1px';
        divider.style.width = '100%';
        divider.style.backgroundColor = 'gray';
        divider.style.margin = '10px 0';
        document.getElementById('kpiContainer').appendChild(divider);

        await renderKpi(kpiInfo, true);
        await saveKpiInfo(kpiInfo);

        document.getElementById('spinner').style.display = 'none'; // Ẩn loading sau khi render xong
    });

    document.getElementById('deleteAllTaskBtn').addEventListener('click', async () => {
        const confirmDelete = confirm('Xóa tất cả task?');

        if (!confirmDelete) {
            return;
        }

        const WORK_ITEM_KEY = 'WorkItemIds';
        allTaskInfo = [];
        await deletelocalStorage(WORK_ITEM_KEY);
        renderEmptyTable();
    });

    document.getElementById('exportCSVBtn').addEventListener('click', async () => {
        const container = document.getElementById('kpiContainer');

        if (container.innerHTML != '') {
            exportAllTablesToCSV();
        }
    })

    async function renderKpi(kpiData, isSaveKpiStats = false) {
        const container = document.getElementById('kpiContainer');

        // Các cột muốn hiển thị (bạn chỉnh theo đúng key trong kpiData nếu cần)
        const columns = ["Tasks", "Start date", "Due date", "Closed date", "Estimate (h)", "Spent (h)", "Số lần bị reopen", "Loại task", "Tiến độ"];
        const columnFieldMap = {
            "Tasks": "taskUrl",
            "Start date": "startDate",
            "Due date": "dueDate",
            "Closed date": "closeDate",
            "Estimate (h)": "estimate",
            "Spent (h)": "spent",
            "Số lần bị reopen": "reopenTotal",
            "Loại task": "type",
            "Tiến độ": "progress"
        };

        // Nhóm dữ liệu theo groupName
        // Giả sử groupName là key 'groupName' trong mỗi object
        const groupedData = {};


        const totalTask = kpiData.length;
        let totalPlannedTask = 0;
        let totalEstimate = 0;
        let totalSpent = 0;
        let totalSpentPlannedTask = 0;
        let totalTaskNoStartDate = 0;
        let totalTaskNoDueDate = 0;
        let totalTaskNoEstimate = 0;
        let totalTaskNoSpent = 0;
        let totalTaskInTime = 0;
        let reopenCount = 0;
        let dailySpentTime = 0;

        kpiData.forEach(item => {
            const group = item.groupName || 'Khác';
            if (!groupedData[group]) {
                groupedData[group] = [];
            }
            groupedData[group].push(item);

            if (item.type === 'Kế hoạch') {
                totalPlannedTask += 1;
                totalSpentPlannedTask += item.spent;
            }

            if (item.startDate == '') {
                totalTaskNoStartDate += 1;
            }

            if (item.dueDate == '') {
                totalTaskNoDueDate += 1;
            }

            if (item.estimate == 0) {
                totalTaskNoEstimate += 1;
            }

            if (item.spent == 0) {
                totalTaskNoSpent += 1;
            }

            if (item.progress === 'Đúng hạn') {
                totalTaskInTime += 1;
            }

            if (item.reopenTotal > 0) {
                reopenCount += 1;
            }

            const createdAt = new Date(item.addedAt); // Parses your date string

            if (createdAt.toDateString() == today.toDateString()) {
                dailySpentTime += item.spent;
            }

            totalEstimate += item.estimate;
            totalSpent += item.spent;
        });

        // Với mỗi group, tạo bảng riêng
        for (const [groupName, items] of Object.entries(groupedData)) {
            // Tạo bảng
            const table = document.createElement("table");
            table.style.marginBottom = "20px"; // khoảng cách giữa các bảng

            // Tạo thead
            const thead = document.createElement("thead");
            const headerRow = document.createElement("tr");
            columns.forEach(col => {
                const th = document.createElement("th");
                th.textContent = col;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Tạo tbody
            const tbody = document.createElement("tbody");
            const titleRenderList = [];

            items.forEach(item => {
                // Tạo tiêu đề cho nhóm
                if (!titleRenderList.includes(groupName)) {
                    titleRenderList.push(groupName);

                    const groupTitle = document.createElement('h3');
                    const urlLink = document.createElement('a');
                    const oldUrl = item.taskUrl;
                    const newUrl = oldUrl.replace(/\/work_items\/\d+/, "/issues");

                    urlLink.href = newUrl;
                    urlLink.target = '_blank';
                    urlLink.textContent = groupName;

                    groupTitle.appendChild(urlLink);
                    container.appendChild(groupTitle);

                }

                const row = document.createElement("tr");
                columns.forEach(col => {
                    const td = document.createElement("td");
                    const key = columnFieldMap[col]; // lấy key thực tế trong object
                    const value = item[key];

                    if (key === "taskUrl") {
                        const link = document.createElement('a');
                        link.href = value;
                        link.textContent = value;
                        link.target = '_blank';
                        td.appendChild(link);
                    } else {
                        td.textContent = value !== undefined ? value : '';
                    }

                    if (key === 'startDate' || key === 'dueDate' || key === 'closeDate') {
                        if (isInPreviousWeek(value)) {
                            td.style.color = 'red';
                        }
                    }

                    row.appendChild(td);
                });

                tbody.appendChild(row);
            });
            table.appendChild(tbody);

            container.appendChild(table);
        }

        const kpiStats = {
            totalTask: totalTask,
            totalPlannedTask: totalPlannedTask,
            totalUnplannedTask: totalTask - totalPlannedTask,
            totalTimeWorkingInCompany: 48, // Default value
            totalEstimate: parseFloat(totalEstimate).toFixed(2),
            totalSpent: parseFloat(totalSpent).toFixed(2),
            totalSpentPlannedTask: parseFloat(totalSpentPlannedTask).toFixed(2),
            totalSpentUnplannedTask: parseFloat(totalSpent - totalSpentPlannedTask).toFixed(2),
            totalTaskNoStartDate: totalTaskNoStartDate,
            totalTaskNoDueDate: totalTaskNoDueDate,
            totalTaskNoEstimate: totalTaskNoEstimate,
            totalTaskNoSpent: totalTaskNoSpent,
            totalTaskInTime: totalTaskInTime,
            totalTaskLate: totalTask - totalTaskInTime,
            totalTaskNotReopen: totalTask - reopenCount,
            totalTaskReopen: reopenCount,
            dailySpentTime: parseFloat(dailySpentTime).toFixed(2),
            lastUpdated: new Date().toLocaleString(),
        }

        if (isSaveKpiStats) {
            await saveKpiStats(kpiStats);
        }

        await renderKpiStats(kpiStats);
    }

    async function renderKpiStats(kpiStats) {
        const container = document.getElementById('kpiStatsContainer');
        // Append divider
        const divider = document.createElement('div');
        divider.style.height = '1px';
        divider.style.width = '100%';
        divider.style.backgroundColor = 'gray';
        divider.style.margin = '10px 0';
        container.appendChild(divider);

        const header = [
            "Tổng số task",
            "Tổng số task kế hoạch",
            "Tổng số task phát sinh",
            "Tổng thời gian làm việc theo lịch công ty (h)",
            "Tổng thời gian Estimate (h)",
            "Tổng thời gian Spent time (h)",
            "Tổng thời gian Spent time (h) của task kế hoạch",
            "Tổng thời gian Spent time (h) của task phát sinh",
            "Số lượng task chưa có Start date",
            "Số lượng task chưa có Due date",
            "Số lượng task chưa có Estimate",
            "Số lượng task chưa có Spent time",
            "Tổng số task đúng hạn",
            "Tổng số task trễ hạn",
            "Tổng số task không bị reopen",
            "Tổng số task có bị reopen"
        ];

        // Create table elements
        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        header.forEach(col => {
            const th = document.createElement("th");
            th.textContent = col;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        const row = document.createElement("tr");

        // Extract values from object in correct order
        const values = [
            kpiStats.totalTask,
            kpiStats.totalPlannedTask,
            kpiStats.totalUnplannedTask,
            kpiStats.totalTimeWorkingInCompany,
            kpiStats.totalEstimate,
            kpiStats.totalSpent,
            kpiStats.totalSpentPlannedTask,
            kpiStats.totalSpentUnplannedTask,
            kpiStats.totalTaskNoStartDate,
            kpiStats.totalTaskNoDueDate,
            kpiStats.totalTaskNoEstimate,
            kpiStats.totalTaskNoSpent,
            kpiStats.totalTaskInTime,
            kpiStats.totalTaskLate,
            kpiStats.totalTaskNotReopen,
            kpiStats.totalTaskReopen,
        ];

        values.forEach(col => {
            const td = document.createElement("td");
            td.textContent = col;
            row.appendChild(td);
        });

        tbody.appendChild(row);
        table.appendChild(tbody);

        container.innerHTML = ''; // Clear old content
        container.appendChild(table);
    }

    async function renderOldKpi() {
        const oldKpiInfo = await getStoredIds('KpiInfo');
        const oldKpiStats = await getStoredIds('KpiStats');
        const lastUpdatedTime = new Date(oldKpiStats.lastUpdated)

        if (oldKpiInfo.length > 0) {
            console.log('Loading old data');

            if (oldKpiInfo.length === 0) {
                return;
            }

            const lastUpdateTitle = document.createElement('h1');
            lastUpdateTitle.textContent = 'Lần thống kê cuối: ' + lastUpdatedTime.toLocaleString();
            document.getElementById('kpiContainer').appendChild(lastUpdateTitle);

            // Append divider
            const divider = document.createElement('div');
            divider.style.height = '1px';
            divider.style.width = '100%';
            divider.style.backgroundColor = 'gray';
            divider.style.margin = '10px 0';
            document.getElementById('kpiContainer').appendChild(divider);

            await renderKpi(oldKpiInfo);
            await renderKpiStats(oldKpiStats);
        }
    }

    function exportAllTablesToCSV() {
        const title = 'KPI_File'; // dùng làm tên file
        const container = document.getElementById('kpiContainer');
        const tables = container.querySelectorAll('table');
        const headers = container.querySelectorAll('h3');

        let csv = '';

        tables.forEach((table, index) => {
            const headerText = headers[index]?.innerText || `Table ${index + 1}`;
            csv += `### ${headerText}\n`; // ghi tên bảng trước mỗi bảng

            // Duyệt từng dòng trong bảng
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = Array.from(row.cells).map(cell => {
                    let text = cell.textContent.trim();
                    if (text.includes(',') || text.includes('"')) {
                        text = `"${text.replace(/"/g, '""')}"`; // escape dấu "
                    }
                    return text;
                });
                csv += cells.join(',') + '\n';
            });

            csv += '\n'; // dòng trắng giữa các bảng
        });

        // Tạo và tải file CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${title}.csv`;
        link.click();
    }


    async function saveKpiInfo(params) {
        await chrome.storage.local.set({ ['KpiInfo']: params });
    }

    async function removeKpiInfo() {
        await chrome.storage.local.remove('KpiInfo');
    }

    async function saveKpiStats(params) {
        await chrome.storage.local.set({ ['KpiStats']: params });
    }


    // async function getWorkItemDetail(projectUrl, groupName) {
    //     const { projectPath, issueIid } = parseGitLabWorkItemUrl(projectUrl);

    //     const token = await getAccessToken();

    //     // 1. Get Project ID
    //     const projectRes = await fetch(
    //         `https://gitlab.widosoft.com/api/v4/projects/${encodeURIComponent(projectPath)}`,
    //         { headers: { 'PRIVATE-TOKEN': token } }
    //     );
    //     const project = await projectRes.json();

    //     const projectId = project.id;

    //     // 2. Get Work Item (Issue) Detail
    //     const issueRes = await fetch(
    //         `https://gitlab.widosoft.com/api/v4/projects/${projectId}/issues/${issueIid}`,
    //         { headers: { 'PRIVATE-TOKEN': token } }
    //     );
    //     const issue = await issueRes.json();
    //     const notesLog = await getActivityLog(token, projectId, issueIid);

    //     if (issue) {
    //         // Get start Date by note log because can get from work item detail
    //         let latestStartDateChange = '';
    //         let reopenTime = 0;
    //         let esimateTime = issue.time_stats.time_estimate
    //             ? parseFloat((issue.time_stats.time_estimate / 3600).toFixed(2))
    //             : 0;

    //         let spentTime = issue.time_stats.total_time_spent
    //             ? parseFloat((issue.time_stats.total_time_spent / 3600).toFixed(2))
    //             : 0;

    //         for (const note of notesLog) {
    //             // console.log(note);

    //             if (
    //                 note.system &&
    //                 note.body &&
    //                 latestStartDateChange === '' &&
    //                 note.body.toLowerCase().includes('changed start date')
    //             ) {
    //                 // Tìm ngày dạng "Month dd, yyyy" bằng regex
    //                 const dateMatch = note.body.match(/\b([A-Za-z]+ \d{2}, \d{4})\b/);

    //                 if (dateMatch) {
    //                     const parsedDate = new Date(dateMatch[1]);

    //                     const day = String(parsedDate.getDate()).padStart(2, '0');
    //                     const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    //                     const year = parsedDate.getFullYear();

    //                     latestStartDateChange = `${year}-${month}-${day}`;
    //                 }
    //             }

    //             if (
    //                 !note.system &&
    //                 note.body &&
    //                 note.body.toLowerCase().includes('reopen') || note.body.toLowerCase().includes('reopend')
    //             ) {
    //                 reopenTime += 1;
    //             }
    //         }

    //         if ((issue.labels.length > 0 && issue.labels.includes("REOPEN"))) {
    //             reopenTime += 1;
    //         }

    //         let progressStatus = "Đúng hạn";

    //         const currentDate = new Date();
    //         const closeDateFormat = issue.closed_at ? new Date(issue.closed_at).toISOString().slice(0, 10) : '';

    //         if (closeDateFormat && issue.due_date) {
    //             progressStatus = compareDate(closeDateFormat, issue.due_date) >= 0 ? "Đúng hạn" : "Trễ hạn";
    //         } else if (!closeDateFormat && issue.due_date && new Date(issue.due_date) < currentDate) {
    //             progressStatus = "Trễ hạn";
    //         }

    //         const workItemDetail = {
    //             taskUrl: projectUrl,
    //             startDate: formatDate(latestStartDateChange ? latestStartDateChange : ''),
    //             dueDate: formatDate(issue.due_date ? issue.due_date : ''),
    //             closeDate: formatDate(closeDateFormat),
    //             estimate: esimateTime,
    //             spent: spentTime,
    //             reopenTotal: reopenTime,
    //             type: (issue.labels.length > 0 && issue.labels.includes("UNPLANNED")) ? "Phát sinh" : "Kế hoạch",
    //             progress: progressStatus,
    //             groupName: groupName
    //         };

    //         return workItemDetail;
    //     } else {
    //         return null;
    //     }
    // }


    async function getActivityLog(token, projectId, issueIid) {
        const res = await fetch(`https://gitlab.widosoft.com/api/v4/projects/${projectId}/issues/${issueIid}/notes`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const notes = await res.json();
        return notes;
    }


    async function getWorkItemDetailNew(createAt, projectUrl, groupName) {
        const { projectPath, issueIid } = parseGitLabWorkItemUrl(projectUrl);
        const token = await getAccessToken();

        const workDetailData = await getTaskDetail(token, projectPath, issueIid);

        if (workDetailData) {
            const workItem = workDetailData.workItem;
            const closeDateFormat = workItem.closedAt ? new Date(workItem.closedAt).toISOString().slice(0, 10) : '';

            const widgets = workItem.widgets

            // Start and due date
            const widgetStartDueDate = widgets.find(widget => widget.type === "START_AND_DUE_DATE");
            const startDate = formatDate(widgetStartDueDate.startDate);
            const dueDate = widgetStartDueDate.dueDate;

            let progressStatus = "Đúng hạn";
            const currentDate = new Date();

            if (closeDateFormat && dueDate) {
                progressStatus = compareDate(closeDateFormat, dueDate) >= 0 ? "Đúng hạn" : "Trễ hạn";
            } else if (!closeDateFormat && dueDate && new Date(dueDate) < currentDate) {
                progressStatus = "Trễ hạn";
            }

            // Time tracking widget
            const widgetTimeTracking = widgets.find(widget => widget.type === "TIME_TRACKING");

            let esimateTimeTotal = widgetTimeTracking.timeEstimate;
            let spentTimeTotal = widgetTimeTracking.totalTimeSpent;

            let spentTimeReal = 0;
            let estimateTimeReal = 0;
            const timeLogs = widgetTimeTracking.timelogs;
            if (timeLogs.nodes.length > 0) {
                let previousSpentTime = 0;

                timeLogs.nodes.forEach(timeLog => {
                    const spentAt = new Date(timeLog.spentAt).toISOString().slice(0, 10);
                    const formatSpentAt = formatDate(spentAt);

                    if (isInPreviousWeek(formatSpentAt)) {
                        previousSpentTime += timeLog.timeSpent;
                    }
                });
                // Recalculate estimate, spend time:
                spentTimeReal = spentTimeTotal - previousSpentTime;

                if (previousSpentTime > 0) {
                    estimateTimeReal = 0;
                } else {
                    estimateTimeReal = esimateTimeTotal;
                }
            } else {
                spentTimeReal = spentTimeTotal;
                estimateTimeReal = esimateTimeTotal;
            }

            // Label widget
            let type = "Kế hoạch";
            const widgetLabel = widgets.find(widget => widget.type === "LABELS");
            const labelNodes = widgetLabel.labels.nodes;
            labelNodes.forEach(label => {
                if (label.title == "UNPLANNED") {
                    type = "Phát sinh";
                } else {
                    type = "Kế hoạch";
                }
            })

            // Assignee widget
            const widgetAssinee = widgets.find(widget => widget.type === "ASSIGNEES");
            const assigneeId = widgetAssinee.assignees.nodes[0].id;

            // Activity log
            let reopenTotal = 0;
            const taskNoteLogs = await getTaskActivityLog(token, projectPath, issueIid);
            if (taskNoteLogs) {
                const taskNoteLogDetail = taskNoteLogs.workItem;

                if (taskNoteLogDetail) {
                    const taskNoteLogWidget = taskNoteLogDetail.widgets.find(widget => widget.type === "NOTES")
                    const taskNoteLogsList = taskNoteLogWidget.discussions.nodes;

                    taskNoteLogsList.forEach(noteLog => {
                        const noteDetails = noteLog.notes.nodes;

                        noteDetails.forEach(noteDetail => {
                            const noteAuthor = noteDetail.author;
                            const noteCreatedAt = new Date(noteDetail.createdAt).toISOString().slice(0, 10);
                            const formatCreatedAt = formatDate(noteCreatedAt);

                            // Only get reopen this week
                            if (noteDetail.body == 'reopened' && noteAuthor.id != assigneeId && !isInPreviousWeek(formatCreatedAt)) {
                                reopenTotal += 1;
                            }
                        })
                    })
                }

            }

            const returnData = {
                taskUrl: workItem.webUrl,
                startDate: startDate,
                dueDate: formatDate(dueDate),
                closeDate: formatDate(closeDateFormat),
                estimate: estimateTimeReal ? parseFloat((estimateTimeReal / 3600).toFixed(2)) : 0,
                spent: spentTimeReal ? parseFloat((spentTimeReal / 3600).toFixed(2)) : 0,
                reopenTotal: reopenTotal,
                type: type,
                progress: progressStatus,
                groupName: groupName,
                addedAt: createAt
            };

            return returnData;
        } else {
            return null;
        }

    }

    async function getTaskDetail(token, fullPath, iid) {
        const queryData = {
            operationName: "namespaceWorkItem",
            variables: {
                fullPath: `${fullPath}`, // fullPath,
                iid: `${iid}`, // iid
            },
            query: `
           query namespaceWorkItem($fullPath: ID!, $iid: String!) {
  workspace: namespace(fullPath: $fullPath) {
    id
    workItem(iid: $iid) {
      ...WorkItem
      __typename
    }
    __typename
  }
}

fragment WorkItem on WorkItem {
  id
  iid
  archived
  title
  state
  description
  confidential
  createdAt
  closedAt
  webUrl
  reference(full: true)
  createNoteEmail
  project {
    id
    __typename
  }
  namespace {
    id
    fullPath
    name
    fullName
    __typename
  }
  author {
    ...Author
    __typename
  }
  workItemType {
    id
    name
    iconName
    __typename
  }
  widgets {
    ...WorkItemWidgets
    __typename
  }
  __typename
}

fragment WorkItemWidgets on WorkItemWidget {
  type
  ... on WorkItemWidgetDescription {
    description
    descriptionHtml
    lastEditedAt
    lastEditedBy {
      name
      webPath
      __typename
    }
    taskCompletionStatus {
      completedCount
      count
      __typename
    }
    __typename
  }
  ... on WorkItemWidgetAssignees {
    allowsMultipleAssignees
    canInviteMembers
    assignees {
      nodes {
        ...User
        __typename
      }
      __typename
    }
    __typename
  }
  ... on WorkItemWidgetLabels {
    labels {
      nodes {
        ...Label
        __typename
      }
      __typename
    }
    __typename
  }
  ... on WorkItemWidgetStartAndDueDate {
    dueDate
    startDate
    __typename
  }
  ... on WorkItemWidgetTimeTracking {
    timeEstimate
    timelogs {
      nodes {
        ...TimelogFragment
        __typename
      }
      __typename
    }
    totalTimeSpent
    __typename
  }
  ... on WorkItemWidgetNotes {
    discussionLocked
    __typename
  }
  __typename
}

fragment Label on Label {
  id
  title
  description
  color
  textColor
  __typename
}

fragment User on User {
  id
  avatarUrl
  name
  username
  webUrl
  webPath
  __typename
}

fragment TimelogFragment on WorkItemTimelog {
  __typename
  id
  timeSpent
  user {
    id
    name
    __typename
  }
  spentAt
  note {
    id
    body
    __typename
  }
  summary
  userPermissions {
    adminTimelog
    __typename
  }
}

fragment Author on User {
  id
  avatarUrl
  name
  username
  webUrl
  webPath
  __typename
}

            `
        };

        const response = await fetch('https://gitlab.widosoft.com/api/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(queryData),
        });

        const res = await response.json();
        return res.data.workspace;
    }

    async function getTaskActivityLog(token, fullPath, iid) {
        const queryData = {
            operationName: "workItemNotesByIid",
            variables: {
                fullPath: `${fullPath}`, // fullPath,
                iid: `${iid}`, // iid
                pageSize: 40
            },
            query: `
            query workItemNotesByIid($fullPath: ID!, $iid: String!, $after: String, $pageSize: Int) {
  workspace: namespace(fullPath: $fullPath) {
    id
    workItem(iid: $iid) {
      id
      iid
      namespace {
        id
        __typename
      }
      widgets {
        ... on WorkItemWidgetNotes {
          type
          discussionLocked
          discussions(first: $pageSize, after: $after, filter: ALL_NOTES) {
            pageInfo {
              ...PageInfo
              __typename
            }
            nodes {
              id
              notes {
                nodes {
                  ...WorkItemNote
                  __typename
                }
                __typename
              }
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment PageInfo on PageInfo {
  hasNextPage
  hasPreviousPage
  startCursor
  endCursor
  __typename
}

fragment WorkItemNote on Note {
  id
  body
  bodyHtml
  system
  internal
  systemNoteIconName
  createdAt
  lastEditedAt
  url
  authorIsContributor
  maxAccessLevelOfAuthor
  externalAuthor
  lastEditedBy {
    ...User
    webPath
    __typename
  }
  discussion {
    id
    resolved
    resolvable
    resolvedBy {
      id
      name
      __typename
    }
    __typename
  }
  author {
    ...User
    __typename
  }
  systemNoteMetadata {
    id
    __typename
  }
  __typename
}

fragment User on User {
  id
  avatarUrl
  name
  username
  webUrl
  webPath
  __typename
}
            `
        };
        const response = await fetch('https://gitlab.widosoft.com/api/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(queryData),
        });

        const res = await response.json();
        return res.data.workspace;
    }

    function parseGitLabWorkItemUrl(url) {
        const match = url.match(/^https?:\/\/[^/]+\/(.+)\/-\/work_items\/(\d+)$/);
        if (!match) {
            throw new Error('Invalid GitLab work item URL');
        }

        const fullPath = match[1]; // e.g., "wido-chat-app-ms/nu2-neighbor-mate/web-app"
        const issueIid = parseInt(match[2], 10); // e.g., 143

        return {
            projectPath: fullPath,
            issueIid: issueIid
        };
    }

    function renderEmptyTable() {
        const container = document.getElementById('allTaskContainer');
        container.innerHTML = ''; // Clear table mỗi lần render
        document.getElementById('getDetailBtn').disabled = true;
        document.getElementById('getDetailBtn').classList.add('disabled-btn');

        const table = document.createElement('table');
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.innerHTML = `
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>Group name</th>
                        <th>Ngày tạo</th>
                        <th>Tác vụ</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="4" style="text-align:center; padding: 12px; color: #666;">
                            Không có dữ liệu
                        </td>
                    </tr>
                </tbody>
            `;

        container.appendChild(table);
    }

})();
