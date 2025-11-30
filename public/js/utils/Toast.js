// js/utils/Toast.js

const Toast = {
    show(message, icon = "✨") {
        // 1. Remove existing toast to avoid stacking clutter
        const existing = document.querySelector('.toast-notification');
        if (existing) {
            existing.classList.remove('visible');
            setTimeout(() => existing.remove(), 200);
        }

        // 2. Create Element
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        document.body.appendChild(toast);

        // 3. Animate In (Next Frame)
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // 4. Auto Dismiss
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 500); // Wait for transition
            }
        }, 3000);
    }
};

// Expose globally
window.showToast = Toast.show;

export { Toast };