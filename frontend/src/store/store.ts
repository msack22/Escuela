import { configureStore } from '@reduxjs/toolkit';
import contestsReducer from './slices/contestsSlice.ts';
import alertsReducer from './slices/alertsSlice.ts';
import scrapingReducer from './slices/scrapingSlice.ts';

export const store = configureStore({
  reducer: {
    contests: contestsReducer,
    alerts: alertsReducer,
    scraping: scrapingReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
