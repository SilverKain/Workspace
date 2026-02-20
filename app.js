// Глобальное состояние приложения
const AppState = {
    files: {},
    currentFile: null,
    statistics: {},
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDate: null,
    isShowingUrl: false,
    lastFileView: null,
    projects: {},
    projectIdCounter: 1
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initEventListeners();
    renderFileList();
    renderProjectList();
    renderCalendar();
    renderStats();
    
    // Восстановить последний открытый файл
    if (AppState.currentFile) {
        displayFile(AppState.currentFile);
    }
});

// Инициализация обработчиков событий
function initEventListeners() {
    document.getElementById('loadFilesBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('loadUrlBtn').addEventListener('click', handleUrlLoad);
    document.getElementById('backToFileBtn').addEventListener('click', handleBackToFile);
    document.getElementById('addProjectBtn').addEventListener('click', handleAddProject);
}

// Обработка выбора файлов
function handleFileSelect(event) {
    const files = event.target.files;
    
    if (files.length === 0) return;
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            const fileName = file.name;
            
            // Сохранить файл в состоянии
            AppState.files[fileName] = {
                name: fileName,
                content: content,
                openCount: AppState.files[fileName]?.openCount || 0,
                lastOpened: AppState.files[fileName]?.lastOpened || null,
                readProgress: AppState.files[fileName]?.readProgress || 0,
                hiddenFromSources: AppState.files[fileName]?.hiddenFromSources || false
            };
            
            saveToLocalStorage();
            renderFileList();
            
            // Открыть первый загруженный файл
            if (!AppState.currentFile) {
                displayFile(fileName);
            }
        };
        
        reader.readAsText(file);
    });
    
    // Очистить input
    event.target.value = '';
}

// Вычислить прогресс прокрутки
function calculateScrollProgress(element) {
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight - element.clientHeight;
    
    if (scrollHeight <= 0) return 100; // Контент полностью виден
    
    const progress = Math.round((scrollTop / scrollHeight) * 100);
    return Math.min(100, Math.max(0, progress));
}

// Обработчик прокрутки для отслеживания прогресса
function handleContentScroll(fileName) {
    const contentArea = document.getElementById('contentArea');
    const progress = calculateScrollProgress(contentArea);
    
    if (AppState.files[fileName]) {
        AppState.files[fileName].readProgress = progress;
        saveToLocalStorage();
        renderFileList();
        renderProjectList();
        renderStats();
    }
}

// Отображение содержимого файла
function displayFile(fileName) {
    if (!AppState.files[fileName]) return;
    
    AppState.currentFile = fileName;
    AppState.isShowingUrl = false;
    AppState.lastFileView = fileName;
    
    // Обновить статистику
    recordFileOpen(fileName);
    
    // Отрисовать содержимое
    const contentArea = document.getElementById('contentArea');
    const content = AppState.files[fileName].content;
    
    // Рендер Markdown
    const htmlContent = marked.parse(content);
    
    contentArea.innerHTML = `<div id="markdownContent">${htmlContent}</div>`;
    
    // Удалить старый обработчик прокрутки если есть
    if (contentArea._scrollHandler) {
        contentArea.removeEventListener('scroll', contentArea._scrollHandler);
    }
    
    // Добавить обработчик прокрутки
    contentArea._scrollHandler = () => handleContentScroll(fileName);
    contentArea.addEventListener('scroll', contentArea._scrollHandler);
    
    // Вычислить начальный прогресс
    setTimeout(() => {
        const initialProgress = calculateScrollProgress(contentArea);
        if (AppState.files[fileName] && AppState.files[fileName].readProgress < initialProgress) {
            AppState.files[fileName].readProgress = initialProgress;
            saveToLocalStorage();
        }
    }, 100);
    
    // Обновить UI
    renderFileList();
    renderProjectList();
    renderCalendar();
    renderStats();
    document.getElementById('backToFileBtn').style.display = 'none';
    
    saveToLocalStorage();
}

// Запись открытия файла в статистику
function recordFileOpen(fileName) {
    const today = getTodayString();
    
    // Увеличить счётчик файла
    if (AppState.files[fileName]) {
        AppState.files[fileName].openCount = (AppState.files[fileName].openCount || 0) + 1;
        AppState.files[fileName].lastOpened = today;
    }
    
    // Записать в статистику по датам
    if (!AppState.statistics[today]) {
        AppState.statistics[today] = {};
    }
    
    if (!AppState.statistics[today][fileName]) {
        AppState.statistics[today][fileName] = 0;
    }
    
    AppState.statistics[today][fileName]++;
}

// Получить сегодняшнюю дату в формате YYYY-MM-DD
function getTodayString() {
    const today = new Date();
    return formatDate(today);
}

// Форматировать дату в YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Отрисовка списка файлов
function renderFileList() {
    const fileList = document.getElementById('fileList');
    
    // Фильтруем файлы, которые не скрыты из источников
    const visibleFiles = Object.keys(AppState.files).filter(fileName => {
        return !AppState.files[fileName].hiddenFromSources;
    });
    
    if (visibleFiles.length === 0) {
        fileList.innerHTML = '<div class="empty-state">Нет загруженных файлов</div>';
        return;
    }
    
    fileList.innerHTML = '';
    
    visibleFiles.forEach(fileName => {
        const file = AppState.files[fileName];
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.draggable = true;
        fileItem.dataset.fileName = fileName;
        
        if (fileName === AppState.currentFile && !AppState.isShowingUrl) {
            fileItem.classList.add('active');
        }
        
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-name">${fileName}</div>
                <div class="file-stats">Прочитано: ${file.readProgress || 0}%</div>
            </div>
            <button class="btn-icon btn-delete" data-file-name="${fileName}" title="Удалить файл">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4H13M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V11M10 7V11M4 4H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
        
        // Клик для открытия файла
        fileItem.addEventListener('click', (e) => {
            // Не открывать файл при клике на кнопку удаления
            if (!e.target.closest('.btn-delete')) {
                displayFile(fileName);
            }
        });
        
        // Обработчик удаления файла
        const deleteBtn = fileItem.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteFile(fileName);
        });
        
        // Drag and Drop события
        fileItem.addEventListener('dragstart', handleFileDragStart);
        fileItem.addEventListener('dragend', handleFileDragEnd);
        
        fileList.appendChild(fileItem);
    });
}

// Обработчики Drag and Drop для файлов
function handleFileDragStart(e) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', e.target.dataset.fileName);
    e.target.classList.add('dragging');
}

function handleFileDragEnd(e) {
    e.target.classList.remove('dragging');
}

// Отрисовка календаря
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    
    // Заголовок календаря
    const monthNames = [
        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    
    const headerHTML = `
        <div class="calendar-header">
            <h3>${monthNames[AppState.currentMonth]} ${AppState.currentYear}</h3>
            <div class="calendar-nav">
                <button id="prevMonth">&lt;</button>
                <button id="nextMonth">&gt;</button>
            </div>
        </div>
    `;
    
    // Дни недели
    const weekdaysHTML = `
        <div class="calendar-weekdays">
            <div class="calendar-weekday">Пн</div>
            <div class="calendar-weekday">Вт</div>
            <div class="calendar-weekday">Ср</div>
            <div class="calendar-weekday">Чт</div>
            <div class="calendar-weekday">Пт</div>
            <div class="calendar-weekday">Сб</div>
            <div class="calendar-weekday">Вс</div>
        </div>
    `;
    
    // Дни месяца
    const daysHTML = renderCalendarDays();
    
    calendar.innerHTML = headerHTML + weekdaysHTML + daysHTML;
    
    // Обработчики навигации
    document.getElementById('prevMonth').addEventListener('click', () => {
        AppState.currentMonth--;
        if (AppState.currentMonth < 0) {
            AppState.currentMonth = 11;
            AppState.currentYear--;
        }
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        AppState.currentMonth++;
        if (AppState.currentMonth > 11) {
            AppState.currentMonth = 0;
            AppState.currentYear++;
        }
        renderCalendar();
    });
}

// Отрисовка дней календаря
function renderCalendarDays() {
    const firstDay = new Date(AppState.currentYear, AppState.currentMonth, 1);
    const lastDay = new Date(AppState.currentYear, AppState.currentMonth + 1, 0);
    
    // День недели первого дня (0 = воскресенье, 1 = понедельник, ...)
    let firstDayOfWeek = firstDay.getDay();
    // Преобразовать в формат Пн=0, Вс=6
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const daysInMonth = lastDay.getDate();
    const today = new Date();
    const todayString = getTodayString();
    
    let daysHTML = '<div class="calendar-days">';
    
    // Пустые ячейки до начала месяца
    for (let i = 0; i < firstDayOfWeek; i++) {
        daysHTML += '<div class="calendar-day empty"></div>';
    }
    
    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(AppState.currentYear, AppState.currentMonth, day);
        const dateString = formatDate(date);
        
        const isToday = dateString === todayString;
        const hasActivity = AppState.statistics[dateString] && 
                           Object.keys(AppState.statistics[dateString]).length > 0;
        const isSelected = dateString === AppState.selectedDate;
        
        let classNames = 'calendar-day';
        if (isToday) classNames += ' today';
        if (hasActivity) classNames += ' has-activity';
        if (isSelected) classNames += ' selected';
        
        daysHTML += `
            <div class="${classNames}" data-date="${dateString}">
                <div class="calendar-day-number">${day}</div>
            </div>
        `;
    }
    
    daysHTML += '</div>';
    
    // Добавить обработчики кликов позже через делегирование
    setTimeout(() => {
        document.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
            dayEl.addEventListener('click', () => {
                const dateString = dayEl.getAttribute('data-date');
                AppState.selectedDate = dateString;
                renderCalendar();
                renderStats();
            });
        });
    }, 0);
    
    return daysHTML;
}

// Отрисовка статистики
function renderStats() {
    const statsContent = document.getElementById('statsContent');
    
    if (AppState.selectedDate) {
        renderDateStats(statsContent, AppState.selectedDate);
    } else {
        renderOverallStats(statsContent);
    }
}

// Отрисовка статистики за выбранный день
function renderDateStats(container, dateString) {
    const stats = AppState.statistics[dateString];
    
    if (!stats || Object.keys(stats).length === 0) {
        container.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">${dateString}</div>
                <div class="stat-value">Нет активности</div>
            </div>
        `;
        return;
    }
    
    let html = `<div class="stat-item"><div class="stat-label">${dateString}</div></div>`;
    
    Object.keys(stats).forEach(fileName => {
        const progress = AppState.files[fileName]?.readProgress || 0;
        html += `
            <div class="stat-item">
                <div class="stat-value">${fileName}: ${progress}%</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Отрисовка общей статистики
function renderOverallStats(container) {
    const fileCount = Object.keys(AppState.files).length;
    
    if (fileCount === 0) {
        container.innerHTML = '<div class="stat-value">Нет данных</div>';
        return;
    }
    
    const totalOpens = Object.values(AppState.files).reduce((sum, file) => sum + (file.openCount || 0), 0);
    const daysWithActivity = Object.keys(AppState.statistics).length;
    
    const avgProgress = fileCount > 0 
        ? Math.round(Object.values(AppState.files).reduce((sum, file) => sum + (file.readProgress || 0), 0) / fileCount)
        : 0;
    
    const html = `
        <div class="stat-item">
            <div class="stat-label">Всего файлов</div>
            <div class="stat-value">${fileCount}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Средний прогресс</div>
            <div class="stat-value">${avgProgress}%</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">Дней с активностью</div>
            <div class="stat-value">${daysWithActivity}</div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Обработка загрузки URL
function handleUrlLoad() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    
    if (!url) return;
    
    // Добавить протокол, если его нет
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'https://' + url;
    }
    
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = `
        <div id="iframeContainer" style="width: 100%; height: 100%;">
            <iframe src="${fullUrl}" style="width: 100%; height: 100%; border: none;"></iframe>
        </div>
    `;
    
    AppState.isShowingUrl = true;
    document.getElementById('backToFileBtn').style.display = 'inline-block';
    renderFileList();
    renderProjectList();
}

// Возврат к последнему файлу
function handleBackToFile() {
    if (AppState.lastFileView) {
        displayFile(AppState.lastFileView);
    } else if (Object.keys(AppState.files).length > 0) {
        const firstFile = Object.keys(AppState.files)[0];
        displayFile(firstFile);
    } else {
        const contentArea = document.getElementById('contentArea');
        contentArea.innerHTML = `
            <div class="welcome-screen">
                <h1>Добро пожаловать!</h1>
                <p>Загрузите Markdown-файлы, чтобы начать работу.</p>
                <p>Или введите URL выше для просмотра веб-страницы.</p>
            </div>
        `;
        AppState.isShowingUrl = false;
        document.getElementById('backToFileBtn').style.display = 'none';
    }
}

// ========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ПРОЕКТАМИ
// ========================================

// Добавить новый проект
function handleAddProject() {
    const projectName = prompt('Введите название проекта:');
    if (!projectName || !projectName.trim()) return;
    
    const projectId = 'project_' + AppState.projectIdCounter++;
    AppState.projects[projectId] = {
        id: projectId,
        name: projectName.trim(),
        files: [],
        expanded: true,
        description: ''
    };
    
    saveToLocalStorage();
    renderProjectList();
}

// Отрисовка списка проектов
function renderProjectList() {
    const projectList = document.getElementById('projectList');
    
    if (Object.keys(AppState.projects).length === 0) {
        projectList.innerHTML = '<div class="empty-state">Создайте проект для организации файлов</div>';
        return;
    }
    
    projectList.innerHTML = '';
    
    Object.values(AppState.projects).forEach(project => {
        const projectEl = createProjectElement(project);
        projectList.appendChild(projectEl);
    });
}

// Создать элемент проекта
function createProjectElement(project) {
    const projectDiv = document.createElement('div');
    projectDiv.className = 'project-item';
    projectDiv.dataset.projectId = project.id;
    
    const fileCount = project.files.length;
    const filesHTML = project.files.map(fileName => {
        const isActive = (fileName === AppState.currentFile && !AppState.isShowingUrl) ? 'active' : '';
        const progress = AppState.files[fileName]?.readProgress || 0;
        const displayName = `${fileName} - ${progress}%`;
        return `
        <div class="project-file ${isActive}" data-file-name="${fileName}">
            <span class="project-file-name">${displayName}</span>
            <button class="btn-icon" onclick="event.stopPropagation(); removeFileFromProject('${project.id}', '${fileName}')" title="Удалить из проекта">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
    `;
    }).join('');
    
    projectDiv.innerHTML = `
        <div class="project-header" onclick="toggleProject('${project.id}')">
            <span class="project-toggle ${project.expanded ? 'expanded' : ''}">▶</span>
            <div class="project-title">${project.name}</div>
            <div class="project-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); renameProject('${project.id}')" title="Переименовать">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 13H13M9 3L13 7L7 13H3V9L9 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button class="btn-icon" onclick="event.stopPropagation(); deleteProject('${project.id}')" title="Удалить проект">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4H13M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M6 7V11M10 7V11M4 4H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="project-files ${project.expanded ? 'expanded' : ''}">
            ${filesHTML}
            <div class="project-drop-zone" data-project-id="${project.id}">
                Перетащите файлы сюда (${fileCount} файлов)
            </div>
        </div>
    `;
    
    // Добавить обработчики для drop zone
    const dropZone = projectDiv.querySelector('.project-drop-zone');
    dropZone.addEventListener('dragover', handleProjectDragOver);
    dropZone.addEventListener('dragleave', handleProjectDragLeave);
    dropZone.addEventListener('drop', handleProjectDrop);
    
    // Добавить обработчики клика на файлы в проекте
    const projectFiles = projectDiv.querySelectorAll('.project-file');
    projectFiles.forEach(fileEl => {
        fileEl.addEventListener('click', (e) => {
            // Проверить что клик не на кнопке удаления
            if (!e.target.closest('.btn-icon')) {
                const fileName = fileEl.dataset.fileName;
                displayFile(fileName);
            }
        });
    });
    
    return projectDiv;
}

// Переключить развернутость проекта
function toggleProject(projectId) {
    if (AppState.projects[projectId]) {
        AppState.projects[projectId].expanded = !AppState.projects[projectId].expanded;
        saveToLocalStorage();
        renderProjectList();
    }
}

// Переименовать проект
function renameProject(projectId) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    const newName = prompt('Введите новое название проекта:', project.name);
    if (newName && newName.trim() && newName !== project.name) {
        project.name = newName.trim();
        saveToLocalStorage();
        renderProjectList();
    }
}

// Удалить проект
function deleteProject(projectId) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    if (confirm('Удалить проект? Файлы вернутся в источники, если их там нет.')) {
        // Получить файлы удаляемого проекта
        const projectFiles = [...project.files];
        
        // Удалить проект
        delete AppState.projects[projectId];
        
        // Проверить каждый файл из удаленного проекта
        projectFiles.forEach(fileName => {
            // Проверить, остался ли файл в других проектах
            const isInAnyProject = Object.values(AppState.projects).some(p => p.files.includes(fileName));
            
            // Если файл не в других проектах и был скрыт из источников, вернуть его
            if (!isInAnyProject && AppState.files[fileName]?.hiddenFromSources) {
                AppState.files[fileName].hiddenFromSources = false;
            }
        });
        
        saveToLocalStorage();
        renderProjectList();
        renderFileList();
    }
}

// Удалить файл из проекта
function removeFileFromProject(projectId, fileName) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    project.files = project.files.filter(f => f !== fileName);
    
    // Проверить, остался ли файл хотя бы в одном проекте
    const isInAnyProject = Object.values(AppState.projects).some(p => p.files.includes(fileName));
    
    // Если файл не в проектах и был скрыт из источников, вернуть его в источники
    if (!isInAnyProject && AppState.files[fileName]?.hiddenFromSources) {
        AppState.files[fileName].hiddenFromSources = false;
    }
    
    saveToLocalStorage();
    renderProjectList();
    renderFileList();
}

// Удалить файл из источников (скрыть, но оставить в проектах)
function deleteFile(fileName) {
    if (!confirm(`Удалить файл "${fileName}" из источников? Файл останется в проектах.`)) return;
    
    // Пометить файл как скрытый из источников
    if (AppState.files[fileName]) {
        AppState.files[fileName].hiddenFromSources = true;
    }
    
    saveToLocalStorage();
    renderFileList();
}

// Обработчики Drag and Drop для проектов
function handleProjectDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleProjectDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleProjectDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const fileName = e.dataTransfer.getData('text/plain');
    const projectId = e.currentTarget.dataset.projectId;
    
    if (!fileName || !projectId || !AppState.projects[projectId]) return;
    
    const project = AppState.projects[projectId];
    
    // Проверить, что файл существует
    if (!AppState.files[fileName]) {
        alert('Файл не найден');
        return;
    }
    
    // Проверить, что файл еще не добавлен в проект
    if (project.files.includes(fileName)) {
        alert('Файл уже добавлен в этот проект');
        return;
    }
    
    // Добавить файл в проект
    project.files.push(fileName);
    saveToLocalStorage();
    renderProjectList();
}

// Сделать функции глобальными для onclick
window.toggleProject = toggleProject;
window.renameProject = renameProject;
window.deleteProject = deleteProject;
window.removeFileFromProject = removeFileFromProject;

// Сохранение в localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('markdownApp_files', JSON.stringify(AppState.files));
        localStorage.setItem('markdownApp_currentFile', AppState.currentFile || '');
        localStorage.setItem('markdownApp_statistics', JSON.stringify(AppState.statistics));
        localStorage.setItem('markdownApp_projects', JSON.stringify(AppState.projects));
        localStorage.setItem('markdownApp_projectIdCounter', AppState.projectIdCounter.toString());
    } catch (e) {
        console.error('Ошибка сохранения в localStorage:', e);
    }
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    try {
        const files = localStorage.getItem('markdownApp_files');
        if (files) {
            AppState.files = JSON.parse(files);
        }
        
        const currentFile = localStorage.getItem('markdownApp_currentFile');
        if (currentFile && AppState.files[currentFile]) {
            AppState.currentFile = currentFile;
        }
        
        const statistics = localStorage.getItem('markdownApp_statistics');
        if (statistics) {
            AppState.statistics = JSON.parse(statistics);
        }
        
        const projects = localStorage.getItem('markdownApp_projects');
        if (projects) {
            AppState.projects = JSON.parse(projects);
        }
        
        const projectIdCounter = localStorage.getItem('markdownApp_projectIdCounter');
        if (projectIdCounter) {
            AppState.projectIdCounter = parseInt(projectIdCounter);
        }
    } catch (e) {
        console.error('Ошибка загрузки из localStorage:', e);
    }
}

// Функция для очистки всех данных (можно вызвать из консоли)
function clearAllData() {
    if (confirm('Удалить все данные? Это действие нельзя отменить.')) {
        localStorage.clear();
        location.reload();
    }
}

// Экспорт функции для использования в консоли
window.clearAllData = clearAllData;
