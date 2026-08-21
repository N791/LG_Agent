import React, { ErrorInfo } from 'react';
import { Result, Button } from 'antd';
import { telemetry } from '../utils/telemetry';
import i18n from '../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    telemetry.logError(error.message, error.stack, { componentStack: errorInfo.componentStack });
    // Flush immediately on critical error
    void telemetry.flush();
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Result
            status="500"
            title={i18n.t('common:errors.title')}
            subTitle={i18n.t('common:errors.unexpected')}
            extra={
              <Button
                type="primary"
                onClick={() => {
                  window.location.reload();
                }}
              >
                {i18n.t('common:actions.reload')}
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
