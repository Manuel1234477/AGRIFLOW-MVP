import { storageService, STORE_KEYS } from './storageService';
import type { User, SupplyListing, DemandRequest } from '../types';

export function hashPassword(pw: string): string {
  return `pwd_hash_${pw}`;
}

export function seedInitialLocalDataIfEmpty(): void {
  const users = storageService.get<User[]>(STORE_KEYS.USERS);
  if (!users || users.length === 0) {
    const demoUsers: User[] = [
      {
        id: 'USR-BUY-001',
        email: 'buyer@kolafarms.com',
        passwordHash: hashPassword('agriflow123'),
        name: 'Kola Farms Ltd',
        role: 'buyer',
        organizationName: 'Kola Farms Ltd',
        phone: '+234 802 345 6789',
        location: 'Ikeja, Lagos',
        verified: true,
        profileComplete: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'USR-SUP-001',
        email: 'supplier@adeyemi.com',
        passwordHash: hashPassword('agriflow123'),
        name: 'Adeyemi Produce Co.',
        role: 'supplier',
        organizationName: 'Adeyemi Produce Co.',
        phone: '+234 801 234 5678',
        location: 'Ogbomoso, Oyo State',
        verified: true,
        profileComplete: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'USR-LOG-001',
        email: 'logistics@swifthaul.com',
        passwordHash: hashPassword('agriflow123'),
        name: 'SwiftHaul Logistics',
        role: 'logistics',
        organizationName: 'SwiftHaul Logistics',
        phone: '+234 803 456 7890',
        location: 'Lagos / Oyo / Kwara Corridor',
        verified: true,
        profileComplete: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'USR-ADM-001',
        email: 'admin@agriflow.ng',
        passwordHash: hashPassword('agriflow123'),
        name: 'AgriFlow Operations',
        role: 'admin',
        organizationName: 'AgriFlow',
        phone: '+234 800 000 0000',
        location: 'Lagos, Nigeria',
        verified: true,
        profileComplete: true,
        createdAt: new Date().toISOString(),
      },
    ];
    storageService.set(STORE_KEYS.USERS, demoUsers);
  }

  const listings = storageService.get<SupplyListing[]>(STORE_KEYS.LISTINGS);
  if (!listings || listings.length === 0) {
    const demoListings: SupplyListing[] = [
      {
        id: 'SUP-AGF-101',
        supplierId: 'USR-SUP-001',
        supplierName: 'Adeyemi Produce Co.',
        supplierVerified: true,
        commodity: 'maize',
        quantity: 18,
        unit: 'tonnes',
        qualityGrade: 'A',
        pricePerUnit: 480000,
        currency: 'NGN',
        location: 'Ogbomoso, Oyo State',
        availabilityDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        description: 'Grade A White Maize. Clean, dried to standard 12% moisture content.',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'SUP-AGF-102',
        supplierId: 'USR-SUP-001',
        supplierName: 'Adeyemi Produce Co.',
        supplierVerified: true,
        commodity: 'soybean',
        quantity: 12,
        unit: 'tonnes',
        qualityGrade: 'A',
        pricePerUnit: 465000,
        currency: 'NGN',
        location: 'Ogbomoso, Oyo State',
        availabilityDate: new Date(Date.now() + 6 * 86400000).toISOString(),
        description: 'High-protein Non-GMO Soybeans, Grade A certified.',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    storageService.set(STORE_KEYS.LISTINGS, demoListings);
  }

  const demands = storageService.get<DemandRequest[]>(STORE_KEYS.DEMANDS);
  if (!demands || demands.length === 0) {
    const demoDemands: DemandRequest[] = [
      {
        id: 'DEM-AGF-101',
        buyerId: 'USR-BUY-001',
        buyerName: 'Kola Farms Ltd',
        commodity: 'maize',
        quantity: 12,
        unit: 'tonnes',
        qualityGrade: 'A',
        destinationLocation: 'Ikeja, Lagos',
        requiredByDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        indicativeBudget: 6000000,
        currency: 'NGN',
        notes: 'White Maize Grade A. Required for food processing plant in Ikeja.',
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    storageService.set(STORE_KEYS.DEMANDS, demoDemands);
  }
}

export function resetPlatformData(): void {
  storageService.remove(STORE_KEYS.PAYMENTS);
  storageService.remove(STORE_KEYS.LOGISTICS_JOBS);
  storageService.remove(STORE_KEYS.DISPUTES);
  storageService.remove(STORE_KEYS.NOTIFICATIONS);
  storageService.remove(STORE_KEYS.AUDIT_EVENTS);
  seedInitialLocalDataIfEmpty();
}

