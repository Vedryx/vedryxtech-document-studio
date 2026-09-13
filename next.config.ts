import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingIncludes: { '/api/documents': ['./templates/*.docx'] },
};
export default config;
