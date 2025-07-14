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
        // --- Upload ---
        document.getElementById('uploadBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('fileName').textContent = file.name;
                document.getElementById('submitBtn').style.display = 'inline-block';
            }
        });

        document.getElementById('submitBtn').addEventListener('click', () => {
            this.uploadAndDisplayCrossword();
        });

        // --- Sélection ---
        document.getElementById('crosswordSelect').addEventListener('change', (e) => {
            document.getElementById('loadBtn').style.display = e.target.value ? 'inline-block' : 'none';
        });

        document.getElementById('loadBtn').addEventListener('click', () => {
            this.loadSelectedCrossword();
        });
    }

    async loadCrosswordsList() {
        try {
            const response = await fetch('/crosswords/');
            const crosswords = await response.json();
            
            const select = document.getElementById('crosswordSelect');
            select.innerHTML = '<option value="">-- Choisir un mots croisés --</option>';
            
            crosswords.forEach(crossword => {
                const option = document.createElement('option');
                option.value = crossword.id;
                option.textContent = crossword.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Erreur chargement liste:', error);
        }
    }

    async uploadAndDisplayCrossword() {
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showStatus('Veuillez sélectionner un fichier', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            this.showStatus('Upload et traitement en cours...', 'loading');
            
            const response = await fetch('/upload-crossword/', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const crossword = await response.json();
                this.showStatus('Mots croisés prêt !', 'success');
                this.displayCrossword(crossword);
                this.currentCrosswordId = crossword.id;
                
                // Reset form et recharge la liste
                fileInput.value = '';
                document.getElementById('fileName').textContent = '';
                document.getElementById('submitBtn').style.display = 'none';
                await this.loadCrosswordsList();
            } else {
                const error = await response.json();
                this.showStatus(`Erreur: ${error.detail}`, 'error');
            }
        } catch (error) {
            console.error('Erreur upload:', error);
            this.showStatus('Erreur lors de l\'upload', 'error');
        }
    }

    async loadSelectedCrossword() {
        const select = document.getElementById('crosswordSelect');
        const crosswordId = select.value;
        
        if (!crosswordId) return;

        try {
            const response = await fetch(`/crosswords/${crosswordId}/`);
            if (response.ok) {
                const crossword = await response.json();
                this.displayCrossword(crossword);
                this.currentCrosswordId = crosswordId;
            } else {
                this.showStatus('Erreur chargement mots croisés', 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showStatus('Erreur chargement mots croisés', 'error');
        }
    }

    displayCrossword(crossword) {
        const gridSection = document.getElementById('gridSection');
        const gridTitle = document.getElementById('gridTitle');
        const container = document.getElementById('crosswordContainer');
        
        gridTitle.textContent = `📝 ${crossword.name}`;
        container.innerHTML = ''; // Vider le contenu précédent

        // Créer l'image de fond
        const img = document.createElement('img');
        img.src = `/${crossword.image_path}`;
        img.onload = () => {
            // Calculer le ratio entre la taille réelle de l'image et sa taille affichée
            const ratio = img.width / img.naturalWidth;
            const inputSize = crossword.square_height * ratio * 0.9; // 90% de la hauteur de la case
            const fontSize = inputSize * 0.7;

            // Créer les inputs une fois l'image chargée pour avoir les bonnes dimensions
            crossword.coordinates.forEach((coord, index) => {
                const input = document.createElement('input');
                input.type = 'text';
                input.maxLength = 1;
                input.className = 'crossword-input';
                input.dataset.index = index;

                // Définir la taille et la position
                input.style.width = `${inputSize}px`;
                input.style.height = `${inputSize}px`;
                input.style.fontSize = `${fontSize}px`;
                input.style.left = `${(coord[0] / img.naturalWidth) * 100}%`;
                input.style.top = `${(coord[1] / img.naturalHeight) * 100}%`;

                // Remplir avec la lettre sauvegardée
                const savedLetter = crossword.user_letters[index];
                if (savedLetter) {
                    input.value = savedLetter;
                }

                input.addEventListener('input', (e) => this.handleCellInput(e, index));
                input.addEventListener('keydown', (e) => this.handleCellNavigation(e));

                container.appendChild(input);
            });
        };
        container.appendChild(img);
        
        gridSection.style.display = 'block';
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
            setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CrosswordApp();
});
