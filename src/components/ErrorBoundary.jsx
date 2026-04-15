import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-6 max-w-sm">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl text-red-400">error</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-primary font-headline">Algo deu errado</h1>
              <p className="text-on-surface-variant text-sm">
                Ocorreu um erro inesperado. Por favor, recarregue a página.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-95"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
