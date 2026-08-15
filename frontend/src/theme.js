import { alpha, createTheme } from '@mui/material/styles';

export const BRAND = {
  teal: '#0B8F8C',
  tealDark: '#086A69',
  tealLight: '#4BC3BE',
  navy: '#091A21',
  navySoft: '#122A33',
  ink: '#17252B',
  muted: '#65757D',
  paper: '#FFFFFF',
  canvas: '#F3F7F7',
  border: '#DCE6E5',
  amber: '#F4A621',
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: BRAND.teal, dark: BRAND.tealDark, light: BRAND.tealLight },
    secondary: { main: BRAND.navySoft },
    warning: { main: BRAND.amber },
    background: { default: BRAND.canvas, paper: BRAND.paper },
    text: { primary: BRAND.ink, secondary: BRAND.muted },
    divider: BRAND.border,
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontSize: '2rem', lineHeight: 1.15, fontWeight: 750, letterSpacing: '-0.035em' },
    h2: { fontSize: '1.5rem', lineHeight: 1.25, fontWeight: 720, letterSpacing: '-0.025em' },
    h3: { fontSize: '1.125rem', lineHeight: 1.35, fontWeight: 700 },
    h4: { fontSize: '1rem', lineHeight: 1.4, fontWeight: 700 },
    button: { fontWeight: 700, letterSpacing: 0, textTransform: 'none' },
  },
  shape: { borderRadius: 12 },
  shadows: [
    'none',
    '0 1px 2px rgba(15, 35, 43, 0.04)',
    '0 4px 14px rgba(15, 35, 43, 0.06)',
    '0 10px 30px rgba(15, 35, 43, 0.08)',
    ...Array(21).fill('0 14px 38px rgba(15, 35, 43, 0.10)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minWidth: 320,
          backgroundImage:
            'radial-gradient(circle at 88% -10%, rgba(75, 195, 190, 0.10), transparent 28%)',
        },
        '::selection': { backgroundColor: alpha(BRAND.teal, 0.2) },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40, borderRadius: 10, paddingInline: 16 },
        containedPrimary: { '&:hover': { backgroundColor: BRAND.tealDark } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${BRAND.border}`,
          boxShadow: '0 5px 18px rgba(16, 39, 47, 0.045)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: BRAND.paper,
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#AFC2C0' },
        },
        notchedOutline: { borderColor: '#CDD9D8' },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 650 } } },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: BRAND.muted,
          fontSize: '0.75rem',
          fontWeight: 750,
          letterSpacing: '0.045em',
          textTransform: 'uppercase',
          backgroundColor: '#F8FAFA',
        },
        root: { borderColor: BRAND.border },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } },
  },
});

export default theme;
