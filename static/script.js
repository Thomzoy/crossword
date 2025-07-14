class CrosswordApp {
    constructor() {
        this.currentCrosswordId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Charger la liste, PUIS essayer de restaurer le dernier mot croisé
        this.loadCrosswordsList().then(() => {
            this.loadCrosswordFromStorage();
        });
        this.loadUserNameFromCookie();
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

        // --- Discussion ---
        document.getElementById('chatFab').addEventListener('click', () => this.toggleChat(true));
        document.getElementById('closeChatBtn').addEventListener('click', () => this.toggleChat(false));
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());

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

    loadCrosswordFromStorage() {
        const storedId = localStorage.getItem('currentCrosswordId');
        if (storedId) {
            const select = document.getElementById('crosswordSelect');
            // Vérifier si l'ID sauvegardé existe toujours dans la liste
            if ([...select.options].some(opt => opt.value === storedId)) {
                select.value = storedId;
                this.loadSelectedCrossword();
            } else {
                localStorage.removeItem('currentCrosswordId');
            }
        }
    }

    toggleMenu(forceState) {
        const menu = document.getElementById('floatingMenu');
        const fab = document.getElementById('fab');
        const shouldBeActive = forceState !== undefined ? forceState : !menu.classList.contains('active');

        menu.classList.toggle('active', shouldBeActive);
        fab.classList.toggle('active', shouldBeActive);
        fab.innerHTML = shouldBeActive ? '&times;' : '...';
    }

    toggleChat(open) {
        if (open && !this.currentCrosswordId) {
            alert("Veuillez d'abord charger un mot croisé.");
            return;
        }
        const chatPanel = document.getElementById('chatPanel');
        chatPanel.classList.toggle('active', open);
        if (open) {
            this.loadMessages();
        }
    }

    loadUserNameFromCookie() {
        const name = document.cookie.split('; ').find(row => row.startsWith('crossword_username='))?.split('=')[1];
        if (name) {
            document.getElementById('userNameInput').value = decodeURIComponent(name);
        }
    }

    async loadMessages() {
        if (!this.currentCrosswordId) return;
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = 'Chargement...';

        try {
            const response = await fetch(`/messages/${this.currentCrosswordId}/`);
            const messages = await response.json();
            messagesContainer.innerHTML = '';
            messages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message';
                
                const nameSpan = document.createElement('div');
                nameSpan.className = 'name';
                nameSpan.textContent = msg.name;

                const textDiv = document.createElement('div');
                textDiv.className = 'text';
                textDiv.textContent = msg.text;

                const timeSpan = document.createElement('div');
                timeSpan.className = 'timestamp';
                timeSpan.textContent = new Date(msg.timestamp).toLocaleString('fr-FR');

                msgDiv.append(nameSpan, textDiv, timeSpan);
                messagesContainer.appendChild(msgDiv);
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            messagesContainer.innerHTML = 'Erreur de chargement des messages.';
        }
    }

    async sendMessage() {
        const name = document.getElementById('userNameInput').value.trim();
        const text = document.getElementById('messageInput').value.trim();

        if (!name || !text) {
            alert('Le nom et le message ne peuvent pas être vides.');
            return;
        }

        try {
            await fetch(`/messages/${this.currentCrosswordId}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, text })
            });
            document.getElementById('messageInput').value = '';
            this.loadMessages(); // Recharger les messages
        } catch (error) {
            alert('Erreur lors de l\'envoi du message.');
        }
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
                this.toggleMenu(false);
            } else {
                this.showStatus('Erreur chargement.', 'error');
            }
        } catch (error) {
            this.showStatus('Erreur chargement.', 'error');
        }
    }

    displayCrossword(crossword) {
        this.currentCrosswordId = crossword.id;
        localStorage.setItem('currentCrosswordId', crossword.id); // Sauvegarde de l'ID

        const container = document.getElementById('crosswordContainer');
        container.innerHTML = '';

        const img = document.createElement('img');
        img.src = `/${crossword.image_path}`;
        img.onload = () => {
            // Utiliser le ratio de la hauteur pour être plus fiable, car la largeur peut être limitée par le conteneur
            const ratio = img.height / img.naturalHeight;
            const inputSize = (crossword.square_height || 30) * ratio * 0.9; // 90% de la hauteur de la case
            const fontSize = inputSize * 0.7;

            crossword.coordinates.forEach((coord, index) => {
                const input = this.createInput(index, coord, img.naturalWidth, img.naturalHeight, inputSize, fontSize);
                const savedLetter = crossword.user_letters[index] || '';
                input.value = savedLetter;
                if (savedLetter) {
                    input.classList.add('has-value');
                }
                container.appendChild(input);
            });
        };
        container.appendChild(img);

        document.getElementById('chatFab').style.display = 'block';
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

        if (letter) {
            event.target.classList.add('has-value');
        } else {
            event.target.classList.remove('has-value');
        }
        
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
