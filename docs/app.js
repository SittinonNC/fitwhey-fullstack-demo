(function () {
  const KEY = "fitwhey-pages-cart";
  const variants = {
    "5-Choc": { sku: "FW-5-CHO", size: "5 LB", flavour: "Chocolate", price: 129900, stock: 12 },
    "5-Vanilla": { sku: "FW-5-VAN", size: "5 LB", flavour: "Vanilla", price: 134900, stock: 8 },
    "5-Strawberry": { sku: "FW-5-STR", size: "5 LB", flavour: "Strawberry", price: 134900, stock: 5 },
    "10-Choc": { sku: "FW-10-CHO", size: "10 LB", flavour: "Chocolate", price: 239900, stock: 0 },
    "10-Vanilla": { sku: "FW-10-VAN", size: "10 LB", flavour: "Vanilla", price: 249900, stock: 6 },
    "10-Strawberry": { sku: "FW-10-STR", size: "10 LB", flavour: "Strawberry", price: 249900, stock: 3 }
  };

  const money = (satang) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(satang / 100);
  const readCart = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (_) { return []; }
  };
  const saveCart = (items) => { localStorage.setItem(KEY, JSON.stringify(items)); updateCount(); };
  const count = () => readCart().reduce((sum, item) => sum + item.quantity, 0);
  const updateCount = () => document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = String(count()); });

  function addToCart(variant, quantity) {
    const items = readCart();
    const existing = items.find((item) => item.sku === variant.sku);
    if (existing) existing.quantity = Math.min(variant.stock, existing.quantity + quantity);
    else items.push({ ...variant, quantity: Math.min(variant.stock, quantity) });
    saveCart(items);
  }

  function productPage() {
    let size = "5";
    let flavour = "Choc";
    let quantity = 1;
    const q = (selector) => document.querySelector(selector);
    const current = () => variants[`${size}-${flavour}`];

    function render() {
      const variant = current();
      document.querySelectorAll("[data-size]").forEach((button) => button.classList.toggle("selected", button.dataset.size === size));
      document.querySelectorAll("[data-flavour]").forEach((button) => button.classList.toggle("selected", button.dataset.flavour === flavour));
      q("[data-size-label]").textContent = variant.size;
      q("[data-flavour-label]").textContent = variant.flavour;
      q("[data-price]").textContent = money(variant.price);
      q("[data-sku]").textContent = `SKU ${variant.sku}`;
      q("[data-qty]").textContent = String(quantity);
      q("[data-qty-minus]").disabled = quantity <= 1;
      q("[data-qty-plus]").disabled = variant.stock === 0 || quantity >= variant.stock;
      q("[data-stock]").textContent = variant.stock ? `มีสินค้า ${variant.stock} ชิ้น` : "สินค้าหมด";
      q("[data-availability]").classList.toggle("unavailable", variant.stock === 0);
      q("[data-add]").disabled = variant.stock === 0;
      q("[data-buy]").disabled = variant.stock === 0;
    }

    document.querySelectorAll("[data-size]").forEach((button) => button.addEventListener("click", () => { size = button.dataset.size; quantity = 1; render(); }));
    document.querySelectorAll("[data-flavour]").forEach((button) => button.addEventListener("click", () => { flavour = button.dataset.flavour; quantity = 1; render(); }));
    q("[data-qty-minus]").addEventListener("click", () => { quantity = Math.max(1, quantity - 1); render(); });
    q("[data-qty-plus]").addEventListener("click", () => { quantity = Math.min(current().stock, quantity + 1); render(); });
    q("[data-add]").addEventListener("click", () => {
      addToCart(current(), quantity);
      q("[data-toast-text]").textContent = `${current().size} · ${current().flavour} เพิ่มลงตะกร้าแล้ว`;
      q("[data-toast]").hidden = false;
    });
    q("[data-buy]").addEventListener("click", () => { addToCart(current(), quantity); window.location.href = "./cart.html"; });
    q("[data-toast-close]").addEventListener("click", () => { q("[data-toast]").hidden = true; });
    render();
  }

  function cartPage() {
    const q = (selector) => document.querySelector(selector);
    function render() {
      const items = readCart();
      const empty = items.length === 0;
      q("[data-empty]").hidden = !empty;
      q("[data-cart-layout]").hidden = empty;
      q("[data-cart-heading]").textContent = empty ? "" : `${count()} ชิ้น`;
      if (empty) return;
      q("[data-cart-items]").innerHTML = items.map((item) => `
        <article class="cart-item" data-sku="${item.sku}">
          <div class="cart-product-image"><img src="./images/product.webp" alt="Fitwhey ${item.flavour}"></div>
          <div class="cart-item-info"><span class="eyebrow">${item.sku}</span><h2>FITWHEY ORIGINAL</h2><p>${item.size}<span>·</span>${item.flavour}</p><small>คงเหลือในเดโม ${item.stock} ชิ้น</small></div>
          <div class="cart-item-actions"><button class="remove-button" data-remove aria-label="ลบสินค้า">×</button><div class="quantity-control"><button data-minus>−</button><output>${item.quantity}</output><button data-plus ${item.quantity >= item.stock ? "disabled" : ""}>+</button></div><strong>${money(item.price * item.quantity)}</strong></div>
        </article>`).join("");
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shipping = subtotal >= 150000 ? 0 : 5000;
      q("[data-subtotal]").textContent = money(subtotal);
      q("[data-shipping]").textContent = shipping === 0 ? "ฟรี" : money(shipping);
      q("[data-total]").textContent = money(subtotal + shipping);
      q("[data-cart-items]").querySelectorAll(".cart-item").forEach((row) => {
        const sku = row.dataset.sku;
        row.querySelector("[data-remove]").addEventListener("click", () => saveCart(readCart().filter((item) => item.sku !== sku)) || render());
        row.querySelector("[data-minus]").addEventListener("click", () => { const next = readCart(); const item = next.find((entry) => entry.sku === sku); item.quantity -= 1; saveCart(item.quantity ? next : next.filter((entry) => entry.sku !== sku)); render(); });
        row.querySelector("[data-plus]").addEventListener("click", () => { const next = readCart(); const item = next.find((entry) => entry.sku === sku); item.quantity = Math.min(item.stock, item.quantity + 1); saveCart(next); render(); });
      });
      q("[data-checkout]").onclick = () => {
        q("[data-cart-layout]").hidden = true;
        q("[data-success]").hidden = false;
        q("[data-order-number]").textContent = `FW-${Date.now().toString().slice(-8)}`;
        q("[data-success-total]").textContent = money(subtotal + shipping);
        saveCart([]);
      };
    }
    render();
  }

  updateCount();
  if (document.body.dataset.page === "product") productPage();
  if (document.body.dataset.page === "cart") cartPage();
})();
