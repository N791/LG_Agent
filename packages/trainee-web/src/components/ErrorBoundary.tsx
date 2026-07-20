import React, { ErrorInfo } from 'react';
import { Result, Button } from 'antd';
import { telemetry } from '../utils/telemetry';

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
            title="Something went wrong."
            subTitle="The application encountered an unexpected error. Our team has been notified."
            extra={
              <Button type="primary" onClick={() => { window.location.reload(); }}>
                Reload Page
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
