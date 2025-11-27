export class AICompanion {
    constructor() {
        this.element = null;
        this.timeout = null;
        this.render();
    }

    render() {
        // Prevent duplicate bubbles
        if (document.querySelector('.ai-companion')) return;

        this.element = document.createElement('div');
        this.element.className = 'ai-companion';
        this.element.innerHTML = `
            <div class="ai-bubble"></div>
            <div class="ai-avatar">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="20" fill="#1D1D1F"/>
                    <path d="M12 22C12 22 15 26 20 26C25 26 28 22 28 22" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="15" cy="16" r="2" fill="white"/>
                    <circle cx="25" cy="16" r="2" fill="white"/>
                </svg>
            </div>
        `;
        document.body.appendChild(this.element);
    }

    say(text, duration = 4000) {
        const bubble = this.element.querySelector('.ai-bubble');
        const avatar = this.element.querySelector('.ai-avatar');

        if (bubble) bubble.textContent = text;

        this.element.classList.add('active');
        
        if (avatar) {
            avatar.style.transform = 'scale(1.2)';
            setTimeout(() => avatar.style.transform = 'scale(1)', 200);
        }

        if (this.timeout) clearTimeout(this.timeout);

        this.timeout = setTimeout(() => {
            this.element.classList.remove('active');
        }, duration);
    }
}