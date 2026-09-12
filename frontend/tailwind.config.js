/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          primary: '#121212',
          secondary: '#1e1e1e',
          accent: '#90caf9',
        }
      },
    },
  },
  plugins: [],
  // Important: This allows Tailwind to work alongside Material UI
  corePlugins: {
    preflight: false,
  },
};
