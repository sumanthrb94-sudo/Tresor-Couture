export interface Fabric {
  id: string;
  name: string;
  description: string;
  pricePerMeter: number;
  /** Real photograph URL (Pexels/Unsplash via CDN proxy or local file). */
  photo: string;
  /** Additional photographs for the gallery. */
  photoGallery?: string[];
  /** Guaranteed-loading SVG fabric swatch used as onError fallback. */
  image: string;
  gallery?: string[];
  category: 'Silk' | 'Cotton' | 'Wool' | 'Linen' | 'Mixed' | 'Satin';
  origin: string;
  tags: string[];
  colors?: { name: string; hex: string }[];
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

export interface Order {
  id: string;
  items: (CartItem & { fabricSnapshot: Fabric })[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  placedAt: string;
}

export type Route =
  | { name: 'home' }
  | { name: 'shop'; category?: string }
  | { name: 'product'; id: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'confirmation'; orderId: string };
