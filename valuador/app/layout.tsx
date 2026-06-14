import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Radar de oportunidades inmobiliarias',
  description:
    'Cargá zona, tipo, ambientes y tu precio/m² de referencia. Escaneamos Zonaprop y te traemos los avisos por debajo del mercado en zona norte de Buenos Aires.',
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
