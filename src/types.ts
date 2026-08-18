/**
 * Top-level catalogue sections surfaced in the Navbar, CategoryStrip and
 * mobile drawer. The curated subcategory vocabulary lives in
 * `MASTER_CATEGORY_TREE` (constants.ts); the menus a shopper actually sees are
 * derived from the catalogue by `subcategoriesFor()` (lib/subcategories.ts).
 */
export type MasterCategory =
  | 'Fabrics'
  | 'Dyeable Fabrics'
  | 'Laces'
  | 'Sarees'
  | 'One Minute Saree'
  | 'Half Saree'
  | 'Lehenga Cholis'
  | 'Langha Jacket'
  | 'Anarkalis'
  | 'Gown'
  | 'Three Piece Set'
  | 'Ethnic Wear'
  | 'Masakhali'
  | 'Western Wear'
  | 'Studios Prêt';

export interface Fabric {
  id: string;
  /** Brand label shown in Myntra-style cards (uppercase, bold). */
  brand: string;
  name: string;
  description: string;
  /** Current selling price per piece (per unit). */
  price: number;
  /** Original "MRP" per piece (always >= price). */
  mrp: number;
  /** Real photograph URL. */
  photo: string;
  /** Additional photographs for the gallery. */
  photoGallery?: string[];
  /** Guaranteed-loading SVG fabric swatch used as onError fallback. */
  image: string;
  gallery?: string[];
  /** Product application category — drives admin category dropdown and storefront navigation. */
  category: MasterCategory;
  /** Top-level catalogue section. Mirrors category for storefront consistency. */
  masterCategory: MasterCategory;
  /** Secondary classification under a master category (e.g. "Banarasi"). */
  subCategory?: string;
  /** Fabric material type — informational only (e.g. Silk, Cotton, Wool). Not a category. */
  materialType?: string;
  tags: string[];
  /** Optional sticker (e.g. "Trending", "Bestseller", "New In"). */
  sticker?: 'Trending' | 'Bestseller' | 'New In' | 'Limited';
  colors?: { name: string; hex: string }[];
  /** Units available to sell. Drives the quantity stepper + out-of-stock. */
  stock?: number;
  /** Unique product code / SKU shown in exports (e.g. HA6758). Especially important for laces. */
  productCode?: string;
  /** Our own scannable code, printed as Code 128 on shelf labels (e.g. TC00001).
   *  Deliberately separate from `productCode`, which is the SUPPLIER's code:
   *  that one is optional, non-unique and absent on own-production pieces, so
   *  it cannot be the thing a till scans. Assigned by scripts/assign-barcodes.ts. */
  barcode?: string;
  /** How the product is sold: per unit, per meter, or as a bundle of meters (laces). */
  unitType?: 'unit' | 'per meter' | 'bundle';
  /** Whether the product is published to the storefront. Absent means Active —
   *  every product written before this field existed stays visible. `Draft` is
   *  what a bulk import assigns to a piece with no photograph yet: it counts for
   *  stock, barcodes and counter billing, but no shopper sees it. See
   *  `isListed()` in lib/availability.ts. */
  listingStatus?: 'Active' | 'Draft' | 'Retired';
  /** Back-office photo grading, straight from the catalogue workbook. Drives
   *  the reshoot queue; has no effect on the storefront. */
  photoQuality?: 'Studio' | 'Acceptable' | 'Needs reshoot';
  /** HSN code for GST invoicing. Carried from the workbook so it is ready when
   *  the CA confirms per-category rates; nothing reads it yet. */
  hsnCode?: string;
  /** GST rate for this piece, as a fraction (0.05, 0.12, 0.18).
   *  RECORDED BUT NOT YET APPLIED: checkout and the tax invoice still use the
   *  site-wide GST_RATE. Wiring it through `computeBreakdown` is deliberately
   *  held until the CA confirms the rate per category, because a wrong rate on
   *  a customer's invoice is a compliance problem, not a display bug. The
   *  importer warns on every row whose rate differs from the site-wide one. */
  gstRate?: number;
  /** Stock level at which to reorder — reporting only, never blocks a sale. */
  reorderLevel?: number;
  /** Where the piece was bought. Back-office only, never shown to customers. */
  supplier?: string;
  /** Buying / cost price for margin reporting. */
  costPrice?: number;
  /** Selling price per meter when unitType is 'per meter' or 'bundle'. */
  sellingPricePerMeter?: number | null;
  /** Number of meters in one bundle when unitType is 'bundle'. */
  bundleSizeMeters?: number | null;
  /** Total selling price of one bundle when unitType is 'bundle'. */
  bundlePrice?: number | null;
  /** Fabric/weave descriptor shown in product details (e.g. "Banarasi brocade"). */
  weaveType?: string;
  rating?: number;
  reviewCount?: number;
}

export interface Collection {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  coverPhoto: string;
  coverImage: string;
  items: Fabric[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar: string;
}

export interface CartItem {
  fabricId: string;
  quantity: number;
  color?: string;
}

export interface ShippingAddress {
  fullName: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** What a customer may choose at web checkout. */
export type WebPaymentMethod = 'card' | 'upi' | 'cod';

/** What an operator may take across the counter. No COD — the piece is handed
 *  over as it is paid for, so there is nothing to collect on delivery. */
export type CounterPaymentMethod = 'cash' | 'upi' | 'card';

/** Anything an order may have been settled with, from either channel. Web
 *  checkout must narrow to `WebPaymentMethod`: widening the checkout to accept
 *  this union would let a browser claim a sale was paid in cash. */
export type PaymentMethod = WebPaymentMethod | CounterPaymentMethod;

export type OrderStatus =
  | 'placed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Order {
  id: string;
  /** Optional foreign key to User; undefined for guest checkouts. */
  userId?: string;
  items: (CartItem & { fabricSnapshot: Fabric })[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  /** Settlement state. 'pending' until a gateway (Cashfree, later) or COD
   *  delivery confirms payment. Online gateway is not wired yet. */
  paymentStatus?: 'pending' | 'paid' | 'failed';
  placedAt: string;
  /** Server-stamped delivery time (Firestore Timestamp at runtime). Drives the
   *  7-day return window in both the UI and firestore.rules. */
  deliveredAt?: unknown;
  status?: OrderStatus;
  /** Optional applied coupon code (uppercase). */
  couponCode?: string;
  /** Discount amount applied via coupon (₹). */
  couponDiscount?: number;
  /** Where the sale happened. Absent means 'web' — every order placed before
   *  the counter existed. An 'in-store' order carries no `userId` (it belongs
   *  to no account) and is created only by /api/pos/sale. */
  channel?: 'web' | 'in-store';
  /** Admin uid that rang up a counter sale. Audit trail only — deliberately
   *  NOT `userId`, which would put the sale in that admin's order history and
   *  make it returnable by their account. */
  counterStaffUid?: string;
  /** Soft-delete marker. Set when the unit is returned to the supplier — row
   *  stays in the DB for reporting (sales report shows it in red) but is
   *  excluded from realised-revenue figures. */
  deletedAt?: string;
}

/* ─────────── e-commerce entities ─────────── */

export type UserRole = 'customer' | 'admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  /** ISO timestamp. */
  createdAt: string;
  defaultAddress?: ShippingAddress;
}

export type CouponKind = 'percent' | 'flat';

export interface Coupon {
  /** Uppercase code customers type. */
  code: string;
  description: string;
  kind: CouponKind;
  /** For percent: 10 = 10%; for flat: amount in ₹. */
  value: number;
  /** Optional minimum subtotal in ₹. */
  minSubtotal?: number;
  /** Optional cap on the discount for percent coupons. */
  maxDiscount?: number;
  /** ISO date string; coupon is invalid after this. */
  expiresAt?: string;
  /** Disable without deleting. */
  active: boolean;
}

/** Cookie/marketing consent record (DPDP). One per signed-in user, keyed by
 *  uid; guests keep the same shape in localStorage until they sign in. */
export interface Consent {
  /** Owner uid (matches the doc id). */
  uid?: string;
  /** Strictly-necessary cookies are always on; this is the analytics/functional opt-in. */
  analytics: boolean;
  /** Marketing emails / SMS opt-in. */
  marketing: boolean;
  /** Version of the policy the user agreed to (so we can re-prompt on changes). */
  policyVersion: string;
  /** ISO timestamp of the choice. */
  updatedAt: string;
}

/** The static legal/policy pages surfaced in the footer and Compliance section. */
export type PolicyKey =
  | 'privacy'
  | 'terms'
  | 'refund'
  | 'shipping'
  | 'cookies'
  | 'contact';

export interface Review {
  id: string;
  fabricId: string;
  userId?: string;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body: string;
  createdAt: string;
  /** Set by admin moderation. */
  status: 'pending' | 'approved' | 'rejected';
}

/* ─────────── returns & refunds (RMA) ─────────── */

/**
 * Return / replacement request lifecycle. Every state transition is admin-driven
 * (the customer only ever creates one in `requested`, and may `cancelled` it while
 * still `requested`). Each transition emails the customer via the mail/ queue.
 */
export type ReturnStatus =
  | 'requested'       // customer raised it; awaiting admin review
  | 'approved'        // admin accepted; pickup being arranged
  | 'rejected'        // admin declined (with a reason)
  | 'pickup_scheduled'// courier pickup arranged
  | 'in_transit'      // item on its way back to the atelier
  | 'received'        // item back + inspected
  | 'refunded'        // money returned (refund resolution)
  | 'replaced'        // replacement dispatched (replacement resolution)
  | 'cancelled'       // customer withdrew before approval
  | 'closed';         // terminal / archived

export type ReturnResolution = 'refund' | 'replacement';

export interface ReturnLineItem {
  fabricId: string;
  name: string;
  /** Units being returned (≤ the quantity that was ordered). */
  quantity: number;
  /** Per-item reason chosen from a fixed vocabulary + free text. */
  reason: string;
}

export interface ReturnEvent {
  status: ReturnStatus;
  at: string;
  /** Optional admin/customer note attached to the transition. */
  note?: string;
  /** 'admin' | 'customer' | 'system'. */
  by?: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  /** Owner uid — taken from the signed-in customer, never the client body. */
  userId: string;
  /** Snapshot of the customer's email so admin can act without a join. */
  customerEmail?: string;
  customerName?: string;
  items: ReturnLineItem[];
  resolution: ReturnResolution;
  /** Overall reason summary. */
  reason: string;
  status: ReturnStatus;
  /** Refund amount (₹) once decided by admin. */
  refundAmount?: number;
  /** e.g. 'Original payment method', 'Store credit', 'UPI'. */
  refundMethod?: string;
  /** Courier / AWB reference for the reverse pickup. */
  trackingRef?: string;
  /** Internal admin-only note (not emailed). */
  adminNote?: string;
  /** Full transition timeline for audit + customer tracking. */
  history: ReturnEvent[];
  createdAt: string;
  updatedAt?: string;
}

/* ─────────── live chat ─────────── */

export type ChatStatus = 'open' | 'closed';
export type ChatSenderRole = 'customer' | 'admin';

/** One conversation per ORDER, keyed by orderId. */
export interface ChatConversation {
  id: string;            // == orderId
  orderId: string;
  /** Owner uid (the customer who placed the order). */
  userId: string;
  customerName?: string;
  customerEmail?: string;
  status: ChatStatus;
  lastMessage?: string;
  lastSenderRole?: ChatSenderRole;
  /** Unread counters, incremented on send and cleared on open. */
  unreadForAdmin?: number;
  unreadForCustomer?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: ChatSenderRole;
  text: string;
  createdAt: string;
}

/* ─────────── CRM (admin-only) ─────────── */

export type CustomerLifecycle = 'lead' | 'active' | 'vip' | 'at_risk' | 'churned';

export interface CrmNote {
  id: string;
  text: string;
  author: string;
  at: string;
}

/** Admin-only CRM overlay for a customer, keyed by uid (collection `crm`). */
export interface CustomerCrm {
  uid: string;
  tags: string[];
  lifecycle: CustomerLifecycle;
  notes: CrmNote[];
  updatedAt?: string;
}

/**
 * Admin console sections. Single source of truth: the URL parser, the nav and
 * the section switch all derive from this, so adding a section cannot leave one
 * of them silently stale (which is how `delivery` and `bulk-email` ended up
 * routable at runtime but absent from the parser's type).
 */
export type AdminSection =
  | 'dashboard'
  | 'counter'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'returns'
  | 'billing'
  | 'customers'
  | 'support'
  | 'coupons'
  | 'reviews'
  | 'compliance'
  | 'delivery'
  | 'bulk-email'
  | 'seo';

export const ADMIN_SECTIONS: AdminSection[] = [
  'dashboard', 'counter', 'products', 'inventory', 'orders', 'returns', 'billing',
  'customers', 'support', 'coupons', 'reviews', 'compliance', 'delivery',
  'bulk-email', 'seo',
];

export type Route =
  | { name: 'home' }
  | { name: 'shop'; category?: string; subCategory?: string }
  | { name: 'search'; q: string }
  | { name: 'product'; id: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'confirmation'; orderId: string }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'account'; tab?: 'profile' | 'orders' | 'returns' | 'wishlist' | 'addresses' }
  | { name: 'admin'; section?: AdminSection }
  | { name: 'admin-brand-kit'; section?: string }
  | { name: 'policy'; policy: PolicyKey }
  | { name: 'auth-action'; mode: string; oobCode: string; apiKey?: string; continueUrl?: string }
  | { name: 'not-found'; path?: string };
