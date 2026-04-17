import React from 'react';
import { Mail, Phone, MapPin, Instagram, Facebook, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer id="contact" className="bg-brand-bg text-brand-ink pt-24 border-t border-brand-border">
      <div className="w-full px-6 md:px-[60px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-20">
        <div className="col-span-1 lg:col-span-1">
          <h2 className="text-3xl font-serif tracking-widest uppercase mb-8">
            Trésor <span className="italic">Couture</span>
          </h2>
          <p className="text-sm text-brand-ink/60 font-light leading-relaxed mb-8">
            The definitive source for luxury textiles and artisanal craftsmanship in India. 
            Elevating the standard of elegance since 2012.
          </p>
          <div className="flex gap-6 text-brand-gold">
            <Instagram className="w-5 h-5 hover:text-brand-ink transition-colors cursor-pointer" />
            <Facebook className="w-5 h-5 hover:text-brand-ink transition-colors cursor-pointer" />
            <Linkedin className="w-5 h-5 hover:text-brand-ink transition-colors cursor-pointer" />
          </div>
        </div>

        <div>
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-8 text-brand-gold">Concierge</h3>
          <ul className="space-y-4 text-sm text-brand-ink/60 font-light">
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Bespoke Inquiries</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Swatch Services</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Bridal Consultations</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Wholesale & Export</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Care Instructions</li>
          </ul>
        </div>

        <div>
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-8 text-brand-gold">Quick Links</h3>
          <ul className="space-y-4 text-sm text-brand-ink/60 font-light">
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Our Heritage</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Modern Weaves</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Sourcing Policy</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Sustainability</li>
            <li className="hover:text-brand-gold transition-colors cursor-pointer">Press</li>
          </ul>
        </div>

        <div>
          <h3 className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-8 text-brand-gold">Atelier</h3>
          <div className="space-y-6">
            <div className="flex gap-4">
              <MapPin className="w-5 h-5 text-brand-gold shrink-0" />
              <p className="text-sm text-brand-ink/60 font-light leading-snug">
                The Heritage Arcade, Shop 14-16, <br />
                Chanakyapuri, New Delhi, India 110021
              </p>
            </div>
            <div className="flex gap-4">
              <Mail className="w-5 h-5 text-brand-gold shrink-0" />
              <p className="text-sm text-brand-ink/60 font-light">concierge@tresorcouture.com</p>
            </div>
            <div className="flex gap-4">
              <Phone className="w-5 h-5 text-brand-gold shrink-0" />
              <p className="text-sm text-brand-ink/60 font-light">+91 (011) 4567 8901</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 md:px-[60px] py-10 md:h-[80px] border-t border-brand-border flex flex-col md:flex-row justify-between items-center gap-8 md:gap-6 text-center md:text-left">
        <p className="text-[10px] uppercase tracking-widest text-brand-ink/40">
          © 2026 Trésor Couture India. All rights reserved.
        </p>
        <div className="flex flex-wrap justify-center gap-8 text-[10px] uppercase tracking-widest text-brand-ink/40">
          <span className="hover:text-brand-ink transition-colors cursor-pointer font-medium italic">Instagram</span>
          <span className="hover:text-brand-ink transition-colors cursor-pointer font-medium italic">Vogue India</span>
          <span className="hover:text-brand-ink transition-colors cursor-pointer font-medium italic">Contact</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
