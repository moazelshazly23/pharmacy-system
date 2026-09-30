import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 font-cairo">
            حدث تنبيه بسيط أثناء العرض
          </h2>
          <p className="text-xs text-stone-500 max-w-sm mb-6 leading-relaxed">
            تم حفظ جميع بياناتك ومحفوظك في أمان تام. يمكنك إعادة تحميل التطبيق للمتابعة:
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="flex items-center gap-2 py-3 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            <RotateCcw size={16} />
            <span>إعادة تحميل التطبيق</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
