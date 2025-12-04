// --- State Management ---
let tasks = JSON.parse(localStorage.getItem('myTasks')) || [];

function saveToLocal() {
    localStorage.setItem('myTasks', JSON.stringify(tasks));
    renderBoard();
}

// --- DOM Elements ---
const modal = document.getElementById('modal');
const subtaskGroup = document.getElementById('subtask-input-group');

// --- Modal Logic ---
function openModal() {
    // Reset form
    document.getElementById('t-title').value = '';
    document.getElementById('t-subtasks').value = '';
    document.getElementById('t-type').value = 'simple';
    document.getElementById('t-priority').value = 'med';
    toggleSubtasksInput();
    modal.style.display = 'flex';
    document.getElementById('t-title').focus();
}

function closeModal() {
    modal.style.display = 'none';
}

function toggleSubtasksInput() {
    const type = document.getElementById('t-type').value;
    subtaskGroup.style.display = type === 'complex' ? 'block' : 'none';
}

// --- Create Task Logic ---
function saveTask() {
    const title = document.getElementById('t-title').value;
    if (!title) return alert('El título es obligatorio');

    const type = document.getElementById('t-type').value;
    const priority = document.getElementById('t-priority').value;
    const rawSubtasks = document.getElementById('t-subtasks').value;

    let subtasks = [];
    if (type === 'complex' && rawSubtasks.trim()) {
        subtasks = rawSubtasks.split('\n').filter(line => line.trim() !== '').map(text => ({
            text: text.trim(),
            done: false
        }));
    }

    const newTask = {
        id: Date.now().toString(),
        title,
        type,
        priority,
        status: 'todo', // Default status
        subtasks
    };

    tasks.push(newTask);
    saveToLocal();
    closeModal();
}

// --- Delete Task ---
function deleteTask(id) {
    if (confirm('¿Borrar esta tarea?')) {
        tasks = tasks.filter(t => t.id !== id);
        saveToLocal();
    }
}

// --- Toggle Subtask ---
function toggleSubtask(taskId, subtaskIndex) {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.subtasks[subtaskIndex]) {
        task.subtasks[subtaskIndex].done = !task.subtasks[subtaskIndex].done;
        saveToLocal(); // Re-renders automatically
    }
}

// --- Drag and Drop Logic ---
function allowDrop(ev) {
    ev.preventDefault();
    const list = ev.target.closest('.task-list');
    if (list) list.classList.add('drag-over');
}

function leaveDrop(ev) {
    const list = ev.target.closest('.task-list');
    if (list) list.classList.remove('drag-over');
}

// Add dragleave listeners manually to cleanup visual cues
document.querySelectorAll('.task-list').forEach(col => {
    col.addEventListener('dragleave', leaveDrop);
});

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.id);
    ev.target.classList.add('dragging');
}

function drop(ev) {
    ev.preventDefault();
    const list = ev.target.closest('.task-list');
    if (list) list.classList.remove('drag-over');

    const cardId = ev.dataTransfer.getData("text");
    const draggedElement = document.getElementById(cardId);

    // Remove dragging class in case render doesn't happen fast enough
    if (draggedElement) draggedElement.classList.remove('dragging');

    if (list) {
        const newStatus = list.getAttribute('data-status');
        const taskId = cardId.replace('task-', '');

        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            saveToLocal();
        }
    }
}

// --- Rendering ---
function getPriorityLabel(p) {
    if (p === 'high') return '<span class="tag p-high">URGENTE</span>';
    if (p === 'med') return '<span class="tag p-med">NORMAL</span>';
    return '<span class="tag p-low">BAJA</span>';
}

function getTypeLabel(t) {
    if (t === 'complex') return '<span class="tag t-complex">ÉPICA</span>';
    return '<span class="tag t-simple">SIMPLE</span>';
}

function renderBoard() {
    // Clear lists
    document.getElementById('list-todo').innerHTML = '';
    document.getElementById('list-doing').innerHTML = '';
    document.getElementById('list-done').innerHTML = '';

    // Counters
    let counts = { todo: 0, doing: 0, done: 0 };

    tasks.forEach(task => {
        counts[task.status]++;

        // Generate Subtasks HTML
        let subtasksHtml = '';
        if (task.type === 'complex' && task.subtasks.length > 0) {
            const items = task.subtasks.map((st, index) => `
    <div class="subtask-item ${st.done ? 'completed' : ''}">
        <input type="checkbox" ${st.done ? 'checked' : ''}
            onchange="toggleSubtask('${task.id}', ${index})">
            <span>${st.text}</span>
    </div>
    `).join('');
            subtasksHtml = `<div class="subtasks-container">${items}</div>`;
        }

        // Generate Card HTML
        const card = document.createElement('div');
        card.className = 'card';
        card.id = `task-${task.id}`;
        card.draggable = true;
        card.setAttribute('ondragstart', 'drag(event)');

        // Border color based on priority logic for extra visual cue
        if (task.priority === 'high') card.style.borderLeftColor = 'var(--priority-high)';
        else if (task.priority === 'low') card.style.borderLeftColor = 'var(--priority-low)';
        else card.style.borderLeftColor = 'var(--priority-med)';

        card.innerHTML = `
    <div class="card-header">
        <div class="tags">
            ${getPriorityLabel(task.priority)}
            ${getTypeLabel(task.type)}
        </div>
        <button class="delete-btn" onclick="deleteTask('${task.id}')">×</button>
    </div>
    <div class="card-title">${task.title}</div>
    ${subtasksHtml}
    `;

        document.getElementById(`list-${task.status}`).appendChild(card);
    });

    // Update counts
    document.getElementById('count-todo').innerText = counts.todo;
    document.getElementById('count-doing').innerText = counts.doing;
    document.getElementById('count-done').innerText = counts.done;
}

// Initial render
renderBoard();

// Close modal on outside click
window.onclick = function (event) {
    if (event.target == modal) closeModal();
}