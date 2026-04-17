export interface Fabric {
  id: string;
  name: string;
  description: string;
  pricePerMeter: number;
  image: string;
  category: 'Silk' | 'Cotton' | 'Wool' | 'Linen' | 'Mixed';
  origin: string;
  tags: string[];
}

export interface Collection {
  id: string;
  name: string;
  subtitle: string;
  description: string;
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
