import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Alert {
  id: number;
  user_name: string;
  whatsapp_number: string;
  subject_preferences: string;
  max_distance_km: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface AlertsState {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  testNotificationLoading: boolean;
  testNotificationResult: {
    success: boolean;
    message: string;
  } | null;
}

const initialState: AlertsState = {
  alerts: [],
  loading: false,
  error: null,
  testNotificationLoading: false,
  testNotificationResult: null,
};

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload;
    },
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.push(action.payload);
    },
    updateAlert: (state, action: PayloadAction<Alert>) => {
      const index = state.alerts.findIndex(alert => alert.id === action.payload.id);
      if (index !== -1) {
        state.alerts[index] = action.payload;
      }
    },
    removeAlert: (state, action: PayloadAction<number>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setTestNotificationLoading: (state, action: PayloadAction<boolean>) => {
      state.testNotificationLoading = action.payload;
    },
    setTestNotificationResult: (state, action: PayloadAction<{ success: boolean; message: string } | null>) => {
      state.testNotificationResult = action.payload;
    },
  },
});

export const {
  setAlerts,
  addAlert,
  updateAlert,
  removeAlert,
  setLoading,
  setError,
  setTestNotificationLoading,
  setTestNotificationResult,
} = alertsSlice.actions;

export default alertsSlice.reducer;
