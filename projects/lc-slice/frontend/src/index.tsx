import { createRoot } from 'react-dom/client';
import { Provider as ReduxProvider} from 'react-redux';
import {store} from "./features/store"
import App from './App';
import './index.css';
import { databaseClient } from './database/dbClient';
import { ApolloProvider } from '@apollo/client/react';
import { BrowserRouter } from 'react-router-dom';
import { calcProportionBetween, Z_TABLE_POSITIVE_SJSU } from './zTableMatrix';

const container = document.getElementById('root')!;
const root = createRoot(container);

console.log(calcProportionBetween(71.33, 3, 68, 77.99));

root.render(
  <ReduxProvider store={store}>
    <ApolloProvider client={databaseClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </ReduxProvider>
);

