import { createPinia } from 'pinia';
import { createApp } from 'vue';
import AppRoot from '@/components/AppRoot.vue';
import { recordClientError, recordNavigation } from '@/lib/diagnostics';
import router from '@/router';

const app = createApp(AppRoot);

// Without these, a Vue render error or an unhandled rejection produces a
// blank screen and leaves nothing behind anywhere — the server never hears
// about it. Capturing them is what lets the log distinguish "our app has a
// bug" from "the API failed".
app.config.errorHandler = (error, _instance, info) => {
    recordClientError(error, 'vue', { info });
    console.error(error);
};

window.addEventListener('error', (event) => {
    recordClientError(event.error ?? event.message, 'window.onerror', {
        file: event.filename,
        line: event.lineno,
    });
});

window.addEventListener('unhandledrejection', (event) => {
    recordClientError(event.reason, 'unhandledrejection');
});

// Navigations give a failure the context of what the user was doing.
router.afterEach((to, from) => {
    recordNavigation(to.fullPath, from.fullPath);
});

app.use(createPinia());
app.use(router);
app.mount('#app');
