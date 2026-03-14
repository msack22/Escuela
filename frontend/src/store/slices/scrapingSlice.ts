import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ScrapingLog {
  id: number;
  source_name: string;
  status: string;
  contests_found: number;
  contests_processed: number;
  error_message?: string;
  execution_time_seconds?: number;
  started_at: string;
  finished_at?: string;
}

interface ScrapingState {
  status: {
    is_running: boolean;
    interval_hours: number;
    available_sources: string[];
    all_sources: string[];
  };
  logs: ScrapingLog[];
  loading: boolean;
  error: string | null;
  manualScrapingLoading: boolean;
  lastManualResult: any;
}

const initialState: ScrapingState = {
  status: {
    is_running: false,
    interval_hours: 2,
    available_sources: [],
    all_sources: [],
  },
  logs: [],
  loading: false,
  error: null,
  manualScrapingLoading: false,
  lastManualResult: null,
};

const scrapingSlice = createSlice({
  name: 'scraping',
  initialState,
  reducers: {
    setStatus: (state, action: PayloadAction<Partial<ScrapingState['status']>>) => {
      state.status = { ...state.status, ...action.payload };
    },
    setLogs: (state, action: PayloadAction<ScrapingLog[]>) => {
      state.logs = action.payload;
    },
    addLog: (state, action: PayloadAction<ScrapingLog>) => {
      state.logs.unshift(action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setManualScrapingLoading: (state, action: PayloadAction<boolean>) => {
      state.manualScrapingLoading = action.payload;
    },
    setLastManualResult: (state, action: PayloadAction<any>) => {
      state.lastManualResult = action.payload;
    },
  },
});

export const {
  setStatus,
  setLogs,
  addLog,
  setLoading,
  setError,
  setManualScrapingLoading,
  setLastManualResult,
} = scrapingSlice.actions;

export default scrapingSlice.reducer;
