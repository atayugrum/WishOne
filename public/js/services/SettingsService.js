import { authService } from './AuthService.js';
import { i18n } from './LocalizationService.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from '../config/firebase-config.js';

class SettingsService {
    constructor() {
        this.defaultSettings = {
            theme: 'system',
            language: 'en',
            notifications: {
                wishlistReminders: true,
                giftReminders: true
            }
        };
        this.currentSettings = { ...this.defaultSettings };
    }

    async init() {
        // 1. Load Local
        const local = localStorage.getItem('wishone_settings');
        if (local) {
            try {
                this.currentSettings = JSON.parse(local);
                this.applyTheme(this.currentSettings.theme);
                i18n.setLocale(this.currentSettings.language);
            } catch (e) { console.warn("Bad local settings", e); }
        }

        // 2. Sync Cloud (Now works because onAuthStateChanged exists!)
        authService.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        this.currentSettings = { ...this.defaultSettings, ...snap.data() };
                        this.saveToLocal();
                        this.applyTheme(this.currentSettings.theme);
                        i18n.setLocale(this.currentSettings.language);
                    }
                } catch (e) {
                    console.warn("Settings sync failed", e);
                }
            }
        });
    }

    async updateSettings(newSettings) {
        this.currentSettings = { ...this.currentSettings, ...newSettings };
        this.saveToLocal();

        if (newSettings.theme) this.applyTheme(newSettings.theme);
        if (newSettings.language) i18n.setLocale(newSettings.language);

        const user = authService.currentUser;
        if (user) {
            try {
                await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), this.currentSettings, { merge: true });
            } catch (e) { console.error("Save settings failed", e); }
        }
    }

    saveToLocal() {
        localStorage.setItem('wishone_settings', JSON.stringify(this.currentSettings));
    }

    applyTheme(theme) {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', systemDark ? 'dark' : 'light');
        }
    }

    getSettings() {
        return this.currentSettings;
    }
}

export const settingsService = new SettingsService();