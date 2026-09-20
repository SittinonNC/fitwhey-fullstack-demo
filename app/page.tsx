"use client";

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, CircleAlert, Minus, PackageCheck, Plus, RefreshCw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { money } from '@/lib/types';

export default function ProductPage() {
  const { product, cart, add, ready, stale, refresh, pending } = useShop();
  const router = useRouter();
  const [size, setSize] = useState('5 lb');
  const [flavour, setFlavour] = useState('Choc');
  const [quantity, setQuantity] = useState(1);
  const [tab, setTab] = useState('รายละเอียดสินค้า');
  const variant = product.variants.find(v => v.size === size && v.flavour === flavour);
  const stock = variant?.availableQuantity ?? 0;
  const inCart = cart.find(item => item.variantId === variant?.id)?.quantity ?? 0;
  const maxAdd = Math.max(0, Math.min(stock, product.maxPerOrder) - inCart);
  const canAdd = ready && !stale && !pending && !!variant && maxAdd >= quantity;
  const sizes = [...new Set(product.variants.map(v => v.size))];
  const flavours = [...new Set(product.variants.map(v => v.flavour))];
  function addToCart(buyNow = false) {
    if (variant && canAdd && add(variant.id, quantity) && buyNow) router.push('/cart');
  }
  return <main className="container product-page">
    <div className="breadcrumb"><span>สินค้า</span><ChevronRight size={13}/><span>เวย์โปรตีน</span><ChevronRight size={13}/><strong>MY WHEY</strong></div>
    <div className="product-grid">
      <section className="gallery" aria-label="ภาพสินค้า">
        <div className="image-stage">
          <div className="stage-top"><span className="small-tag">THE DAILY ESSENTIAL</span><span className="edition">01 / BAAM!!</span></div>
          <Image src="/images/product.webp" alt="BAAM MY WHEY ภาพประกอบสินค้า รูปบรรจุภัณฑ์อาจต่างจากตัวเลือก" width={720} height={720} sizes="(max-width: 720px) 90vw, 50vw" preload className="product-image"/>
          <div className="stage-bottom"><span>FUEL YOUR NEXT REP.</span><span>WHEY PROTEIN</span></div>
        </div>
        <div className="image-caption"><span>ภาพประกอบสินค้า · บรรจุภัณฑ์อาจแตกต่างตามตัวเลือก</span><span>BAAM!! SERIES</span></div>
        <div className="product-values"><div><PackageCheck/><span>เลือกได้ 2 ขนาด<small>5 lb และ 10 lb</small></span></div><div><ShoppingBag/><span>3 รสชาติที่เลือกได้<small>เลือกให้ตรงกับสไตล์คุณ</small></span></div><div><ShieldCheck/><span>ตรวจสินค้าก่อนยืนยัน<small>อัปเดตจำนวนระหว่างเลือกซื้อ</small></span></div></div>
      </section>
      <section className="product-info">
        <div className="eyebrow"><span className="brand-badge">BAAM!!</span><span>EVERYDAY PERFORMANCE</span></div>
        <h1>MY WHEY<span>MAKE EVERY REP COUNT.</span></h1>
        <p className="description">{product.description}</p>
        <div className="price-row"><strong>{money(variant?.priceMinor ?? 0)}</strong><span>ราคาต่อชิ้น</span></div>
        <div className="divider"/>
        <fieldset className="option-group"><legend><span className="step-number">01</span> เลือกขนาด <span className="selected-label">{size}</span></legend>
          <div className="size-options">{sizes.map(value => <button key={value} className={`size-option ${size === value ? 'selected' : ''}`} aria-pressed={size === value} onClick={() => { setSize(value); setQuantity(1); }}><strong>{value}</strong><small>{value === '5 lb' ? 'ขนาดมาตรฐาน' : 'ขนาดใหญ่'}</small>{size === value && <Check size={16}/>}</button>)}</div>
        </fieldset>
        <fieldset className="option-group"><legend><span className="step-number">02</span> เลือกรสชาติ <span className="selected-label">{flavour}</span></legend>
          <div className="flavour-options">{flavours.map(value => {
            const candidate = product.variants.find(v => v.size === size && v.flavour === value);
            return <button key={value} className={`flavour-option ${flavour === value ? 'selected' : ''} ${!candidate?.availableQuantity ? 'sold-out-option' : ''}`} aria-pressed={flavour === value} onClick={() => { setFlavour(value); setQuantity(1); }}><span className={`flavour-dot ${value.toLowerCase()}`}/><span>{value}{candidate?.availableQuantity === 0 && <small>หมดชั่วคราว</small>}</span>{flavour === value && <Check size={14}/>}</button>;
          })}</div>
        </fieldset>
        <div className={`availability ${stock === 0 || stale ? 'unavailable' : ''}`} aria-live="polite">
          {stale ? <><CircleAlert size={17}/><span>ยังอัปเดตสต็อกไม่ได้</span><button onClick={() => void refresh()}>ลองใหม่</button></> : stock === 0 ? <><CircleAlert size={17}/><span>รส {flavour} ขนาด {size} หมดชั่วคราว<br/><small>เลือกรสชาติอื่น หรือกลับไปขนาด 5 lb</small></span></> : <><span className="stock-dot"/><span>พร้อมส่ง · เหลือ {stock} ชิ้น</span><span className="stock-refresh"><RefreshCw size={12}/> อัปเดตอัตโนมัติ</span></>}
        </div>
        <div className="purchase-row"><div className="quantity-control"><button aria-label="ลดจำนวน" disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)}><Minus size={17}/></button><output aria-label="จำนวนสินค้า">{quantity}</output><button aria-label="เพิ่มจำนวน" disabled={quantity >= maxAdd || stock === 0} onClick={() => setQuantity(q => q + 1)}><Plus size={17}/></button></div><button className="button primary" disabled={!canAdd} onClick={() => addToCart()}><ShoppingBag size={19}/>{stock === 0 ? 'สินค้าหมดชั่วคราว' : 'เพิ่มลงตะกร้า'}<ArrowRight size={19}/></button></div>
        <button className="button buy-now" disabled={!canAdd} onClick={() => addToCart(true)}>ซื้อเลย</button>
        {inCart > 0 && <p className="cart-hint">ตัวเลือกนี้อยู่ในตะกร้าแล้ว {inCart} ชิ้น{maxAdd < quantity && ' · เพิ่มไม่ได้เกินจำนวนที่พร้อมขาย'}</p>}
        <div className="shipping-note"><Truck size={20}/><div><strong>จัดส่งฟรีสำหรับคำสั่งซื้อทดลอง</strong><span>ไม่มีการเรียกเก็บเงินหรือจัดส่งสินค้าจริง</span></div></div>
      </section>
    </div>
    <section className="details-section">
      <div className="tabs" role="tablist" aria-label="ข้อมูลสินค้า">{['รายละเอียดสินค้า', 'วิธีรับประทาน', 'การเก็บรักษา'].map(value => <button key={value} id={`tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="product-details" onClick={() => setTab(value)}>{value}</button>)}</div>
      <div className="details-content" id="product-details" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <div><span className="eyebrow red">BUILT FOR YOUR ROUTINE</span><h2>{tab === 'รายละเอียดสินค้า' ? 'ทุกวันของคุณ ไปได้อีกขั้น' : tab}</h2></div>
        <p>{tab === 'รายละเอียดสินค้า' ? 'MY WHEY เวย์โปรตีนจาก BAAM!! เลือกขนาดและรสชาติให้เข้ากับกิจวัตรของคุณ ข้อมูลราคาและจำนวนในร้านนี้ใช้สำหรับทดลองระบบเท่านั้น โปรดดูส่วนประกอบและข้อมูลโภชนาการจากฉลากสินค้าจริง' : tab === 'วิธีรับประทาน' ? 'ดูปริมาณและวิธีชงจากฉลากของสูตรและรสชาติที่เลือก รายละเอียดอาจแตกต่างกันตามรุ่นสินค้า' : 'เก็บตามคำแนะนำบนฉลาก ปิดบรรจุภัณฑ์ให้สนิทหลังเปิด และตรวจสอบวันหมดอายุก่อนใช้'}</p>
      </div>
    </section>
  </main>;
}
