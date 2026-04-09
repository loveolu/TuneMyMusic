module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        base: '#0A0A0B',
        surface: '#141416',
        elevated: '#1C1C1F',
        border: '#2A2A2E',
        'text-primary': '#F5F5F0',
        'text-secondary': '#8A8A8F',
        accent: '#E8FF47',
        'accent-dim': '#B8CC2F',
        success: '#4ADE80',
        warning: '#FBBF24',
        error: '#F87171',
      },
    },
  },
  plugins: [],
};
