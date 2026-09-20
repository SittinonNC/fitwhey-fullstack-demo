import type { Metadata } from 'next';
import { ShopProvider } from '@/components/shop-provider';
import { Shell } from '@/components/shell';
import { store } from '@/lib/server';
import type { Product } from '@/lib/types';
import './globals.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'FITWHEY — Fuel your next rep', description: 'เดโมร้านโปรตีนจากโจทย์ Full Stack: เลือกสินค้าและทดลองสั่งซื้อ', robots: { index: false, follow: false }, icons: { icon: '/icon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const product = store.getProduct('my-whey') as Product;
  return <html lang="th"><body><ShopProvider initialProduct={product}><Shell>{children}</Shell></ShopProvider></body></html>;
}
