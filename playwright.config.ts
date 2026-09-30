import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',timeout:90000,retries:process.env.CI?1:0,use:{baseURL:'http://127.0.0.1:1420',viewport:{width:1280,height:800},trace:'retain-on-failure'},webServer:{command:'npm run dev -- --host 127.0.0.1',url:'http://127.0.0.1:1420',reuseExistingServer:!process.env.CI,timeout:30000}});
