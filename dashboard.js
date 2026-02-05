document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Check ---
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
        window.location.href = 'index.html';
        return;
    }
    const currentUser = JSON.parse(currentUserRaw);

    // Update Profile Name
    const userProfileName = document.querySelector('.user-profile span');
    if (userProfileName) userProfileName.textContent = currentUser.name;

    // Logout Logic
    const logoutLink = document.querySelector('.logout a');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        });
    }

    // Global Data Key (Shared by all who have the admin password)
    const DATA_KEY = 'pis_global_data';

    // ... (Rest of existing variables)
    const tableBody = document.querySelector('#dataTable tbody');
    const addRowBtn = document.getElementById('addRowBtn');
    const add50Btn = document.getElementById('add50Btn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    // Pagination Elements
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    const jumpPageInput = document.getElementById('jumpPageInput');
    const jumpPageBtn = document.getElementById('jumpPageBtn');
    const startIndexSpan = document.getElementById('startIndex');
    const endIndexSpan = document.getElementById('endIndex');
    const totalEntriesSpan = document.getElementById('totalEntries');

    // State
    const ROWS_PER_PAGE = 20;
    let currentPage = 1;
    let tableData = []; // Array of Objects to store data
    let platformOptions = [];
    let fittingOptions = [];
    const defaultPlatforms = ['rw', 'Tappe', 'ms', 'HR', 'HR Trendy', 'Trendy Culture', 'Textile centere', 'Trendy piyush', 'Ajio - Junuku', 'Ajio - 2 De', 'Ajio - Jihu', 'my - De', 'my - Jihu'];
    const defaultFittings = ['chacha', 'jahangir', 'jitu'];

    // --- Platform/Fitting Management Functions ---
    function loadPlatforms() {
        const stored = localStorage.getItem('pis_platforms');
        if (stored) {
            platformOptions = JSON.parse(stored);
        } else {
            platformOptions = [...defaultPlatforms];
            savePlatforms();
        }
    }

    function savePlatforms() {
        localStorage.setItem('pis_platforms', JSON.stringify(platformOptions));
    }

    function loadFittings() {
        const stored = localStorage.getItem('pis_fittings');
        if (stored) {
            fittingOptions = JSON.parse(stored);
        } else {
            fittingOptions = [...defaultFittings];
            saveFittings();
        }
    }

    function saveFittings() {
        localStorage.setItem('pis_fittings', JSON.stringify(fittingOptions));
    }

    // --- Data Management Functions ---

    // --- Data Management (Firebase Cloud Sync) ---

    let dbRef = null;
    let isFirebaseConnected = false;

    // Hardcoded Configuration (Auto-Sync)
    const firebaseConfig = {
        apiKey: "AIzaSyBryHZVts2tNd3PY1inZI5olVOJz0sd3XM",
        authDomain: "piss-297ff.firebaseapp.com",
        databaseURL: "https://piss-297ff-default-rtdb.firebaseio.com",
        projectId: "piss-297ff",
        storageBucket: "piss-297ff.firebasestorage.app",
        messagingSenderId: "224754497264",
        appId: "1:224754497264:web:32a0f0f3419460fc997435",
        measurementId: "G-9X6G4LC7DJ"
    };

    const firebaseStatus = document.getElementById('firebaseStatus');

    // Initialize Immediately
    initFirebase(firebaseConfig);

    function initFirebase(config) {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }

            // Authenticate Anonymously first
            const auth = firebase.auth();
            auth.signInAnonymously()
                .then(() => {
                    // Signed in..
                    const database = firebase.database();

                    // Reference to Global Data
                    dbRef = database.ref('pis_global_data');

                    updateFirebaseStatus('connected');
                    isFirebaseConnected = true;

                    // --- Realtime Listener ---
                    dbRef.on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data && Array.isArray(data)) {
                            if (JSON.stringify(data) !== JSON.stringify(tableData)) {
                                tableData = data;
                                localStorage.setItem(DATA_KEY, JSON.stringify(tableData));

                                const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE) || 1;
                                if (currentPage > totalPages) currentPage = totalPages;
                                renderTable();
                                console.log("☁️ Synced from Cloud (Updated)");
                            }
                        }
                    });
                })
                .catch((error) => {
                    console.error("Auth Error:", error);
                    updateFirebaseStatus('error');
                    alert("Authentication Failed. Check console.");
                });

        } catch (error) {
            console.error("Firebase Error:", error);
            updateFirebaseStatus('error');
        }
    }

    function updateFirebaseStatus(status) {
        if (!firebaseStatus) return;
        if (status === 'connected') {
            firebaseStatus.textContent = "✅ Auto-Sync Active";
            firebaseStatus.style.color = "#10b981";
        } else {
            firebaseStatus.textContent = "❌ Connection Failed";
            firebaseStatus.style.color = "#ef4444";
        }
    }

    function loadFromLocalStorage() {
        // We load local first to be instant
        let storedData = localStorage.getItem(DATA_KEY);
        if (!storedData) {
            // Migration checks...
            const legacyUserKey = `pis_table_data_maniyadhruvik07@gmail.com`;
            const userStore = localStorage.getItem(legacyUserKey);
            if (userStore) {
                storedData = userStore;
                localStorage.setItem(DATA_KEY, storedData);
            } else {
                const legacyData = localStorage.getItem('pis_table_data');
                if (legacyData) {
                    storedData = legacyData;
                    localStorage.setItem(DATA_KEY, storedData);
                }
            }
        }

        if (storedData) {
            tableData = JSON.parse(storedData);
        } else {
            tableData = [];
            tableData.push(addNewEntryObject());
        }
        renderTable();
    }

    function saveToLocalStorage() {
        // 1. Save Local
        localStorage.setItem(DATA_KEY, JSON.stringify(tableData));

        // 2. Sync to Cloud (if connected)
        if (isFirebaseConnected && dbRef) {
            dbRef.set(tableData).catch(err => console.error("Cloud Save Error:", err));
        }
    }

    function addNewEntryObject() {
        const today = new Date().toISOString().split('T')[0];
        return {
            date: today,
            orderDate: '',
            orderNo: '',
            designNo: '',
            blouseSize: '',
            customize: '',
            kotiSize: '',
            kurtaSize: '',
            platform: '',
            fittingName: '',
            finalDate: '', // Deadline
            receiveDate: ''
        };
    }

    // --- Core Functions ---

    function addRows(count) {
        for (let i = 0; i < count; i++) {
            tableData.push(addNewEntryObject());
        }
        saveToLocalStorage();
        // If adding many rows, maybe jump to the last page? Or stay current.
        // Let's stay on current unless we were on the last page.
        const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE);
        if (currentPage < totalPages && currentPage !== 1) {
            // Optional: Move to last page if user wants to see new entries immediately
            // currentPage = totalPages; 
        }
        renderTable();
    }

    function deleteRow(item) {
        const index = tableData.indexOf(item);
        if (index > -1) {
            tableData.splice(index, 1);
        }
        saveToLocalStorage();

        // Adjust pagination if needed
        const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE) || 1;
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        renderTable();
    }

    function clearAll() {
        if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
            tableData = [];
            tableData.push(addNewEntryObject()); // Keep one empty row
            saveToLocalStorage();
            currentPage = 1;
            renderTable();
        }
    }

    // --- Rendering ---

    let searchQuery = '';

    function createRowElement(data, displayIndex) {
        // Calculate globalRowIndex just for display purposes (optional)
        // If we want the serial number to be 1, 2, 3... of the filtered list, use displayIndex
        // If we want the Serial Number to be the ID in the main list, use indexOf.
        // Let's use displayIndex + 1 for now so the list always looks clean 1..N
        const row = document.createElement('tr');

        row.innerHTML = `
            <td class="row-index">${displayIndex + 1}</td>
            <td><input type="date" data-field="date" value="${data.date || ''}"></td>
            <td><input type="date" data-field="orderDate" value="${data.orderDate || ''}"></td>
            <td><input type="text" data-field="orderNo" placeholder="Order No" value="${data.orderNo || ''}"></td>
            <td><input type="text" data-field="designNo" placeholder="Design No" value="${data.designNo || ''}"></td>
            <td><input type="text" data-field="blouseSize" placeholder="Size" value="${data.blouseSize || ''}"></td>
            <td><input type="text" data-field="customize" placeholder="Customize" value="${data.customize || ''}"></td>
            <td><input type="text" data-field="kotiSize" placeholder="Koti Size" value="${data.kotiSize || ''}"></td>
            <td><input type="text" data-field="kurtaSize" placeholder="Kurta Size" value="${data.kurtaSize || ''}"></td>
            <td>
                <select data-field="platform">
                    <option value="">Select Platform</option>
                    ${platformOptions.map(opt => `<option value="${opt}" ${data.platform === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </td>
            <td>
                <select data-field="fittingName">
                    <option value="">Select Fitting</option>
                    ${fittingOptions.map(opt => `<option value="${opt}" ${data.fittingName === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </td>
            <td><input type="date" data-field="finalDate" value="${data.finalDate || ''}"></td>
            <td><input type="date" data-field="receiveDate" value="${data.receiveDate || ''}"></td>
            <td style="text-align: center;">
                <button class="delete-btn" title="Delete Row"><i class="fas fa-trash"></i></button>
            </td>
        `;

        // Event Listeners for Inputs (Data Binding)
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const field = e.target.getAttribute('data-field');
                data[field] = e.target.value; // Bind directly to the object reference
                saveToLocalStorage(); // Auto-save on every keystroke/change
            });
        });

        // Event Listener for Delete
        const deleteBtn = row.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to delete this row?")) {
                deleteRow(data); // Pass the object itself
            }
        });

        return row;
    }

    function renderTable() {
        // Clear current table body
        tableBody.innerHTML = '';

        // 1. Filter Data
        let displayData = tableData;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            displayData = tableData.filter(row => {
                return (
                    (row.orderNo && row.orderNo.toLowerCase().includes(query)) ||
                    (row.designNo && row.designNo.toLowerCase().includes(query)) ||
                    (row.platform && row.platform.toLowerCase().includes(query)) ||
                    (row.fittingName && row.fittingName.toLowerCase().includes(query)) ||
                    (row.blouseSize && row.blouseSize.toLowerCase().includes(query)) ||
                    (row.customize && row.customize.toLowerCase().includes(query)) ||
                    (row.date && row.date.includes(query)) // Date string YYYY-MM-DD
                );
            });
        }

        const totalRows = displayData.length;
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;

        // Ensure currentPage is valid
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        // Calculate slice
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        const end = Math.min(start + ROWS_PER_PAGE, totalRows);

        // Loop through the slice and create row elements
        for (let i = start; i < end; i++) {
            // displayData[i] is the object. "i" is the index in the FILTERED list (for this page slice context, but we want continuous count)
            const rowElement = createRowElement(displayData[i], i);
            tableBody.appendChild(rowElement);
        }

        // Update UI info
        startIndexSpan.textContent = totalRows > 0 ? start + 1 : 0;
        endIndexSpan.textContent = end;
        totalEntriesSpan.textContent = totalRows;
        pageIndicator.textContent = `Page ${currentPage} of ${totalPages} `;

        // Update Buttons
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
    }

    // --- Pagination Logic ---

    function changePage(direction) {
        currentPage += direction;
        renderTable();
    }

    function jumpToPage() {
        const pageNum = parseInt(jumpPageInput.value);
        const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE) || 1;

        if (pageNum >= 1 && pageNum <= totalPages) {
            currentPage = pageNum;
            renderTable();
            jumpPageInput.value = '';
        } else {
            alert(`Please enter a page number between 1 and ${totalPages} `);
        }
    }

    // --- Event Listeners ---

    addRowBtn.addEventListener('click', () => addRows(1));
    add50Btn.addEventListener('click', () => addRows(50));
    clearAllBtn.addEventListener('click', clearAll);

    prevBtn.addEventListener('click', () => changePage(-1));
    nextBtn.addEventListener('click', () => changePage(1));

    jumpPageBtn.addEventListener('click', jumpToPage);
    jumpPageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') jumpToPage();
    });

    // --- Search Listener ---
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            currentPage = 1; // Reset to page 1 on search
            renderTable();
        });
    }

    // --- Tab Switching Logic ---
    const navData = document.getElementById('navData');
    const navReports = document.getElementById('navReports');
    const navDateWise = document.getElementById('navDateWise');
    const navLatePis = document.getElementById('navLatePis');

    const dataSection = document.getElementById('dataSection');
    const reportsSection = document.getElementById('reportsSection');
    const dateWiseSection = document.getElementById('dateWiseSection');
    const latePisSection = document.getElementById('latePisSection');
    const settingsSection = document.getElementById('settingsSection');

    // settings nav
    const navSettings = document.getElementById('navSettings');

    function switchTab(tab) {
        // Reset all
        dataSection.style.display = 'none';
        reportsSection.style.display = 'none';
        dateWiseSection.style.display = 'none';
        latePisSection.style.display = 'none';
        settingsSection.style.display = 'none';

        navData.classList.remove('active');
        navReports.classList.remove('active');
        navDateWise.classList.remove('active');
        navLatePis.classList.remove('active');
        navSettings.classList.remove('active');

        if (tab === 'data') {
            dataSection.style.display = 'flex';
            navData.classList.add('active');
        } else if (tab === 'reports') {
            reportsSection.style.display = 'flex';
            navReports.classList.add('active');
        } else if (tab === 'datewise') {
            dateWiseSection.style.display = 'flex';
            navDateWise.classList.add('active');
        } else if (tab === 'latepis') {
            latePisSection.style.display = 'flex';
            navLatePis.classList.add('active');
        } else if (tab === 'settings') {
            settingsSection.style.display = 'flex';
            navSettings.classList.add('active');
        }
    }

    navData.addEventListener('click', (e) => { e.preventDefault(); switchTab('data'); });
    navReports.addEventListener('click', (e) => { e.preventDefault(); switchTab('reports'); });
    navDateWise.addEventListener('click', (e) => { e.preventDefault(); switchTab('datewise'); });
    navLatePis.addEventListener('click', (e) => { e.preventDefault(); switchTab('latepis'); });
    navSettings.addEventListener('click', (e) => { e.preventDefault(); switchTab('settings'); });

    // --- Backup & Restore Logic ---
    const backupDataBtn = document.getElementById('backupDataBtn');
    const restoreDataBtn = document.getElementById('restoreDataBtn');
    const restoreDataInput = document.getElementById('restoreDataInput');

    backupDataBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(tableData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 10);
        a.download = `pis_data_backup_${currentUser.name}_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    restoreDataBtn.addEventListener('click', () => {
        restoreDataInput.click();
    });

    restoreDataInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    if (confirm(`About to overwrite current data with ${importedData.length} entries from backup.Continue ? `)) {
                        tableData = importedData;
                        saveToLocalStorage();
                        renderTable();
                        alert("Data restored successfully!");
                    }
                } else {
                    alert("Invalid backup file format.");
                }
            } catch (err) {
                alert("Error reading file: " + err.message);
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    });

    // --- Late PIS Report Logic ---
    const generateLateReportBtn = document.getElementById('generateLateReportBtn');
    const lateStartDate = document.getElementById('lateStartDate');
    const lateEndDate = document.getElementById('lateEndDate');
    // Threshold input is no longer needed but we might want to keep it or remove it from HTML. 
    // Ideally remove but for now just ignore it in JS.
    const latePisTableBody = document.querySelector('#latePisTable tbody');

    generateLateReportBtn.addEventListener('click', () => {
        const start = lateStartDate.value;
        const end = lateEndDate.value;

        if (!start || !end) {
            alert("Please select both Start Date and End Date");
            return;
        }

        const startDate = start;
        const endDate = end;

        const reportMap = {};
        const today = new Date(); // For checking if pending items are overdue

        tableData.forEach(row => {
            // Filter by Final Date (Deadline) instead of Entry Date
            if (!row.finalDate) return;
            const filterDate = row.finalDate;

            // Filter by date range
            if (filterDate >= startDate && filterDate <= endDate) {
                const finalDate = new Date(row.finalDate);

                // Count row as 1 item
                let itemsInRow = 1;

                if (itemsInRow > 0) {
                    const design = row.designNo || "Unknown";
                    if (!reportMap[design]) {
                        reportMap[design] = { total: 0, late: 0 };
                    }

                    // This item is "Expected" or "Done", so it counts towards the total we track
                    reportMap[design].total += itemsInRow;

                    let isLate = false;

                    // Check Lateness (ONLY if Received)
                    if (row.receiveDate && row.receiveDate.trim() !== '') {
                        // Item is Received: Compare Receive vs Final
                        const receiveDate = new Date(row.receiveDate);
                        if (receiveDate > finalDate) {
                            isLate = true;
                        }
                    }

                    if (isLate) {
                        reportMap[design].late += itemsInRow;
                    }
                }
            }
        });

        // Result Elements
        const totalLateCell = document.getElementById('lateTotalLate');

        // Variables for Grand Totals
        let grandTotalItems = 0; // Total items considered (denominator)
        let grandLate = 0;

        // Render Table
        latePisTableBody.innerHTML = '';
        const designs = Object.keys(reportMap).sort();

        designs.forEach(design => {
            const data = reportMap[design];

            grandTotalItems += data.total;
            grandLate += data.late;

            // Calculate Percentage: (Late / Total with Final Date) * 100
            const percentage = data.total > 0 ? ((data.late / data.total) * 100).toFixed(2) : 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
            < td > ${design}</td >
                <td>${data.late}</td>
                <td>${percentage}%</td>
        `;
            latePisTableBody.appendChild(tr);
        });

        if (designs.length === 0) {
            latePisTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No data with Final Dates found for this range.</td></tr>';
        }

        // Update Grand Totals
        totalLateCell.textContent = grandLate;

        // Calculate Overall Percentage (Total Late / Total Items)
        const totalPercentage = grandTotalItems > 0 ? ((grandLate / grandTotalItems) * 100).toFixed(2) : "0.00";

        // Find or Create the percentage cell in the footer
        let percentCell = document.getElementById('lateTotalPercentage');
        if (percentCell) percentCell.textContent = totalPercentage + '%';
    });

    // --- Report (Total Pending) Generation Logic ---
    const generateReportBtn = document.getElementById('generateReportBtn');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    // Result Elements (Table body and Footers)
    const reportTableBody = document.querySelector('#reportTable tbody');
    const grandTotalCell = document.getElementById('grandTotal');

    generateReportBtn.addEventListener('click', () => {
        const start = startDateInput.value;
        const end = endDateInput.value;

        if (!start || !end) {
            alert("Please select both Start Date and End Date");
            return;
        }

        const startDate = start;
        const endDate = end;

        // Grouping Data
        const reportMap = {};

        let grandTotal = 0;

        tableData.forEach(row => {
            // Filter by Final Date (Deadline)
            if (!row.finalDate) return;
            const filterDate = row.finalDate;

            // Filter by date range
            if (filterDate >= startDate && filterDate <= endDate) {
                // Determine if pending based on Receive Date (Empty or Null)
                if (!row.receiveDate || row.receiveDate.trim() === '') {
                    const design = row.designNo || "Unknown";
                    const platform = row.platform || "-";
                    const orderNo = row.orderNo || "-";

                    const key = `${orderNo}| ${design}| ${platform} `;

                    if (!reportMap[key]) {
                        reportMap[key] = { orderNo: orderNo, design: design, platform: platform, count: 0 };
                    }

                    // Count the row itself as 1 pending item, regardless of sizes
                    let itemsInRow = 1;

                    // If itemsInRow > 0, add to map
                    if (itemsInRow > 0) {
                        reportMap[key].count += itemsInRow;
                        grandTotal += itemsInRow;
                    }
                }
            }
        });

        // Render Table
        reportTableBody.innerHTML = '';

        // Sort designs alphabetically/numerically
        const keys = Object.keys(reportMap).sort();

        keys.forEach(key => {
            const data = reportMap[key];
            // Only show designs that have at least one pending item
            if (data.count > 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
            < td > ${data.orderNo}</td >
                    <td>${data.design}</td>
                    <td>${data.platform}</td>
                    <td>${data.count}</td>
        `;
                reportTableBody.appendChild(tr);
            }
        });

        if (keys.length === 0 || grandTotal === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending data found for this date range.</td></tr>';
        }

        // Update Grand Totals
        grandTotalCell.textContent = grandTotal;
    });

    // --- Date Wise Pending Logic ---
    const generateDateWiseBtn = document.getElementById('generateDateWiseBtn');
    const dateWiseStartDate = document.getElementById('dateWiseStartDate');
    const dateWiseEndDate = document.getElementById('dateWiseEndDate');
    const dateWiseTableBody = document.querySelector('#dateWiseTable tbody');
    const dateWiseGrandTotal = document.getElementById('dateWiseGrandTotal');

    generateDateWiseBtn.addEventListener('click', () => {
        const start = dateWiseStartDate.value;
        const end = dateWiseEndDate.value;

        if (!start || !end) {
            alert("Please select both Start Date and End Date");
            return;
        }

        const startDate = start;
        const endDate = end;

        const reportData = [];
        let grandTotal = 0;

        tableData.forEach(row => {
            // Filter by Final Date (Deadline)
            if (!row.finalDate) return;
            const filterDate = row.finalDate;

            if (filterDate >= startDate && filterDate <= endDate) {
                // Check for empty Receive Date
                if (!row.receiveDate || row.receiveDate.trim() === '') {
                    const design = row.designNo || "Unknown";
                    const platform = row.platform || "-";
                    const orderNo = row.orderNo || "-";

                    // Count the row itself as 1 pending item
                    let itemsInRow = 1;

                    if (itemsInRow > 0) {
                        // Check if we already have an entry for this Deadline + Design + Platform + OrderNo
                        // We use row.finalDate as the 'date' property for grouping
                        const existingEntry = reportData.find(item => item.date === row.finalDate && item.design === design && item.platform === platform && item.orderNo === orderNo);
                        if (existingEntry) {
                            existingEntry.count += itemsInRow;
                        } else {
                            reportData.push({ date: row.finalDate, orderNo: orderNo, design: design, platform: platform, count: itemsInRow });
                        }
                        grandTotal += itemsInRow;
                    }
                }
            }
        });

        // Sort by Date then by Design No
        reportData.sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            // If dates are equal, sort by Order No
            if (a.orderNo < b.orderNo) return -1;
            if (a.orderNo > b.orderNo) return 1;
            // If Order No is equal, sort by design
            if (a.design < b.design) return -1;
            if (a.design > b.design) return 1;
            // If design is also equal, sort by platform
            if (a.platform < b.platform) return -1;
            if (a.platform > b.platform) return 1;
            return 0;
        });

        dateWiseTableBody.innerHTML = '';
        reportData.forEach(item => {
            // Format Date to DD-MM-YYYY
            const [year, month, day] = item.date.split('-');
            const formattedDate = `${day} -${month} -${year} `;

            const tr = document.createElement('tr');
            tr.innerHTML = `< td > ${formattedDate}</td ><td>${item.orderNo}</td><td>${item.design}</td><td>${item.platform}</td><td>${item.count}</td>`;
            dateWiseTableBody.appendChild(tr);
        });

        if (reportData.length === 0) {
            dateWiseTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No pending data found for this date range.</td></tr>';
        }
        dateWiseGrandTotal.textContent = grandTotal;
    });

    // --- PDF Export Logic ---
    const exportTotalPendingPdfBtn = document.getElementById('exportTotalPendingPdfBtn');
    const exportDateWisePdfBtn = document.getElementById('exportDateWisePdfBtn');

    exportTotalPendingPdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const title = `Total Pending Report(${startDate} to ${endDate})`;

        doc.text(title, 14, 15);

        doc.autoTable({
            html: '#reportTable',
            startY: 20,
            theme: 'grid',
            headStyles: { fillColor: [244, 114, 182] }, // Match primary color pink-ish
            footStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
            styles: { fontSize: 10, cellPadding: 3 },
        });

        doc.save(`Total_Pending_${startDate}_${endDate}.pdf`);
    });

    exportDateWisePdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const startDate = dateWiseStartDate.value;
        const endDate = dateWiseEndDate.value;
        const title = `Date Wise Pending Report(${startDate} to ${endDate})`;

        doc.text(title, 14, 15);

        doc.autoTable({
            html: '#dateWiseTable',
            startY: 20,
            theme: 'grid',
            headStyles: { fillColor: [168, 85, 247] }, // Match secondary color purple-ish
            footStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
            styles: { fontSize: 10, cellPadding: 3 },
        });

        doc.save(`Date_Wise_Pending_${startDate}_${endDate}.pdf`);
    });

    // Initialize
    loadPlatforms();
    loadFittings();
    loadFromLocalStorage();

    // --- Platform Modal Logic ---
    const platformModal = document.getElementById('platformModal');
    const managePlatformsBtn = document.getElementById('managePlatformsBtn');
    const closePlatformModal = document.querySelector('.close-modal'); // Selects the first one
    const addPlatformBtn = document.getElementById('addPlatformBtn');
    const newPlatformInput = document.getElementById('newPlatformInput');
    const platformList = document.getElementById('platformList');

    // --- Fitting Modal Logic ---
    const fittingModal = document.getElementById('fittingModal');
    const manageFittingsBtn = document.getElementById('manageFittingsBtn');
    const closeFittingModal = document.querySelector('.close-fitting-modal');
    const addFittingBtn = document.getElementById('addFittingBtn');
    const newFittingInput = document.getElementById('newFittingInput');
    const fittingList = document.getElementById('fittingList');

    // --- Generic Modal Helpers ---
    function openModal(modal, renderFn) {
        renderFn();
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
    }

    // --- Platform Logic ---
    function renderPlatformList() {
        platformList.innerHTML = '';
        platformOptions.forEach((platform, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
            < span > ${platform}</span >
                <button class="platform-delete-btn" data-type="platform" data-index="${index}"><i class="fas fa-trash"></i></button>
        `;
            platformList.appendChild(li);
        });
        attachDeleteListeners('platform');
    }

    function addPlatform() {
        const newVal = newPlatformInput.value.trim();
        if (newVal && !platformOptions.includes(newVal)) {
            platformOptions.push(newVal);
            savePlatforms();
            newPlatformInput.value = '';
            renderPlatformList();
            renderTable();
        } else if (platformOptions.includes(newVal)) {
            alert('Platform already exists!');
        }
    }

    function deletePlatform(index) {
        if (confirm(`Delete "${platformOptions[index]}" ? `)) {
            platformOptions.splice(index, 1);
            savePlatforms();
            renderPlatformList();
            renderTable();
        }
    }

    // --- Fitting Logic ---
    function renderFittingList() {
        fittingList.innerHTML = '';
        fittingOptions.forEach((fitting, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
            < span > ${fitting}</span >
                <button class="platform-delete-btn" data-type="fitting" data-index="${index}"><i class="fas fa-trash"></i></button>
        `;
            fittingList.appendChild(li);
        });
        attachDeleteListeners('fitting');
    }

    function addFitting() {
        const newVal = newFittingInput.value.trim();
        if (newVal && !fittingOptions.includes(newVal)) {
            fittingOptions.push(newVal);
            saveFittings();
            newFittingInput.value = '';
            renderFittingList();
            renderTable();
        } else if (fittingOptions.includes(newVal)) {
            alert('Fitting already exists!');
        }
    }

    function deleteFitting(index) {
        if (confirm(`Delete "${fittingOptions[index]}" ? `)) {
            fittingOptions.splice(index, 1);
            saveFittings();
            renderFittingList();
            renderTable();
        }
    }

    // --- Shared Listener Attachment ---
    function attachDeleteListeners(type) {
        document.querySelectorAll(`.platform - delete -btn[data - type="${type}"]`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                if (type === 'platform') deletePlatform(index);
                else if (type === 'fitting') deleteFitting(index);
            });
        });
    }

    // --- Event Bindings ---
    managePlatformsBtn.addEventListener('click', () => openModal(platformModal, renderPlatformList));
    closePlatformModal.addEventListener('click', () => closeModal(platformModal));
    addPlatformBtn.addEventListener('click', addPlatform);

    manageFittingsBtn.addEventListener('click', () => openModal(fittingModal, renderFittingList));
    closeFittingModal.addEventListener('click', () => closeModal(fittingModal));
    addFittingBtn.addEventListener('click', addFitting);

    // Close modal if clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === platformModal) closeModal(platformModal);
        if (e.target === fittingModal) closeModal(fittingModal);
    });
});
