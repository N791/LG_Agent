import request from '../utils/request';

export const reportsService = {
  exportReport: async (reportType: string, format: string, filters?: Record<string, unknown>) => {
    return request.post(
      '/reports/export',
      { reportType, format, filters },
      {
        responseType: 'blob', // Important for downloading files
      },
    );
  },
};
