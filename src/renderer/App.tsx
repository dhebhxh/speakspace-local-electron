import { HashRouter } from 'react-router-dom';
import './App.css';
import AppRoute from './AppRoute';

export default function App() {
  return (
    <HashRouter>
      <AppRoute />
    </HashRouter>
  );
}
