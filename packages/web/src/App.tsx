import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation('common');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('consoleTitle')}</h1>
        <p className="text-gray-600 mb-6">AI 沉浸式企业入职引擎</p>
        <Button type="primary">{t('getStarted')}</Button>
      </div>
    </div>
  );
}

export default App;
