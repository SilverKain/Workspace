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
    
    // Обработчики экспорта/импорта
    document.getElementById('exportBtn').addEventListener('click', handleExportData);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importInput').click();
    });
    document.getElementById('importInput').addEventListener('change', handleImportData);

    const clearStorageBtn = document.getElementById('clearStorageBtn');
    if (clearStorageBtn) {
        clearStorageBtn.addEventListener('click', clearAllData);
    }
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
                hiddenFromSources: false // При загрузке файл всегда виден в источниках
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
    
    // Восстановить позицию прокрутки на основе сохраненного процента
    setTimeout(() => {
        const savedProgress = AppState.files[fileName]?.readProgress || 0;
        if (savedProgress > 0) {
            const scrollHeight = contentArea.scrollHeight - contentArea.clientHeight;
            const targetScrollTop = (savedProgress / 100) * scrollHeight;
            contentArea.scrollTop = targetScrollTop;
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
// ФУНКЦИИ ЭКСПОРТА И ИМПОРТА ДАННЫХ
// ========================================

function cloneProjectStructure(structure) {
    if (!Array.isArray(structure)) return [];

    return structure.map(item => {
        if (item?.type === 'folder') {
            return {
                type: 'folder',
                name: item.name || 'Новая папка',
                expanded: item.expanded !== false,
                children: cloneProjectStructure(item.children || [])
            };
        }

        return {
            type: 'file',
            name: item?.name || ''
        };
    }).filter(item => item.name);
}

function buildProjectStructureFromLegacyFiles(files) {
    if (!Array.isArray(files)) return [];

    return files
        .map(file => (typeof file === 'string' ? file : file?.name))
        .filter(Boolean)
        .map(fileName => ({
            type: 'file',
            name: fileName
        }));
}

function countFilesInImportedStructure(structure) {
    if (!Array.isArray(structure)) return 0;

    return structure.reduce((sum, item) => {
        if (item?.type === 'file') return sum + 1;
        if (item?.type === 'folder') return sum + countFilesInImportedStructure(item.children || []);
        return sum;
    }, 0);
}

function collectFilesFromLegacyImport(importData) {
    const legacyFiles = {};

    (importData.projects || []).forEach(project => {
        (project.files || []).forEach(file => {
            const fileName = typeof file === 'string' ? file : file?.name;
            if (!fileName) return;

            legacyFiles[fileName] = {
                name: fileName,
                content: AppState.files[fileName]?.content || '',
                readProgress: Math.max(
                    AppState.files[fileName]?.readProgress || 0,
                    typeof file?.progress === 'number' ? file.progress : 0
                ),
                openCount: AppState.files[fileName]?.openCount || 0,
                lastOpened: AppState.files[fileName]?.lastOpened || null,
                hiddenFromSources: AppState.files[fileName]?.hiddenFromSources || false
            };
        });
    });

    (importData.filesWithoutProjects || []).forEach(file => {
        const fileName = typeof file === 'string' ? file : file?.name;
        if (!fileName) return;

        legacyFiles[fileName] = {
            name: fileName,
            content: AppState.files[fileName]?.content || '',
            readProgress: Math.max(
                AppState.files[fileName]?.readProgress || 0,
                typeof file?.progress === 'number' ? file.progress : 0
            ),
            openCount: AppState.files[fileName]?.openCount || 0,
            lastOpened: AppState.files[fileName]?.lastOpened || null,
            hiddenFromSources: AppState.files[fileName]?.hiddenFromSources || false
        };
    });

    return legacyFiles;
}

function normalizeImportedFiles(importData) {
    if (importData.files && typeof importData.files === 'object' && !Array.isArray(importData.files)) {
        const normalizedFiles = {};

        Object.entries(importData.files).forEach(([key, value]) => {
            const fileName = value?.name || key;
            if (!fileName) return;

            normalizedFiles[fileName] = {
                name: fileName,
                content: typeof value?.content === 'string' ? value.content : '',
                readProgress: typeof value?.readProgress === 'number' ? value.readProgress : 0,
                openCount: typeof value?.openCount === 'number' ? value.openCount : 0,
                lastOpened: value?.lastOpened || null,
                hiddenFromSources: Boolean(value?.hiddenFromSources)
            };
        });

        return normalizedFiles;
    }

    return collectFilesFromLegacyImport(importData);
}

function normalizeImportedProjects(importData) {
    if (!Array.isArray(importData.projects)) return [];

    return importData.projects.map(project => ({
        name: project?.name || 'Импортированный проект',
        expanded: project?.expanded !== false,
        description: project?.description || '',
        structure: Array.isArray(project?.structure)
            ? cloneProjectStructure(project.structure)
            : buildProjectStructureFromLegacyFiles(project?.files || [])
    }));
}

// Экспорт данных в JSON
async function handleExportData() {
    const projectsForExport = Object.values(AppState.projects).map(project => ({
        id: project.id,
        name: project.name,
        expanded: project.expanded !== false,
        description: project.description || '',
        structure: Array.isArray(project.structure)
            ? cloneProjectStructure(project.structure)
            : buildProjectStructureFromLegacyFiles(project.files || [])
    }));

    const filesForExport = Object.entries(AppState.files).reduce((acc, [fileName, fileData]) => {
        acc[fileName] = {
            name: fileName,
            content: typeof fileData.content === 'string' ? fileData.content : '',
            readProgress: fileData.readProgress || 0,
            openCount: fileData.openCount || 0,
            lastOpened: fileData.lastOpened || null,
            hiddenFromSources: Boolean(fileData.hiddenFromSources)
        };
        return acc;
    }, {});

    const exportData = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        projects: projectsForExport,
        files: filesForExport,
        statistics: AppState.statistics,
        currentFile: AppState.currentFile,
        selectedDate: AppState.selectedDate,
        currentMonth: AppState.currentMonth,
        currentYear: AppState.currentYear
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const fileName = `workspace-export-${new Date().toISOString().split('T')[0]}.json`;

    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: 'JSON файлы',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(dataStr);
            await writable.close();

            alert('Данные успешно экспортированы!');
            return;
        } catch (err) {
            if (err.name === 'AbortError') {
                return;
            }

            console.error('Ошибка при сохранении файла:', err);
        }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert('Данные экспортированы через загрузки браузера.');
}

// Импорт данных из JSON
function handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const importData = JSON.parse(e.target.result);
            const importedProjects = normalizeImportedProjects(importData);
            const importedFiles = normalizeImportedFiles(importData);

            if (importedProjects.length === 0 && Object.keys(importedFiles).length === 0) {
                alert('Неверный формат файла!');
                return;
            }

            const projectCount = importedProjects.length;
            const fileCount = Object.keys(importedFiles).length;
            const filesInProjects = importedProjects.reduce((sum, project) => {
                return sum + countFilesInImportedStructure(project.structure);
            }, 0);

            if (!confirm(`Загрузить данные?\n\nПроектов: ${projectCount}\nФайлов: ${fileCount}\nФайлов в структуре проектов: ${filesInProjects}\n\nТекущие данные будут объединены с загруженными.`)) {
                return;
            }

            Object.entries(importedFiles).forEach(([fileName, importedFile]) => {
                const existingFile = AppState.files[fileName] || {};

                AppState.files[fileName] = {
                    name: fileName,
                    content: typeof importedFile.content === 'string' ? importedFile.content : (existingFile.content || ''),
                    readProgress: Math.max(existingFile.readProgress || 0, importedFile.readProgress || 0),
                    openCount: Math.max(existingFile.openCount || 0, importedFile.openCount || 0),
                    lastOpened: importedFile.lastOpened || existingFile.lastOpened || null,
                    hiddenFromSources: importedFile.hiddenFromSources ?? existingFile.hiddenFromSources ?? false
                };
            });

            importedProjects.forEach(projectData => {
                const projectId = 'project_' + AppState.projectIdCounter++;
                AppState.projects[projectId] = {
                    id: projectId,
                    name: projectData.name,
                    structure: cloneProjectStructure(projectData.structure),
                    expanded: projectData.expanded,
                    description: projectData.description
                };
            });

            if (importData.statistics && typeof importData.statistics === 'object') {
                Object.entries(importData.statistics).forEach(([date, filesStats]) => {
                    if (!AppState.statistics[date]) {
                        AppState.statistics[date] = {};
                    }

                    if (filesStats && typeof filesStats === 'object') {
                        Object.entries(filesStats).forEach(([fileName, count]) => {
                            const existingCount = AppState.statistics[date][fileName] || 0;
                            AppState.statistics[date][fileName] = existingCount + (Number(count) || 0);
                        });
                    }
                });
            }

            if (importData.currentFile && AppState.files[importData.currentFile]) {
                AppState.currentFile = importData.currentFile;
            }

            saveToLocalStorage();
            renderProjectList();
            renderFileList();
            renderStats();

            alert('Данные успешно импортированы!');
        } catch (error) {
            console.error('Ошибка импорта:', error);
            alert('Ошибка при чтении файла!');
        }
    };

    reader.readAsText(file);

    // Очистить input
    event.target.value = '';
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
        structure: [], // Древовидная структура вместо простого массива files
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
    
    // Мигрировать старую структуру если нужно
    if (project.files && !project.structure) {
        project.structure = project.files.map(fileName => ({
            type: 'file',
            name: fileName
        }));
        delete project.files;
        saveToLocalStorage();
    }
    
    // Обеспечить наличие structure
    if (!project.structure) {
        project.structure = [];
    }
    
    const fileCount = countFilesInStructure(project.structure);
    const structureHTML = renderProjectStructure(project.structure, project.id, []);
    
    projectDiv.innerHTML = `
        <div class="project-header" onclick="toggleProject('${project.id}')">
            <span class="project-toggle ${project.expanded ? 'expanded' : ''}">▶</span>
            <div class="project-title">${project.name}</div>
            <div class="project-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); addFolderToProject('${project.id}', [])" title="Добавить папку">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M2 4C2 3.44772 2.44772 3 3 3H6L7 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4ZM8 7V11M6 9H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
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
            ${structureHTML}
            <div class="project-drop-zone" data-project-id="${project.id}" data-path="[]">
                Перетащите файлы сюда (${fileCount} файлов)
            </div>
        </div>
    `;
    
    // Добавить обработчики для всех drop zone
    const dropZones = projectDiv.querySelectorAll('.project-drop-zone');
    dropZones.forEach(dropZone => {
        dropZone.addEventListener('dragover', handleProjectDragOver);
        dropZone.addEventListener('dragleave', handleProjectDragLeave);
        dropZone.addEventListener('drop', handleProjectDrop);
    });
    
    // Добавить обработчики клика на файлы в проекте
    const projectFiles = projectDiv.querySelectorAll('.project-file');
    projectFiles.forEach(fileEl => {
        fileEl.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon')) {
                const fileName = fileEl.dataset.fileName;
                displayFile(fileName);
            }
        });
        
        // Добавить drag для файлов внутри проекта
        fileEl.draggable = true;
        fileEl.addEventListener('dragstart', handleProjectFileDragStart);
        fileEl.addEventListener('dragend', handleProjectFileDragEnd);
    });
    
    // Добавить обработчики для drop-зон между файлами
    const dropTargets = projectDiv.querySelectorAll('.file-drop-target');
    dropTargets.forEach(target => {
        target.addEventListener('dragover', handleFileDropTargetDragOver);
        target.addEventListener('dragleave', handleFileDropTargetDragLeave);
        target.addEventListener('drop', handleFileDropTargetDrop);
    });
    
    return projectDiv;
}

// Подсчитать количество файлов в структуре
function countFilesInStructure(structure) {
    let count = 0;
    structure.forEach(item => {
        if (item.type === 'file') {
            count++;
        } else if (item.type === 'folder' && item.children) {
            count += countFilesInStructure(item.children);
        }
    });
    return count;
}

// Рендерить древовидную структуру проекта
function renderProjectStructure(structure, projectId, path) {
    let html = '';
    
    structure.forEach((item, index) => {
        const currentPath = [...path, index];
        const pathStr = JSON.stringify(currentPath);
        const parentPath = JSON.stringify(path);
        
        if (item.type === 'folder') {
            const isExpanded = item.expanded !== false;
            const childrenHTML = isExpanded ? renderProjectStructure(item.children || [], projectId, currentPath) : '';
            
            html += `
                <div class="file-drop-target" data-project-id="${projectId}" data-parent-path="${parentPath}" data-insert-index="${index}"></div>
                <div class="project-folder" data-path="${pathStr}">
                    <div class="folder-header" onclick="toggleProjectFolder('${projectId}', ${pathStr})">
                        <span class="folder-toggle ${isExpanded ? 'expanded' : ''}">▶</span>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right: 4px;">
                            <path d="M2 4C2 3.44772 2.44772 3 3 3H6L7 5H13C13.5523 5 14 5.44772 14 6V12C14 12.5523 13.5523 13 13 13H3C2.44772 13 2 12.5523 2 12V4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="folder-name">${item.name}</span>
                        <div class="folder-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); addFolderToProject('${projectId}', ${pathStr})" title="Добавить подпапку">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                            <button class="btn-icon" onclick="event.stopPropagation(); renameFolderInProject('${projectId}', ${pathStr})" title="Переименовать">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 13H13M9 3L13 7L7 13H3V9L9 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                            <button class="btn-icon" onclick="event.stopPropagation(); deleteFolderFromProject('${projectId}', ${pathStr})" title="Удалить папку">
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="folder-content ${isExpanded ? 'expanded' : ''}">
                        ${childrenHTML}
                        <div class="project-drop-zone folder-drop-zone" data-project-id="${projectId}" data-path="${pathStr}" data-insert-index="${(item.children || []).length}">
                            Перетащите сюда
                        </div>
                    </div>
                </div>
            `;
        } else if (item.type === 'file') {
            const isActive = (item.name === AppState.currentFile && !AppState.isShowingUrl) ? 'active' : '';
            const progress = AppState.files[item.name]?.readProgress || 0;
            const displayName = `${item.name} - ${progress}%`;
            
            html += `
                <div class="file-drop-target" data-project-id="${projectId}" data-parent-path="${parentPath}" data-insert-index="${index}"></div>
                <div class="project-file ${isActive}" data-file-name="${item.name}" data-path="${pathStr}" data-project-id="${projectId}">
                    <span class="project-file-name">${displayName}</span>
                    <button class="btn-icon" onclick="event.stopPropagation(); removeFileFromProjectPath('${projectId}', ${pathStr})" title="Удалить из проекта">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            `;
        }
    });
    
    // Добавить drop-зону в конец списка
    if (structure.length > 0) {
        const parentPath = JSON.stringify(path);
        html += `<div class="file-drop-target" data-project-id="${projectId}" data-parent-path="${parentPath}" data-insert-index="${structure.length}"></div>`;
    }
    
    return html;
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
        // Получить все файлы удаляемого проекта
        const projectFiles = getAllFilesFromStructure(project.structure || []);
        
        // Удалить проект
        delete AppState.projects[projectId];
        
        // Проверить каждый файл из удаленного проекта
        projectFiles.forEach(fileName => {
            // Проверить, остался ли файл в других проектах
            const isInAnyProject = isFileInAnyProject(fileName);
            
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

// Получить все файлы из структуры
function getAllFilesFromStructure(structure) {
    const files = [];
    structure.forEach(item => {
        if (item.type === 'file') {
            files.push(item.name);
        } else if (item.type === 'folder' && item.children) {
            files.push(...getAllFilesFromStructure(item.children));
        }
    });
    return files;
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
    
    const projectId = e.currentTarget.dataset.projectId;
    const targetPath = JSON.parse(e.currentTarget.dataset.path || '[]');
    const insertIndex = parseInt(e.currentTarget.dataset.insertIndex);
    
    if (!projectId || !AppState.projects[projectId]) return;
    
    const project = AppState.projects[projectId];
    
    // Инициализировать structure если её нет
    if (!project.structure) {
        project.structure = [];
    }
    
    // Проверить, это перемещение внутри проекта или добавление из источников
    const projectFileData = e.dataTransfer.getData('projectFile');
    
    if (projectFileData) {
        // Перемещение файла внутри проекта или между проектами
        const { fileName, path: sourcePath, projectId: sourceProjectId } = JSON.parse(projectFileData);
        
        if (sourceProjectId === projectId) {
            // Перемещение внутри одного проекта
            // Используем логику из handleFileDropTargetDrop
            return; // Это обрабатывается в handleFileDropTargetDrop
        } else {
            // Перемещение между проектами
            const sourceProject = AppState.projects[sourceProjectId];
            if (!sourceProject) return;
            
            const sourcePathArr = JSON.parse(sourcePath);
            const sourceParent = getParentByPath(sourceProject.structure, sourcePathArr);
            if (!sourceParent) return;
            
            const sourceIndex = sourcePathArr[sourcePathArr.length - 1];
            const fileItem = sourceParent[sourceIndex];
            
            // Удалить из исходного проекта
            sourceParent.splice(sourceIndex, 1);
            
            // Добавить в целевой проект (в конец папки)
            const targetParent = targetPath.length === 0 ? project.structure :
                                (getItemByPath(project.structure, targetPath)?.children || []);
            
            if (!isNaN(insertIndex)) {
                targetParent.splice(insertIndex, 0, { type: 'file', name: fileName });
            } else {
                targetParent.push({ type: 'file', name: fileName });
            }
        }
    } else {
        // Добавление из источников
        const fileName = e.dataTransfer.getData('text/plain');
        
        if (!fileName || !AppState.files[fileName]) {
            return;
        }
        
        // Проверить, что файл еще не добавлен в этот проект
        if (containsFile(project.structure, fileName)) {
            return;
        }
        
        // Добавить файл в нужное место
        const targetParent = targetPath.length === 0 ? project.structure :
                            (getItemByPath(project.structure, targetPath)?.children || []);
        
        if (targetParent) {
            if (!isNaN(insertIndex)) {
                targetParent.splice(insertIndex, 0, { type: 'file', name: fileName });
            } else {
                targetParent.push({ type: 'file', name: fileName });
            }
        }
    }
    
    saveToLocalStorage();
    renderProjectList();
}

// Сделать функции глобальными для onclick
window.toggleProject = toggleProject;
window.renameProject = renameProject;
window.deleteProject = deleteProject;

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

// ========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ПАПКАМИ В ПРОЕКТАХ
// ========================================

// Получить элемент по пути в структуре
function getItemByPath(structure, path) {
    let current = structure;
    for (let i = 0; i < path.length - 1; i++) {
        const index = path[i];
        if (current[index] && current[index].type === 'folder') {
            current = current[index].children || [];
        } else {
            return null;
        }
    }
    return current[path[path.length - 1]];
}

// Получить родительский контейнер по пути
function getParentByPath(structure, path) {
    if (path.length === 0) return structure;
    
    let current = structure;
    for (let i = 0; i < path.length - 1; i++) {
        const index = path[i];
        if (current[index] && current[index].type === 'folder') {
            current = current[index].children || [];
        } else {
            return null;
        }
    }
    return current;
}

// Добавить папку в проект
function addFolderToProject(projectId, path) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    const folderName = prompt('Введите название папки:');
    if (!folderName || !folderName.trim()) return;
    
    // Инициализировать structure если её нет
    if (!project.structure) {
        project.structure = [];
    }
    
    const parent = getParentByPath(project.structure, path);
    if (!parent) return;
    
    const newFolder = {
        type: 'folder',
        name: folderName.trim(),
        expanded: true,
        children: []
    };
    
    // Добавить в нужное место
    if (path.length === 0) {
        parent.push(newFolder);
    } else {
        const parentFolder = getItemByPath(project.structure, path);
        if (parentFolder && parentFolder.type === 'folder') {
            if (!parentFolder.children) parentFolder.children = [];
            parentFolder.children.push(newFolder);
        }
    }
    
    saveToLocalStorage();
    renderProjectList();
}

// Переименовать папку
function renameFolderInProject(projectId, path) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    const folder = getItemByPath(project.structure, path);
    if (!folder || folder.type !== 'folder') return;
    
    const newName = prompt('Введите новое название папки:', folder.name);
    if (newName && newName.trim() && newName !== folder.name) {
        folder.name = newName.trim();
        saveToLocalStorage();
        renderProjectList();
    }
}

// Удалить папку
function deleteFolderFromProject(projectId, path) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    if (!confirm('Удалить папку? Все файлы внутри останутся в проекте.')) return;
    
    const parent = getParentByPath(project.structure, path);
    if (!parent) return;
    
    const index = path[path.length - 1];
    const folder = parent[index];
    
    // Переместить все файлы из папки в родительский контейнер
    if (folder && folder.type === 'folder' && folder.children) {
        const files = folder.children.filter(item => item.type === 'file');
        parent.splice(index, 1, ...files);
    } else {
        parent.splice(index, 1);
    }
    
    saveToLocalStorage();
    renderProjectList();
}

// Переключить состояние папки
function toggleProjectFolder(projectId, path) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    const folder = getItemByPath(project.structure, path);
    if (folder && folder.type === 'folder') {
        folder.expanded = !folder.expanded;
        saveToLocalStorage();
        renderProjectList();
    }
}

// Удалить файл из проекта по пути
function removeFileFromProjectPath(projectId, path) {
    const project = AppState.projects[projectId];
    if (!project) return;
    
    const parent = getParentByPath(project.structure, path);
    if (!parent) return;
    
    const index = path[path.length - 1];
    const file = parent[index];
    
    if (file && file.type === 'file') {
        const fileName = file.name;
        parent.splice(index, 1);
        
        // Проверить, остался ли файл в других местах проекта
        const isInAnyProject = isFileInAnyProject(fileName);
        
        // Если файл не в проектах и был скрыт из источников, вернуть его в источники
        if (!isInAnyProject && AppState.files[fileName]?.hiddenFromSources) {
            AppState.files[fileName].hiddenFromSources = false;
        }
        
        saveToLocalStorage();
        renderProjectList();
        renderFileList();
    }
}

// Проверить, есть ли файл хотя бы в одном проекте
function isFileInAnyProject(fileName) {
    return Object.values(AppState.projects).some(project => {
        return containsFile(project.structure || [], fileName);
    });
}

// Проверить, содержит ли структура файл
function containsFile(structure, fileName) {
    return structure.some(item => {
        if (item.type === 'file' && item.name === fileName) {
            return true;
        } else if (item.type === 'folder' && item.children) {
            return containsFile(item.children, fileName);
        }
        return false;
    });
}

// Обработчик drag для файлов внутри проекта
function handleProjectFileDragStart(e) {
    e.stopPropagation();
    const fileName = e.currentTarget.dataset.fileName;
    const path = e.currentTarget.dataset.path;
    const projectId = e.currentTarget.dataset.projectId;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('projectFile', JSON.stringify({ fileName, path, projectId }));
    e.currentTarget.classList.add('dragging');
}

// Обработчик окончания drag для файлов внутри проекта
function handleProjectFileDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
}

// Обработчики для drop-зон между файлами
function handleFileDropTargetDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleFileDropTargetDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleFileDropTargetDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    
    const projectId = e.currentTarget.dataset.projectId;
    const parentPath = JSON.parse(e.currentTarget.dataset.parentPath || '[]');
    const insertIndex = parseInt(e.currentTarget.dataset.insertIndex);
    
    if (!projectId || !AppState.projects[projectId]) return;
    
    const project = AppState.projects[projectId];
    if (!project.structure) project.structure = [];
    
    // Проверить, это перемещение внутри проекта или добавление из источников
    const projectFileData = e.dataTransfer.getData('projectFile');
    
    if (projectFileData) {
        // Перемещение файла внутри проекта или между проектами
        const { fileName, path: sourcePath, projectId: sourceProjectId } = JSON.parse(projectFileData);
        
        if (sourceProjectId === projectId) {
            // Перемещение внутри одного проекта
            const sourcePathArr = JSON.parse(sourcePath);
            
            // Получить элемент
            const sourceParent = getParentByPath(project.structure, sourcePathArr);
            if (!sourceParent) return;
            
            const sourceIndex = sourcePathArr[sourcePathArr.length - 1];
            const fileItem = sourceParent[sourceIndex];
            
            // Проверить, не перемещаем ли на то же место
            const targetParent = parentPath.length === 0 ? project.structure : 
                               (getItemByPath(project.structure, parentPath)?.children || project.structure);
            
            // Проверить, что родитель тот же
            const isSameParent = JSON.stringify(sourcePathArr.slice(0, -1)) === JSON.stringify(parentPath);
            
            if (isSameParent && (sourceIndex === insertIndex || sourceIndex === insertIndex - 1)) {
                // Перемещение на то же место или рядом
                return;
            }
            
            // Удалить из старого места
            sourceParent.splice(sourceIndex, 1);
            
            // Вычислить новый индекс (если удаляем из того же родителя и индекс был меньше)
            let finalIndex = insertIndex;
            if (isSameParent && sourceIndex < insertIndex) {
                finalIndex = insertIndex - 1;
            }
            
            // Добавить в новое место
            targetParent.splice(finalIndex, 0, fileItem);
        } else {
            // Перемещение между проектами
            const sourceProject = AppState.projects[sourceProjectId];
            if (!sourceProject) return;
            
            const sourcePathArr = JSON.parse(sourcePath);
            const sourceParent = getParentByPath(sourceProject.structure, sourcePathArr);
            if (!sourceParent) return;
            
            const sourceIndex = sourcePathArr[sourcePathArr.length - 1];
            const fileItem = sourceParent[sourceIndex];
            
            // Удалить из исходного проекта
            sourceParent.splice(sourceIndex, 1);
            
            // Добавить в целевой проект
            const targetParent = parentPath.length === 0 ? project.structure :
                               (getItemByPath(project.structure, parentPath)?.children || project.structure);
            
            targetParent.splice(insertIndex, 0, { type: 'file', name: fileName });
        }
    } else {
        // Добавление из источников
        const fileName = e.dataTransfer.getData('text/plain');
        
        if (!fileName || !AppState.files[fileName]) {
            return;
        }
        
        // Проверить, что файл еще не добавлен в этот проект
        if (containsFile(project.structure, fileName)) {
            return;
        }
        
        // Добавить файл в нужное место
        const targetParent = parentPath.length === 0 ? project.structure :
                           (getItemByPath(project.structure, parentPath)?.children || project.structure);
        
        if (targetParent) {
            targetParent.splice(insertIndex, 0, { type: 'file', name: fileName });
        }
    }
    
    saveToLocalStorage();
    renderProjectList();
}

// Сделать функции глобальными
window.toggleProjectFolder = toggleProjectFolder;
window.addFolderToProject = addFolderToProject;
window.renameFolderInProject = renameFolderInProject;
window.deleteFolderFromProject = deleteFolderFromProject;
window.removeFileFromProjectPath = removeFileFromProjectPath;
