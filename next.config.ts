import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: { '/api/documents': ['./templates/*.docx', './public/brand/logo.png', './node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff', './node_modules/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff'] },
};
export default config;
