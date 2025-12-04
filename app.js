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
    document.getElementById('t-id').value = '';
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
    const id = document.getElementById('t-id').value;
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

    if (id) {
        // Edit existing
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            tasks[taskIndex] = { ...tasks[taskIndex], title, type, priority, subtasks };
        }
    } else {
        // Create new
        const newTask = {
            id: Date.now().toString(),
            title,
            type,
            priority,
            status: 'todo', // Default status
            subtasks
        };
        tasks.push(newTask);
    }
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

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('t-id').value = task.id;
    document.getElementById('t-title').value = task.title;
    document.getElementById('t-type').value = task.type;
    document.getElementById('t-priority').value = task.priority;

    // Handle subtasks for edit
    if (task.type === 'complex' && task.subtasks) {
        document.getElementById('t-subtasks').value = task.subtasks.map(s => s.text).join('\n');
    } else {
        document.getElementById('t-subtasks').value = '';
    }

    toggleSubtasksInput();
    modal.style.display = 'flex';
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

    // Remove dragging class
    if (draggedElement) draggedElement.classList.remove('dragging');

    if (list) {
        const newStatus = list.getAttribute('data-status');
        const taskId = cardId.replace('task-', '');

        // Find the task
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const task = tasks[taskIndex];

        // Determine position
        // Get all cards in the list *except* the dragged one (though it's not in DOM yet usually, but good practice)
        // Actually, since we are dropping, we can look at where we dropped.
        // But the standard HTML5 DnD API is a bit tricky for exact index.
        // A common trick is to look at the element under the mouse.

        // We need to find the element we dropped *before*.
        // We can use clientY to find the closest element.
        const afterElement = getDragAfterElement(list, ev.clientY);

        // Remove task from old position
        tasks.splice(taskIndex, 1);

        // Update status
        task.status = newStatus;

        if (afterElement == null) {
            // Add to end
            tasks.push(task);
        } else {
            // Insert before the afterElement
            const afterId = afterElement.id.replace('task-', '');
            const afterIndex = tasks.findIndex(t => t.id === afterId);

            // We need to be careful because we just removed an item, so indices might have shifted.
            // But since we are re-building the array, maybe it's safer to just re-insert.
            // Wait, the `tasks` array is the source of truth.
            // If we want to insert *before* `afterId` in the `tasks` array, we need to find where `afterId` is.
            // Note: `tasks` contains ALL tasks, not just this column's.
            // So we can't just use the index in `tasks` directly for visual order if we just splice.
            // BUT, if we assume the visual order reflects the array order (filtered by status), we can do this:

            // 1. Filter tasks by status to get the current column's tasks in order.
            // 2. Find the index of `afterId` in that filtered list.
            // 3. Insert our task into that position in the filtered list.
            // 4. Reconstruct the main `tasks` array.

            // Let's try a simpler approach:
            // We know the target status.
            // We want to place `task` before `afterElement`.

            // Let's get all tasks of the new status.
            const statusTasks = tasks.filter(t => t.status === newStatus);

            if (afterElement) {
                const afterId = afterElement.id.replace('task-', '');
                const targetIndexInStatus = statusTasks.findIndex(t => t.id === afterId);

                // Insert into statusTasks
                statusTasks.splice(targetIndexInStatus, 0, task);
            } else {
                statusTasks.push(task);
            }

            // Now we need to merge this back into the main `tasks` array.
            // The easiest way is to keep other statuses as is, and replace the newStatus tasks.
            const otherTasks = tasks.filter(t => t.status !== newStatus);

            // If the task was moving within the same column, it was already removed from `tasks` (via splice above).
            // If it was moving columns, it was also removed.
            // So `otherTasks` does NOT contain our moved task.
            // `statusTasks` contains our moved task in the right place.

            // Wait, if we moved within the same column, `statusTasks` (generated from `tasks` after splice) 
            // would be missing the moved task, which is correct.
            // But `otherTasks` would also be missing it.
            // So we just concatenate.

            // However, we need to be careful about the order of `otherTasks`. 
            // The user might expect them to stay in order.
            // Since we only care about the order within each status, concatenating is fine.

            tasks = [...otherTasks, ...statusTasks];
        }

        saveToLocal();
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
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
        <div class="actions">
            <button class="edit-btn" onclick="editTask('${task.id}')">✎</button>
            <button class="delete-btn" onclick="deleteTask('${task.id}')">×</button>
        </div>
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