import request from '../utils/request';

export const reportsService = {
  exportReport: async (reportType: string, format: string, filters?: any) => {
    return request.post(
      '/v1/reports/export',
      { reportType, format, filters },
      {
        responseType: 'blob', // Important for downloading files
      }
    );
  },
};
