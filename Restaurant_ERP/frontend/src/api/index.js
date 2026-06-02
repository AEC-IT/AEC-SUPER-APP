import api from './client';

export const authAPI = {
  login: (email, password) => api.post('/auth/login/', { email, password }),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  me: () => api.get('/accounts/me/'),
};

export const revenueAPI = {
  cafeUnits: () => api.get('/revenue/canteen/units/'),
  createCafeUnit: (data) => api.post('/revenue/canteen/units/', data),
  canteenItems: () => api.get('/revenue/canteen/items/'),
  canteenSales: (params) => api.get('/revenue/canteen/sales/', { params }),
  createCanteenSale: (data) => api.post('/revenue/canteen/sales/', data),
  cafeExpenses: (params) => api.get('/revenue/canteen/expenses/', { params }),
  createCafeExpense: (data) => api.post('/revenue/canteen/expenses/', data),
};

export const petpoojaAPI = {
  getConfig: () => api.get('/integrations/petpooja/config/'),
  saveConfig: (data) => api.put('/integrations/petpooja/config/', data),
  syncItems: () => api.post('/integrations/petpooja/sync-items/'),
  syncSales: () => api.post('/integrations/petpooja/sync-sales/'),
  jobs: () => api.get('/integrations/petpooja/jobs/'),
};
