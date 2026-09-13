import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Document Studio · vedryxTech',
  description: 'Prepare branded NDAs, master services and data-protection agreements with vedryxTech Document Studio.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){var t;try{t=localStorage.getItem('vedryxtech-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()` }} /></head><body>{children}</body></html>;
}
