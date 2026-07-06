import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
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
        spotify: '#1DB954',
        'apple-music': '#FC3C44',
        'youtube-music': '#FF0000',
        'amazon-music': '#00A8E1',
        tidal: '#000000',
        deezer: '#EF5466',
        soundcloud: '#FF5500',
        pandora: '#3668FF',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
