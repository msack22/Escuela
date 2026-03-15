import { configureStore } from '@reduxjs/toolkit';
import contestsReducer from './slices/contestsSlice';
import alertsReducer from './slices/alertsSlice';
import scrapingReducer from './slices/scrapingSlice';

export const store = configureStore({
  reducer: {
    contests: contestsReducer,
    alerts: alertsReducer,
    scraping: scrapingReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
