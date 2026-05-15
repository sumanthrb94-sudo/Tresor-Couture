// Server-side mirror of the frontend domain types. Keep the field names
// aligned with src/types.ts so the storefront can swap localStorage for
// Firestore without translation layers.

export type MasterCategory =
  | 'Fabrics'
  | 'Dyeable Fabrics'
  | 'Lace'
  | 'Sarees'
  | 'Lehenga Cholis'
  | 'Anarkalis'
  | 'Western Wear'
  | 'Studios Prêt';

export interface Product {
  id: string;
  brand: string;
  name: string;
  description: string;
  pricePerMeter: number;
  mrpPerMeter: number;
  photo: string;
  photoGallery?: string[];
  image: string;
  gallery?: string[];
  category: 'Silk' | 'Cotton' | 'Wool' | 'Linen' | 'Mixed' | 'Satin';
  masterCategory: MasterCategory;
  subCategory?: string;
  origin: string;
  tags: string[];
  sticker?: 'Trending' | 'Bestseller' | 'New In' | 'Limited';
  colors?: { name: string; hex: string }[];
  lengthOptions?: number[];
  widthInches?: number;
  inStockMeters?: number;
  weaveType?: string;
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
  updatedAt?: string;
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

export type OrderStatus =
  | 'placed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Order {
  id: string;
  userId?: string;
  items: { fabricId: string; meters: number; color?: string; fabricSnapshot: Product }[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: 'card' | 'upi' | 'cod';
  placedAt: string;
  status: OrderStatus;
  couponCode?: string;
  couponDiscount?: number;
}

export type CouponKind = 'percent' | 'flat';
export interface Coupon {
  code: string;
  description: string;
  kind: CouponKind;
  value: number;
  minSubtotal?: number;
  maxDiscount?: number;
  expiresAt?: string;
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
  status: 'pending' | 'approved' | 'rejected';
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'customer' | 'admin';
  createdAt: string;
  defaultAddress?: ShippingAddress;
}
