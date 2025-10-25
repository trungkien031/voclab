// Dữ liệu mẫu (ĐÃ CẬP NHẬT cho Spaced Repetition)
const sampleWords = [
    { 
        id: 1, 
        word: "abandon", 
        partOfSpeech: "verb", 
        meaning: "bỏ rơi, từ bỏ", 
        example: "He had to abandon the car.", 
        pronunciation: "əˈbændən", 
        audio: "", 
        tags: ["common"],
        level: 1, // THAY ĐỔI
        nextReviewDate: new Date().toISOString() // THAY ĐỔI
    },
    { 
        id: 2, 
        word: "benevolent", 
        partOfSpeech: "adjective", 
        meaning: "nhân từ, từ bi", 
        example: "A benevolent donor helped the school.", 
        pronunciation: "bəˈnevələnt", 
        audio: "", 
        tags: ["advanced"],
        level: 1,
        nextReviewDate: new Date().toISOString()
    },
    { 
        id: 3, 
        word: "curious", 
        partOfSpeech: "adjective", 
        meaning: "tò mò, hiếu kỳ", 
        example: "She was curious about the new technology.", 
        pronunciation: "ˈkjʊriəs", 
        audio: "", 
        tags: ["common", "personality"],
        level: 5, // 'learned' true giờ là level cao
        nextReviewDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // Đã học, hẹn 10 ngày sau
    }
];

// Global variables
let words = [];
let currentTheme = 'light';
let currentFlashcardIndex = 0;
let flashcardWords = [];
let isFlashcardFlipped = false;
let currentListenIndex = 0;
let listenWords = [];
let currentQuiz = null;
let currentQuizIndex = 0;
let quizAnswers = [];
let speechSynthesis = window.speechSynthesis;

// Hằng số cho Spaced Repetition (số ngày)
// Level 1: 1 ngày, Level 2: 3 ngày, Level 3: 7 ngày, Level 4: 14 ngày, ...
const SPACING_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120];

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    initializeApp();
});

// Load data từ localStorage hoặc sử dụng sample data
function loadData() {
    const storedWords = localStorage.getItem('vocablab-words');
    const storedTheme = localStorage.getItem('vocablab-theme') || 'light';
    
    if (storedWords) {
        words = JSON.parse(storedWords);
        // THÊM MỚI: Di chuyển dữ liệu cũ (nếu có)
        migrateData();
    } else {
        words = [...sampleWords];
        saveData();
    }
    
    currentTheme = storedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
}

// THÊM MỚI: Di chuyển dữ liệu từ 'learned: boolean' sang 'level'
function migrateData() {
    let needsSave = false;
    words.forEach(word => {
        if (word.learned !== undefined) {
            console.log('Migrating old word:', word.word);
            word.level = word.learned ? 5 : 1;
            word.nextReviewDate = new Date().toISOString();
            delete word.learned;
            needsSave = true;
        }
        // Đảm bảo các từ mới hơn cũng có trường dữ liệu
        if (!word.level) word.level = 1;
        if (!word.nextReviewDate) word.nextReviewDate = new Date().toISOString();
    });
    if (needsSave) saveData();
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('vocablab-words', JSON.stringify(words));
    localStorage.setItem('vocablab-theme', currentTheme);
}

// Initialize the application
function initializeApp() {
    updateDashboard();
    renderWordList();
    initializeFlashcards();
    initializeListenAndRepeat();
}

// Theme management
function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
    saveData();
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-icon');
    icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// Mobile menu toggle
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-open');
}

// Navigation (CẬP NHẬT: truyền 'this' để set active)
function showSection(sectionId, navElement) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));

    document.getElementById(sectionId).classList.add('active');
    if(navElement) navElement.classList.add('active');

    document.getElementById('sidebar').classList.remove('mobile-open');

    // Cập nhật nội dung khi chuyển section
    if (sectionId === 'dashboard') {
        updateDashboard();
    } else if (sectionId === 'words') {
        renderWordList();
    } else if (sectionId === 'flashcards') {
        initializeFlashcards();
    } else if (sectionId === 'listen') {
        initializeListenAndRepeat();
    }
}

// Dashboard functions (CẬP NHẬT: cho Spaced Repetition)
function updateDashboard() {
    const totalWords = words.length;
    // "Learned" được định nghĩa là level 5 trở lên
    const learnedWords = words.filter(word => word.level >= 5).length;
    // "Review today" là những từ có ngày review <= hôm nay
    const reviewToday = words.filter(word => new Date(word.nextReviewDate) <= new Date()).length;
    
    const quizScores = JSON.parse(localStorage.getItem('vocablab-quiz-scores') || '[]');
    const averageScore = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : 0;
    
    document.getElementById('total-words').textContent = totalWords;
    document.getElementById('learned-words').textContent = learnedWords;
    document.getElementById('review-today').textContent = reviewToday;
    document.getElementById('quiz-score').textContent = averageScore + '%';
}

// Word management functions
function renderWordList(filteredWords = null) {
    const wordsToRender = filteredWords || words;
    const container = document.getElementById('word-list');

    if (wordsToRender.length === 0) {
        container.innerHTML = '<div class="card text-center">No words found. Add some words to get started!</div>';
        return;
    }

    container.innerHTML = wordsToRender.sort((a, b) => new Date(b.addedDate) - new Date(a.addedDate)).map(word => `
        <div class="word-card">
            <div class="word-info">
                <div class="word-title">${word.word}</div>
                <div class="word-part-of-speech">${word.partOfSpeech}</div>
                <div class="word-meaning">${word.meaning}</div>
                ${word.example ? `<div class="word-example">"${word.example}"</div>` : ''}
                ${word.pronunciation ? `<div class="word-example">/${word.pronunciation}/</div>` : ''}
                ${word.tags && word.tags.length > 0 ? `<div class="word-example">Tags: ${word.tags.join(', ')}</div>` : ''}
            </div>
            <div class="word-actions">
                <span class="word-level">Level: ${word.level}</span>
                ${word.audio || word.word ? `
                    <button class="btn btn-sm btn-secondary" onclick="playWordAudio('${word.word}', '${word.audio}')">
                        <i class="fas fa-volume-up"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-secondary" onclick="editWord(${word.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteWord(${word.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function filterWords() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filtered = words.filter(word => 
        word.word.toLowerCase().includes(searchTerm) || 
        word.meaning.toLowerCase().includes(searchTerm) || 
        (word.tags && word.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
    renderWordList(filtered);
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'add-word-modal') {
        document.getElementById('word-input').focus();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    if (modalId === 'add-word-modal') {
        document.querySelector('#add-word-modal form').reset();
    }
}

function saveWord(event) {
    event.preventDefault();
    const word = document.getElementById('word-input').value;
    const partOfSpeech = document.getElementById('pos-input').value;
    const meaning = document.getElementById('meaning-input').value;
    const example = document.getElementById('example-input').value;
    const pronunciation = document.getElementById('pronunciation-input').value;
    const audio = document.getElementById('audio-input').value;
    const tagsInput = document.getElementById('tags-input').value;
    
    const newWord = {
        id: Date.now(),
        word,
        partOfSpeech,
        meaning,
        example,
        pronunciation,
        audio,
        tags: tagsInput ? tagsInput.split(',').map(tag => tag.trim()) : [],
        addedDate: new Date().toISOString(),
        // CẬP NHẬT: Cho Spaced Repetition
        level: 1,
        nextReviewDate: new Date().toISOString()
    };
    
    words.push(newWord);
    saveData();
    renderWordList();
    updateDashboard();
    closeModal('add-word-modal');
    showNotification('Word added successfully!', 'success');
}

function editWord(id) {
    const word = words.find(w => w.id === id);
    if (!word) return;
    
    document.getElementById('edit-word-id').value = id;
    document.getElementById('edit-word-input').value = word.word;
    document.getElementById('edit-pos-input').value = word.partOfSpeech;
    document.getElementById('edit-meaning-input').value = word.meaning;
    document.getElementById('edit-example-input').value = word.example || '';
    document.getElementById('edit-pronunciation-input').value = word.pronunciation || '';
    document.getElementById('edit-audio-input').value = word.audio || '';
    document.getElementById('edit-tags-input').value = word.tags ? word.tags.join(', ') : '';
    
    showModal('edit-word-modal');
}

function updateWord(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('edit-word-id').value);
    const wordIndex = words.findIndex(w => w.id === id);
    if (wordIndex === -1) return;

    // Giữ nguyên level và ngày review khi edit
    const existingWord = words[wordIndex];
    words[wordIndex] = {
        ...existingWord,
        word: document.getElementById('edit-word-input').value,
        partOfSpeech: document.getElementById('edit-pos-input').value,
        meaning: document.getElementById('edit-meaning-input').value,
        example: document.getElementById('edit-example-input').value,
        pronunciation: document.getElementById('edit-pronunciation-input').value,
        audio: document.getElementById('edit-audio-input').value,
        tags: document.getElementById('edit-tags-input').value ? document.getElementById('edit-tags-input').value.split(',').map(tag => tag.trim()) : []
    };
    
    saveData();
    renderWordList();
    closeModal('edit-word-modal');
    showNotification('Word updated successfully!', 'success');
}

function deleteWord(id) {
    if (confirm('Are you sure you want to delete this word?')) {
        words = words.filter(word => word.id !== id);
        saveData();
        renderWordList();
        updateDashboard();
        showNotification('Word deleted successfully!', 'success');
    }
}

// THÊM MỚI: Gợi ý 2 - Tích hợp API
async function fetchWordFromAPI() {
    const word = document.getElementById('word-input').value.trim();
    if (!word) {
        showNotification('Please enter a word to look up.', 'error');
        return;
    }

    const btn = document.getElementById('lookup-api-btn');
    const btnIcon = btn.querySelector('i');
    btnIcon.className = 'fas fa-spinner fa-spin'; // Hiển thị loading
    btn.disabled = true;

    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        if (!response.ok) {
            throw new Error('Word not found');
        }
        const data = await response.json();
        const entry = data[0];
        
        // Tự động điền thông tin
        const phonetic = entry.phonetics.find(p => p.text)?.text;
        const audio = entry.phonetics.find(p => p.audio)?.audio;
        const meaning = entry.meanings[0]?.definitions[0]?.definition;
        const partOfSpeech = entry.meanings[0]?.partOfSpeech;
        const example = entry.meanings[0]?.definitions[0]?.example;

        if(partOfSpeech) document.getElementById('pos-input').value = partOfSpeech;
        if(meaning) document.getElementById('meaning-input').value = meaning;
        if(phonetic) document.getElementById('pronunciation-input').value = phonetic;
        if(example) document.getElementById('example-input').value = example;
        if(audio) document.getElementById('audio-input').value = audio;

        showNotification('Word data populated!', 'success');

    } catch (error) {
        console.error('API Error:', error);
        showNotification('Could not find word data.', 'error');
    } finally {
        btnIcon.className = 'fas fa-search'; // Hoàn tất loading
        btn.disabled = false;
    }
}


// Audio functions
function playWordAudio(word, audioUrl) {
    if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(e => {
            console.warn('Audio failed to play:', e);
            speakWord(word); // Dự phòng nếu link audio hỏng
        });
    } else {
        speakWord(word);
    }
}

function speakWord(word) {
    if (speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    }
}

// Flashcard functions (CẬP NHẬT: Gợi ý 3 - Spaced Repetition)
function initializeFlashcards() {
    const today = new Date();
    // Chỉ học những từ có ngày review <= hôm nay
    flashcardWords = words.filter(word => new Date(word.nextReviewDate) <= today);
    
    if (flashcardWords.length === 0) {
        // Nếu không có từ nào, kiểm tra xem có từ nào không
        if (words.length > 0) {
            showNotification('No words to review today! Good job!', 'success');
        } else {
            showNotification('Add some words to start learning.', 'warning');
        }
    }
    
    // Xáo trộn mảng
    flashcardWords.sort(() => Math.random() - 0.5);
    
    currentFlashcardIndex = 0;
    isFlashcardFlipped = false;
    updateFlashcard();
}

function updateFlashcard() {
    const container = document.getElementById('flashcard');
    const controls = document.querySelector('.flashcard-controls');

    if (flashcardWords.length === 0 || currentFlashcardIndex >= flashcardWords.length) {
        document.getElementById('flashcard-word').textContent = 'All Done!';
        document.getElementById('flashcard-meaning').textContent = 'You have reviewed all available cards for now.';
        document.getElementById('flashcard-example').textContent = '';
        container.classList.add('flipped');
        controls.classList.add('hidden');
        document.getElementById('flashcard-progress').style.width = '100%';
        updateDashboard(); // Cập nhật lại dashboard
        return;
    }

    controls.classList.remove('hidden');
    const word = flashcardWords[currentFlashcardIndex];
    document.getElementById('flashcard-word').textContent = word.word;
    document.getElementById('flashcard-meaning').textContent = word.meaning;
    document.getElementById('flashcard-example').textContent = word.example || '';

    const progress = ((currentFlashcardIndex + 1) / flashcardWords.length) * 100;
    document.getElementById('flashcard-progress').style.width = progress + '%';

    container.classList.remove('flipped');
    isFlashcardFlipped = false;
}

function flipCard() {
    if (flashcardWords.length === 0) return;
    const card = document.getElementById('flashcard');
    card.classList.toggle('flipped');
    isFlashcardFlipped = !isFlashcardFlipped;
}

function playAudio(event) {
    event.stopPropagation(); // Ngăn card bị lật khi bấm nút audio
    const word = flashcardWords[currentFlashcardIndex];
    playWordAudio(word.word, word.audio);
}

// THAY ĐỔI: Logic cho Spaced Repetition
function handleFlashcardResponse(rating) {
    if (flashcardWords.length === 0 || currentFlashcardIndex >= flashcardWords.length) return;

    // Lật thẻ nếu chưa lật
    if (!isFlashcardFlipped) {
        flipCard();
        // Chờ 1 chút để user xem nghĩa rồi mới xử lý
        setTimeout(() => handleFlashcardResponse(rating), 400);
        return;
    }

    const word = flashcardWords[currentFlashcardIndex];
    const originalWord = words.find(w => w.id === word.id);
    if (!originalWord) return;

    let newLevel = originalWord.level;
    if (rating === 'again') {
        newLevel = 1; // Reset về level 1
    } else if (rating === 'good') {
        newLevel = Math.min(newLevel + 1, SPACING_INTERVALS_DAYS.length);
    } else if (rating === 'easy') {
        newLevel = Math.min(newLevel + 2, SPACING_INTERVALS_DAYS.length);
    }
    
    originalWord.level = newLevel;
    originalWord.nextReviewDate = calculateNextReviewDate(newLevel);
    
    saveData();
    
    currentFlashcardIndex++;
    updateFlashcard();
}

// THÊM MỚI: Hàm tính ngày review tiếp theo
function calculateNextReviewDate(level) {
    const daysToAdd = SPACING_INTERVALS_DAYS[level - 1] || 1; // Lấy số ngày từ mảng
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return nextDate.toISOString();
}

// Listen & Repeat functions (Giữ nguyên)
function initializeListenAndRepeat() {
    listenWords = [...words];
    listenWords.sort(() => Math.random() - 0.5); // Xáo trộn
    currentListenIndex = 0;
    updateListenWord();
}

function updateListenWord() {
    if (listenWords.length === 0) {
        document.getElementById('listen-word').textContent = 'No words available';
        return;
    }
    const word = listenWords[currentListenIndex];
    document.getElementById('listen-word').textContent = word.word;
    document.getElementById('listen-pos').textContent = word.partOfSpeech;
    document.getElementById('listen-meaning').textContent = word.meaning;
    document.getElementById('listen-example').textContent = word.example || '';
}

function playListenAudio() {
    const word = listenWords[currentListenIndex];
    playWordAudio(word.word, word.audio);
}

function nextListenWord() {
    currentListenIndex = (currentListenIndex + 1) % listenWords.length;
    updateListenWord();
}

function shuffleListenWords() {
    initializeListenAndRepeat();
}

// Quiz functions (CẬP NHẬT: Gợi ý 4 - Cải thiện Quiz)
function startQuiz() {
    const numQuestions = parseInt(document.getElementById('quiz-num-questions').value) || 10;
    const quizType = document.getElementById('quiz-type').value;

    if (words.length < 4) {
        showNotification('You need at least 4 words to start a quiz.', 'error');
        return;
    }

    currentQuiz = {
        questions: generateQuiz(numQuestions, quizType),
        type: quizType,
        total: numQuestions
    };
    currentQuizIndex = 0;
    quizAnswers = [];

    document.getElementById('quiz-start-screen').classList.add('hidden');
    document.getElementById('quiz-main-screen').classList.remove('hidden');
    
    renderQuizQuestion();
}

function generateQuiz(num, type) {
    const questions = [];
    const shuffledWords = [...words].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < num; i++) {
        if (i >= shuffledWords.length) break; // Dừng nếu hết từ
        
        const questionWord = shuffledWords[i];
        
        // CẬP NHẬT: Câu hỏi ngược
        // 50% cơ hội là câu hỏi ngược (nếu không phải fill-in-blank)
        const isReverse = type === 'multiple-choice' && Math.random() < 0.5;

        // Tạo các lựa chọn
        const options = [];
        if (isReverse) {
            options.push(questionWord.word); // Đáp án đúng là từ
        } else {
            options.push(questionWord.meaning); // Đáp án đúng là nghĩa
        }
        
        // Lấy 3 từ ngẫu nhiên khác
        const distractors = [...words]
            .filter(w => w.id !== questionWord.id)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
            
        distractors.forEach(distractor => {
            if (isReverse) {
                options.push(distractor.word);
            } else {
                options.push(distractor.meaning);
            }
        });

        // Xáo trộn các lựa chọn
        options.sort(() => 0.5 - Math.random());
        
        questions.push({
            word: questionWord.word,
            meaning: questionWord.meaning,
            questionText: isReverse ? `Which word means "${questionWord.meaning}"?` : `What is the meaning of "${questionWord.word}"?`,
            subText: isReverse ? 'Find the correct word.' : `(${questionWord.partOfSpeech})`,
            options: options,
            correctAnswer: isReverse ? questionWord.word : questionWord.meaning,
            type: type === 'mixed' ? (Math.random() < 0.5 ? 'multiple-choice' : 'fill-in-blank') : type,
            isReverse: isReverse
        });
    }
    return questions;
}

function renderQuizQuestion() {
    if (currentQuizIndex >= currentQuiz.total) {
        endQuiz(false);
        return;
    }

    const q = currentQuiz.questions[currentQuizIndex];
    const container = document.getElementById('quiz-question-container');
    let html = `
        <div class="quiz-question-text">${q.questionText}</div>
        <p class="quiz-question-subtext">${q.subText}</p>
    `;

    if (q.type === 'multiple-choice') {
        html += '<div class="quiz-options">';
        q.options.forEach(option => {
            html += `<div class="quiz-option" onclick="selectQuizOption(this, '${option}')">${option}</div>`;
        });
        html += '</div>';
    } else { // fill-in-blank
        html += `
            <div class="form-group">
                <input type="text" class="form-input" id="fill-in-blank-input" placeholder="Type your answer...">
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // Cập nhật progress bar
    document.getElementById('quiz-question-number').textContent = `Question ${currentQuizIndex + 1}/${currentQuiz.total}`;
    const progress = ((currentQuizIndex + 1) / currentQuiz.total) * 100;
    document.getElementById('quiz-progress').style.width = progress + '%';
    
    document.getElementById('quiz-next-btn').classList.add('hidden'); // Ẩn nút Next
}

function selectQuizOption(element, answer) {
    // Vô hiệu hóa các lựa chọn khác
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.classList.add('disabled'));
    
    checkQuiz(answer);
}

function nextQuizQuestion() {
    // Nếu là fill-in-blank, check đáp án khi nhấn Next
    const q = currentQuiz.questions[currentQuizIndex];
    if (q.type === 'fill-in-blank') {
        const answer = document.getElementById('fill-in-blank-input').value.trim();
        checkQuiz(answer);
    }
    
    currentQuizIndex++;
    renderQuizQuestion();
}

function checkQuiz(answer) {
    const q = currentQuiz.questions[currentQuizIndex];
    let isCorrect = false;
    
    if (q.type === 'multiple-choice') {
        isCorrect = (answer === q.correctAnswer);
        const options = document.querySelectorAll('.quiz-option');
        options.forEach(opt => {
            if (opt.textContent === q.correctAnswer) {
                opt.classList.add('correct');
            } else if (opt.textContent === answer && !isCorrect) {
                opt.classList.add('incorrect');
            }
        });
    } else { // fill-in-blank
        // Check tương đối (không phân biệt hoa thường, bỏ qua khoảng trắng)
        const formattedAnswer = answer.toLowerCase().trim();
        const formattedCorrectAnswer = (q.isReverse ? q.word : q.meaning).toLowerCase().trim();
        isCorrect = (formattedAnswer === formattedCorrectAnswer);
        
        const input = document.getElementById('fill-in-blank-input');
        input.disabled = true;
        input.classList.add(isCorrect ? 'correct' : 'incorrect'); // Cần thêm style cho input.correct/incorrect
    }
    
    // Lưu kết quả
    quizAnswers.push({
        question: q.questionText,
        yourAnswer: answer,
        correctAnswer: q.correctAnswer,
        isCorrect: isCorrect
    });

    // Hiển thị nút Next
    document.getElementById('quiz-next-btn').classList.remove('hidden');
}

function endQuiz(interrupted) {
    if (interrupted && !confirm('Are you sure you want to end the quiz?')) {
        return;
    }

    document.getElementById('quiz-main-screen').classList.add('hidden');
    document.getElementById('quiz-start-screen').classList.remove('hidden');

    const correctAnswers = quizAnswers.filter(a => a.isCorrect).length;
    const totalQuestions = quizAnswers.length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Lưu điểm số
    if (totalQuestions > 0) {
        const quizScores = JSON.parse(localStorage.getItem('vocablab-quiz-scores') || '[]');
        quizScores.push(score);
        localStorage.setItem('vocablab-quiz-scores', JSON.stringify(quizScores));
        updateDashboard();
    }

    // THAY ĐỔI: Hiển thị modal kết quả chi tiết
    renderQuizResults(score);
    showModal('quiz-results-modal');
}

// THÊM MỚI: Hiển thị kết quả chi tiết
function renderQuizResults(score) {
    const summaryEl = document.getElementById('quiz-results-summary');
    const bodyEl = document.getElementById('quiz-results-body');
    
    summaryEl.innerHTML = `
        <h3 class="text-center mb-2">Your Score: ${score}%</h3>
        <p class="text-center text-muted">You got ${quizAnswers.filter(a => a.isCorrect).length} out of ${quizAnswers.length} correct.</p>
    `;
    
    let resultsHtml = '';
    quizAnswers.forEach(a => {
        resultsHtml += `
            <div class="quiz-result-item ${a.isCorrect ? 'correct' : 'incorrect'}">
                <div class="quiz-result-question">${a.question}</div>
                <div class="quiz-result-answer">
                    ${a.isCorrect ? 
                        `<span class="correct-answer"><i class="fas fa-check"></i> ${a.yourAnswer}</span>` : 
                        `<span class="incorrect-answer"><i class="fas fa-times"></i> ${a.yourAnswer}</span>
                         <span class="correct-answer"> (Correct: ${a.correctAnswer})</span>`
                    }
                </div>
            </div>
        `;
    });
    
    bodyEl.innerHTML = resultsHtml;
}


// Settings functions (Data Management)
function importData() {
    if (confirm('Importing data will overwrite all current data. Are you sure?')) {
        document.getElementById('import-file-input').click();
    }
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.words) {
                words = data.words;
                saveData();
                initializeApp();
                showNotification('Data imported successfully!', 'success');
            } else {
                throw new Error('Invalid file format');
            }
        } catch (error) {
            showNotification('Failed to import data. Invalid file.', 'error');
        }
    };
    reader.readAsText(file);
    // Reset input để có thể import file cũ lần nữa
    event.target.value = null;
}

function exportData() {
    const data = {
        words: words,
        // Có thể export thêm settings, scores...
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocablab_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Data exported successfully!', 'success');
}

function resetData() {
    if (confirm('ARE YOU SURE you want to delete ALL data? This cannot be undone.')) {
        localStorage.removeItem('vocablab-words');
        localStorage.removeItem('vocablab-quiz-scores');
        // localStorage.removeItem('vocablab-theme'); // Có thể giữ lại theme
        words = [...sampleWords]; // Quay về dữ liệu mẫu
        saveData();
        initializeApp();
        showNotification('All data has been reset.', 'success');
    }
}

// Utility: Notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification'; // Reset
    notification.classList.add(type);
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}