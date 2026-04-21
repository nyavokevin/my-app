export interface GymMember {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  membershipType: string;
  joinedAt: string;
  notes: string;
  active: boolean;
}

export type AttendanceSource = 'phone-number' | 'qr-phone' | 'member-id';
export type AttendanceAction = 'check-in' | 'check-out';
export type PaymentCategory = 'membership' | 'stock';
export type StockHistoryAction = 'create' | 'restock' | 'sale';

export interface AttendanceRecord {
  id: number;
  memberId: number;
  memberName: string;
  memberPhone: string;
  checkedInAt: string;
  source: AttendanceSource;
  action: AttendanceAction;
}

export interface StockItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  createdAt: string;
}

export interface StockItemInput {
  name: string;
  price: number;
  quantity: number;
}

export interface StockHistoryRecord {
  id: number;
  stockItemId: number;
  stockItemName: string;
  action: StockHistoryAction;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  customerName: string;
  customerMemberId: number | null;
  notes: string;
  createdAt: string;
}

export interface StockRestockInput {
  quantity: number;
  notes: string;
}

export interface StockSaleInput {
  quantity: number;
  customerName: string;
  customerMemberId: number | null;
  notes: string;
}

export interface PaymentRecord {
  id: number;
  label: string;
  amount: number;
  category: PaymentCategory;
  createdAt: string;
}

export interface PaymentInput {
  label: string;
  amount: number;
  category: PaymentCategory;
}

export interface MembershipType {
  id: number;
  name: string;
  price: number;
  createdAt: string;
}

export interface MembershipTypeInput {
  name: string;
  price: number;
}

export interface GymMemberInput {
  fullName: string;
  email: string;
  phone: string;
  membershipType: string;
  joinedAt: string;
  notes: string;
  active: boolean;
}

export interface GymMemberApi {
  list(): Promise<GymMember[]>;
  create(member: GymMemberInput): Promise<GymMember>;
  update(id: number, member: GymMemberInput): Promise<GymMember>;
  remove(id: number): Promise<void>;
  listAttendanceHistory(): Promise<AttendanceRecord[]>;
  checkInByPhone(phone: string, source?: AttendanceSource, action?: AttendanceAction): Promise<AttendanceRecord>;
  checkInByMemberId(memberId: number, action?: AttendanceAction): Promise<AttendanceRecord>;
  openClientPresenceWindow(): Promise<void>;
  listStockItems(): Promise<StockItem[]>;
  createStockItem(item: StockItemInput): Promise<StockItem>;
  updateStockItem(id: number, item: StockItemInput): Promise<StockItem>;
  removeStockItem(id: number): Promise<void>;
  listStockHistory(stockItemId: number): Promise<StockHistoryRecord[]>;
  restockStockItem(id: number, input: StockRestockInput): Promise<StockItem>;
  sellStockItem(id: number, input: StockSaleInput): Promise<StockItem>;
  listPayments(): Promise<PaymentRecord[]>;
  createPayment(payment: PaymentInput): Promise<PaymentRecord>;
  removePayment(id: number): Promise<void>;
  listMembershipTypes(): Promise<MembershipType[]>;
  createMembershipType(membershipType: MembershipTypeInput): Promise<MembershipType>;
  updateMembershipType(id: number, membershipType: MembershipTypeInput): Promise<MembershipType>;
  removeMembershipType(id: number): Promise<void>;
}