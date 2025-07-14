class CrosswordApp {
    constructor() {
        this.currentCrosswordId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCrosswordsList();
    }

    setupEventListeners() {
        // --- Menu Flottant ---
        document.getElementById('fab').addEventListener('click', () => this.toggleMenu());

        // Clic en dehors du menu pour le fermer
        document.addEventListener('click', (event) => {
            const menu = document.getElementById('floatingMenu');
            const fab = document.getElementById('fab');
            if (!menu.contains(event.target) && !fab.contains(event.target) && menu.classList.contains('active')) {
                this.toggleMenu(false);
            }
        });

        // --- Upload ---
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('submitBtn').style.display = 'block';
            }
        });

        document.getElementById('submitBtn').addEventListener('click', () => {
            this.uploadAndDisplayCrossword();
        });

        // --- Sélection ---
        document.getElementById('crosswordSelect').addEventListener('change', (e) => {
            document.getElementById('loadBtn').style.display = e.target.value ? 'block' : 'none';
        });

        document.getElementById('loadBtn').addEventListener('click', () => {
            this.loadSelectedCrossword();
        });
    }

    toggleMenu(forceState) {
        const menu = document.getElementById('floatingMenu');
        const fab = document.getElementById('fab');
        const shouldBeActive = forceState !== undefined ? forceState : !menu.classList.contains('active');

        menu.classList.toggle('active', shouldBeActive);
        fab.classList.toggle('active', shouldBeActive);
        fab.innerHTML = shouldBeActive ? '&times;' : '...';
    }

    async loadCrosswordsList() {
        try {
            const response = await fetch('/crosswords/');
            const crosswords = await response.json();
            
            const select = document.getElementById('crosswordSelect');
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- Choisir --</option>';
            
            crosswords.forEach(crossword => {
                const option = document.createElement('option');
                option.value = crossword.id;
                option.textContent = crossword.name;
                select.appendChild(option);
            });
            select.value = currentValue;
        } catch (error) {
            console.error('Erreur chargement liste:', error);
        }
    }

    async uploadAndDisplayCrossword() {
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        this.showStatus('Upload en cours...', 'loading');
        
        try {
            const response = await fetch('/upload-crossword/', { method: 'POST', body: formData });
            if (response.ok) {
                const crossword = await response.json();
                this.displayCrossword(crossword);
                this.currentCrosswordId = crossword.id;
                this.showStatus('Succès !', 'success');
                this.toggleMenu(false);
                await this.loadCrosswordsList();
            } else {
                const error = await response.json();
                this.showStatus(`Erreur: ${error.detail}`, 'error');
            }
        } catch (error) {
            this.showStatus('Erreur upload.', 'error');
        } finally {
            fileInput.value = '';
            document.getElementById('fileName').textContent = '';
            document.getElementById('submitBtn').style.display = 'none';
        }
    }

    async loadSelectedCrossword() {
        const crosswordId = document.getElementById('crosswordSelect').value;
        if (!crosswordId) return;

        try {
            const response = await fetch(`/crosswords/${crosswordId}/`);
            if (response.ok) {
                const crossword = await response.json();
                this.displayCrossword(crossword);
                this.currentCrosswordId = crosswordId;
                this.toggleMenu(false);
            } else {
                this.showStatus('Erreur chargement.', 'error');
            }
        } catch (error) {
            this.showStatus('Erreur chargement.', 'error');
        }
    }

    displayCrossword(crossword) {
        const container = document.getElementById('crosswordContainer');
        container.innerHTML = '';

        const img = document.createElement('img');
        img.src = `/${crossword.image_path}`;
        img.onload = () => {
            const ratio = img.width / img.naturalWidth;
            const inputSize = (crossword.square_height || 30) * ratio * 0.9;
            const fontSize = inputSize * 0.7;

            crossword.coordinates.forEach((coord, index) => {
                const input = this.createInput(index, coord, img.naturalWidth, img.naturalHeight, inputSize, fontSize);
                input.value = crossword.user_letters[index] || '';
                container.appendChild(input);
            });
        };
        container.appendChild(img);
    }

    createInput(index, coord, naturalWidth, naturalHeight, inputSize, fontSize) {
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 1;
        input.className = 'crossword-input';
        input.dataset.index = index;
        
        input.style.width = `${inputSize}px`;
        input.style.height = `${inputSize}px`;
        input.style.fontSize = `${fontSize}px`;
        input.style.left = `${(coord[0] / naturalWidth) * 100}%`;
        input.style.top = `${(coord[1] / naturalHeight) * 100}%`;

        input.addEventListener('input', (e) => this.handleCellInput(e, index));
        input.addEventListener('keydown', (e) => this.handleCellNavigation(e));
        return input;
    }

    async handleCellInput(event, cellIndex) {
        const letter = event.target.value.toUpperCase();
        event.target.value = letter;
        
        if (!this.currentCrosswordId) return;
        
        try {
            await fetch('/update-cell/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    crossword_id: parseInt(this.currentCrosswordId),
                    cell_index: cellIndex,
                    letter: letter
                })
            });
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
        }
    }

    handleCellNavigation(event) {
        const allInputs = Array.from(document.querySelectorAll('.crossword-input'));
        const currentIndex = allInputs.findIndex(input => input === event.target);
        let nextIndex = -1;

        if (event.key === 'ArrowRight' || (event.key === 'Enter' && !event.shiftKey) || (event.key === 'Tab' && !event.shiftKey)) {
            nextIndex = (currentIndex + 1) % allInputs.length;
        } else if (event.key === 'ArrowLeft' || (event.key === 'Enter' && event.shiftKey) || (event.key === 'Tab' && event.shiftKey)) {
            nextIndex = (currentIndex - 1 + allInputs.length) % allInputs.length;
        } else if (event.key === 'Backspace' && event.target.value === '') {
             nextIndex = (currentIndex - 1 + allInputs.length) % allInputs.length;
        }

        if (nextIndex !== -1) {
            event.preventDefault();
            allInputs[nextIndex].focus();
            if (event.key === 'Backspace') {
                allInputs[nextIndex].value = '';
                this.handleCellInput({target: allInputs[nextIndex]}, parseInt(allInputs[nextIndex].dataset.index));
            }
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.textContent = message;
        statusDiv.className = '';
        statusDiv.style.display = 'block';
        
        if (type === 'success') statusDiv.classList.add('status-success');
        else if (type === 'error') statusDiv.classList.add('status-error');
        
        if (type !== 'loading') {
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CrosswordApp();
});
