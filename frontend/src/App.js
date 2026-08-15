import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Layout from './Layout';
import { AuthProvider } from './auth/AuthContext';

const App = () => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Router>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </Router>
  </ThemeProvider>
);

export default App;
