/**
 * Top-level catalogue sections surfaced in the Navbar, CategoryStrip and
 * mobile drawer. Subcategories live in `MASTER_CATEGORY_TREE` in constants.ts.
 */
export type MasterCategory =
  | 'Fabrics'
  | 'Dyeable Fabrics'
  | 'Sarees'
  | 'Lehenga Cholis'
  | 'Anarkalis'
  | 'Western Wear'
  | 'Designer Wear';

export interface Fabric {
  id: string;
  /** Brand label shown in Myntra-style cards (uppercase, bold). */
  brand: string;
  name: string;
  description: string;
  /** Current selling price per meter. */
  pricePerMeter: number;
  /** Original "MRP" per meter (always >= pricePerMeter). */
  mrpPerMeter: number;
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
  sticker?: 'Trending' | 'Bestseller' | 'New In' | 'Limited' | 'Hot Deal';
  colors?: { name: string; hex: string }[];
  /** Pre-cut length presets shown as "size" pills. */
  lengthOptions?: number[];
  widthInches?: number;
  inStockMeters?: number;
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
  meters: number;
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
  placedAt: string;
  status?: OrderStatus;
  /** Optional applied coupon code (uppercase). */
  couponCode?: string;
  /** Discount amount applied via coupon (₹). */
  couponDiscount?: number;
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
  | { name: 'product'; id: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'confirmation'; orderId: string }
  | { name: 'customise'; productId?: string }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'account'; tab?: 'profile' | 'orders' | 'wishlist' | 'addresses' }
  | { name: 'admin'; section?: 'dashboard' | 'products' | 'orders' | 'coupons' | 'reviews' }
  | { name: 'admin-brand-kit'; section?: string };
