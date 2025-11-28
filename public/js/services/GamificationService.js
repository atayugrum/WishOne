// js/services/GamificationService.js
import { authService } from './AuthService.js';

export const GamificationService = {
    // Soft, premium confetti
    triggerConfetti() {
        const colors = ['#E6E6FA', '#F8C8DC', '#ADD8E6', '#FFD700', '#FFFFFF'];
        const count = 50;

        for (let i = 0; i < count; i++) {
            this._createParticle(colors);
        }
    },

    _createParticle(colors) {
        const particle = document.createElement('div');
        particle.style.position = 'fixed';
        particle.style.width = Math.random() * 8 + 4 + 'px';
        particle.style.height = Math.random() * 8 + 4 + 'px';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.top = '-10px';
        particle.style.left = Math.random() * 100 + 'vw';
        particle.style.opacity = Math.random() + 0.5;
        particle.style.borderRadius = '50%';
        particle.style.zIndex = '9999';
        particle.style.pointerEvents = 'none';

        // Random Physics
        const duration = Math.random() * 3 + 2;
        particle.style.transition = `top ${duration}s ease-in, left ${duration}s ease-in-out, transform ${duration}s linear, opacity ${duration}s ease-in`;

        document.body.appendChild(particle);

        // Animate
        setTimeout(() => {
            particle.style.top = '110vh';
            particle.style.left = (parseFloat(particle.style.left) + (Math.random() * 20 - 10)) + 'vw';
            particle.style.transform = `rotate(${Math.random() * 360}deg)`;
            particle.style.opacity = '0';
        }, 100);

        // Cleanup
        setTimeout(() => {
            particle.remove();
        }, duration * 1000);
    },

    // Check for Milestones
    checkMilestones(action, totalCount) {
        const key = `milestone_${action}`;
        const hasTriggered = localStorage.getItem(key);

        if (!hasTriggered) {
            if (action === 'add_item' && totalCount >= 5) {
                this._showMicroReward("5 Wishes Added! 🌟");
                localStorage.setItem(key, 'true');
                this.triggerConfetti();
            }
            if (action === 'manifest' && totalCount >= 1) {
                this._showMicroReward("First Manifestation! ✨");
                localStorage.setItem(key, 'true');
                this.triggerConfetti();
            }
        }
    },

    _showMicroReward(text) {
        const badge = document.createElement('div');
        badge.className = 'glass-panel';
        badge.style.position = 'fixed';
        badge.style.top = '100px';
        badge.style.left = '50%';
        badge.style.transform = 'translate(-50%, 20px)';
        badge.style.padding = '12px 24px';
        badge.style.borderRadius = '30px';
        badge.style.fontWeight = 'bold';
        badge.style.color = '#1D1D1F';
        badge.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
        badge.style.zIndex = '2000';
        badge.style.opacity = '0';
        badge.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        badge.innerText = text;

        document.body.appendChild(badge);

        requestAnimationFrame(() => {
            badge.style.opacity = '1';
            badge.style.transform = 'translate(-50%, 0)';
        });

        setTimeout(() => {
            badge.style.opacity = '0';
            badge.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => badge.remove(), 500);
        }, 3000);
    }
};