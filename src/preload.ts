import { contextBridge, ipcRenderer } from 'electron';

import type {
	AttendanceAction,
	AttendanceSource,
	GymMemberApi,
	GymMemberInput,
	MembershipTypeInput,
	PaymentInput,
	StockItemInput,
	StockRestockInput,
	StockSaleInput,
} from './shared/gym-members';

const gymMembersApi: GymMemberApi = {
	list: () => ipcRenderer.invoke('gym-members:list'),
	create: (member: GymMemberInput) => ipcRenderer.invoke('gym-members:create', member),
	update: (id: number, member: GymMemberInput) => ipcRenderer.invoke('gym-members:update', id, member),
	remove: (id: number) => ipcRenderer.invoke('gym-members:remove', id),
	listAttendanceHistory: () => ipcRenderer.invoke('gym-members:attendance-history'),
	checkInByPhone: (phone: string, source: AttendanceSource = 'phone-number', action: AttendanceAction = 'check-in') => ipcRenderer.invoke('gym-members:attendance-checkin', phone, source, action),
	checkInByMemberId: (memberId: number, action: AttendanceAction = 'check-in') => ipcRenderer.invoke('gym-members:attendance-checkin-by-id', memberId, action),
	openClientPresenceWindow: () => ipcRenderer.invoke('gym-members:open-client-presence-window'),
	listStockItems: () => ipcRenderer.invoke('gym-members:stock:list'),
	createStockItem: (item: StockItemInput) => ipcRenderer.invoke('gym-members:stock:create', item),
	updateStockItem: (id: number, item: StockItemInput) => ipcRenderer.invoke('gym-members:stock:update', id, item),
	removeStockItem: (id: number) => ipcRenderer.invoke('gym-members:stock:remove', id),
	listStockHistory: (stockItemId: number) => ipcRenderer.invoke('gym-members:stock:history', stockItemId),
	restockStockItem: (id: number, input: StockRestockInput) => ipcRenderer.invoke('gym-members:stock:restock', id, input),
	sellStockItem: (id: number, input: StockSaleInput) => ipcRenderer.invoke('gym-members:stock:sell', id, input),
	listPayments: () => ipcRenderer.invoke('gym-members:payments:list'),
	createPayment: (payment: PaymentInput) => ipcRenderer.invoke('gym-members:payments:create', payment),
	removePayment: (id: number) => ipcRenderer.invoke('gym-members:payments:remove', id),
	listMembershipTypes: () => ipcRenderer.invoke('gym-members:membership-types:list'),
	createMembershipType: (membershipType: MembershipTypeInput) => ipcRenderer.invoke('gym-members:membership-types:create', membershipType),
	updateMembershipType: (id: number, membershipType: MembershipTypeInput) => ipcRenderer.invoke('gym-members:membership-types:update', id, membershipType),
	removeMembershipType: (id: number) => ipcRenderer.invoke('gym-members:membership-types:remove', id),
};

contextBridge.exposeInMainWorld('gymMembers', gymMembersApi);
