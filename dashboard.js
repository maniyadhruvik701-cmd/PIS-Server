document.addEventListener('DOMContentLoaded', () => {
    // --- Auth Check ---
    const currentUserRaw = localStorage.getItem('currentUser');
    if (!currentUserRaw) {
        window.location.href = 'index.html';
        return;
    }
    const currentUser = JSON.parse(currentUserRaw);

    // Force redirection to role-select on refresh or direct URL access
    const navEntries = performance.getEntriesByType('navigation');
    const isRefresh = navEntries.length > 0 && navEntries[0].type === 'reload';
    const isInitialLogin = sessionStorage.getItem('pis_session_active');

    if (isRefresh || !isInitialLogin) {
        localStorage.removeItem('accessRole');
        localStorage.removeItem('activeUserId');
        localStorage.removeItem('activeUserName');
        sessionStorage.removeItem('pis_session_active');
        window.location.href = 'role-select.html';
        return;
    }
    // Clear flag so next refresh/navigation triggers redirection
    sessionStorage.removeItem('pis_session_active');

    // --- Role Check ---
    const accessRole = localStorage.getItem('accessRole');
    if (!accessRole) {
        window.location.href = 'role-select.html';
        return;
    }

    // Update Profile Name + Show Role Badge
    const activeUserName = localStorage.getItem('activeUserName') || currentUser.name;
    const userProfileName = document.querySelector('.user-profile span');
    if (userProfileName) userProfileName.textContent = activeUserName;

    // Show role badge next to name in header
    const userProfile = document.querySelector('.user-profile');
    if (userProfile && !document.getElementById('roleBadge')) {
        const roleBadge = document.createElement('span');
        roleBadge.id = 'roleBadge';
        const roleLabels = { order: 'Order', fitting: 'Fitting', fullaccess: 'Full Access', Member: 'Member' };
        const roleColors = { order: '#f59e0b', fitting: '#10b981', fullaccess: '#6366f1', Member: '#14b8a6' };

        // Clean up any [object Object] text if it already existed in localStorage
        const cleanRole = (accessRole && accessRole.toString().includes('object')) ? 'Member' : (accessRole || 'Member');

        roleBadge.textContent = roleLabels[cleanRole] || cleanRole;
        roleBadge.style.cssText = `
            font-size: 0.7rem; font-weight: 600; padding: 3px 10px;
            border-radius: 50px; background: ${roleColors[cleanRole] || '#6366f1'}22;
            color: ${roleColors[cleanRole] || '#6366f1'}; border: 1px solid ${roleColors[cleanRole] || '#6366f1'}44;
            margin-left: 6px; vertical-align: middle;
        `;
        userProfileName.after(roleBadge);
    }

    // Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('accessRole');
            localStorage.removeItem('activeUserId');
            localStorage.removeItem('activeUserName');
            sessionStorage.removeItem('pis_session_active');
            window.location.href = 'index.html';
        });
    }

    function showSection(sectionToShow, activeNav) {
        sections.forEach(s => { if (s) s.style.display = 'none'; });
        navs.forEach(n => { if (n) n.classList.remove('active'); });

        if (sectionToShow) {
            sectionToShow.style.display = (sectionToShow === dataSection) ? 'flex' : 'block';
        }
        if (activeNav) {
            activeNav.classList.add('active');
            // Update page title based on nav text
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                const navText = activeNav.querySelector('span') ? activeNav.querySelector('span').textContent : activeNav.textContent;
                pageTitle.textContent = navText.trim();
            }
        }

        // Refresh dynamic content
        if (sectionToShow === dataSection) {
            renderTable();
        } else if (sectionToShow === permissionsSection) {
            renderPermissionsTable();
        }
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

    let warnedDuplicates = new Set(); // Track warned duplicate numbers globally in session
    let platformOptions = [];
    let fittingOptions = [];
    let fittingDetailOptions = [];
    const defaultPlatforms = ['rw', 'Tappe', 'ms', 'HR', 'HR Trendy', 'Trendy Culture', 'Textile centere', 'Trendy piyush', 'Ajio - Junuku', 'Ajio - 2 De', 'Ajio - Jihu', 'my - De', 'my - Jihu'];
    const defaultFittings = ['chacha', 'jahangir', 'jitu'];
    const defaultFittingDetails = ['Fitting 1', 'Fitting 2'];

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
        // Sync to cloud
        if (isFirebaseConnected && firebase.database) {
            firebase.database().ref('pis_platforms').set(platformOptions).catch(err => console.error("Cloud Platform Save Error:", err));
        }
    }

    function loadFittings() {
        const stored = localStorage.getItem('pis_fittings');
        if (stored) {
            fittingOptions = JSON.parse(stored);
        } else {
            fittingOptions = [...defaultFittings];
            saveFittings();
        }
        populateReportFilters();
    }

    function saveFittings() {
        localStorage.setItem('pis_fittings', JSON.stringify(fittingOptions));
        populateReportFilters();
        // Sync to cloud
        if (isFirebaseConnected && firebase.database) {
            firebase.database().ref('pis_fittings').set(fittingOptions).catch(err => console.error("Cloud Fitting Save Error:", err));
        }
    }

    function loadFittingDetails() {
        const stored = localStorage.getItem('pis_fitting_details');
        if (stored) {
            fittingDetailOptions = JSON.parse(stored);
        } else {
            fittingDetailOptions = [...defaultFittingDetails];
            saveFittingDetails();
        }
    }

    function saveFittingDetails() {
        localStorage.setItem('pis_fitting_details', JSON.stringify(fittingDetailOptions));
        // Sync to cloud
        if (isFirebaseConnected && firebase.database) {
            firebase.database().ref('pis_fitting_details').set(fittingDetailOptions).catch(err => console.error("Cloud Fitting Detail Save Error:", err));
        }
    }

    function populateReportFilters() {
        const reportSelect = document.getElementById('reportFittingFilter');
        const dateWiseSelect = document.getElementById('dateWiseFittingFilter');
        const fittingWiseSelect = document.getElementById('fittingWiseFittingFilter');

        const defaultOption = '<option value="">All Fittings</option>';
        const optionsHtml = fittingOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('');

        if (reportSelect) reportSelect.innerHTML = defaultOption + optionsHtml;
        if (dateWiseSelect) dateWiseSelect.innerHTML = defaultOption + optionsHtml;
        if (fittingWiseSelect) fittingWiseSelect.innerHTML = defaultOption + optionsHtml;
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

                    // --- Global Data Listener ---
                    dbRef.on('value', (snapshot) => {
                        const data = snapshot.val();
                        // Only overwrite if we got valid array and it's not empty (prevents accidental "Delete All" if DB glitches)
                        if (data && Array.isArray(data) && data.length > 0) {
                            if (JSON.stringify(data) !== JSON.stringify(tableData)) {
                                // Important: Check if user is currently typing before refreshing UI
                                const activeEl = document.activeElement;
                                const isUserTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT') && activeEl.closest('#dataTable');

                                // --- CRITICAL FIX: In-place Merge ---
                                // Instead of tableData = data, we update objects in-place to keep UI row references alive.
                                // If we replace the array reference, row elements rendered from the old array 
                                // become disconnected from the new tableData, causing data loss on save.

                                // 1. Update existing objects and add new ones
                                data.forEach((newRow, i) => {
                                    if (tableData[i]) {
                                        Object.assign(tableData[i], newRow);
                                    } else {
                                        tableData.push({ ...newRow });
                                    }
                                });

                                // 2. Remove extra rows if server has fewer rows
                                if (tableData.length > data.length) {
                                    tableData.splice(data.length);
                                }

                                localStorage.setItem(DATA_KEY, JSON.stringify(tableData));

                                // Only render table from sync if user is NOT actively typing to prevent losing focus/input
                                if (!isUserTyping) {
                                    const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE) || 1;
                                    if (currentPage > totalPages) currentPage = totalPages;
                                    renderTable();
                                    console.log("☁️ Data Synced from Cloud (In-place)");
                                }
                            }
                        }
                    });



                    // --- Platforms Listener ---
                    database.ref('pis_platforms').on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data && Array.isArray(data)) {
                            if (JSON.stringify(data) !== JSON.stringify(platformOptions)) {
                                platformOptions = data;
                                localStorage.setItem('pis_platforms', JSON.stringify(platformOptions));
                                renderTable();
                                console.log("☁️ Platforms Synced from Cloud");
                            }
                        }
                    });

                    // --- Fittings Listener ---
                    database.ref('pis_fittings').on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data && Array.isArray(data)) {
                            if (JSON.stringify(data) !== JSON.stringify(fittingOptions)) {
                                fittingOptions = data;
                                localStorage.setItem('pis_fittings', JSON.stringify(fittingOptions));
                                populateReportFilters();
                                renderTable();
                                console.log("☁️ Fittings Synced from Cloud");
                            }
                        }
                    });

                    // --- Fitting Details Listener ---
                    database.ref('pis_fitting_details').on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data && Array.isArray(data)) {
                            if (JSON.stringify(data) !== JSON.stringify(fittingDetailOptions)) {
                                fittingDetailOptions = data;
                                localStorage.setItem('pis_fitting_details', JSON.stringify(fittingDetailOptions));
                                renderTable();
                                console.log("☁️ Fitting Details Synced from Cloud");
                            }
                        }
                    });

                    // --- User Permissions Listener ---
                    database.ref('user_permissions').on('value', (snapshot) => {
                        const data = snapshot.val();
                        if (data) {
                            userPermissions = data;
                            localStorage.setItem('pis_cached_permissions', JSON.stringify(data));
                            // Update UI layout immediately when permissions change
                            applyRoleAccess();

                            if (document.getElementById('permissionsSection').style.display !== 'none') {
                                renderPermissionsTable();
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
            // Load saved page or default to last page
            const savedPage = localStorage.getItem('pis_current_page');
            const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE) || 1;
            if (savedPage) {
                currentPage = Math.min(parseInt(savedPage), totalPages);
            } else {
                currentPage = totalPages;
            }
        } else {
            tableData = [];
            tableData.push(addNewEntryObject());
            currentPage = 1;
        }

        renderTable();
    }

    function saveToLocalStorage(modifiedIndex = -1) {
        // 1. Save Local
        localStorage.setItem(DATA_KEY, JSON.stringify(tableData));
        localStorage.setItem('pis_current_page', currentPage);

        // 2. Sync to Cloud (if connected)
        if (isFirebaseConnected && dbRef) {
            if (modifiedIndex > -1 && tableData[modifiedIndex]) {
                dbRef.child(modifiedIndex).update(tableData[modifiedIndex]).catch(err => console.error("Cloud Save Error:", err));
            } else {
                dbRef.set(tableData).catch(err => console.error("Cloud Save Error:", err));
            }
        }
    }

    function addNewEntryObject() {
        const today = new Date().toISOString().split('T')[0];
        return {
            date: '', // Fitting Out Date - make it empty by default
            orderDate: today, // Order Date - default to today
            confirmationDate: '', // Confirmation Date
            orderNo: '',
            designNo: '',
            fittingDetail: '',
            blouseSize: '',
            customize: '',
            kotiSize: '',
            kurtaSize: '',
            platform: '',
            fittingName: '',
            finalDate: '', // Deadline
            receiveDate: '',
            shipDate: '',
            pcs: 1,
            updatedBy: localStorage.getItem('activeUserName') || '',
            history: []
        };
    }

    // --- Core Functions ---

    function addRows(count) {
        // Force blur on current active element to ensure any pending 'change' events fire 
        // to save the current row's data before we re-render and add new rows.
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
            document.activeElement.blur();
        }

        currentPage = 1; // Always show the newly added rows at the top

        if (isFirebaseConnected && dbRef) {
            dbRef.transaction((currentData) => {
                let data = currentData || [];
                const newRows = [];
                for(let i = 0; i < count; i++) {
                    newRows.push(addNewEntryObject());
                }
                return data.concat(newRows);
            }).catch(err => console.error("Cloud Add Rows Error:", err));
        } else {
            for (let i = 0; i < count; i++) {
                tableData.push(addNewEntryObject());
            }
            saveToLocalStorage(-1);
            renderTable();
        }
    }

    function deleteRow(item) {
        const index = tableData.indexOf(item);
        if (index > -1) {
            if (isFirebaseConnected && dbRef) {
                dbRef.transaction((currentData) => {
                    if (currentData && currentData.length > index) {
                        currentData.splice(index, 1);
                    }
                    return currentData;
                }).catch(err => console.error("Cloud Delete Row Error:", err));
            } else {
                tableData.splice(index, 1);
                saveToLocalStorage(-1);
                
                // Adjust pagination if needed
                const totalPages = Math.ceil(tableData.length / ROWS_PER_PAGE) || 1;
                if (currentPage > totalPages) {
                    currentPage = totalPages;
                }
                renderTable();
            }
        }
    }

    function clearAll() {
        if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
            if (isFirebaseConnected && dbRef) {
                 tableData = [addNewEntryObject()];
                 saveToLocalStorage(-1);
                 currentPage = 1;
                 renderTable();
            } else {
                 tableData = [];
                 tableData.push(addNewEntryObject());
                 saveToLocalStorage(-1);
                 currentPage = 1;
                 renderTable();
            }
            alert("All data cleared.");
        }
    }

    // --- Rendering ---

    let searchQuery = '';

    function formatDateForDisplay(isoDate) {
        if (!isoDate) return '';
        const parts = isoDate.split('-');
        if (parts.length !== 3) return isoDate;
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    function createRowElement(data, displayIndex) {
        // Calculate globalRowIndex just for display purposes (optional)
        // If we want the serial number to be 1, 2, 3... of the filtered list, use displayIndex
        // If we want the Serial Number to be the ID in the main list, use indexOf.
        // Let's use displayIndex + 1 for now so the list always looks clean 1..N
        const row = document.createElement('tr');

        row.innerHTML = `
            <td class="row-index">${displayIndex + 1}</td>
            <td><input type="date" data-field="orderDate" value="${data.orderDate || ''}"></td>
            <td><input type="date" data-field="confirmationDate" value="${data.confirmationDate || ''}"></td>
            <td><input type="date" data-field="date" value="${data.date || ''}"></td>
            <td><input type="text" data-field="orderNo" placeholder="Order No" value="${data.orderNo || ''}"></td>
            <td><input type="text" data-field="designNo" placeholder="Design No" value="${data.designNo || ''}"></td>
            <td>
                <select data-field="fittingDetail">
                    <option value="">Select Detail</option>
                    ${fittingDetailOptions.map(opt => `<option value="${opt}" ${data.fittingDetail === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </td>
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
            <td><input type="number" data-field="pcs" value="${data.pcs || 1}"></td>
            <td>
                <select data-field="fittingName">
                    <option value="">Select Fitting</option>
                    ${fittingOptions.map(opt => `<option value="${opt}" ${data.fittingName === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            </td>
            <td><input type="date" data-field="finalDate" value="${data.finalDate || ''}"></td>
            <td><input type="date" data-field="receiveDate" value="${data.receiveDate || ''}"></td>
            <td><input type="date" data-field="shipDate" value="${data.shipDate || ''}"></td>
            <td style="font-size: 0.8rem; color: rgba(255,255,255,0.6); vertical-align: middle;" class="row-user-name">${data.updatedBy || ''}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button class="history-btn" title="View History" style="background: transparent; border: none; color: #10b981; cursor: pointer; padding: 5px; margin-right: 5px;"><i class="fas fa-history"></i></button>
                <button class="edit-row-btn" title="Edit Row" style="background: transparent; border: none; color: var(--accent-color); cursor: pointer; padding: 5px; margin-right: 5px;"><i class="fas fa-edit"></i></button>
                <button class="delete-btn" title="Delete Row"><i class="fas fa-trash"></i></button>
            </td>
        `;

        // Event Listeners for Inputs (Data Binding)
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            const field = input.getAttribute('data-field');
            const isDateField = ['date', 'orderDate', 'confirmationDate', 'finalDate', 'receiveDate', 'shipDate'].includes(field);

            // Special handling for date fields for dd-mm-yyyy display
            if (isDateField) {
                // Initial display state
                const originalType = input.type;
                input.type = 'text';
                input.placeholder = 'dd-mm-yyyy';
                if (data[field]) {
                    input.value = formatDateForDisplay(data[field]);
                }

                input.addEventListener('focus', function () {
                    this.type = 'date';
                    this.value = data[field] || '';
                    if (this.showPicker) {
                        // Small delay to ensure type change is processed
                        setTimeout(() => this.showPicker(), 10);
                    }
                });

                input.addEventListener('blur', function () {
                    this.type = 'text';
                    this.value = formatDateForDisplay(data[field]);
                    if(this.adjustWidth) this.adjustWidth();
                });
            }

            // Auto-resize logic so the box adjusts as user types
            if (input.tagName === 'INPUT') {
                input.style.minWidth = '50px'; // Prevent it from getting too small
                input.adjustWidth = function() {
                    const length = this.value.length;
                    const charCount = Math.max(6, length + 2); // At least 6 character width
                    this.style.width = charCount + 'ch';
                };
                
                // Keep the input event for resizing ONLY
                input.addEventListener('input', function() {
                    this.adjustWidth();
                });
                
                // Initial size adjustment
                input.adjustWidth();
            }

            // Use 'change' instead of 'input' for text fields to save only when user finishes typing
            // This prevents race conditions with Firebase and avoids "automatic deletion"
            const eventType = 'change';
            input.addEventListener(eventType, (e) => {
                const targetField = e.target.getAttribute('data-field');
                const oldValue = data[targetField] || '';
                const newValue = e.target.value;

                // --- CRITICAL FIX: Date Corruption Safeguard ---
                // If it's a date field and it's currently in 'text' mode (showing dd-mm-yyyy),
                // we MUST NOT save this value to our data object, as it expect YYYY-MM-DD.
                // Saving dd-mm-yyyy will break the date picker next time it's focused.
                if (isDateField && input.type === 'text') {
                    return;
                }

                if (targetField === 'finalDate' && e.target.value) {
                    const selectedDate = e.target.value;
                    let count = 0;
                    tableData.forEach(r => {
                        if (r !== data && r.finalDate === selectedDate) {
                            count++;
                        }
                    });

                    if (count >= 9) {
                        alert("Slot is full! You cannot add more than 9 orders for this final date.");
                        e.target.value = data[targetField] || ''; // Revert to previous value
                        return; // Prevent further execution
                    }
                }

                data[targetField] = newValue; // Bind directly to the object reference

                // Track who updated this row
                const activeUserName = localStorage.getItem('activeUserName') || 'Unknown';
                data.updatedBy = activeUserName;
                const userCell = row.querySelector('.row-user-name');
                if (userCell) userCell.textContent = activeUserName;

                // Track History
                if (oldValue !== newValue) {
                    if (!data.history) data.history = [];
                    const now = new Date();
                    const formattedDate = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-US');
                    
                    const fieldLabels = {
                        orderDate: 'Order Date', confirmationDate: 'Confirmation Date', date: 'Fitting Out Date',
                        orderNo: 'Order No', designNo: 'Design No', fittingDetail: 'Fitting Detail',
                        blouseSize: 'Blouse Size', customize: 'Customize', kotiSize: 'Koti Size',
                        kurtaSize: 'Kurta Size', platform: 'Platform', pcs: 'Pieces',
                        fittingName: 'Fitting Name', finalDate: 'Final Date', receiveDate: 'Fitting Receive Date',
                        shipDate: 'Ship Date'
                    };
                    const fieldName = fieldLabels[targetField] || targetField;
                    
                    data.history.push({
                        field: fieldName,
                        oldValue: oldValue,
                        newValue: newValue,
                        user: activeUserName,
                        timestamp: formattedDate
                    });
                }

                const index = tableData.indexOf(data);
                saveToLocalStorage(index); // Auto-save on every keystroke/change, only updating this specific row
            });

            // Duplicate entry check on 'blur' event
            if (field === 'orderNo' || field === 'designNo') {
                input.addEventListener('blur', function () {
                    const val = (this.value || '').toString().trim();

                    if (val) {
                        const exists = tableData.some(r =>
                            r !== data &&
                            (field === 'orderNo' ? (r.orderNo || '') : (r.designNo || '')).toString().trim().toLowerCase() === val.toLowerCase()
                        );

                        if (exists) {
                            // Only alert if we haven't warned for this specific value in this session yet
                            const warnKey = `${field}_${val.toLowerCase()}`;
                            if (!warnedDuplicates.has(warnKey)) {
                                setTimeout(() => {
                                    alert(`Warning: ${field === 'orderNo' ? 'Order' : 'Design'} No "${val}" already exists in the table!`);
                                    warnedDuplicates.add(warnKey); // Mark this value as warned globally
                                }, 100);
                            }
                        }
                    }
                });
            }
        });

        // Event Listener for Delete
        const deleteBtn = row.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to delete this row?")) {
                deleteRow(data); // Pass the object itself
            }
        });

        const editBtn = row.querySelector('.edit-row-btn');
        editBtn.addEventListener('click', () => {
            // Focusing the first logical input of the row
            const firstInput = row.querySelector('input');
            if (firstInput) firstInput.focus();
        });

        const historyBtn = row.querySelector('.history-btn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                const modal = document.getElementById('historyModal');
                const list = document.getElementById('historyList');
                list.innerHTML = '';
                
                if (!data.history || data.history.length === 0) {
                    list.innerHTML = '<li style="padding: 10px; color: rgba(255,255,255,0.5);">No history recorded yet.</li>';
                } else {
                    // Show latest first
                    [...data.history].reverse().forEach(h => {
                        const li = document.createElement('li');
                        li.style.padding = '12px 10px';
                        li.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                        li.style.backgroundColor = 'rgba(0,0,0,0.2)';
                        li.style.marginBottom = '5px';
                        li.style.borderRadius = '6px';
                        
                        li.innerHTML = `
                            <div style="font-size: 0.8rem; color: #10b981; margin-bottom: 4px;">
                                <i class="far fa-clock"></i> ${h.timestamp} - <strong style="color: #6366f1;">${h.user}</strong>
                            </div>
                            <div style="font-size: 0.95rem; margin-bottom: 4px;">Changed <strong style="color: #eab308;">${h.field}</strong></div>
                            <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 8px;">
                                <span style="text-decoration: line-through; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.oldValue || '(empty)'}</span> 
                                <i class="fas fa-arrow-right" style="color: #4b5563; font-size: 0.7rem;"></i> 
                                <span style="color: #fff; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${h.newValue || '(empty)'}</span>
                            </div>
                        `;
                        list.appendChild(li);
                    });
                }
                modal.style.display = 'flex';
            });
        }

        return row;
    }

    function renderTable() {
        // Clear current table body
        if (!tableBody) return;
        tableBody.innerHTML = '';

        // 1. Map data with original Sr. No. (1-based index) and then reverse
        // This ensures the latest entries are shown first while preserving their true ID
        let displayData = tableData.map((row, idx) => {
            row._originalIdx = idx;
            row._srNo = idx + 1;
            return row;
        });

        // 2. Apply Search Filter if any
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            displayData = displayData.filter(row => {
                return (
                    (row.orderNo && row.orderNo.toString().toLowerCase().includes(query)) ||
                    (row.designNo && row.designNo.toString().toLowerCase().includes(query)) ||
                    (row.platform && row.platform.toLowerCase().includes(query)) ||
                    (row.fittingName && row.fittingName.toLowerCase().includes(query)) ||
                    (row.blouseSize && row.blouseSize.toString().toLowerCase().includes(query)) ||
                    (row.customize && row.customize.toLowerCase().includes(query)) ||
                    (row.pcs && row.pcs.toString().includes(query)) ||
                    (row.date && row.date.includes(query))
                );
            });
        }

        // 3. Reverse the order to show last (newest) entries first
        displayData.reverse();

        const totalRows = displayData.length;
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE) || 1;

        // Ensure currentPage is valid
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        // Calculate slice
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        const end = Math.min(start + ROWS_PER_PAGE, totalRows);

        // 4. Render the current page slice
        for (let i = start; i < end; i++) {
            const item = displayData[i];
            // Use item._srNo - 1 as the index for createRowElement so the Sr No column is correct
            const rowElement = createRowElement(item, item._srNo - 1);
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

        // Remember current page in localStorage
        localStorage.setItem('pis_current_page', currentPage);
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

    // --- Delete Range Logic ---
    const deleteRangeBtn = document.getElementById('deleteRangeBtn');
    const deleteRangeInput = document.getElementById('deleteRangeInput');
    if (deleteRangeBtn) {
        deleteRangeBtn.addEventListener('click', () => {
            const rangeStr = deleteRangeInput.value.trim();
            if (!rangeStr.includes('-')) {
                alert("Please enter range in format: Start-End (Ex: 300-400)");
                return;
            }

            const parts = rangeStr.split('-');
            const startSr = parseInt(parts[0].trim());
            const endSr = parseInt(parts[1].trim());

            if (isNaN(startSr) || isNaN(endSr) || startSr <= 0 || endSr < startSr) {
                alert("Please enter a valid range (Ex: 300-400)");
                return;
            }

            if (endSr > tableData.length) {
                alert(`Range exceeds total entries (${tableData.length})`);
                return;
            }

            if (confirm(`Are you sure you want to delete entries from Sr No ${startSr} to ${endSr}? This cannot be undone.`)) {
                // Sr No 300 is at index 299
                const startIdx = startSr - 1;
                const count = endSr - startIdx;

                if (isFirebaseConnected && dbRef) {
                    dbRef.transaction((currentData) => {
                        if (currentData && currentData.length >= startIdx + count) {
                            currentData.splice(startIdx, count);
                        }
                        return currentData;
                    }).catch(err => console.error("Cloud Delete Range Error:", err));
                    deleteRangeInput.value = '';
                    alert(`Successfully deleted ${count} entries.`);
                } else {
                    tableData.splice(startIdx, count);
                    saveToLocalStorage(-1);
                    renderTable();
                    deleteRangeInput.value = '';
                    alert(`Successfully deleted ${count} entries.`);
                }
            }
        });
    }

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

    // --- Tab Switching Logic (Unified) ---
    const navData = document.getElementById('navData');
    const navReports = document.getElementById('navReports');
    const navDateWise = document.getElementById('navDateWise');
    const navLatePis = document.getElementById('navLatePis');
    const navTotalOrder = document.getElementById('navTotalOrder');
    const navFittingWise = document.getElementById('navFittingWise');
    const navFittingOutReport = document.getElementById('navFittingOutReport');
    const navShipPending = document.getElementById('navShipPending');
    const navPermissions = document.getElementById('navPermissions');
    const navSettings = document.getElementById('navSettings');

    const dataSection = document.getElementById('dataSection');
    const reportsSection = document.getElementById('reportsSection');
    const dateWiseSection = document.getElementById('dateWiseSection');
    const latePisSection = document.getElementById('latePisSection');
    const totalOrderSection = document.getElementById('totalOrderSection');
    const fittingWiseSection = document.getElementById('fittingWiseSection');
    const fittingOutReportSection = document.getElementById('fittingOutReportSection');
    const shipPendingSection = document.getElementById('shipPendingSection');
    const permissionsSection = document.getElementById('permissionsSection');
    const settingsSection = document.getElementById('settingsSection');

    const sections = [dataSection, reportsSection, dateWiseSection, latePisSection, totalOrderSection, fittingWiseSection, fittingOutReportSection, shipPendingSection, permissionsSection, settingsSection];
    const navs = [navData, navReports, navDateWise, navLatePis, navTotalOrder, navFittingWise, navFittingOutReport, navShipPending, navPermissions, navSettings];

    // Global Permissions State
    let userPermissions = JSON.parse(localStorage.getItem('pis_cached_permissions') || '{}');
    const ALL_USERS = [
        { id: 'vishal', name: 'Vishal' }, { id: 'piyush', name: 'Piyush' },
        { id: 'amish', name: 'Amish' }, { id: 'arshit', name: 'Arshit' },
        { id: 'manager', name: 'Manager' }, { id: 'radhi', name: 'Radhi' },
        { id: 'vruti', name: 'Vruti' }, { id: 'bhumi', name: 'Bhumi' }
    ];

    function showSection(sectionToShow, activeNav) {
        sections.forEach(s => { if (s) s.style.display = 'none'; });
        navs.forEach(n => { if (n) n.classList.remove('active'); });

        if (sectionToShow) {
            // Data section uses flex for layout
            sectionToShow.style.display = (sectionToShow === dataSection) ? 'flex' : 'block';
        }
        if (activeNav) activeNav.classList.add('active');

        // Refresh dynamic content
        if (sectionToShow === dataSection) {
            renderTable();
        } else if (sectionToShow === permissionsSection) {
            renderPermissionsTable();
        }
    }

    if (navData) navData.addEventListener('click', () => showSection(dataSection, navData));
    if (navReports) navReports.addEventListener('click', () => showSection(reportsSection, navReports));
    if (navDateWise) navDateWise.addEventListener('click', () => showSection(dateWiseSection, navDateWise));
    if (navLatePis) navLatePis.addEventListener('click', () => showSection(latePisSection, navLatePis));
    if (navTotalOrder) navTotalOrder.addEventListener('click', () => showSection(totalOrderSection, navTotalOrder));
    if (navFittingWise) navFittingWise.addEventListener('click', () => showSection(fittingWiseSection, navFittingWise));
    if (navPermissions) navPermissions.addEventListener('click', () => showSection(permissionsSection, navPermissions));
    if (navSettings) navSettings.addEventListener('click', () => showSection(settingsSection, navSettings));
    if (navFittingOutReport) navFittingOutReport.addEventListener('click', () => showSection(fittingOutReportSection, navFittingOutReport));
    if (navShipPending) navShipPending.addEventListener('click', () => showSection(shipPendingSection, navShipPending));

    // --- Backup & Restore Logic ---
    const backupDataBtn = document.getElementById('backupDataBtn');
    const restoreDataBtn = document.getElementById('restoreDataBtn');
    const restoreDataInput = document.getElementById('restoreDataInput');
    const copyToClipboardBtn = document.getElementById('copyToClipboardBtn');
    const importFromPasteBtn = document.getElementById('importFromPasteBtn');
    const copyPasteArea = document.getElementById('copyPasteArea');

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

    copyToClipboardBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(tableData, null, 2);
        copyPasteArea.value = dataStr;
        copyPasteArea.select();
        try {
            document.execCommand('copy');
            alert("Data copied to clipboard!");
        } catch (err) {
            alert("Failed to copy. Please copy manually from the text box.");
        }
    });

    importFromPasteBtn.addEventListener('click', () => {
        const pasteData = copyPasteArea.value.trim();
        if (!pasteData) {
            alert("Please paste data in the text area first.");
            return;
        }

        try {
            const importedData = JSON.parse(pasteData);
            if (Array.isArray(importedData)) {
                if (confirm(`Do you want to completely OVERWRITE current data with ${importedData.length} entries?\n\nClick 'OK' to Overwrite.\nClick 'Cancel' to APPEND them to existing data.`)) {
                    // Overwrite
                    tableData = importedData;
                } else {
                    // Append
                    tableData = tableData.concat(importedData);
                }
                saveToLocalStorage();
                renderTable();
                copyPasteArea.value = ''; // clear area after success
                alert("Data imported successfully!");
            } else {
                alert("Invalid format: Data is not a JSON array.");
            }
        } catch (err) {
            alert("Error parsing JSON: " + err.message);
        }
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

                // Count using pcs field
                let itemsInRow = parseInt(row.pcs) || 1;

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
                <td>${design}</td>
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
        const selectedFitting = document.getElementById('reportFittingFilter').value;

        // Grouping Data
        const reportMap = {};

        let grandTotal = 0;

        tableData.forEach(row => {
            // --- Date Filtering by Order Date ---
            const oDate = row.orderDate || '';
            if (oDate >= startDate && oDate <= endDate) {
                // Filter by Fitting Name if selected
                if (selectedFitting && row.fittingName !== selectedFitting) return;

                // --- Pending Logic ---
                // Condition 1: Final Date exists AND Fitting Receive Date is empty
                // Condition 2: Confirmation Date exists AND Ship Date is empty AND Receive Date is empty
                const hasConf = row.confirmationDate && row.confirmationDate.trim() !== '';
                const hasFinal = row.finalDate && row.finalDate.trim() !== '';
                const noFittingReceive = !row.receiveDate || row.receiveDate.trim() === '';
                const noShip = !row.shipDate || row.shipDate.trim() === '';

                let isPending = false;
                if (hasFinal && noFittingReceive) {
                    isPending = true;
                } else if (hasConf && noShip && noFittingReceive) {
                    isPending = true;
                }

                if (isPending) {
                    const design = row.designNo || "Unknown";
                    const platform = row.platform || "-";
                    const orderNo = row.orderNo || "-";
                    const fittingName = row.fittingName || "-";
                    const blouseSize = row.blouseSize || "-";
                    const kotiSize = row.kotiSize || "-";
                    const kurtaSize = row.kurtaSize || "-";
                    const confirmationDate = row.confirmationDate || "-";
                    const fittingDetail = row.fittingDetail || "-";

                    const key = `${orderNo}| ${design}| ${platform}| ${fittingName}| ${blouseSize}| ${kotiSize}| ${kurtaSize}| ${fittingDetail}`;

                    if (!reportMap[key]) {
                        reportMap[key] = {
                            confirmationDate,
                            orderNo,
                            design,
                            platform,
                            fittingName,
                            blouseSize,
                            kotiSize,
                            kurtaSize,
                            fittingDetail,
                            count: 0
                        };
                    }

                    // Count using pcs field
                    let itemsInRow = parseInt(row.pcs) || 1;

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
                // Format confirmationDate as dd-mm-yyyy
                tr.innerHTML = `
                    <td>${data.orderNo}</td>
                    <td>${data.design}</td>
                    <td>${data.platform}</td>
                    <td>${data.fittingName}</td>
                    <td>${data.blouseSize}</td>
                    <td>${data.kotiSize}</td>
                    <td>${data.kurtaSize}</td>
                    <td>${data.fittingDetail}</td>
                    <td>${data.count}</td>
                `;
                reportTableBody.appendChild(tr);
            }
        });

        if (keys.length === 0 || grandTotal === 0) {
            reportTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No pending data found for this date range.</td></tr>';
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
        const selectedFitting = document.getElementById('dateWiseFittingFilter').value;

        const reportData = [];
        let grandTotal = 0;

        tableData.forEach(row => {
            // --- Date Filtering by Final Date ---
            const fDate = row.finalDate || '';
            if (fDate >= startDate && fDate <= endDate) {
                // Filter by Fitting Name if selected
                if (selectedFitting && row.fittingName !== selectedFitting) return;

                // --- Pending Logic ---
                // Condition 1: Final Date exists AND Fitting Receive Date is empty
                // Condition 2: Confirmation Date exists AND Ship Date is empty AND Receive Date is empty
                const hasConf = row.confirmationDate && row.confirmationDate.trim() !== '';
                const hasFinal = row.finalDate && row.finalDate.trim() !== '';
                const noFittingReceive = !row.receiveDate || row.receiveDate.trim() === '';
                const noShip = !row.shipDate || row.shipDate.trim() === '';

                let isPending = false;
                if (hasFinal && noFittingReceive) {
                    isPending = true;
                } else if (hasConf && noShip && noFittingReceive) {
                    isPending = true;
                }

                if (isPending) {
                    const design = row.designNo || "Unknown";
                    const platform = row.platform || "-";
                    const orderNo = row.orderNo || "-";
                    const fittingName = row.fittingName || "-";
                    const blouseSize = row.blouseSize || "-";
                    const kotiSize = row.kotiSize || "-";
                    const kurtaSize = row.kurtaSize || "-";
                    const fittingDetail = row.fittingDetail || "-";

                    // Count using pcs field
                    let itemsInRow = parseInt(row.pcs) || 1;

                    if (itemsInRow > 0) {
                        // Group by Final Date + OrderNo + Design + Platform
                        const existingEntry = reportData.find(item =>
                            item.date === row.finalDate &&
                            item.design === design &&
                            item.platform === platform &&
                            item.orderNo === orderNo &&
                            item.fittingName === fittingName &&
                            item.blouseSize === blouseSize &&
                            item.kotiSize === kotiSize &&
                            item.kurtaSize === kurtaSize &&
                            item.fittingDetail === fittingDetail
                        );
                        if (existingEntry) {
                            existingEntry.count += itemsInRow;
                        } else {
                            reportData.push({
                                date: row.finalDate,
                                orderNo,
                                design,
                                platform,
                                fittingName,
                                blouseSize,
                                kotiSize,
                                kurtaSize,
                                fittingDetail,
                                count: itemsInRow
                            });
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
            const formattedDate = `${day}-${month}-${year}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${item.orderNo}</td>
                <td>${item.design}</td>
                <td>${item.platform}</td>
                <td>${item.fittingName}</td>
                <td>${item.blouseSize}</td>
                <td>${item.kotiSize}</td>
                <td>${item.kurtaSize}</td>
                <td>${item.fittingDetail}</td>
                <td>${item.count}</td>
            `;
            dateWiseTableBody.appendChild(tr);
        });

        if (reportData.length === 0) {
            dateWiseTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No pending data found for this date range.</td></tr>';
        }
        dateWiseGrandTotal.textContent = grandTotal;
    });

    // --- Total Order Report Logic ---
    const generateTotalOrderBtn = document.getElementById('generateTotalOrderBtn');
    const totalOrderStartDate = document.getElementById('totalOrderStartDate');
    const totalOrderEndDate = document.getElementById('totalOrderEndDate');
    const totalOrderThead = document.getElementById('totalOrderThead');
    const totalOrderTbody = document.getElementById('totalOrderTbody');
    const totalOrderFooter = document.getElementById('totalOrderFooter');

    generateTotalOrderBtn.addEventListener('click', () => {
        const start = totalOrderStartDate.value;
        const end = totalOrderEndDate.value;

        if (!start || !end) {
            alert("Please select both Start Date and End Date");
            return;
        }

        // Filter rows by Order Date range
        const filtered = tableData.filter(row => {
            if (!row.orderDate) return false;
            return row.orderDate >= start && row.orderDate <= end;
        });

        if (filtered.length === 0) {
            totalOrderThead.innerHTML = '';
            totalOrderTbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">No data found for this Order Date range.</td></tr>';
            totalOrderFooter.innerHTML = '';
            return;
        }

        // Design Nos (rows) from filtered data; Platforms (columns) from saved platformOptions
        const designSet = new Set();
        filtered.forEach(row => {
            if (row.designNo) designSet.add(row.designNo);
        });

        const designs = Array.from(designSet).sort();
        // Use the full saved platform list as columns (same order as managed)
        const platforms = platformOptions.slice();

        // Build pivot map: designNo -> platform -> count
        const pivot = {};
        designs.forEach(d => {
            pivot[d] = {};
            platforms.forEach(p => pivot[d][p] = 0);
        });

        filtered.forEach(row => {
            const p = row.platform || '';
            const d = row.designNo || '';
            if (p && d && pivot[d] && pivot[d][p] !== undefined) {
                pivot[d][p] += (parseInt(row.pcs) || 1);
            }
        });

        // Render Header: Design No | Platform1 | Platform2 | ... | Total
        totalOrderThead.innerHTML = `
            <tr>
                <th>Design No</th>
                ${platforms.map(p => `<th>${p}</th>`).join('')}
                <th>Total</th>
            </tr>
        `;

        // Render Body: each row = one Design No
        totalOrderTbody.innerHTML = '';
        const platformColTotals = {};
        platforms.forEach(p => platformColTotals[p] = 0);
        let grandTotal = 0;

        designs.forEach(d => {
            let rowTotal = 0;
            const cells = platforms.map(p => {
                const val = pivot[d][p];
                platformColTotals[p] += val;
                rowTotal += val;
                return `<td>${val > 0 ? val : '-'}</td>`;
            }).join('');
            grandTotal += rowTotal;

            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${d}</strong></td>${cells}<td><strong>${rowTotal}</strong></td>`;
            totalOrderTbody.appendChild(tr);
        });

        // Render Footer (Grand Total row per platform column)
        const footerCells = platforms.map(p => `<td>${platformColTotals[p]}</td>`).join('');
        totalOrderFooter.innerHTML = `<td>Grand Total</td>${footerCells}<td>${grandTotal}</td>`;
    });

    // --- Total Order PDF Export ---
    const exportTotalOrderPdfBtn = document.getElementById('exportTotalOrderPdfBtn');
    exportTotalOrderPdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const start = totalOrderStartDate.value;
        const end = totalOrderEndDate.value;
        doc.text(`Total Order Report (${start} to ${end})`, 14, 15);
        doc.autoTable({
            html: '#totalOrderTable',
            startY: 20,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
            footStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
            styles: { fontSize: 9, cellPadding: 3 },
        });
        doc.save(`Total_Order_${start}_${end}.pdf`);
    });

    // --- Fitting Wise Report Logic ---
    const generateFittingWiseBtn = document.getElementById('generateFittingWiseBtn');
    const fittingWiseStartDate = document.getElementById('fittingWiseStartDate');
    const fittingWiseEndDate = document.getElementById('fittingWiseEndDate');
    const fittingWiseTbody = document.getElementById('fittingWiseTbody');
    const fittingWiseGrandTotal = document.getElementById('fittingWiseGrandTotal');

    generateFittingWiseBtn.addEventListener('click', () => {
        const start = fittingWiseStartDate.value;
        const end = fittingWiseEndDate.value;

        if (!start || !end) {
            alert("Please select both Start Date and End Date");
            return;
        }

        const selectedFitting = document.getElementById('fittingWiseFittingFilter').value;
        const reportMap = {};
        let grandTotal = 0;

        tableData.forEach(row => {
            // Filter by Fitting Receive Date (receiveDate)
            if (!row.receiveDate) return;
            const filterDate = row.receiveDate;

            if (filterDate >= start && filterDate <= end) {
                const fittingName = row.fittingName || "Unknown Fitting";
                const orderNo = row.orderNo || "-";
                const designNo = row.designNo || "-";
                const platform = row.platform || "-";

                // Apply Fitting Name Filter
                if (selectedFitting && fittingName !== selectedFitting) return;

                // Group by OrderNo, DesignNo, Platform, FittingName, and FittingInDate
                const key = `${orderNo}|${designNo}|${platform}|${fittingName}|${filterDate}`;

                if (!reportMap[key]) {
                    reportMap[key] = {
                        orderNo,
                        designNo,
                        platform,
                        fittingName,
                        fittingInDate: filterDate,
                        count: 0
                    };
                }

                // Use pcs field
                const rowPcs = parseInt(row.pcs) || 1;
                reportMap[key].count += rowPcs;
                grandTotal += rowPcs;
            }
        });

        // Render Table
        fittingWiseTbody.innerHTML = '';
        const keys = Object.keys(reportMap).sort();

        keys.forEach(key => {
            const data = reportMap[key];

            // Format Date to DD-MM-YYYY
            const [year, month, day] = data.fittingInDate.split('-');
            const formattedDate = `${day}-${month}-${year}`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.orderNo}</td>
                <td>${data.designNo}</td>
                <td>${data.platform}</td>
                <td>${data.fittingName}</td>
                <td>${formattedDate}</td>
                <td>${data.count}</td>
            `;
            fittingWiseTbody.appendChild(tr);
        });

        if (keys.length === 0 || grandTotal === 0) {
            fittingWiseTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No data found for this date range.</td></tr>';
        }

        // Update Grand Total
        fittingWiseGrandTotal.textContent = grandTotal;
    });

    // --- Fitting Out Report Logic ---
    const generateFittingOutBtn = document.getElementById('generateFittingOutBtn');
    const fittingOutStartDate = document.getElementById('fittingOutStartDate');
    const fittingOutEndDate = document.getElementById('fittingOutEndDate');
    const fittingOutReportHead = document.getElementById('fittingOutReportHead');
    const fittingOutReportBody = document.getElementById('fittingOutReportBody');
    const fittingOutReportFoot = document.getElementById('fittingOutReportFoot');

    if (generateFittingOutBtn) {
        generateFittingOutBtn.addEventListener('click', () => {
            const start = fittingOutStartDate.value;
            const end = fittingOutEndDate.value;

            if (!start || !end) {
                alert("Please select both Start Date and End Date");
                return;
            }

            // Filter Data by Fitting Out Date (row.date)
            const filteredRows = tableData.filter(row => {
                const fDate = row.date;
                if (!fDate) return false;
                return fDate >= start && fDate <= end;
            });

            if (filteredRows.length === 0) {
                fittingOutReportHead.innerHTML = '';
                fittingOutReportFoot.innerHTML = '';
                fittingOutReportBody.innerHTML = '<tr><td style="text-align:center; padding: 20px;">No data found for this range.</td></tr>';
                return;
            }

            // Find all unique Platforms & Designs from filtered results
            const platforms = [...new Set(filteredRows.map(r => r.platform || 'Unknown'))].sort();
            const designs = [...new Set(filteredRows.map(r => r.designNo || 'Unknown'))].sort();

            // Build Headers: Design No | Plat 1 | Plat 2 | ... | Total
            let headHtml = `<tr>
                <th style="padding: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.1); text-align: left;">Design No</th>`;
            platforms.forEach(p => {
                headHtml += `<th style="padding: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.1); text-align: center;">${p}</th>`;
            });
            headHtml += `<th style="padding: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(20, 184, 166, 0.2); text-align: center;">Total</th></tr>`;
            fittingOutReportHead.innerHTML = headHtml;

            // Build Rows
            let bodyHtml = '';
            const colTotals = new Array(platforms.length).fill(0);
            let grandGrandTotal = 0;

            designs.forEach(design => {
                let rowTotal = 0;
                bodyHtml += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: 600; color: #fff;">${design}</td>`;

                platforms.forEach((plat, pIdx) => {
                    const rowPcs = filteredRows.filter(r => (r.designNo || 'Unknown') === design && (r.platform || 'Unknown') === plat)
                        .reduce((acc, r) => acc + (parseInt(r.pcs) || 1), 0);
                    bodyHtml += `<td style="padding: 12px; text-align: center; color: rgba(255,255,255,0.7);">${rowPcs || '-'}</td>`;
                    rowTotal += rowPcs;
                    colTotals[pIdx] += rowPcs;
                });

                bodyHtml += `<td style="padding: 12px; text-align: center; font-weight: bold; color: #2dd4bf;">${rowTotal}</td></tr>`;
                grandGrandTotal += rowTotal;
            });
            fittingOutReportBody.innerHTML = bodyHtml;

            // Build Footer
            let footHtml = `<tr style="background: rgba(255,255,255,0.05); font-weight: bold;">
                <td style="padding: 12px; border-top: 2px solid rgba(255,255,255,0.1);">Grand Total</td>`;
            colTotals.forEach(total => {
                footHtml += `<td style="padding: 12px; text-align: center; border-top: 2px solid rgba(255,255,255,0.1);">${total}</td>`;
            });
            footHtml += `<td style="padding: 12px; text-align: center; color: #2dd4bf; border-top: 2px solid rgba(20, 184, 166, 0.4); font-size: 1.1rem;">${grandGrandTotal}</td></tr>`;
            fittingOutReportFoot.innerHTML = footHtml;
        });
    }

    // --- Ship Pending Report Logic ---
    const generateShipPendingBtn = document.getElementById('generateShipPendingBtn');
    const shipPendingStartDate = document.getElementById('shipPendingStartDate');
    const shipPendingEndDate = document.getElementById('shipPendingEndDate');
    const shipPendingTbody = document.getElementById('shipPendingTbody');
    const shipPendingGrandTotal = document.getElementById('shipPendingGrandTotal');

    if (generateShipPendingBtn) {
        generateShipPendingBtn.addEventListener('click', () => {
            const start = shipPendingStartDate.value;
            const end = shipPendingEndDate.value;

            if (!start || !end) {
                alert("Please select both Start Date and End Date");
                return;
            }

            // Filter Data by Order Date range
            const filteredRows = tableData.filter(row => {
                const oDate = row.orderDate;
                if (!oDate) return false;
                return oDate >= start && oDate <= end;
            });

            if (filteredRows.length === 0) {
                shipPendingTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No data found for this range.</td></tr>';
                shipPendingGrandTotal.textContent = "0";
                return;
            }

            let bodyHtml = '';
            let totalPending = 0;

            filteredRows.forEach(row => {
                const isPending = !row.shipDate || row.shipDate.trim() === '';
                if (isPending) {
                    const rowPcs = parseInt(row.pcs) || 1;
                    totalPending += rowPcs;

                    bodyHtml += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 12px;">${formatDateForDisplay(row.orderDate)}</td>
                        <td style="padding: 12px;">${row.orderNo || '-'}</td>
                        <td style="padding: 12px;">${row.designNo || '-'}</td>
                        <td style="padding: 12px;">${row.platform || '-'}</td>
                        <td style="padding: 12px;">${rowPcs}</td>
                    </tr>`;
                }
            });

            shipPendingTbody.innerHTML = bodyHtml;
            shipPendingGrandTotal.textContent = totalPending;
        });
    }

    // --- Ship Pending PDF Export ---
    const exportShipPendingPdfBtn = document.getElementById('exportShipPendingPdfBtn');
    if (exportShipPendingPdfBtn) {
        exportShipPendingPdfBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait' });
            const start = shipPendingStartDate.value;
            const end = shipPendingEndDate.value;
            doc.text(`Ship Pending Report (${start} to ${end})`, 14, 15);
            doc.autoTable({
                html: '#shipPendingTable',
                startY: 20,
                theme: 'grid',
                headStyles: { fillColor: [244, 114, 182] }, // Pink color to match
                footStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
                styles: { fontSize: 10, cellPadding: 3 },
            });
            doc.save(`Ship_Pending_${start}_${end}.pdf`);
        });
    }

    // --- Fitting Wise PDF Export ---
    const exportFittingWisePdfBtn = document.getElementById('exportFittingWisePdfBtn');
    exportFittingWisePdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait' });
        const start = fittingWiseStartDate.value;
        const end = fittingWiseEndDate.value;
        doc.text(`Fitting Wise Report (${start} to ${end})`, 14, 15);
        doc.autoTable({
            html: '#fittingWiseTable',
            startY: 20,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }, // blue color
            footStyles: { fillColor: [20, 20, 20], textColor: [255, 255, 255] },
            styles: { fontSize: 10, cellPadding: 3 },
        });
        doc.save(`Fitting_Wise_${start}_${end}.pdf`);
    });

    // --- PDF Export Logic ---
    const exportTotalPendingPdfBtn = document.getElementById('exportTotalPendingPdfBtn');
    const exportDateWisePdfBtn = document.getElementById('exportDateWisePdfBtn');

    exportTotalPendingPdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });

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
        const doc = new jsPDF({ orientation: 'landscape' });

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
    loadFittingDetails();
    loadFromLocalStorage();

    // --- Role-Based Access Control ---
    function applyRoleAccess() {
        const activeUserId = localStorage.getItem('activeUserId') || '';
        const navPermEl = document.getElementById('navPermissions');
        const isAdmin = (activeUserId === 'vishal' || activeUserId === 'piyush');

        // Force Permissions tab for admins
        if (navPermEl) navPermEl.style.display = isAdmin ? 'block' : 'none';

        const userPermRaw = userPermissions[activeUserId] || {};
        // Unified Permission Object: only use the object-based granular permissions
        let uPerm = (typeof userPermRaw === 'object') ? { ...userPermRaw } : { reports: {} };

        const reports = uPerm.reports || {};

        // --- Navigation Visibility ---
        const navMap = [
            { id: 'navReports', visible: !!reports.totalPending },
            { id: 'navDateWise', visible: !!reports.dateWise },
            { id: 'navLatePis', visible: !!reports.latePis },
            { id: 'navTotalOrder', visible: !!reports.totalOrder },
            { id: 'navFittingWise', visible: !!reports.fittingWise },
            { id: 'navFittingOutReport', visible: !!reports.fittingOutReport },
            { id: 'navShipPending', visible: !!reports.shipPending },
            { id: 'navSettings', visible: true }, 
            { id: 'navTrash', visible: !!reports.trash }
        ];

        // "Data" tab visibility (only if they have at least one column permission)
        let hasAnyCol = false;
        for (let i = 1; i <= 18; i++) {
            if (uPerm[`col_${i}`]) { hasAnyCol = true; break; }
        }
        
        const canSeeData = isAdmin || hasAnyCol; 
        if (navData) navData.style.display = canSeeData ? 'block' : 'none';

        navMap.forEach(cfg => {
            const el = document.getElementById(cfg.id);
            if (el) {
                // Admins see everything, others see what's explicitly checked
                el.style.display = (isAdmin || cfg.visible) ? 'block' : 'none';
            }
        });

        // --- Table Column Visibility ---
        // Map permission keys to actual DOM column indices (0-based)
        // DOM order: 0=#, 1=OrderDate, 2=ConfirmationDate, 3=FittingOutDate, 4=OrderNo,
        //            5=DesignNo, 6=FittingDetail, 7=BlouseSize, 8=Customize, 9=KotiSize,
        //            10=KurtaSize, 11=Platform, 12=Pcs, 13=FittingName, 14=FinalDate,
        //            15=FittingReceived, 16=FittingIn, 17=ShipDate, 18=UserName, 19=Action
        const colKeyToDomIndex = {
            col_1: 1,   // Order Date
            col_18: 2,  // Confirmation Date (new)
            col_2: 3,   // Fitting Out Date
            col_3: 4,   // Order No
            col_4: 5,   // Design No
            col_5: 6,   // Fitting Detail
            col_6: 7,   // Blouse Size
            col_7: 8,   // Customize Blouse
            col_8: 9,   // Koti Size
            col_9: 10,  // Kurta Size
            col_10: 11, // Platform
            col_11: 12, // Pcs
            col_12: 13, // Fitting Name
            col_13: 14, // Final Date
            col_14: 15, // Fitting Received
            col_15: 16, // Fitting In/Return
            col_16: 17, // Ship Date
            col_17: 18  // User Name Log
        };
        const ACTION_COL_INDEX = 19;

        let visibleCols = null; // null means show all (for Admins)
        if (!isAdmin) { // Only apply restrictions for non-admins
            visibleCols = new Set([0]); // Always show index (Column #)
            let hasAnyField = false;
            for (const [key, domIdx] of Object.entries(colKeyToDomIndex)) {
                if (uPerm[key]) {
                    visibleCols.add(domIdx);
                    hasAnyField = true;
                }
            }
            // Show Action column if user has access to any field
            if (hasAnyField) visibleCols.add(ACTION_COL_INDEX);
        }

        if (visibleCols === null) {
            // Full Admin reset
            const styleTag = document.getElementById('roleAccessStyle');
            if (styleTag) styleTag.textContent = '';
            document.querySelectorAll('#dataTable thead tr th').forEach(th => th.style.display = '');
        } else {
            // Apply column hiding based on individual field selections
            const theadCells = document.querySelectorAll('#dataTable thead tr th');
            theadCells.forEach((th, i) => {
                th.style.display = visibleCols.has(i) ? '' : 'none';
            });

            // Inject CSS for dynamic column hiding
            let styleTag = document.getElementById('roleAccessStyle');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'roleAccessStyle';
                document.head.appendChild(styleTag);
            }

            let cssRules = '';
            for (let i = 0; i < theadCells.length; i++) {
                if (!visibleCols.has(i)) {
                    cssRules += `#dataTable tbody tr td:nth-child(${i + 1}) { display: none; }\n`;
                }
            }
            styleTag.textContent = cssRules;
        }

        // Management buttons: Limited hiding for non-admins
        if (!isAdmin && !uPerm.fullAdmin) {
            const add50 = document.getElementById('add50Btn');
            const clearAll = document.getElementById('clearAllBtn');
            const platBtn = document.getElementById('managePlatformsBtn');
            const fitBtn = document.getElementById('manageFittingsBtn');
            const fitDetBtn = document.getElementById('manageFittingDetailsBtn');

            if (add50) add50.style.display = 'none';
            if (clearAll) clearAll.style.display = 'none';
            if (platBtn) platBtn.style.display = 'none';
            if (fitBtn) fitBtn.style.display = 'none';
            if (fitDetBtn) fitDetBtn.style.display = 'none';
        }

        // --- Active Tab Safeguard ---
        if (!canSeeData && navData && navData.classList.contains('active')) {
            // Find first visible report (skip Settings/Trash for default landing)
            const firstVisibleNav = navs.find(n => n && n.style.display !== 'none' && n.id !== 'navSettings' && n.id !== 'navTrash' && n.id !== 'navPermissions');
            
            if (firstVisibleNav) {
                const navIndex = navs.indexOf(firstVisibleNav);
                if (navIndex !== -1 && sections[navIndex]) {
                    showSection(sections[navIndex], firstVisibleNav);
                }
            } else if (navSettings && navSettings.style.display !== 'none') {
                // If only settings is visible
                showSection(settingsSection, navSettings);
            } else {
                dataSection.style.display = 'none';
                document.getElementById('pageTitle').textContent = 'Access Denied';
            }
        }
    }

    // --- User Permissions Management (Flipped Layout) ---
    function renderPermissionsTable() {
        const tbody = document.getElementById('userPermissionsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const dataEntryFields = [
            { key: 'col_1', label: 'Order Date', color: '#f59e0b' },
            { key: 'col_18', label: 'Confirmation Date', color: '#f59e0b' },
            { key: 'col_2', label: 'Fitting Out Date', color: '#f59e0b' },
            { key: 'col_3', label: 'Order No', color: '#f59e0b' },
            { key: 'col_4', label: 'Design No', color: '#f59e0b' },
            { key: 'col_5', label: 'Fitting Detail', color: '#f59e0b' },
            { key: 'col_6', label: 'Blouse Size', color: '#f59e0b' },
            { key: 'col_7', label: 'Customize Blouse', color: '#f59e0b' },
            { key: 'col_8', label: 'Koti Size', color: '#f59e0b' },
            { key: 'col_9', label: 'Kurta Size', color: '#f59e0b' },
            { key: 'col_10', label: 'Platform', color: '#f59e0b' },
            { key: 'col_11', label: 'Pcs', color: '#f59e0b' },
            { key: 'col_12', label: 'Fitting Name', color: '#f59e0b' },
            { key: 'col_13', label: 'Final Date', color: '#f59e0b' },
            { key: 'col_14', label: 'Fitting Received', color: '#f59e0b' },
            { key: 'col_15', label: 'Fitting In/Reture', color: '#f59e0b' },
            { key: 'col_16', label: 'Ship Date', color: '#f59e0b' },
            { key: 'col_17', label: 'User Name Log', color: '#f59e0b' }
        ];

        const reportsList = [
            { key: 'totalPending', label: 'Total Pending', color: '#6366f1' },
            { key: 'dateWise', label: 'Date Wise', color: '#a855f7' },
            { id: 'latePis', key: 'latePis', label: 'Late PIS', color: '#f43f5e' },
            { key: 'totalOrder', label: 'Total Order', color: '#fbbf24' },
            { key: 'fittingWise', label: 'Fitting Wise', color: '#34d399' },
            { key: 'fittingOutReport', label: 'Fitting Out Report', color: '#2dd4bf' },
            { key: 'shipPending', label: 'Ship Pending', color: '#f472b6' },
            { key: 'trash', label: 'Trash / Recycle Bin', color: '#6b7280' }
        ];

        const usersToDisplay = ALL_USERS.filter(u => u.id !== 'vishal' && u.id !== 'piyush');

        // Add Section Header for Data Entry
        const headerData = document.createElement('tr');
        headerData.innerHTML = `<td colspan="${usersToDisplay.length + 1}" style="background: rgba(45, 212, 191, 0.1); color: #2dd4bf; padding: 10px 20px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; border-bottom: 2px solid rgba(45, 212, 191, 0.2);">Data Entry Table Fields</td>`;
        tbody.appendChild(headerData);

        dataEntryFields.forEach(perm => {
            renderRow(perm, 'field');
        });

        // Add Section Header for Reports
        const headerRep = document.createElement('tr');
        headerRep.innerHTML = `<td colspan="${usersToDisplay.length + 1}" style="background: rgba(129, 140, 248, 0.1); color: #818cf8; padding: 10px 20px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; border-top: 10px solid transparent; border-bottom: 2px solid rgba(129, 140, 248, 0.2);">Dashboard Reports</td>`;
        tbody.appendChild(headerRep);

        reportsList.forEach(perm => {
            renderRow(perm, 'report');
        });

        function renderRow(perm, group) {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';

            let html = `<td style="padding: 12px 20px; font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.7); position: sticky; left: 0; background: #1a1a2e; z-index: 1;">${perm.label}</td>`;

            usersToDisplay.forEach(user => {
                const raw = userPermissions[user.id] || {};
                const uPerm = (typeof raw === 'object') ? raw : { reports: {} };
                let isChecked = false;

                if (group === 'report') {
                    isChecked = !!(uPerm.reports && uPerm.reports[perm.key || perm.id]);
                } else {
                    isChecked = !!uPerm[perm.key];
                }

                html += `
                    <td style="text-align: center; padding: 10px;">
                        <input type="checkbox" class="perm-check" 
                               data-user="${user.id}" 
                               data-group="${group}" 
                               data-key="${perm.key || perm.id}" 
                               ${isChecked ? 'checked' : ''}>
                    </td>`;
            });

            tr.innerHTML = html;
            tbody.appendChild(tr);
        }

        // Re-attach listeners
        tbody.querySelectorAll('.perm-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const userId = e.target.dataset.user;
                const group = e.target.dataset.group;
                const key = e.target.dataset.key;
                const isChecked = e.target.checked;

                let current = userPermissions[userId] || {};
                if (typeof current === 'string') {
                    const oldRole = current;
                    current = { reports: {} };
                    if (oldRole === 'order') {
                        ['col_1', 'col_3', 'col_4', 'col_9', 'col_14'].forEach(k => current[k] = true);
                    } else if (oldRole === 'fitting') {
                        ['col_2', 'col_3', 'col_4', 'col_9', 'col_11', 'col_12', 'col_13'].forEach(k => current[k] = true);
                    } else if (oldRole === 'fullaccess') {
                        for (let i = 1; i <= 16; i++) current[`col_${i}`] = true;
                        current.reports = { totalPending: true, dateWise: true, latePis: true, totalOrder: true, fittingWise: true, fittingOutReport: true, shipPending: true };
                    }
                }
                if (!current.reports) current.reports = {};

                if (group === 'report') {
                    current.reports[key] = isChecked;
                } else {
                    current[key] = isChecked;
                }

                userPermissions[userId] = current;
                syncPermissionsToCloud(userId);
                applyRoleAccess();
            });
        });
    }

    function syncPermissionsToCloud(userIdToSync) {
        if (isFirebaseConnected && firebase.database) {
            // If a specific userId is provided, only update that user's data to avoid race conditions
            if (userIdToSync) {
                firebase.database().ref('user_permissions/' + userIdToSync).set(userPermissions[userIdToSync])
                    .then(() => console.log(`☁️ Permissions for ${userIdToSync} Synced`))
                    .catch(err => console.error("Permission Sync Error:", err));
            } else {
                // Otherwise update all (rare)
                firebase.database().ref('user_permissions').set(userPermissions)
                    .then(() => console.log("☁️ All Permissions Synced"))
                    .catch(err => console.error("Permission Sync Error:", err));
            }
        }
    }

    applyRoleAccess();


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
            <span>${platform}</span>
            <div style="display: flex; gap: 8px;">
                <button class="platform-edit-btn" data-type="platform" data-index="${index}" style="background: transparent; border: none; color: var(--accent-color); cursor: pointer;"><i class="fas fa-edit"></i></button>
                <button class="platform-delete-btn" data-type="platform" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
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

    function editPlatform(index) {
        const oldVal = platformOptions[index];
        const newVal = prompt(`Edit Platform Name:`, oldVal);
        if (newVal && newVal.trim() !== "" && newVal !== oldVal) {
            platformOptions[index] = newVal.trim();
            savePlatforms();
            renderPlatformList();
            renderTable();
        }
    }

    function deletePlatform(index) {
        if (confirm(`Delete "${platformOptions[index]}"?`)) {
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
            <span>${fitting}</span>
            <div style="display: flex; gap: 8px;">
                <button class="platform-edit-btn" data-type="fitting" data-index="${index}" style="background: transparent; border: none; color: var(--accent-color); cursor: pointer;"><i class="fas fa-edit"></i></button>
                <button class="platform-delete-btn" data-type="fitting" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
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

    function editFitting(index) {
        const oldVal = fittingOptions[index];
        const newVal = prompt(`Edit Fitting Name:`, oldVal);
        if (newVal && newVal.trim() !== "" && newVal !== oldVal) {
            fittingOptions[index] = newVal.trim();
            saveFittings();
            renderFittingList();
            renderTable();
        }
    }

    function deleteFitting(index) {
        if (confirm(`Delete "${fittingOptions[index]}"?`)) {
            fittingOptions.splice(index, 1);
            saveFittings();
            renderFittingList();
            renderTable();
        }
    }

    // --- Shared Listener Attachment ---
    function attachDeleteListeners(type) {
        document.querySelectorAll(`.platform-delete-btn[data-type="${type}"]`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                if (type === 'platform') deletePlatform(index);
                else if (type === 'fitting') deleteFitting(index);
                else if (type === 'fittingDetail') deleteFittingDetail(index);
            });
        });

        document.querySelectorAll(`.platform-edit-btn[data-type="${type}"]`).forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.getAttribute('data-index');
                if (type === 'platform') editPlatform(index);
                else if (type === 'fitting') editFitting(index);
                else if (type === 'fittingDetail') editFittingDetail(index);
            });
        });
    }

    // --- Fitting Detail Logic ---
    const fittingDetailModal = document.getElementById('fittingDetailModal');
    const manageFittingDetailsBtn = document.getElementById('manageFittingDetailsBtn');
    const closeFittingDetailModal = document.querySelector('.close-fitting-detail-modal');
    const addFittingDetailBtn = document.getElementById('addFittingDetailBtn');
    const newFittingDetailInput = document.getElementById('newFittingDetailInput');
    const fittingDetailList = document.getElementById('fittingDetailList');

    function renderFittingDetailList() {
        fittingDetailList.innerHTML = '';
        fittingDetailOptions.forEach((detail, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
            <span>${detail}</span>
            <div style="display: flex; gap: 8px;">
                <button class="platform-edit-btn" data-type="fittingDetail" data-index="${index}" style="background: transparent; border: none; color: var(--accent-color); cursor: pointer;"><i class="fas fa-edit"></i></button>
                <button class="platform-delete-btn" data-type="fittingDetail" data-index="${index}"><i class="fas fa-trash"></i></button>
            </div>
        `;
            fittingDetailList.appendChild(li);
        });
        attachDeleteListeners('fittingDetail');
    }

    function addFittingDetail() {
        const newVal = newFittingDetailInput.value.trim();
        if (newVal && !fittingDetailOptions.includes(newVal)) {
            fittingDetailOptions.push(newVal);
            saveFittingDetails();
            newFittingDetailInput.value = '';
            renderFittingDetailList();
            renderTable();
        } else if (fittingDetailOptions.includes(newVal)) {
            alert('Detail already exists!');
        }
    }

    function editFittingDetail(index) {
        const oldVal = fittingDetailOptions[index];
        const newVal = prompt(`Edit Fitting Detail:`, oldVal);
        if (newVal && newVal.trim() !== "" && newVal !== oldVal) {
            fittingDetailOptions[index] = newVal.trim();
            saveFittingDetails();
            renderFittingDetailList();
            renderTable();
        }
    }

    function deleteFittingDetail(index) {
        if (confirm(`Delete "${fittingDetailOptions[index]}"?`)) {
            fittingDetailOptions.splice(index, 1);
            saveFittingDetails();
            renderFittingDetailList();
            renderTable();
        }
    }

    manageFittingDetailsBtn.addEventListener('click', () => openModal(fittingDetailModal, renderFittingDetailList));
    closeFittingDetailModal.addEventListener('click', () => closeModal(fittingDetailModal));
    addFittingDetailBtn.addEventListener('click', addFittingDetail);

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
        const historyModal = document.getElementById('historyModal');
        if (historyModal && e.target === historyModal) {
            historyModal.style.display = 'none';
        }
    });

    const closeHistoryModal = document.querySelector('.close-history-modal');
    if (closeHistoryModal) {
        closeHistoryModal.addEventListener('click', () => {
            document.getElementById('historyModal').style.display = 'none';
        });
    }

    // --- Keyboard Navigation for Data Table ---
    const dataTable = document.getElementById('dataTable');
    if (dataTable) {
        dataTable.addEventListener('keydown', (e) => {
            const target = e.target;
            if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;

            // Don't intercept up/down for select elements so they can still change options
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && target.tagName === 'SELECT') {
                return;
            }

            let moveDirection = null;

            if (e.key === 'ArrowUp') {
                moveDirection = 'up';
            } else if (e.key === 'ArrowDown') {
                moveDirection = 'down';
            } else if (e.key === 'ArrowLeft') {
                let canMoveLeft = false;
                if (target.tagName === 'INPUT') {
                    if (target.type === 'date') {
                        canMoveLeft = false;
                    } else if (target.type === 'number') {
                        canMoveLeft = true;
                    } else {
                        try {
                            if (target.selectionStart === 0) canMoveLeft = true;
                        } catch(err) { canMoveLeft = true; }
                    }
                } else {
                    canMoveLeft = true; // SELECT
                }
                if (canMoveLeft) moveDirection = 'left';
            } else if (e.key === 'ArrowRight') {
                let canMoveRight = false;
                if (target.tagName === 'INPUT') {
                    if (target.type === 'date') {
                        canMoveRight = false;
                    } else if (target.type === 'number') {
                        canMoveRight = true;
                    } else {
                        try {
                            if (target.selectionEnd === target.value.length) canMoveRight = true;
                        } catch(err) { canMoveRight = true; }
                    }
                } else {
                    canMoveRight = true; // SELECT
                }
                if (canMoveRight) moveDirection = 'right';
            }

            if (!moveDirection) return;

            const td = target.closest('td');
            const tr = target.closest('tr');
            if (!td || !tr) return;

            const tds = Array.from(tr.children);
            const colIndex = tds.indexOf(td);

            if (moveDirection === 'up' || moveDirection === 'down') {
                e.preventDefault();
                const nextTr = moveDirection === 'up' ? tr.previousElementSibling : tr.nextElementSibling;
                if (nextTr) {
                    const nextTd = nextTr.children[colIndex];
                    if (nextTd) {
                        const nextInput = nextTd.querySelector('input, select');
                        if (nextInput) {
                            nextInput.focus();
                        }
                    }
                }
            } else if (moveDirection === 'left' || moveDirection === 'right') {
                const inputsInRow = Array.from(tr.querySelectorAll('input, select'));
                const currentIndex = inputsInRow.indexOf(target);
                let nextInput = null;

                if (moveDirection === 'left' && currentIndex > 0) {
                    nextInput = inputsInRow[currentIndex - 1];
                } else if (moveDirection === 'right' && currentIndex < inputsInRow.length - 1) {
                    nextInput = inputsInRow[currentIndex + 1];
                }

                if (nextInput) {
                    e.preventDefault();
                    nextInput.focus();
                }
            }
        });
    }
});
