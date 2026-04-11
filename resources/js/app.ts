import { createPinia } from 'pinia';
import { createApp } from 'vue';
import AppRoot from '@/components/AppRoot.vue';
import router from '@/router';

const app = createApp(AppRoot);
app.use(createPinia());
app.use(router);
app.mount('#app');
