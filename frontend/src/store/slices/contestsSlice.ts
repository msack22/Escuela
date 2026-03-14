import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Contest {
  id: number;
  title: string;
  description: string;
  date: string;
  registration_deadline?: string;
  school: {
    id: number;
    name: string;
    city: string;
    department: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  subject: {
    id: number;
    name: string;
    description?: string;
  };
  source: {
    url: string;
    name: string;
  };
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface ContestsState {
  contests: Contest[];
  loading: boolean;
  error: string | null;
  filters: {
    subject_id?: number;
    city?: string;
    department?: string;
    date_from?: string;
    date_to?: string;
    school_name?: string;
    title_contains?: string;
    is_active: boolean;
  };
  pagination: {
    skip: number;
    limit: number;
    total: number;
  };
}

const initialState: ContestsState = {
  contests: [],
  loading: false,
  error: null,
  filters: {
    is_active: true,
  },
  pagination: {
    skip: 0,
    limit: 100,
    total: 0,
  },
};

const contestsSlice = createSlice({
  name: 'contests',
  initialState,
  reducers: {
    setContests: (state, action: PayloadAction<Contest[]>) => {
      state.contests = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<ContestsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPagination: (state, action: PayloadAction<Partial<ContestsState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = { is_active: true };
    },
  },
});

export const {
  setContests,
  setLoading,
  setError,
  setFilters,
  setPagination,
  clearFilters,
} = contestsSlice.actions;

export default contestsSlice.reducer;
