/**
 * Top-level catalogue sections surfaced in the Navbar, CategoryStrip and
 * mobile drawer. Subcategories live in `MASTER_CATEGORY_TREE` in constants.ts.
 */
export type MasterCategory =
  | 'Fabrics'
  | 'Dyeable Fabrics'
  | 'Lace'
  | 'Sarees'
  | 'Lehenga Cholis'
  | 'Anarkalis'
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
  /** Fabric weave / base material — kept for filter facets and garment material. */
  category: 'Silk' | 'Cotton' | 'Wool' | 'Linen' | 'Mixed' | 'Satin';
  /** Top-level catalogue section. Drives the navbar + category strip. */
  masterCategory: MasterCategory;
  /** Secondary classification under a master category (e.g. "Half Sarees"). */
  subCategory?: string;
  origin: string;
  tags: string[];
  /** Optional sticker (e.g. "Trending", "Bestseller", "New In"). */
  sticker?: 'Trending' | 'Bestseller' | 'New In' | 'Limited';
  colors?: { name: string; hex: string }[];
  /** Units available to sell. Drives the quantity stepper + out-of-stock. */
  stock?: number;
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

export type PaymentMethod = 'card' | 'upi' | 'cod';

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
  status?: OrderStatus;
  /** Optional applied coupon code (uppercase). */
  couponCode?: string;
  /** Discount amount applied via coupon (₹). */
  couponDiscount?: number;
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
  /** SHA-256 of password — never store plaintext. */
  passwordHash: string;
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
  | { name: 'account'; tab?: 'profile' | 'orders' | 'wishlist' | 'addresses' }
  | { name: 'admin'; section?: 'dashboard' | 'products' | 'inventory' | 'orders' | 'billing' | 'customers' | 'coupons' | 'reviews' | 'compliance' }
  | { name: 'admin-brand-kit'; section?: string }
  | { name: 'policy'; policy: PolicyKey }
  | { name: 'auth-action'; mode: string; oobCode: string; apiKey?: string; continueUrl?: string }
  | { name: 'not-found'; path?: string };
