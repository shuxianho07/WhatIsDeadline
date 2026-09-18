// Constants
let STORAGE_KEY = 'prepmate_events';
let COURSES_KEY = 'prepmate_courses';
const DAILY_HOURS_LIMIT = 5;

// Auth State
let currentUser = sessionStorage.getItem('currentUser');
if (!currentUser) {
    window.location.href = 'index.html';
}

let usersDB = JSON.parse(localStorage.getItem('prepmate_users')) || { admin: '123456' };

// DOM Elements
const appWrapper = document.getElementById('app-wrapper');

const quickAddForm = document.getElementById('quick-add-form');
const editForm = document.getElementById('edit-task-form');
const editModal = document.getElementById('edit-modal');
const closeModals = document.querySelectorAll('.close-modal');
const eventsList = document.getElementById('events-list');
const draftsList = document.getElementById('drafts-list');
const todaysTasks = document.getElementById('todays-tasks');
const dateDisplay = document.getElementById('date-display');
const dailyProgressBar = document.getElementById('daily-progress-bar');
const dailyHoursText = document.getElementById('daily-hours-text');

// State
let events = [];
let currentCourseFilter = 'All';
let currentView = 'list';
let calendarInstance = null;
let coursesList = [];
let datePicker;

function loadDataForUser() {
    STORAGE_KEY = `prepmate_events_${currentUser}`;
    COURSES_KEY = `prepmate_courses_${currentUser}`;

    // Migration for admin
    if (currentUser === 'admin') {
        const legacyEvents = localStorage.getItem('prepmate_events');
        const legacyCourses = localStorage.getItem('prepmate_courses');
        
        if (legacyEvents && !localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, legacyEvents);
            localStorage.removeItem('prepmate_events');
        }
        if (legacyCourses && !localStorage.getItem(COURSES_KEY)) {
            localStorage.setItem(COURSES_KEY, legacyCourses);
            localStorage.removeItem('prepmate_courses');
        }
    }

    events = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    coursesList = JSON.parse(localStorage.getItem(COURSES_KEY)) || [];
    
    if (coursesList.length === 0) {
        const existingCourses = [...new Set(events.map(e => e.course).filter(Boolean))];
        if (existingCourses.length > 0) {
            coursesList = existingCourses.map(name => ({ name: name, color: '' }));
            localStorage.setItem(COURSES_KEY, JSON.stringify(coursesList));
        }
    } else if (coursesList.length > 0 && typeof coursesList[0] === 'string') {
        coursesList = coursesList.map(name => ({ name: name, color: '' }));
        localStorage.setItem(COURSES_KEY, JSON.stringify(coursesList));
    }
}

// Initialize
function init() {
    // Set date display
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateDisplay.textContent = new Date().toLocaleDateString('en-US', options);

    if (typeof flatpickr !== 'undefined') {
        datePicker = flatpickr("#edit-date", {
            dateFormat: "Y-m-d",
            minDate: "today"
        });
    }

    // Filter listener

    // Filter listener
    const filterSelect = document.getElementById('course-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            currentCourseFilter = e.target.value;
            renderEvents();
            renderTodaysPlan();
        });
    }

    // View Toggles
    const viewBtns = document.querySelectorAll('.view-btn');
    const eventsList = document.getElementById('events-list');
    const eventsTableContainer = document.getElementById('events-table-container');
    const eventsCalendarContainer = document.getElementById('events-calendar-container');

    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentView = btn.getAttribute('data-view');
            
            eventsList.style.display = currentView === 'list' ? 'flex' : 'none';
            if(currentView !== 'list') eventsList.style.display = 'none'; // Overriding default flex if needed
            
            eventsTableContainer.style.display = currentView === 'table' ? 'block' : 'none';
            eventsCalendarContainer.style.display = currentView === 'calendar' ? 'block' : 'none';
            
            renderEvents();
            
            if (currentView === 'calendar' && calendarInstance) {
                calendarInstance.render();
            }
        });
    });

    // Render UI
    renderEvents();
    renderTodaysPlan();
}

// Event Listeners
quickAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newEvent = {
        id: Date.now().toString(),
        title: document.getElementById('quick-task-title').value.trim(),
        course: '',
        type: 'Other',
        dueDate: null,
        totalHours: 10,
        difficulty: 3,
        hoursCompleted: 0,
        createdAt: new Date().toISOString()
    };
    events.push(newEvent);
    saveEvents();
    quickAddForm.reset();
    renderEvents();
});

editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-task-id').value;
    const event = events.find(e => e.id === id);
    if (event) {
        const newHours = parseInt(document.getElementById('edit-hours').value);
        const completedInput = document.getElementById('edit-completed-hours');
        const newCompletedHours = completedInput ? parseFloat(completedInput.value) : event.hoursCompleted;

        event.title = document.getElementById('edit-title').value;
        event.course = document.getElementById('edit-course').value;
        event.type = document.getElementById('edit-type').value;
        event.dueDate = document.getElementById('edit-date').value || null;
        event.totalHours = newHours;
        event.hoursCompleted = Math.min(newHours, Math.max(0, newCompletedHours)); // Ensure it doesn't exceed total
        event.difficulty = parseInt(document.getElementById('edit-difficulty').value) || 3;
        saveEvents();
        closeModal();
        renderEvents();
        renderTodaysPlan();
    }
});

// Modal functions
function openModal(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;
    
    document.getElementById('edit-task-id').value = event.id;
    document.getElementById('edit-title').value = event.title;
    renderCourseButtonsInModal(event.course);
    document.getElementById('edit-type').value = event.type;
    
    if (datePicker) {
        datePicker.setDate(event.dueDate || null);
    }
    
    document.getElementById('edit-hours').value = event.totalHours;
    const completedInput = document.getElementById('edit-completed-hours');
    if (completedInput) completedInput.value = event.hoursCompleted || 0;
    document.getElementById('edit-difficulty').value = event.difficulty || 3;
    
    editModal.classList.add('show');
}

function closeModal() {
    editModal.classList.remove('show');
}

closeModals.forEach(btn => {
    // Only bind to the edit modal's close button if it doesn't have a specific ID, 
    // or bind to all of them if they are purely visual.
    // The delete modal has its own listener on #close-delete-modal, so we can just bind closeModal to the one in edit-modal.
    if (!btn.id || btn.id === 'close-edit-modal') {
        btn.addEventListener('click', closeModal);
    }
});
window.addEventListener('click', (e) => {
    if (e.target === editModal) closeModal();
    if (courseContextMenu && !courseContextMenu.contains(e.target)) {
        courseContextMenu.classList.remove('show');
    }
    if (typeof deleteCourseModal !== 'undefined' && e.target === deleteCourseModal) {
        deleteCourseModal.classList.remove('show');
    }
});

// Helper Functions
function saveEvents() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function deleteEvent(id) {
    events = events.filter(e => e.id !== id);
    saveEvents();
    renderEvents();
    renderTodaysPlan();
}

function toggleTaskDone(id, recommendedToday) {
    const todayStr = new Date().toISOString().split('T')[0];
    const event = events.find(e => e.id === id);
    if (event) {
        if (event.lastCompletedDate === todayStr && event.lastCompletedHours > 0) {
            // Undo
            event.hoursCompleted -= event.lastCompletedHours;
            if (event.hoursCompleted < 0) event.hoursCompleted = 0;
            event.lastCompletedDate = null;
            event.lastCompletedHours = 0;
        } else {
            // Mark Done
            const actualHoursToAdd = Math.min(recommendedToday, event.totalHours - event.hoursCompleted);
            event.hoursCompleted += actualHoursToAdd;
            event.lastCompletedDate = todayStr;
            event.lastCompletedHours = actualHoursToAdd;
        }
        saveEvents();
        renderTodaysPlan();
        renderEvents();
    }
}

function updateCourseFilterOptions() {
    const filterSelect = document.getElementById('course-filter');
    if (!filterSelect) return;
    
    let html = `<option value="All">All Courses</option>`;
    coursesList.forEach(c => {
        html += `<option value="${c.name}">${c.name}</option>`;
    });
    
    filterSelect.innerHTML = html;
    if (coursesList.some(c => c.name === currentCourseFilter)) {
        filterSelect.value = currentCourseFilter;
    } else {
        currentCourseFilter = 'All';
        filterSelect.value = 'All';
    }
}

function renderCourseButtonsInModal(selectedCourse) {
    const container = document.getElementById('course-selection-container');
    if (!container) return;
    
    document.getElementById('edit-course').value = selectedCourse || '';
    
    container.innerHTML = coursesList.map(c => `
        <button type="button" class="course-btn ${c.name === selectedCourse ? 'active' : ''}" 
                style="${c.color ? `border-color: ${c.color}; ${c.name === selectedCourse ? `background: ${c.color}; color: #fff;` : `color: ${c.color};`}` : ''}"
                onclick="selectCourse('${c.name}')"
                oncontextmenu="handleCourseContextMenu(event, '${c.name}')">${c.name}</button>
    `).join('');
    
    if (selectedCourse) {
        container.innerHTML += `<button type="button" class="course-btn" style="border-color: #ef4444; color: #fca5a5;" onclick="selectCourse('')"><i class="fa-solid fa-xmark"></i> Clear</button>`;
    }
}

window.selectCourse = function(course) {
    renderCourseButtonsInModal(course);
}

// Add Course logic
const btnAddCourse = document.getElementById('btn-add-course');
const newCourseInput = document.getElementById('new-course-input');

if (btnAddCourse && newCourseInput) {
    btnAddCourse.addEventListener('click', () => {
        const val = newCourseInput.value.trim();
        if (val && !coursesList.some(c => c.name === val)) {
            coursesList.push({ name: val, color: '' });
            localStorage.setItem(COURSES_KEY, JSON.stringify(coursesList));
            updateCourseFilterOptions(); 
        }
        newCourseInput.value = '';
        if (val) {
            renderCourseButtonsInModal(val); 
        }
    });
}

// Context Menu Logic
const courseContextMenu = document.getElementById('course-context-menu');
const ctxColorBtn = document.getElementById('ctx-color');
const ctxColorPicker = document.getElementById('ctx-color-picker');
const ctxRenameBtn = document.getElementById('ctx-rename');
const ctxDeleteBtn = document.getElementById('ctx-delete');

const deleteCourseModal = document.getElementById('delete-course-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal');
const deleteFolderNameSpan = document.getElementById('delete-folder-name');
const btnDeleteFolderOnly = document.getElementById('btn-delete-folder-only');
const btnDeleteFolderTasks = document.getElementById('btn-delete-folder-tasks');

let currentContextCourse = null;

window.handleCourseContextMenu = function(e, courseName) {
    e.preventDefault();
    currentContextCourse = courseName;
    
    courseContextMenu.style.left = `${e.clientX}px`;
    courseContextMenu.style.top = `${e.clientY}px`;
    courseContextMenu.classList.add('show');
};

if (ctxColorBtn && ctxColorPicker) {
    ctxColorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ctxColorPicker.click();
    });
    
    ctxColorPicker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        const courseObj = coursesList.find(c => c.name === currentContextCourse);
        if (courseObj) {
            courseObj.color = newColor;
            localStorage.setItem(COURSES_KEY, JSON.stringify(coursesList));
            renderCourseButtonsInModal(document.getElementById('edit-course').value);
            renderEvents();
            renderTodaysPlan();
        }
        courseContextMenu.classList.remove('show');
    });
}

if (ctxRenameBtn) {
    ctxRenameBtn.addEventListener('click', () => {
        courseContextMenu.classList.remove('show');
        const newName = prompt(`Rename folder "${currentContextCourse}" to:`, currentContextCourse);
        if (newName && newName.trim() !== '' && newName.trim() !== currentContextCourse) {
            const trimmedName = newName.trim();
            const courseObj = coursesList.find(c => c.name === currentContextCourse);
            if (courseObj) {
                courseObj.name = trimmedName;
                localStorage.setItem(COURSES_KEY, JSON.stringify(coursesList));
            }
            
            let updatedEvents = false;
            events.forEach(e => {
                if (e.course === currentContextCourse) {
                    e.course = trimmedName;
                    updatedEvents = true;
                }
            });
            if (updatedEvents) saveEvents();
            
            if (document.getElementById('edit-course').value === currentContextCourse) {
                document.getElementById('edit-course').value = trimmedName;
            }
            if (currentCourseFilter === currentContextCourse) currentCourseFilter = trimmedName;
            
            renderCourseButtonsInModal(document.getElementById('edit-course').value);
            updateCourseFilterOptions();
            renderEvents();
            renderTodaysPlan();
        }
    });
}

if (ctxDeleteBtn) {
    ctxDeleteBtn.addEventListener('click', () => {
        courseContextMenu.classList.remove('show');
        deleteFolderNameSpan.textContent = currentContextCourse;
        deleteCourseModal.classList.add('show');
    });
}

if (closeDeleteModalBtn) {
    closeDeleteModalBtn.addEventListener('click', () => {
        deleteCourseModal.classList.remove('show');
    });
}

function executeFolderDeletion(deleteTasksAlso) {
    coursesList = coursesList.filter(c => c.name !== currentContextCourse);
    localStorage.setItem(COURSES_KEY, JSON.stringify(coursesList));
    
    if (deleteTasksAlso) {
        events = events.filter(e => e.course !== currentContextCourse);
    } else {
        events.forEach(e => {
            if (e.course === currentContextCourse) e.course = '';
        });
    }
    saveEvents();
    
    if (document.getElementById('edit-course').value === currentContextCourse) {
        document.getElementById('edit-course').value = '';
    }
    if (currentCourseFilter === currentContextCourse) currentCourseFilter = 'All';
    
    deleteCourseModal.classList.remove('show');
    renderCourseButtonsInModal(document.getElementById('edit-course').value);
    updateCourseFilterOptions();
    renderEvents();
    renderTodaysPlan();
}

if (btnDeleteFolderOnly) {
    btnDeleteFolderOnly.addEventListener('click', () => executeFolderDeletion(false));
}

if (btnDeleteFolderTasks) {
    btnDeleteFolderTasks.addEventListener('click', () => executeFolderDeletion(true));
}

function renderEvents() {
    updateCourseFilterOptions();
    
    let filteredEvents = events;
    if (currentCourseFilter !== 'All') {
        filteredEvents = events.filter(e => e.course === currentCourseFilter);
    }

    const scheduled = filteredEvents.filter(e => e.dueDate);
    const drafts = filteredEvents.filter(e => !e.dueDate);

    // Render Drafts
    if (drafts.length === 0) {
        draftsList.innerHTML = '<div class="empty-state">No pending tasks!</div>';
    } else {
        draftsList.innerHTML = drafts.map(event => {
            const courseObj = coursesList.find(c => c.name === event.course);
            const courseColor = courseObj && courseObj.color ? courseObj.color : 'rgba(0,0,0,0.05)';
            const textColor = courseObj && courseObj.color ? '#fff' : 'var(--text-primary)';
            const border = courseObj && courseObj.color ? 'transparent' : 'rgba(0,0,0,0.1)';
            const courseBadge = event.course ? `<span class="type-badge" style="background: ${courseColor}; color: ${textColor}; border: 1px solid ${border};">${event.course}</span>` : '';
            return `
                <li class="event-item">
                    <div class="event-info">
                        <span class="event-title">${event.title}</span>
                        <div class="event-meta">
                            ${courseBadge}
                            <span class="type-badge type-other">Draft</span>
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="btn-icon" onclick="openModal('${event.id}')" title="Edit/Schedule">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteEvent('${event.id}')" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </li>
            `;
        }).join('');
    }

    // Render Scheduled
    const eventsList = document.getElementById('events-list');
    const eventsTableBody = document.getElementById('events-table-body');
    const fullCalendarEl = document.getElementById('full-calendar');

    if (scheduled.length === 0) {
        eventsList.innerHTML = '<div class="empty-state">No upcoming events found.</div>';
        if (eventsTableBody) eventsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">No upcoming events found.</td></tr>';
        if (calendarInstance) calendarInstance.removeAllEvents();
    } else {
        const sortedEvents = [...scheduled].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (currentView === 'list') {
            eventsList.innerHTML = sortedEvents.map(event => {
                const daysLeft = Math.ceil((new Date(event.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                const progress = Math.round((event.hoursCompleted / event.totalHours) * 100) || 0;
                const urgentHtml = daysLeft <= 1 ? '<span class="urgent-badge">Urgent!</span>' : '';
                
                const courseObj = coursesList.find(c => c.name === event.course);
                const courseColor = courseObj && courseObj.color ? courseObj.color : 'rgba(0,0,0,0.05)';
                const textColor = courseObj && courseObj.color ? '#fff' : 'var(--text-primary)';
                const border = courseObj && courseObj.color ? 'transparent' : 'rgba(0,0,0,0.1)';
                const courseBadge = event.course ? `<span class="type-badge" style="background: ${courseColor}; color: ${textColor}; border: 1px solid ${border};">${event.course}</span>` : '';
                
                return `
                    <li class="event-item">
                        <div class="event-info">
                            <span class="event-title">${event.title} ${urgentHtml}</span>
                            <div class="event-meta">
                                ${courseBadge}
                                <span class="type-badge type-${event.type.toLowerCase()}">${event.type}</span>
                                <span><i class="fa-regular fa-clock"></i> Due in ${daysLeft} days</span>
                                <span><i class="fa-solid fa-chart-line"></i> ${progress}% Prep</span>
                            </div>
                        </div>
                        <div class="task-actions">
                            <button class="btn-icon" onclick="openModal('${event.id}')" title="Edit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-icon btn-delete" onclick="deleteEvent('${event.id}')" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </li>
                `;
            }).join('');
        }

        if (currentView === 'table') {
            if (eventsTableBody) {
                eventsTableBody.innerHTML = sortedEvents.map(event => {
                    const daysLeft = Math.ceil((new Date(event.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                    const progress = Math.round((event.hoursCompleted / event.totalHours) * 100) || 0;
                    const urgentHtml = daysLeft <= 1 ? '<span class="urgent-badge" style="margin-left:0.5rem; font-size:0.7rem;">Urgent!</span>' : '';
                    
                    const courseObj = coursesList.find(c => c.name === event.course);
                    const courseColor = courseObj && courseObj.color ? courseObj.color : 'rgba(0,0,0,0.05)';
                    const textColor = courseObj && courseObj.color ? '#fff' : 'var(--text-primary)';
                    const border = courseObj && courseObj.color ? 'transparent' : 'rgba(0,0,0,0.1)';
                    const courseBadge = event.course ? `<span class="type-badge" style="background: ${courseColor}; color: ${textColor}; border: 1px solid ${border};">${event.course}</span>` : '';
                    
                    return `
                        <tr>
                            <td><strong style="color: var(--text-primary);">${event.title}</strong>${urgentHtml}</td>
                            <td>${courseBadge}</td>
                            <td><span class="type-badge type-${event.type.toLowerCase()}">${event.type}</span></td>
                            <td>${event.dueDate} <span style="font-size: 0.8rem; opacity: 0.7;">(${daysLeft} days)</span></td>
                            <td>${progress}%</td>
                            <td>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button class="btn-icon" onclick="openModal('${event.id}')" style="background: rgba(255,255,255,0.1); padding: 0.4rem; border-radius: 0.25rem;">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn-icon btn-delete" onclick="deleteEvent('${event.id}')" style="background: rgba(239,68,68,0.1); padding: 0.4rem; border-radius: 0.25rem;">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        if (currentView === 'calendar') {
            if (!calendarInstance && typeof FullCalendar !== 'undefined' && fullCalendarEl) {
                calendarInstance = new FullCalendar.Calendar(fullCalendarEl, {
                    initialView: 'dayGridMonth',
                    height: 'auto',
                    headerToolbar: {
                        left: 'prev,next today',
                        center: 'title',
                        right: ''
                    },
                    events: [],
                    eventClick: function(info) {
                        openModal(info.event.id);
                    }
                });
                calendarInstance.render();
            }
            
            if (calendarInstance) {
                const calendarEvents = sortedEvents.map(e => {
                    const courseObj = coursesList.find(c => c.name === e.course);
                    return {
                        id: e.id,
                        title: e.title + (e.course ? ` (${e.course})` : ''),
                        start: e.dueDate,
                        backgroundColor: courseObj && courseObj.color ? courseObj.color : '#3b82f6',
                        borderColor: courseObj && courseObj.color ? courseObj.color : '#3b82f6'
                    };
                });
                calendarInstance.removeAllEvents();
                calendarInstance.addEventSource(calendarEvents);
            }
        }
    }
}

// Scheduling Algorithm
function calculateTodaysPlan() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = new Date().toISOString().split('T')[0];

    let tasks = [];
    let totalRecommendedHours = 0;

    events.forEach(event => {
        if (currentCourseFilter !== 'All' && event.course !== currentCourseFilter) return;
        if (!event.dueDate) return;

        const dueDate = new Date(event.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        // Determine how much was already completed today
        const doneToday = (event.lastCompletedDate === todayStr) ? (event.lastCompletedHours || 0) : 0;
        
        // Pretend we haven't done today's work yet for the calculation
        const hoursCompletedBeforeToday = event.hoursCompleted - doneToday;
        
        // Don't schedule if it was already fully prepped *before* today, or past due
        if (hoursCompletedBeforeToday >= event.totalHours || dueDate < today) return;

        const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (daysLeft === 0) return; // Due today, hopefully prepped! 

        const hoursRemaining = event.totalHours - hoursCompletedBeforeToday;

        const minDaysNeeded = Math.ceil(hoursRemaining / (DAILY_HOURS_LIMIT / 2)); 
        const startWindowDays = Math.max(3, minDaysNeeded * 2);

        if (daysLeft > startWindowDays) return;
        
        let recommendedToday = hoursRemaining / daysLeft;
        const urgencyMultiplier = 1 + ((5 / daysLeft) * (event.difficulty / 5));
        recommendedToday = recommendedToday * urgencyMultiplier;

        recommendedToday = Math.min(recommendedToday, Math.min(3, hoursRemaining));
        recommendedToday = Math.ceil(recommendedToday * 2) / 2;

        if (recommendedToday > 0) {
            tasks.push({
                ...event,
                recommendedToday,
                isDoneToday: doneToday > 0
            });
            totalRecommendedHours += recommendedToday;
        }
    });

    if (totalRecommendedHours > DAILY_HOURS_LIMIT) {
        const scaleFactor = DAILY_HOURS_LIMIT / totalRecommendedHours;
        
        tasks.forEach(task => {
            task.exactRecommended = task.recommendedToday * scaleFactor;
            task.recommendedToday = Math.floor(task.exactRecommended * 2) / 2;
        });
        
        let currentTotal = tasks.reduce((sum, task) => sum + task.recommendedToday, 0);
        
        tasks.sort((a, b) => (b.exactRecommended - b.recommendedToday) - (a.exactRecommended - a.recommendedToday));
        
        for (let task of tasks) {
            if (currentTotal < DAILY_HOURS_LIMIT) {
                task.recommendedToday += 0.5;
                currentTotal += 0.5;
            }
        }
        
        tasks = tasks.filter(task => task.recommendedToday > 0);
    }

    return tasks;
}

function renderTodaysPlan() {
    const tasks = calculateTodaysPlan();
    
    let totalHoursForToday = tasks.reduce((sum, task) => sum + task.recommendedToday, 0);
    
    // Update Progress Bar
    const progressPercent = Math.min((totalHoursForToday / DAILY_HOURS_LIMIT) * 100, 100);
    dailyProgressBar.style.width = `${progressPercent}%`;
    dailyHoursText.textContent = `${totalHoursForToday} / ${DAILY_HOURS_LIMIT} Hours Planned`;

    if (tasks.length === 0) {
        todaysTasks.innerHTML = '<div class="empty-state">No study tasks required today. You are on track!</div>';
        return;
    }

    // Sort by priority (higher recommended hours first)
    tasks.sort((a, b) => b.recommendedToday - a.recommendedToday);

    todaysTasks.innerHTML = tasks.map(task => {
        const daysLeft = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        const urgentHtml = daysLeft <= 1 ? '<span class="urgent-badge">Due Tomorrow!</span>' : '';
        
        const courseObj = coursesList.find(c => c.name === task.course);
        const courseColor = courseObj && courseObj.color ? courseObj.color : 'rgba(0,0,0,0.05)';
        const textColor = courseObj && courseObj.color ? '#fff' : 'var(--text-primary)';
        const border = courseObj && courseObj.color ? 'transparent' : 'rgba(0,0,0,0.1)';
        const courseBadge = task.course ? `<span class="type-badge" style="background: ${courseColor}; color: ${textColor}; border: 1px solid ${border};">${task.course}</span>` : '';

        const doneClass = task.isDoneToday ? 'task-done' : '';
        const iconClass = task.isDoneToday ? 'fa-solid fa-rotate-left' : 'fa-solid fa-check-circle';
        const btnTitle = task.isDoneToday ? 'Undo' : 'Mark Completed for Today';
        const btnStyle = task.isDoneToday ? 'background: rgba(255,255,255,0.1); color: var(--text-secondary);' : '';

        return `
            <li class="task-item ${doneClass}">
                <div class="task-info">
                    <span class="task-title">${task.title} ${urgentHtml}</span>
                    <div class="task-meta">
                        ${courseBadge}
                        <span class="type-badge type-${task.type.toLowerCase()}">${task.type}</span>
                        <span><i class="fa-solid fa-hourglass-half"></i> Study ${task.recommendedToday} hours today</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-complete" onclick="toggleTaskDone('${task.id}', ${task.recommendedToday})" title="${btnTitle}" style="${btnStyle}">
                        <i class="${iconClass}"></i>
                    </button>
                </div>
            </li>
        `;
    }).join('');
}

// Export/Import Data
const btnExport = document.getElementById('btn-export');
const fileImport = document.getElementById('file-import');

if (btnExport && fileImport) {
    btnExport.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "prepmate_data.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedEvents = JSON.parse(event.target.result);
                if (Array.isArray(importedEvents)) {
                    events = importedEvents;
                    saveEvents();
                    renderEvents();
                    renderTodaysPlan();
                    alert('Data successfully imported!');
                } else {
                    alert('Invalid data format.');
                }
            } catch (err) {
                alert('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    });
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        // Reset state
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    });
}

// Boot up automatically now that we have an auth guard
loadDataForUser();
init();
