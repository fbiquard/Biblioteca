import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Valuador · ¿Está subvaluada?',
  description:
    'Pegá el link de una propiedad de Zonaprop o Argenprop y descubrí si está subvaluada, en precio justo o cara respecto al mercado real de su subzona en zona norte de Buenos Aires.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className="dark">
      <body>{children}</body>
    </html>
  );
}
