export class AICompanion {
    constructor() {
        this.element = null;
        this.timeout = null;
        this.basePath = '/img/mascot/';

        // Exact filename mapping based on your upload
        this.moods = {
            idle: 'AtOneMonkeyIcon.png',
            welcome: 'AtOneMonkeyWelcomingIcon.png',
            thinking: 'AtOneMonkeyThinkingIcon.png',
            magic: 'AtOneMonkeyMagicIcon.png',
            celebrating: 'AtOneMonkeyCelebratingIcon.png',
            dancing: 'AtOneMonkeyDancingIcon.png',
            loving: 'AtOneMonkeyLovingIcon.png',
            zen: 'AtOneMonkeyMeditatingIcon.png',
            presenting: 'AtOneMonkeyPresentingIcon.png',
            error: 'AtOneMonkeyErrorIcon.png'
        };

        this.preloadImages();
        this.render();
    }

    preloadImages() {
        Object.values(this.moods).forEach(filename => {
            const img = new Image();
            img.src = this.basePath + filename;
        });
    }

    render() {
        if (document.querySelector('.ai-companion')) return;

        this.element = document.createElement('div');
        this.element.className = 'ai-companion';
        // Click mascot to say hello/random status
        this.element.onclick = (e) => {
            if (e.target.classList.contains('ai-mascot-img')) {
                this.say("I'm here to help you manifest!", "presenting");
            }
        };

        this.element.innerHTML = `
            <div class="ai-avatar-container">
                <img src="${this.basePath + this.moods.idle}" class="ai-mascot-img" alt="AtOne Mascot">
            </div>
            <div class="ai-message-bubble"></div>
        `;
        document.body.appendChild(this.element);
    }

    /**
     * @param {string} text - Message to show
     * @param {string} mood - idle, welcome, thinking, magic, celebrating, dancing, loving, zen, presenting, error
     * @param {number} duration - ms to show bubble
     */
    say(text, mood = 'idle', duration = 5000) {
        const bubble = this.element.querySelector('.ai-message-bubble');
        const img = this.element.querySelector('.ai-mascot-img');

        // 1. Set Text & Show Bubble
        if (text) {
            bubble.textContent = text;
            this.element.classList.add('active');
        }

        // 2. Change Pose
        if (img && this.moods[mood]) {
            img.src = this.basePath + this.moods[mood];

            // Pop animation
            img.style.transform = 'scale(1.2)';
            setTimeout(() => img.style.transform = 'scale(1)', 300);
        }

        // 3. Auto-Hide Bubble & Reset Pose
        if (this.timeout) clearTimeout(this.timeout);

        if (duration > 0) {
            this.timeout = setTimeout(() => {
                this.element.classList.remove('active'); // Hide bubble

                // Return to Idle pose after a moment
                setTimeout(() => {
                    if (img) img.src = this.basePath + this.moods.idle;
                }, 500);
            }, duration);
        }
    }

    // Helper for loading states (no text, just pose)
    setMood(mood) {
        const img = this.element.querySelector('.ai-mascot-img');
        if (img && this.moods[mood]) {
            img.src = this.basePath + this.moods[mood];
        }
    }

    // FIX: Added alias method to handle calls from other views
    setState(mood) {
        this.setMood(mood);
    }
}