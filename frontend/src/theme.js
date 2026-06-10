import { createTheme } from '@mui/material/styles';

// Single source of truth for the app's palette. The bracket view derives its
// own (styled-components) theme from these same hex values — change them here
// and both worlds stay in sync.
export const BRAND = {
  teal: '#0E7C7B',
  tealDark: '#0A5958',
  tealLight: '#3DA8A6',
  ink: '#27303A',
  paper: '#FFFFFF',
  canvas: '#F6F8F8',
  amber: '#F59E0B',
};

const theme = createTheme({
  palette: {
    primary: { main: BRAND.teal, dark: BRAND.tealDark, light: BRAND.tealLight },
    warning: { main: BRAND.amber },
    background: { default: BRAND.canvas, paper: BRAND.paper },
    text: { primary: BRAND.ink },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

export default theme;
