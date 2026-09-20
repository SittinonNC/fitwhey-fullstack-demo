"use client";
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, LoaderCircle, LockKeyhole, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { money, type Order } from '@/lib/types';

export default function CartPage() {
  const { product, cart, ready, stale, pending, busy, change, checkout } = useShop();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const rows = cart.map(item => ({ ...item, variant: product.variants.find(v => v.id === item.variantId) }));
  const total = rows.reduce((sum, item) => sum + (item.variant?.priceMinor ?? 0) * item.quantity, 0);
  const invalid = rows.some(item => !item.variant || item.quantity > Math.min(item.variant.availableQuantity, 10));
  async function submit() {
    setError('');
    try { setOrder(await checkout()); } catch (e) { setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'); }
  }
  if (!ready) return <main className="container empty-state"><LoaderCircle className="spin"/><p>กำลังเปิดตะกร้าของคุณ…</p></main>;
  if (order) return <main className="container success-page"><div className="success-card"><div className="success-icon"><Check size={36}/></div><span className="eyebrow red">YOU’RE ALL SET</span><h1>คำสั่งซื้อเรียบร้อยแล้ว</h1><p>บันทึกคำสั่งซื้อทดลองและอัปเดตสต็อกแล้ว<br/>ไม่มีการเรียกเก็บเงินหรือจัดส่งสินค้าจริง</p><div className="receipt-heading"><span>หมายเลขคำสั่งซื้อ</span><strong>{order.orderNumber}</strong></div>{order.items.map(item => <div className="receipt-item" key={item.variantId}><span>{item.productName}<small>{item.size} / {item.flavour} × {item.quantity}</small></span><strong>{money(item.lineTotalMinor)}</strong></div>)}<div className="receipt-total"><span>ยอดรวม</span><strong>{money(order.totalMinor)}</strong></div><Link className="button primary" href="/">เลือกสินค้าต่อ <ArrowRight size={18}/></Link></div></main>;
  if (cart.length === 0 && !pending) return <main className="container empty-state"><div className="empty-icon"><ShoppingBag size={42}/></div><span className="eyebrow red">YOUR NEXT REP STARTS HERE</span><h1>ตะกร้ายังว่างอยู่</h1><p>เลือกขนาดและรสชาติที่ชอบ แล้วเริ่มต้นไปด้วยกัน</p><Link className="button primary" href="/">เลือกสินค้า <ArrowRight size={18}/></Link></main>;
  return <main className="container cart-page"><Link href="/" className="back-link"><ArrowLeft size={16}/> เลือกสินค้าต่อ</Link><div className="cart-title"><div><span className="eyebrow red">ONE STEP CLOSER</span><h1>ตะกร้าของคุณ<span>{cart.reduce((s, i) => s + i.quantity, 0)} ชิ้น</span></h1></div><span className="checkout-step"><span>01</span> ตรวจสอบสินค้า <Chevron/> <span>02</span> ยืนยันคำสั่งซื้อ</span></div>
    <div className="cart-layout"><section className="cart-items" aria-label="รายการสินค้า"><div className="cart-table-heading"><span>สินค้า</span><span>จำนวน / ราคา</span></div>
      {rows.map(({ variant, variantId, quantity }) => <article className="cart-item" key={variantId}><div className="cart-product-image"><Image src="/images/product.webp" alt="BAAM MY WHEY" width={160} height={160}/></div><div className="cart-item-info"><span className="eyebrow">BAAM!!</span><h2>{product.name}</h2><p>{variant?.size} <span>/</span> {variant?.flavour}</p><small>{variant ? money(variant.priceMinor) : 'ไม่พบสินค้า'} ต่อชิ้น</small>{variant && quantity > variant.availableQuantity && <span className="item-error">พร้อมขายเพียง {variant.availableQuantity} ชิ้น กรุณาลดจำนวนหรือนำออก</span>}</div><div className="cart-item-actions"><button className="remove-button" aria-label={`ลบ ${variant?.size} ${variant?.flavour}`} disabled={!!pending || busy} onClick={() => change(variantId, 0)}><Trash2 size={17}/></button><div className="quantity-control"><button aria-label={`ลดจำนวน ${variant?.flavour}`} disabled={!!pending || busy || quantity <= 1} onClick={() => change(variantId, Math.min(quantity - 1, variant?.availableQuantity ?? 0))}><Minus size={15}/></button><output>{quantity}</output><button aria-label={`เพิ่มจำนวน ${variant?.flavour}`} disabled={!!pending || busy || quantity >= Math.min(variant?.availableQuantity ?? 0, 10)} onClick={() => change(variantId, quantity + 1)}><Plus size={15}/></button></div><strong>{money((variant?.priceMinor ?? 0) * quantity)}</strong></div></article>)}
      <div className="cart-delivery"><Truck/><div><strong>จัดส่งฟรี</strong><p>สำหรับทุกคำสั่งซื้อในเดโมนี้</p></div><CheckCircle2 size={20}/></div>
      <p className="cart-inventory-note"><CircleAlert size={16}/> สินค้าในตะกร้ายังไม่ถูกจอง ระบบจะตรวจจำนวนอีกครั้งเมื่อยืนยัน</p>
    </section><aside className="order-summary"><h2>สรุปคำสั่งซื้อ</h2><div className="summary-line"><span>ราคาสินค้า</span><strong>{money(total)}</strong></div><div className="summary-line"><span>ค่าจัดส่ง</span><strong className="green">ฟรี</strong></div><div className="summary-total"><span>ยอดรวมทั้งหมด</span><strong>{money(total)}</strong></div><p className="summary-caption">ราคาตัวอย่าง · ไม่มีค่าใช้จ่ายจริง</p>
      {pending && <div className="form-alert"><CircleAlert size={18}/><span>มีคำขอที่ยังไม่ได้รับผล กดตรวจสอบเพื่อเรียกผลคำสั่งซื้อเดิม โดยไม่สั่งซ้ำ</span></div>}
      {error && <div className="form-alert" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
      {stale && !pending && <div className="form-alert" role="alert">ยังอัปเดตสต็อกไม่ได้ กรุณารอสักครู่</div>}
      <button className="button primary checkout-button" disabled={busy || (!pending && (invalid || stale || !cart.length))} onClick={() => void submit()}>{busy ? <><LoaderCircle className="spin" size={19}/> กำลังยืนยัน…</> : <>{pending ? 'ตรวจสอบคำสั่งซื้ออีกครั้ง' : 'ยืนยันคำสั่งซื้อทดลอง'}<ArrowRight size={18}/></>}</button><div className="secure-note"><LockKeyhole size={15}/> ไม่ต้องกรอกข้อมูลบัตรหรือข้อมูลส่วนตัว</div><div className="demo-note"><strong>ลองได้เหมือนซื้อจริง</strong><p>คำสั่งซื้อจะถูกบันทึกและจำนวนสินค้าจะลดลงจริงในระบบทดลองนี้</p></div></aside></div>
  </main>;
}
function Chevron() { return <span aria-hidden="true" className="step-divider">/</span>; }
