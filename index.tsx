
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const RootApp = () => {
  useEffect(() => {
    // Al montar exitosamente, ocultamos el loader de inmediato
    const hide = (window as any).hideTalkieLoader;
    if (hide) hide();
  }, []);

  return <App />;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RootApp />);
}
