<script setup lang="ts">
import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { memberApi } from './renderer/member-api';
import type {
  AttendanceAction,
  AttendanceRecord,
  AttendanceSource,
  GymMember,
  GymMemberInput,
  MembershipDurationUnit,
  MembershipSubscriptionInput,
  MembershipType,
  MembershipTypeInput,
  PaymentCategory,
  PaymentMethod,
  PaymentRecord,
  StockHistoryRecord,
  StockItem,
  StockItemInput,
  StockRestockInput,
  StockSaleInput,
} from './shared/gym-members';

type AppView = 'dashboard' | 'search' | 'memberships' | 'checkins' | 'stock' | 'payments' | 'presence-client' | 'settings';

type NavItem = {
  view: AppView;
  label: string;
  iconClass: string;
  badge?: string;
};

type AttendancePoint = {
  day: string;
  morning: number;
  evening: number;
};

type PlanSummary = {
  name: string;
  count: number;
  change: number;
  tone: 'pink' | 'cyan' | 'lime' | 'gold' | 'mint';
};

type AttendanceDayGroup = {
  dayKey: string;
  dayLabel: string;
  records: AttendanceRecord[];
};

type PaymentFormState = {
  label: string;
  amount: number;
  category: PaymentCategory;
  paymentMethod: PaymentMethod;
  memberId: number | null;
  membershipTypeId: number | null;
  startedAt: string;
};

type RenewalFormState = {
  membershipTypeId: number | null;
  paymentMethod: PaymentMethod;
  startedAt: string;
};

const isPresenceClientWindow = new URLSearchParams(window.location.search).get('view') === 'presence-client';

const members = ref<GymMember[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const isCheckInSaving = ref(false);
const errorMessage = ref('');
const editingMemberId = ref<number | null>(null);
const currentView = ref<AppView>(isPresenceClientWindow ? 'presence-client' : 'dashboard');
const searchQuery = ref('');
const submittedSearchQuery = ref('');
const isMemberModalOpen = ref(false);
const isMemberDetailsModalOpen = ref(false);
const isRenewalModalOpen = ref(false);
const isStockModalOpen = ref(false);
const isStockDetailsModalOpen = ref(false);
const isStockSaleModalOpen = ref(false);
const isStockRestockModalOpen = ref(false);
const currentPage = ref(1);
const membersPerPage = 6;
const stockCurrentPage = ref(1);
const stockItemsPerPage = 10;
const attendanceHistory = ref<AttendanceRecord[]>([]);
const isAttendanceLoading = ref(true);
const checkInPhone = ref('');
const presenceLookup = ref('');
const selectedAttendanceAction = ref<AttendanceAction>('check-in');
const stockItems = ref<StockItem[]>([]);
const payments = ref<PaymentRecord[]>([]);
const membershipTypes = ref<MembershipType[]>([]);
const isStockLoading = ref(true);
const isPaymentLoading = ref(true);
const isMembershipTypeLoading = ref(true);
const isStockSaving = ref(false);
const isPaymentSaving = ref(false);
const isMembershipTypeSaving = ref(false);
const editingStockId = ref<number | null>(null);
const editingMembershipTypeId = ref<number | null>(null);
const createWithMembershipPayment = ref(true);
const selectedSearchMemberId = ref<number | null>(null);
const selectedStockItemId = ref<number | null>(null);
const renewalMemberId = ref<number | null>(null);
const stockSearchQuery = ref('');
const stockSaleCustomerQuery = ref('');
const stockHistory = ref<StockHistoryRecord[]>([]);
const isStockHistoryLoading = ref(false);

const paymentCategoryOptions: PaymentCategory[] = ['membership', 'stock'];
const navItems: NavItem[] = [
  { view: 'dashboard', label: 'Tableau de bord', iconClass: 'fi-rr-dashboard' },
  { view: 'search', label: 'Recherche', iconClass: 'fi-rr-search-alt' },
  { view: 'memberships', label: 'Adhesions', iconClass: 'fi-rr-membership' },
  { view: 'checkins', label: 'Presences', iconClass: 'fi-rr-clipboard-check' },
  { view: 'stock', label: 'Stock', iconClass: 'fi-rr-box-open-full' },
  { view: 'payments', label: 'Paiements', iconClass: 'fi-rr-money-check-edit-alt' },
  { view: 'settings', label: 'Parametres', iconClass: 'fi-rr-settings-sliders' },
];

const toneClassMap: Record<PlanSummary['tone'], string> = {
  pink: 'tone-pink',
  cyan: 'tone-cyan',
  lime: 'tone-lime',
  gold: 'tone-gold',
  mint: 'tone-mint',
};

const planToneMap: Record<string, PlanSummary['tone']> = {
  Premium: 'pink',
  Annual: 'cyan',
  Quarterly: 'lime',
  Monthly: 'gold',
  Standard: 'cyan',
  Basic: 'mint',
  Student: 'gold',
  'Trial Pass': 'pink',
};

const form = reactive<GymMemberInput>({
  fullName: '',
  email: '',
  phone: '',
  membershipType: 'Monthly',
  joinedAt: new Date().toISOString().slice(0, 10),
  notes: '',
  active: true,
});

const stockForm = reactive<StockItemInput>({
  name: '',
  price: 0,
  quantity: 0,
});

const stockRestockForm = reactive<StockRestockInput>({
  quantity: 1,
  notes: '',
});

const stockSaleForm = reactive<StockSaleInput>({
  quantity: 1,
  customerName: '',
  customerMemberId: null,
  notes: '',
});

const paymentForm = reactive<PaymentFormState>({
  label: '',
  amount: 0,
  category: 'membership',
  paymentMethod: 'cash',
  memberId: null,
  membershipTypeId: null,
  startedAt: new Date().toISOString().slice(0, 10),
});

const renewalForm = reactive<RenewalFormState>({
  membershipTypeId: null,
  paymentMethod: 'cash',
  startedAt: new Date().toISOString().slice(0, 10),
});

const membershipTypeForm = reactive<MembershipTypeInput>({
  name: '',
  price: 0,
  durationCount: 1,
  durationUnit: 'months',
});

const normalizeDurationUnit = (durationUnit?: MembershipDurationUnit | null): MembershipDurationUnit => {
  if (durationUnit === 'days' || durationUnit === 'years' || durationUnit === 'months') {
    return durationUnit;
  }

  return 'months';
};

const normalizeDurationCount = (durationCount?: number | null) => {
  const normalized = Number(durationCount);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
};

const normalizeMembershipTypeDetails = (membershipType: MembershipType | null) => {
  if (membershipType === null) {
    return null;
  }

  return {
    ...membershipType,
    price: Number.isFinite(Number(membershipType.price)) ? Number(membershipType.price) : 0,
    durationCount: normalizeDurationCount(membershipType.durationCount),
    durationUnit: normalizeDurationUnit(membershipType.durationUnit),
  };
};

const membershipOptions = computed(() => membershipTypes.value.map((membershipType) => membershipType.name));

const membershipSelectOptions = computed(() => {
  if (form.membershipType && !membershipOptions.value.includes(form.membershipType)) {
    return [form.membershipType, ...membershipOptions.value];
  }

  return membershipOptions.value;
});

const membershipPriceMap = computed(() => {
  return membershipTypes.value.reduce<Record<string, number>>((map, membershipType) => {
    map[membershipType.name] = membershipType.price;
    return map;
  }, {
    Standard: 55,
    Basic: 25,
    Student: 19,
    'Trial Pass': 12,
  });
});

const selectedMembershipType = computed(() => {
  return normalizeMembershipTypeDetails(
    membershipTypes.value.find((membershipType) => membershipType.name === form.membershipType) ?? null,
  );
});

const selectedPaymentMembershipType = computed(() => {
  return normalizeMembershipTypeDetails(
    membershipTypes.value.find((membershipType) => membershipType.id === paymentForm.membershipTypeId) ?? null,
  );
});

const selectedPaymentMember = computed(() => {
  return members.value.find((member) => member.id === paymentForm.memberId) ?? null;
});

const selectedRenewalMember = computed(() => {
  return members.value.find((member) => member.id === renewalMemberId.value) ?? null;
});

const selectedRenewalMembershipType = computed(() => {
  return normalizeMembershipTypeDetails(
    membershipTypes.value.find((membershipType) => membershipType.id === renewalForm.membershipTypeId) ?? null,
  );
});

const membershipTypeFormTitle = computed(() => {
  return editingMembershipTypeId.value === null ? 'Create membership type' : 'Update membership type';
});

const membershipTypeSubmitLabel = computed(() => {
  if (isMembershipTypeSaving.value) {
    return 'Enregistrement...';
  }

  return editingMembershipTypeId.value === null ? 'Enregistrer le type' : 'Mettre a jour le type';
});

const parseStoredDate = (value: string) => {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonth = (value: string, referenceDate: Date) => {
  const parsed = parseStoredDate(value);

  return parsed !== null
    && parsed.getFullYear() === referenceDate.getFullYear()
    && parsed.getMonth() === referenceDate.getMonth();
};

const isSameDay = (value: string, referenceDate: Date) => {
  const parsed = parseStoredDate(value);

  return parsed !== null
    && parsed.getFullYear() === referenceDate.getFullYear()
    && parsed.getMonth() === referenceDate.getMonth()
    && parsed.getDate() === referenceDate.getDate();
};

const shiftDate = (referenceDate: Date, days: number) => {
  const nextDate = new Date(referenceDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const previousMonthDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date;
};

const formatDelta = (currentValue: number, previousValue: number) => {
  if (currentValue === 0 && previousValue === 0) {
    return '0.0';
  }

  if (previousValue === 0) {
    return currentValue > 0 ? '100.0' : '0.0';
  }

  return (((currentValue - previousValue) / previousValue) * 100).toFixed(1);
};

const memberMatchesQuery = (member: GymMember, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    member.fullName,
    member.email ?? '',
    member.phone,
    member.membershipType,
    member.joinedAt,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
};

const formatMemberEmail = (email: string | null) => {
  return email && email.trim() ? email : 'Sans email';
};

const filteredMembers = computed(() => {
  return members.value.filter((member) => memberMatchesQuery(member, searchQuery.value));
});

const submittedSearchResults = computed(() => {
  const query = submittedSearchQuery.value.trim();

  if (!query) {
    return [];
  }

  return members.value.filter((member) => memberMatchesQuery(member, query));
});

const selectedSearchMember = computed(() => {
  return members.value.find((member) => member.id === selectedSearchMemberId.value) ?? null;
});

const selectedStockItem = computed(() => {
  return stockItems.value.find((item) => item.id === selectedStockItemId.value) ?? null;
});

const selectedStockSaleMember = computed(() => {
  if (stockSaleForm.customerMemberId === null) {
    return null;
  }

  return members.value.find((member) => member.id === stockSaleForm.customerMemberId) ?? null;
});

const selectedMemberAttendanceHistory = computed(() => {
  if (selectedSearchMember.value === null) {
    return [];
  }

  return attendanceHistory.value.filter((entry) => entry.memberId === selectedSearchMember.value?.id);
});

const selectedMemberPaymentHistory = computed(() => {
  if (selectedSearchMember.value === null) {
    return [];
  }

  const normalizedName = selectedSearchMember.value.fullName.trim().toLowerCase();

  return membershipPayments.value.filter((payment) => {
    return payment.label.toLowerCase().includes(normalizedName);
  });
});

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredMembers.value.length / membersPerPage));
});

const paginatedMembers = computed(() => {
  const startIndex = (currentPage.value - 1) * membersPerPage;
  return filteredMembers.value.slice(startIndex, startIndex + membersPerPage);
});

const mobileNavItems = computed(() => navItems.filter((item) => item.view !== 'presence-client').slice(0, 4));

const todayKey = () => new Date().toISOString().slice(0, 10);

const todayAttendance = computed(() => {
  const currentDay = todayKey();
  return attendanceHistory.value.filter((entry) => entry.checkedInAt.slice(0, 10) === currentDay);
});

const todayCheckIns = computed(() => todayAttendance.value.filter((entry) => entry.action === 'check-in').length);

const todayCheckOuts = computed(() => todayAttendance.value.filter((entry) => entry.action === 'check-out').length);

const uniqueVisitorsToday = computed(() => {
  return new Set(todayAttendance.value.map((entry) => entry.memberId)).size;
});

const groupedAttendanceHistory = computed<AttendanceDayGroup[]>(() => {
  const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });
  const groups = new Map<string, AttendanceRecord[]>();

  attendanceHistory.value.forEach((record) => {
    const dayKey = record.checkedInAt.slice(0, 10);
    const bucket = groups.get(dayKey);

    if (bucket) {
      bucket.push(record);
    } else {
      groups.set(dayKey, [record]);
    }
  });

  return [...groups.entries()].map(([dayKey, records]) => {
    const parsed = new Date(`${dayKey}T00:00:00`);

    return {
      dayKey,
      dayLabel: Number.isNaN(parsed.getTime()) ? dayKey : formatter.format(parsed),
      records,
    };
  });
});

const totalStockValue = computed(() => stockItems.value.reduce((sum, item) => sum + (item.price * item.quantity), 0));

const totalStockUnits = computed(() => stockItems.value.reduce((sum, item) => sum + item.quantity, 0));

const filteredStockItems = computed(() => {
  const normalizedQuery = stockSearchQuery.value.trim().toLowerCase();

  if (!normalizedQuery) {
    return stockItems.value;
  }

  return stockItems.value.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
});

const stockTotalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredStockItems.value.length / stockItemsPerPage));
});

const paginatedStockItems = computed(() => {
  const startIndex = (stockCurrentPage.value - 1) * stockItemsPerPage;
  return filteredStockItems.value.slice(startIndex, startIndex + stockItemsPerPage);
});

const stockSaleMemberResults = computed(() => {
  const normalizedQuery = stockSaleCustomerQuery.value.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return members.value
    .filter((member) => member.fullName.toLowerCase().includes(normalizedQuery))
    .slice(0, 6);
});

const membershipPayments = computed(() => payments.value.filter((payment) => payment.category === 'membership'));

const stockPayments = computed(() => payments.value.filter((payment) => payment.category === 'stock'));

const totalPayments = computed(() => payments.value.reduce((sum, payment) => sum + payment.amount, 0));

const currentMonthMemberships = computed(() => {
  const referenceDate = new Date();
  return members.value.filter((member) => isSameMonth(member.joinedAt, referenceDate)).length;
});

const previousMonthMemberships = computed(() => {
  const referenceDate = previousMonthDate();
  return members.value.filter((member) => isSameMonth(member.joinedAt, referenceDate)).length;
});

const currentMonthRevenue = computed(() => {
  const referenceDate = new Date();
  return payments.value
    .filter((payment) => isSameMonth(payment.createdAt, referenceDate))
    .reduce((sum, payment) => sum + payment.amount, 0);
});

const previousMonthRevenue = computed(() => {
  const referenceDate = previousMonthDate();
  return payments.value
    .filter((payment) => isSameMonth(payment.createdAt, referenceDate))
    .reduce((sum, payment) => sum + payment.amount, 0);
});

const yesterdayVisitors = computed(() => {
  const referenceDate = shiftDate(new Date(), -1);
  return new Set(
    attendanceHistory.value
      .filter((entry) => isSameDay(entry.checkedInAt, referenceDate))
      .map((entry) => entry.memberId),
  ).size;
});

const stockFormTitle = computed(() => editingStockId.value === null ? 'Creer un produit' : 'Modifier le produit');

const stockSubmitLabel = computed(() => {
  if (isStockSaving.value) {
    return 'Enregistrement...';
  }

  return editingStockId.value === null ? 'Enregistrer le produit' : 'Mettre a jour le produit';
});

const stockDetailsTitle = computed(() => selectedStockItem.value?.name ?? 'Details du produit');

const stockPaginationLabel = computed(() => {
  if (filteredStockItems.value.length === 0) {
    return '0-0 sur 0 produits';
  }

  const startIndex = (stockCurrentPage.value - 1) * stockItemsPerPage + 1;
  const endIndex = Math.min(stockCurrentPage.value * stockItemsPerPage, filteredStockItems.value.length);
  return `${startIndex}-${endIndex} sur ${filteredStockItems.value.length} produits`;
});

const paginationLabel = computed(() => {
  if (filteredMembers.value.length === 0) {
    return '0-0 sur 0 membres';
  }

  const startIndex = (currentPage.value - 1) * membersPerPage + 1;
  const endIndex = Math.min(currentPage.value * membersPerPage, filteredMembers.value.length);
  return `${startIndex}-${endIndex} sur ${filteredMembers.value.length} membres`;
});

const totalMembers = computed(() => members.value.length);
const activeMembers = computed(() => members.value.filter((member) => member.active).length);
const inactiveMembers = computed(() => totalMembers.value - activeMembers.value);

const monthlyRevenue = computed(() => {
  return currentMonthRevenue.value;
});

const activePresence = computed(() => {
  return uniqueVisitorsToday.value;
});

const memberGrowth = computed(() => {
  return formatDelta(currentMonthMemberships.value, previousMonthMemberships.value);
});

const revenueGrowth = computed(() => {
  return formatDelta(currentMonthRevenue.value, previousMonthRevenue.value);
});

const presenceGrowth = computed(() => {
  return formatDelta(uniqueVisitorsToday.value, yesterdayVisitors.value);
});

const chartMax = computed(() => {
  const maxValue = attendanceSeries.value.reduce((largest, item) => {
    return Math.max(largest, item.morning, item.evening);
  }, 0);

  return Math.max(4, Math.ceil(maxValue / 2) * 2);
});

const yAxisSteps = computed(() => {
  const max = chartMax.value;
  return [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
});

const attendanceSeries = computed<AttendancePoint[]>(() => {
  const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
  const dates = Array.from({ length: 7 }, (_value, index) => shiftDate(new Date(), index - 6));
  const countForDay = (date: Date, action: AttendanceAction) => {
    return attendanceHistory.value.filter((entry) => entry.action === action && isSameDay(entry.checkedInAt, date)).length;
  };
  const maxValue = Math.max(1, ...dates.flatMap((date) => [
    countForDay(date, 'check-in'),
    countForDay(date, 'check-out'),
  ]));

  return dates.map((date) => {
    const checkInCount = countForDay(date, 'check-in');
    const checkOutCount = countForDay(date, 'check-out');

    return {
      day: dayFormatter.format(date).replace('.', ''),
      morning: Math.max(checkInCount === 0 ? 0 : 12, Math.round((checkInCount / maxValue) * 100)),
      evening: Math.max(checkOutCount === 0 ? 0 : 12, Math.round((checkOutCount / maxValue) * 100)),
    };
  });
});

const planSummaries = computed<PlanSummary[]>(() => {
  const counts = new Map<string, number>();
  const currentMonthCounts = new Map<string, number>();
  const previousMonthCounts = new Map<string, number>();
  const currentMonthDate = new Date();
  const previousMonth = previousMonthDate();

  members.value.forEach((member) => {
    counts.set(member.membershipType, (counts.get(member.membershipType) ?? 0) + 1);

    if (isSameMonth(member.joinedAt, currentMonthDate)) {
      currentMonthCounts.set(member.membershipType, (currentMonthCounts.get(member.membershipType) ?? 0) + 1);
    }

    if (isSameMonth(member.joinedAt, previousMonth)) {
      previousMonthCounts.set(member.membershipType, (previousMonthCounts.get(member.membershipType) ?? 0) + 1);
    }
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count], index) => {
      const baseChange = Number(formatDelta(currentMonthCounts.get(name) ?? 0, previousMonthCounts.get(name) ?? 0));

      return {
        name,
        count,
        change: baseChange,
        tone: planToneMap[name] ?? ['pink', 'cyan', 'lime', 'gold', 'mint'][index % 5] as PlanSummary['tone'],
      };
    });
});

const newMembers = computed(() => {
  return [...members.value]
    .sort((left, right) => right.joinedAt.localeCompare(left.joinedAt))
    .slice(0, 5);
});

const formTitle = computed(() => {
  return editingMemberId.value === null ? 'Creer une adhesion' : "Modifier l'adhesion";
});

const submitLabel = computed(() => {
  return isSaving.value
    ? 'Enregistrement...'
    : editingMemberId.value === null
      ? 'Enregistrer le membre'
      : 'Mettre a jour le membre';
});

const pageTitle = computed(() => {
  if (currentView.value === 'dashboard') {
    return 'Tableau de bord';
  }

  if (currentView.value === 'memberships') {
    return 'Adhesions';
  }

  if (currentView.value === 'search') {
    return 'Recherche';
  }

  if (currentView.value === 'checkins') {
    return 'Presences';
  }

  if (currentView.value === 'stock') {
    return 'Stock';
  }

  if (currentView.value === 'payments') {
    return 'Paiements';
  }

  if (currentView.value === 'presence-client') {
    return 'Presence client';
  }

  return navItems.find((item) => item.view === currentView.value)?.label ?? 'Tableau de bord';
});

const pageDescription = computed(() => {
  switch (currentView.value) {
    case 'dashboard':
      return 'Vue en temps reel des membres, des paiements et des presences';
    case 'memberships':
      return 'Gerez les membres, les formules et les profils depuis un seul ecran';
    case 'search':
      return 'Recherchez des membres et ouvrez leurs details, paiements et presences';
    case 'checkins':
      return 'Enregistrez les entrees et sorties puis consultez l historique par jour';
    case 'stock':
      return 'Gerez le stock avec un catalogue simple par nom et prix';
    case 'payments':
      return 'Enregistrez les paiements d adhesion et de stock dans un seul registre';
    case 'settings':
      return 'Gerez les types d adhesion et leurs prix en base locale';
    case 'presence-client':
      return 'Utilisez un seul champ pour le telephone ou l ID membre afin de marquer les entrees et sorties';
  }
});

const resetForm = () => {
  editingMemberId.value = null;
  form.fullName = '';
  form.email = '';
  form.phone = '';
  form.membershipType = membershipOptions.value[0] ?? '';
  form.joinedAt = new Date().toISOString().slice(0, 10);
  form.notes = '';
  form.active = true;
  createWithMembershipPayment.value = true;
};

const openCreateMemberModal = () => {
  currentView.value = 'memberships';
  resetForm();
  isMemberModalOpen.value = true;
};

const closeMemberModal = () => {
  isMemberModalOpen.value = false;
  resetForm();
};

const submitSearch = () => {
  submittedSearchQuery.value = searchQuery.value.trim();

  if (submittedSearchQuery.value) {
    currentView.value = 'search';
  }
};

const openMemberDetails = (member: GymMember) => {
  selectedSearchMemberId.value = member.id;
  isMemberDetailsModalOpen.value = true;
};

const resetRenewalForm = () => {
  renewalForm.membershipTypeId = membershipTypes.value[0]?.id ?? null;
  renewalForm.paymentMethod = 'cash';
  renewalForm.startedAt = new Date().toISOString().slice(0, 10);
};

const openRenewalModal = (member: GymMember) => {
  renewalMemberId.value = member.id;
  resetRenewalForm();
  isRenewalModalOpen.value = true;
};

const closeRenewalModal = () => {
  isRenewalModalOpen.value = false;
  renewalMemberId.value = null;
  resetRenewalForm();
};

const closeMemberDetails = () => {
  isMemberDetailsModalOpen.value = false;
  selectedSearchMemberId.value = null;
};

const loadMembers = async () => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    members.value = await memberApi.list();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger les membres.';
  } finally {
    isLoading.value = false;
  }
};

const loadAttendanceHistory = async () => {
  isAttendanceLoading.value = true;

  try {
    attendanceHistory.value = await memberApi.listAttendanceHistory();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger l historique des presences.';
  } finally {
    isAttendanceLoading.value = false;
  }
};

const loadStockItems = async () => {
  isStockLoading.value = true;

  try {
    stockItems.value = await memberApi.listStockItems();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger le stock.';
  } finally {
    isStockLoading.value = false;
  }
};

const loadPayments = async () => {
  isPaymentLoading.value = true;

  try {
    payments.value = await memberApi.listPayments();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger les paiements.';
  } finally {
    isPaymentLoading.value = false;
  }
};

const loadMembershipTypes = async () => {
  isMembershipTypeLoading.value = true;

  try {
    membershipTypes.value = await memberApi.listMembershipTypes();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger les types d adhesion.';
  } finally {
    isMembershipTypeLoading.value = false;
  }
};

const startEditing = (member: GymMember) => {
  currentView.value = 'memberships';
  editingMemberId.value = member.id;
  form.fullName = member.fullName;
  form.email = member.email;
  form.phone = member.phone;
  form.membershipType = member.membershipType;
  form.joinedAt = member.joinedAt;
  form.notes = member.notes;
  form.active = member.active;
  isMemberModalOpen.value = true;
};

const saveMember = async () => {
  isSaving.value = true;
  errorMessage.value = '';

  try {
    if (editingMemberId.value === null) {
      const created = await memberApi.create({ ...form });

      members.value = [created, ...members.value];
      closeMemberModal();

      if (createWithMembershipPayment.value) {
        const membershipType = selectedMembershipType.value;

        if (!membershipType) {
          throw new Error('Selectionnez un type d adhesion enregistre avant de creer un paiement.');
        }

        try {
          await memberApi.createMembershipSubscription({
            memberId: created.id,
            membershipTypeId: membershipType.id,
            startedAt: created.joinedAt,
            paymentMethod: 'cash',
          });

          await Promise.all([loadMembers(), loadPayments()]);
        } catch (error) {
          await loadMembers();
          const reason = error instanceof Error ? error.message : 'Impossible d enregistrer le paiement d adhesion.';
          errorMessage.value = `Membre cree, mais abonnement non enregistre: ${reason}`;
        }
      }
    } else {
      const updated = await memberApi.update(editingMemberId.value, { ...form });
      members.value = members.value.map((member) =>
        member.id === updated.id ? updated : member,
      );

      closeMemberModal();
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d enregistrer le membre.';
  } finally {
    isSaving.value = false;
  }
};

const removeMember = async (memberId: number) => {
  errorMessage.value = '';

  try {
    await memberApi.remove(memberId);
    members.value = members.value.filter((member) => member.id !== memberId);

    if (editingMemberId.value === memberId) {
      closeMemberModal();
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de supprimer le membre.';
  }
};

const resetStockForm = () => {
  editingStockId.value = null;
  stockForm.name = '';
  stockForm.price = 0;
  stockForm.quantity = 0;
};

const resetStockRestockForm = () => {
  stockRestockForm.quantity = 1;
  stockRestockForm.notes = '';
};

const resetStockSaleForm = () => {
  stockSaleForm.quantity = 1;
  stockSaleForm.customerName = '';
  stockSaleForm.customerMemberId = null;
  stockSaleForm.notes = '';
  stockSaleCustomerQuery.value = '';
};

const handleStockSaleCustomerInput = () => {
  stockSaleForm.customerName = stockSaleCustomerQuery.value.trim();
  stockSaleForm.customerMemberId = null;
};

const selectStockSaleCustomer = (member: GymMember) => {
  stockSaleCustomerQuery.value = member.fullName;
  stockSaleForm.customerName = member.fullName;
  stockSaleForm.customerMemberId = member.id;
};

const openCreateStockModal = () => {
  currentView.value = 'stock';
  resetStockForm();
  isStockModalOpen.value = true;
};

const closeStockModal = () => {
  isStockModalOpen.value = false;
  resetStockForm();
};

const closeStockDetailsModal = () => {
  isStockDetailsModalOpen.value = false;
  stockHistory.value = [];
};

const closeStockSaleModal = () => {
  isStockSaleModalOpen.value = false;
  resetStockSaleForm();
};

const closeStockRestockModal = () => {
  isStockRestockModalOpen.value = false;
  resetStockRestockForm();
};

const startEditingStock = (item: StockItem) => {
  currentView.value = 'stock';
  selectedStockItemId.value = item.id;
  editingStockId.value = item.id;
  stockForm.name = item.name;
  stockForm.price = item.price;
  stockForm.quantity = item.quantity;
  isStockModalOpen.value = true;
};

const loadStockHistory = async (stockItemId: number) => {
  isStockHistoryLoading.value = true;

  try {
    stockHistory.value = await memberApi.listStockHistory(stockItemId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de charger l historique du stock.';
  } finally {
    isStockHistoryLoading.value = false;
  }
};

const openStockDetailsModal = async (item: StockItem) => {
  currentView.value = 'stock';
  selectedStockItemId.value = item.id;
  isStockDetailsModalOpen.value = true;
  await loadStockHistory(item.id);
};

const openStockSaleModal = (item: StockItem) => {
  currentView.value = 'stock';
  selectedStockItemId.value = item.id;
  resetStockSaleForm();
  isStockSaleModalOpen.value = true;
};

const openStockRestockModal = (item: StockItem) => {
  currentView.value = 'stock';
  selectedStockItemId.value = item.id;
  resetStockRestockForm();
  isStockRestockModalOpen.value = true;
};

const saveStockItem = async () => {
  isStockSaving.value = true;
  errorMessage.value = '';

  try {
    if (editingStockId.value === null) {
      const created = await memberApi.createStockItem({
        ...stockForm,
        price: Number(stockForm.price),
        quantity: Number(stockForm.quantity),
      });
      stockItems.value = [created, ...stockItems.value];
    } else {
      const updated = await memberApi.updateStockItem(editingStockId.value, {
        ...stockForm,
        price: Number(stockForm.price),
        quantity: Number(stockForm.quantity),
      });
      stockItems.value = stockItems.value.map((item) => item.id === updated.id ? updated : item);

      if (selectedStockItemId.value === updated.id && isStockDetailsModalOpen.value) {
        await loadStockHistory(updated.id);
      }
    }

    resetStockForm();
    isStockModalOpen.value = false;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d enregistrer le produit.';
  } finally {
    isStockSaving.value = false;
  }
};

const removeStockItem = async (itemId: number) => {
  errorMessage.value = '';

  try {
    await memberApi.removeStockItem(itemId);
    stockItems.value = stockItems.value.filter((item) => item.id !== itemId);

    if (editingStockId.value === itemId) {
      resetStockForm();
    }

    if (selectedStockItemId.value === itemId) {
      closeStockDetailsModal();
      closeStockSaleModal();
      closeStockRestockModal();
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de supprimer le produit.';
  }
};

const submitStockRestock = async () => {
  if (selectedStockItem.value === null) {
    return;
  }

  isStockSaving.value = true;
  errorMessage.value = '';

  try {
    const updated = await memberApi.restockStockItem(selectedStockItem.value.id, {
      quantity: Number(stockRestockForm.quantity),
      notes: stockRestockForm.notes,
    });

    stockItems.value = stockItems.value.map((item) => item.id === updated.id ? updated : item);
    await loadStockHistory(updated.id);
    closeStockRestockModal();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de restocker ce produit.';
  } finally {
    isStockSaving.value = false;
  }
};

const submitStockSale = async () => {
  if (selectedStockItem.value === null) {
    return;
  }

  isStockSaving.value = true;
  errorMessage.value = '';

  try {
    const updated = await memberApi.sellStockItem(selectedStockItem.value.id, {
      quantity: Number(stockSaleForm.quantity),
      customerName: stockSaleForm.customerName,
      customerMemberId: stockSaleForm.customerMemberId,
      notes: stockSaleForm.notes,
    });

    stockItems.value = stockItems.value.map((item) => item.id === updated.id ? updated : item);
    await Promise.all([loadPayments(), loadStockHistory(updated.id)]);
    closeStockSaleModal();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d enregistrer cette vente.';
  } finally {
    isStockSaving.value = false;
  }
};

const savePayment = async () => {
  isPaymentSaving.value = true;
  errorMessage.value = '';

  try {
    if (paymentForm.category === 'membership') {
      const membershipInput: MembershipSubscriptionInput = {
        memberId: Number(paymentForm.memberId),
        membershipTypeId: Number(paymentForm.membershipTypeId),
        startedAt: paymentForm.startedAt,
        paymentMethod: paymentForm.paymentMethod,
      };

      await memberApi.createMembershipSubscription(membershipInput);
      await Promise.all([loadMembers(), loadPayments()]);
    } else {
      const created = await memberApi.createPayment({
        label: paymentForm.label,
        amount: Number(paymentForm.amount),
        category: paymentForm.category,
        paymentMethod: paymentForm.paymentMethod,
      });
      payments.value = [created, ...payments.value];
    }

    paymentForm.label = '';
    paymentForm.amount = 0;
    paymentForm.category = 'membership';
    paymentForm.paymentMethod = 'cash';
    paymentForm.memberId = members.value[0]?.id ?? null;
    paymentForm.membershipTypeId = membershipTypes.value[0]?.id ?? null;
    paymentForm.startedAt = new Date().toISOString().slice(0, 10);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d enregistrer le paiement.';
  } finally {
    isPaymentSaving.value = false;
  }
};

const saveRenewal = async () => {
  if (selectedRenewalMember.value === null) {
    return;
  }

  isPaymentSaving.value = true;
  errorMessage.value = '';

  try {
    await memberApi.createMembershipSubscription({
      memberId: selectedRenewalMember.value.id,
      membershipTypeId: Number(renewalForm.membershipTypeId),
      startedAt: renewalForm.startedAt,
      paymentMethod: renewalForm.paymentMethod,
    });

    await Promise.all([loadMembers(), loadPayments()]);
    closeRenewalModal();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d enregistrer ce reabonnement.';
  } finally {
    isPaymentSaving.value = false;
  }
};

const resetMembershipTypeForm = () => {
  editingMembershipTypeId.value = null;
  membershipTypeForm.name = '';
  membershipTypeForm.price = 0;
  membershipTypeForm.durationCount = 1;
  membershipTypeForm.durationUnit = 'months';
};

const startEditingMembershipType = (membershipType: MembershipType) => {
  currentView.value = 'settings';
  editingMembershipTypeId.value = membershipType.id;
  membershipTypeForm.name = membershipType.name;
  membershipTypeForm.price = membershipType.price;
  membershipTypeForm.durationCount = membershipType.durationCount;
  membershipTypeForm.durationUnit = membershipType.durationUnit;
};

const saveMembershipType = async () => {
  isMembershipTypeSaving.value = true;
  errorMessage.value = '';

  try {
    if (editingMembershipTypeId.value === null) {
      const created = await memberApi.createMembershipType({
        name: membershipTypeForm.name,
        price: Number(membershipTypeForm.price),
        durationCount: Number(membershipTypeForm.durationCount),
        durationUnit: membershipTypeForm.durationUnit,
      });
      membershipTypes.value = [...membershipTypes.value, created].sort((left, right) => left.price - right.price || left.name.localeCompare(right.name));
    } else {
      const updated = await memberApi.updateMembershipType(editingMembershipTypeId.value, {
        name: membershipTypeForm.name,
        price: Number(membershipTypeForm.price),
        durationCount: Number(membershipTypeForm.durationCount),
        durationUnit: membershipTypeForm.durationUnit,
      });
      membershipTypes.value = membershipTypes.value
        .map((membershipType) => membershipType.id === updated.id ? updated : membershipType)
        .sort((left, right) => left.price - right.price || left.name.localeCompare(right.name));
    }

    resetMembershipTypeForm();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d enregistrer le type d adhesion.';
  } finally {
    isMembershipTypeSaving.value = false;
  }
};

const removeMembershipType = async (membershipTypeId: number) => {
  errorMessage.value = '';

  try {
    await memberApi.removeMembershipType(membershipTypeId);
    membershipTypes.value = membershipTypes.value.filter((membershipType) => membershipType.id !== membershipTypeId);

    if (editingMembershipTypeId.value === membershipTypeId) {
      resetMembershipTypeForm();
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de supprimer le type d adhesion.';
  }
};

const removePayment = async (paymentId: number) => {
  errorMessage.value = '';

  try {
    await memberApi.removePayment(paymentId);
    payments.value = payments.value.filter((payment) => payment.id !== paymentId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de supprimer le paiement.';
  }
};

const submitPhoneCheckIn = async (
  phone = checkInPhone.value,
  source: AttendanceSource = 'phone-number',
  action: AttendanceAction = selectedAttendanceAction.value,
) => {
  const nextPhone = phone.trim();

  if (!nextPhone) {
    errorMessage.value = 'Le numero de telephone est requis pour enregistrer une entree.';
    return;
  }

  isCheckInSaving.value = true;
  errorMessage.value = '';

  try {
    const attendance = await memberApi.checkInByPhone(nextPhone, source, action);
    attendanceHistory.value = [attendance, ...attendanceHistory.value];
    checkInPhone.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : `Impossible d enregistrer ${action === 'check-in' ? 'l entree' : 'la sortie'} de ce membre.`;
  } finally {
    isCheckInSaving.value = false;
  }
};

const submitPresenceLookup = async () => {
  const rawValue = presenceLookup.value.trim();

  if (!rawValue) {
    errorMessage.value = 'Saisissez un numero de telephone ou un identifiant membre.';
    return;
  }

  isCheckInSaving.value = true;
  errorMessage.value = '';

  try {
    let attendance: AttendanceRecord | null = null;
    const numericValue = rawValue.replace(/\D/g, '');
    const canTryId = /^\d+$/.test(rawValue);

    if (canTryId) {
      try {
        attendance = await memberApi.checkInByMemberId(Number(rawValue), selectedAttendanceAction.value);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';

        if (!message.includes('Member not found')) {
          throw error;
        }
      }
    }

    if (attendance === null) {
      attendance = await memberApi.checkInByPhone(numericValue || rawValue, 'phone-number', selectedAttendanceAction.value);
    }

    attendanceHistory.value = [attendance, ...attendanceHistory.value];
    presenceLookup.value = '';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible de traiter cette recherche.';
  } finally {
    isCheckInSaving.value = false;
  }
};

const openClientPresenceWindow = async () => {
  errorMessage.value = '';

  try {
    await memberApi.openClientPresenceWindow();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Impossible d ouvrir la fenetre de presence client.';
  }
};

const goToPage = (page: number) => {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value);
};

const goToStockPage = (page: number) => {
  stockCurrentPage.value = Math.min(Math.max(page, 1), stockTotalPages.value);
};

watch(searchQuery, () => {
  currentPage.value = 1;
});

watch(stockSearchQuery, () => {
  stockCurrentPage.value = 1;
});

watch(filteredMembers, (value) => {
  if (value.length === 0) {
    currentPage.value = 1;
    return;
  }

  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
});

watch(filteredStockItems, (value) => {
  if (value.length === 0) {
    stockCurrentPage.value = 1;
    return;
  }

  if (stockCurrentPage.value > stockTotalPages.value) {
    stockCurrentPage.value = stockTotalPages.value;
  }
});

watch(membershipOptions, (value) => {
  if (editingMemberId.value !== null) {
    return;
  }

  if (!form.membershipType || !value.includes(form.membershipType)) {
    form.membershipType = value[0] ?? '';
  }
}, { immediate: true });

watch(() => paymentForm.category, (category) => {
  if (category === 'membership') {
    paymentForm.label = '';
    paymentForm.memberId = paymentForm.memberId ?? members.value[0]?.id ?? null;
    paymentForm.membershipTypeId = paymentForm.membershipTypeId ?? membershipTypes.value[0]?.id ?? null;
    paymentForm.amount = selectedPaymentMembershipType.value?.price ?? 0;
    paymentForm.paymentMethod = paymentForm.paymentMethod ?? 'cash';
    return;
  }

  paymentForm.memberId = null;
  paymentForm.membershipTypeId = null;
});

watch(selectedPaymentMembershipType, (membershipType) => {
  if (paymentForm.category !== 'membership' || membershipType === null) {
    return;
  }

  paymentForm.amount = membershipType.price;
}, { immediate: true });

watch(membershipTypes, (value) => {
  if (paymentForm.category !== 'membership') {
    return;
  }

  if (paymentForm.membershipTypeId === null || !value.some((membershipType) => membershipType.id === paymentForm.membershipTypeId)) {
    paymentForm.membershipTypeId = value[0]?.id ?? null;
  }

  if (!form.membershipType || !value.some((membershipType) => membershipType.name === form.membershipType)) {
    form.membershipType = value[0]?.name ?? '';
  }
}, { immediate: true });

watch(members, (value) => {
  if (paymentForm.category !== 'membership') {
    return;
  }

  if (paymentForm.memberId === null || !value.some((member) => member.id === paymentForm.memberId)) {
    paymentForm.memberId = value[0]?.id ?? null;
  }
}, { immediate: true });

watch(membershipTypes, (value) => {
  if (renewalForm.membershipTypeId === null || !value.some((membershipType) => membershipType.id === renewalForm.membershipTypeId)) {
    renewalForm.membershipTypeId = value[0]?.id ?? null;
  }
}, { immediate: true });

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MGA',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatChange = (value: number) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatStockHistoryAction = (action: StockHistoryRecord['action']) => {
  if (action === 'sale') {
    return 'Vente';
  }

  if (action === 'restock') {
    return 'Restock';
  }

  return 'Creation';
};

const formatAttendanceDate = (value: string) => {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const formatAttendanceSource = (source: AttendanceSource) => {
  if (source === 'qr-phone') {
    return 'QR telephone';
  }

  if (source === 'member-id') {
    return 'ID membre';
  }

  return 'Telephone';
};

const formatAttendanceAction = (action: AttendanceAction) => {
  return action === 'check-in' ? 'Entree' : 'Sortie';
};

const formatPaymentCategory = (category: PaymentCategory) => {
  return category === 'membership' ? 'Adhesion' : 'Stock';
};

const formatPaymentMethod = (paymentMethod: PaymentMethod) => {
  return paymentMethod === 'mobile-money' ? 'Mobile money' : 'Espece';
};

const formatMembershipDuration = (durationCount?: number | null, durationUnit?: MembershipDurationUnit | null) => {
  const normalizedDurationCount = normalizeDurationCount(durationCount);
  const normalizedDurationUnit = normalizeDurationUnit(durationUnit);

  if (normalizedDurationUnit === 'days') {
    return `${normalizedDurationCount} jour${normalizedDurationCount > 1 ? 's' : ''}`;
  }

  if (normalizedDurationUnit === 'years') {
    return `${normalizedDurationCount} an${normalizedDurationCount > 1 ? 's' : ''}`;
  }

  return `${normalizedDurationCount} mois`;
};

const initialsFor = (value: string) => {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

onMounted(async () => {
  await Promise.all([loadMembers(), loadAttendanceHistory(), loadStockItems(), loadPayments(), loadMembershipTypes()]);
});
</script>

<template>
  <div :class="['app-shell', isPresenceClientWindow && 'presence-shell']">
    <aside v-if="!isPresenceClientWindow" class="sidebar">
      <div class="sidebar-top">
        <div class="brand-row">
          <div class="brand-mark">GL</div>
          <div>
            <div class="brand-name">Gymlytic<span>.</span></div>
            <p class="brand-copy">Performance cockpit</p>
          </div>
        </div>

        <nav class="sidebar-nav">
          <button
            v-for="item in navItems"
            :key="item.view"
            :class="['nav-button', currentView === item.view && 'is-active']"
            type="button"
            @click="currentView = item.view"
          >
            <span class="nav-icon"><i :class="item.iconClass" aria-hidden="true"></i></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
          </button>
        </nav>
      </div>

      <div class="sidebar-card">
        <div class="sidebar-card-mark">PR</div>
        <p>Passez en mode Pro pour debloquer un suivi avance des presences et de la fidelisation.</p>
        <button class="upgrade-button" type="button">Passer Pro</button>
      </div>
    </aside>

    <main class="main-shell">
      <div v-if="!isPresenceClientWindow" class="mobile-nav">
        <button
          v-for="item in mobileNavItems"
          :key="item.view"
          :class="['mobile-nav-button', currentView === item.view && 'is-active']"
          type="button"
          @click="currentView = item.view"
        >
          {{ item.label }}
        </button>
      </div>

      <header class="topbar">
        <div>
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDescription }}</p>
        </div>

        <div v-if="!isPresenceClientWindow" class="topbar-actions">
          <label class="search-box" @keyup.enter="submitSearch">
            <span>Recherche</span>
            <input v-model="searchQuery" type="text" placeholder="Rechercher un membre" />
          </label>
          <button class="primary-button search-submit" type="button" @click="submitSearch">Rechercher</button>
        </div>
      </header>

      <p v-if="errorMessage" class="alert-banner">{{ errorMessage }}</p>

      <template v-if="currentView === 'dashboard'">
        <section class="stats-grid">
          <article class="stat-card tone-gold">
            <div class="stat-card-top">
              <div class="stat-icon">MB</div>
              <div class="stat-change is-positive">{{ memberGrowth }}%</div>
            </div>
            <p>Total des membres</p>
            <strong>{{ totalMembers }}</strong>
            <svg class="stat-spark" viewBox="0 0 100 50" aria-hidden="true">
              <path d="M0,42 Q12,26 24,33 T48,18 T72,28 T100,8" />
            </svg>
          </article>

          <article class="stat-card tone-cyan">
            <div class="stat-card-top">
              <div class="stat-icon">RV</div>
              <div class="stat-change is-positive">{{ revenueGrowth }}%</div>
            </div>
            <p>Revenus du mois</p>
            <strong>{{ formatCurrency(monthlyRevenue) }}</strong>
            <svg class="stat-spark" viewBox="0 0 100 50" aria-hidden="true">
              <path d="M0,44 Q18,39 28,22 T55,30 T82,16 T100,4" />
            </svg>
          </article>

          <article class="stat-card tone-mint">
            <div class="stat-card-top">
              <div class="stat-icon">AC</div>
              <div class="stat-change is-positive">{{ presenceGrowth }}%</div>
            </div>
            <p>Presence du jour</p>
            <strong>{{ activePresence }}</strong>
            <svg class="stat-spark" viewBox="0 0 100 50" aria-hidden="true">
              <path d="M0,28 Q18,11 35,24 T62,17 T84,25 T100,9" />
            </svg>
          </article>
        </section>

        <section class="content-grid dashboard-grid">
          <article class="panel attendance-panel">
            <div class="panel-header">
              <div>
                <h2>Presence hebdomadaire</h2>
                <p>Entrees et sorties enregistrees cette semaine</p>
              </div>
              <button class="panel-chip" type="button">Cette semaine</button>
            </div>

            <div class="chart-wrap">
              <div class="chart-grid-lines">
                <div v-for="step in yAxisSteps" :key="step" class="chart-grid-line">
                  <span v-if="step > 0">{{ step }}</span>
                </div>
              </div>

              <div class="chart-columns">
                <div v-for="item in attendanceSeries" :key="item.day" class="chart-column">
                  <div class="chart-bars">
                    <div class="chart-bar morning" :style="{ height: `${item.morning}%` }"></div>
                    <div class="chart-bar evening" :style="{ height: `${item.evening}%` }"></div>
                  </div>
                  <span>{{ item.day }}</span>
                </div>
              </div>
            </div>

            <div class="legend-row">
              <div class="legend-item"><span class="legend-dot morning"></span>Entrees</div>
              <div class="legend-item"><span class="legend-dot evening"></span>Sorties</div>
            </div>
          </article>

          <article class="panel plans-panel">
            <div class="panel-header">
              <div>
                <h2>Membres par formule</h2>
                <p>Repartition reelle issue de la base locale</p>
              </div>
              <button class="panel-chip" type="button">Ce mois-ci</button>
            </div>

            <div class="plan-table-header">
              <span>Formule</span>
              <span>Membres</span>
              <span>Evolution</span>
            </div>

            <div v-if="planSummaries.length === 0" class="empty-state">
              Ajoutez des membres pour remplir cette repartition.
            </div>

            <div v-else class="plan-list">
              <div v-for="plan in planSummaries" :key="plan.name" class="plan-row">
                <div class="plan-name-cell">
                  <div :class="['plan-mark', toneClassMap[plan.tone]]">{{ initialsFor(plan.name) }}</div>
                  <span>{{ plan.name }}</span>
                </div>
                <span class="plan-value">{{ plan.count }}</span>
                <span :class="['plan-change', plan.change >= 0 ? 'is-positive' : 'is-negative']">
                  {{ formatChange(plan.change) }}
                </span>
              </div>
            </div>

            <button class="text-link" type="button" @click="currentView = 'memberships'">
              Ouvrir les adhesions
            </button>
          </article>
        </section>

        <section class="content-grid lower-grid">
          <article class="panel roster-panel">
            <div class="panel-header">
              <div>
                <h2>Derniers membres</h2>
                <p>Inscriptions recentes et acces rapide a la modification</p>
              </div>
              <button class="panel-chip" type="button" @click="currentView = 'memberships'">
                Gerer
              </button>
            </div>

            <div v-if="isLoading" class="empty-state">Chargement des membres...</div>
            <div v-else-if="newMembers.length === 0" class="empty-state">Aucun membre pour le moment.</div>
            <div v-else class="roster-list">
              <button
                v-for="member in newMembers"
                :key="member.id"
                class="roster-row"
                type="button"
                @click="startEditing(member)"
              >
                <div class="roster-avatar">{{ initialsFor(member.fullName) }}</div>
                <div class="roster-copy">
                  <strong>{{ member.fullName }}</strong>
                  <span>{{ member.membershipType }} · {{ member.joinedAt }}</span>
                </div>
                <span :class="['member-status', member.active ? 'is-online' : 'is-idle']">
                  {{ member.active ? 'Actif' : 'Inactif' }}
                </span>
              </button>
            </div>
          </article>

          <article class="panel spotlight-panel">
            <div class="panel-header">
              <div>
                <h2>Vue d ensemble</h2>
                <p>Lecture rapide de l etat actuel de la salle</p>
              </div>
            </div>

            <div class="snapshot-grid">
              <div class="snapshot-card">
                <span>Membres actifs</span>
                <strong>{{ activeMembers }}</strong>
              </div>
              <div class="snapshot-card">
                <span>Membres inactifs</span>
                <strong>{{ inactiveMembers }}</strong>
              </div>
              <div class="snapshot-card wide">
                <span>Formule dominante</span>
                <strong>{{ planSummaries[0]?.name ?? 'Aucune formule' }}</strong>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentView === 'search'">
        

        <section class="panel search-results-panel">
          <div class="panel-header">
            <div>
              <h2>Rechercher un membre</h2>
              <p>Recherchez par nom, email, telephone, formule ou date d inscription</p>
            </div>
            <button class="panel-chip" type="button" @click="submittedSearchQuery = ''">Effacer</button>
          </div>

          <form class="search-page-form" @submit.prevent="submitSearch">
            <label class="search-box search-page-box">
              <span>Recherche membre</span>
              <input v-model="searchQuery" type="text" placeholder="Rechercher un membre" />
            </label>
            <button class="primary-button search-submit" type="submit">Rechercher</button>
          </form>

          <div v-if="!submittedSearchQuery" class="empty-state">
            Saisissez une recherche pour voir les membres correspondants.
          </div>

          <template v-else>
            <div class="panel-header search-results-header">
              <div>
                <h2>Resultats de recherche</h2>
                <p>
                  {{ submittedSearchResults.length }} membre{{ submittedSearchResults.length === 1 ? '' : 's' }} trouve{{ submittedSearchResults.length === 1 ? '' : 's' }} pour "{{ submittedSearchQuery }}"
                </p>
              </div>
            </div>

            <div v-if="submittedSearchResults.length === 0" class="empty-state">
              Aucun membre ne correspond a cette recherche.
            </div>

            <div v-else class="search-results-list">
              <div v-for="member in submittedSearchResults" :key="member.id" class="search-result-row">
                <div class="search-result-copy">
                  <strong>{{ member.fullName }}</strong>
                  <span>{{ member.membershipType }} · {{ member.phone }} · {{ formatMemberEmail(member.email) }}</span>
                </div>

                <div class="search-result-actions">
                  <span :class="['member-status', member.active ? 'is-online' : 'is-idle']">
                    {{ member.active ? 'Actif' : 'Inactif' }}
                  </span>
                  <button class="panel-chip" type="button" @click="openMemberDetails(member)">Details</button>
                </div>
              </div>
            </div>
          </template>
        </section>
      </template>

      <template v-else-if="currentView === 'memberships'">
        <section class="membership-overview">
          <article class="overview-card">
            <span>Tous les dossiers</span>
            <strong>{{ totalMembers }}</strong>
          </article>
          <article class="overview-card">
            <span>Resultats de recherche</span>
            <strong>{{ filteredMembers.length }}</strong>
          </article>
          <article class="overview-card">
            <span>Taux actif</span>
            <strong>
              {{ totalMembers === 0 ? '0%' : `${Math.round((activeMembers / totalMembers) * 100)}%` }}
            </strong>
          </article>
        </section>

        <section class="content-grid memberships-grid">
          <article class="panel roster-panel memberships-list-panel">
            <div class="panel-header">
              <div>
                <h2>Annuaire des membres</h2>
                <p>Recherchez, consultez, modifiez ou supprimez les profils membres</p>
              </div>
              <div class="panel-actions">
                <button class="panel-chip" type="button" @click="loadMembers">Actualiser</button>
                <button class="primary-button" type="button" @click="openCreateMemberModal">Nouveau membre</button>
              </div>
            </div>

            <div v-if="isLoading" class="empty-state">Chargement des membres...</div>
            <div v-else-if="filteredMembers.length === 0" class="empty-state">Aucun membre ne correspond a la recherche actuelle.</div>

            <div v-else class="membership-list">
              <div v-for="member in paginatedMembers" :key="member.id" class="membership-card">
                <div class="membership-card-top">
                  <div class="roster-avatar">{{ initialsFor(member.fullName) }}</div>
                  <div class="membership-card-copy">
                    <strong>{{ member.fullName }}</strong>
                    <span>{{ formatMemberEmail(member.email) }}</span>
                  </div>
                  <span :class="['member-status', member.active ? 'is-online' : 'is-idle']">
                    {{ member.active ? 'Actif' : 'Inactif' }}
                  </span>
                </div>

                <dl class="membership-meta">
                  <div>
                    <dt>Formule</dt>
                    <dd>{{ member.membershipType }}</dd>
                  </div>
                  <div>
                    <dt>Telephone</dt>
                    <dd>{{ member.phone }}</dd>
                  </div>
                  <div>
                    <dt>Inscrit le</dt>
                    <dd>{{ member.joinedAt }}</dd>
                  </div>
                  <div>
                    <dt>Premiere adhesion</dt>
                    <dd>{{ member.firstMembershipAt ? formatAttendanceDate(member.firstMembershipAt) : 'Non definie' }}</dd>
                  </div>
                  <div>
                    <dt>Fin abonnement</dt>
                    <dd>{{ member.membershipEndsAt ? formatAttendanceDate(member.membershipEndsAt) : 'Non definie' }}</dd>
                  </div>
                </dl>

                <p v-if="member.notes" class="membership-notes">{{ member.notes }}</p>

                <div class="membership-actions">
                  <button class="primary-button" type="button" @click="openRenewalModal(member)">Reabonner</button>
                  <button class="panel-chip" type="button" @click="startEditing(member)">Modifier</button>
                  <button class="danger-button" type="button" @click="removeMember(member.id)">Supprimer</button>
                </div>
              </div>

              <div class="pagination-bar">
                <p>{{ paginationLabel }}</p>
                <div class="pagination-actions">
                  <button
                    class="panel-chip"
                    type="button"
                    :disabled="currentPage === 1"
                    @click="goToPage(currentPage - 1)"
                  >
                    Precedent
                  </button>
                  <div class="pagination-pages">
                    <button
                      v-for="page in totalPages"
                      :key="page"
                      :class="['pagination-page', page === currentPage && 'is-active']"
                      type="button"
                      @click="goToPage(page)"
                    >
                      {{ page }}
                    </button>
                  </div>
                  <button
                    class="panel-chip"
                    type="button"
                    :disabled="currentPage === totalPages"
                    @click="goToPage(currentPage + 1)"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentView === 'checkins'">
        <section class="membership-overview">
          <article class="overview-card">
            <span>Entrees du jour</span>
            <strong>{{ todayCheckIns }}</strong>
          </article>
          <article class="overview-card">
            <span>Sorties du jour</span>
            <strong>{{ todayCheckOuts }}</strong>
          </article>
          <article class="overview-card">
            <span>Visiteurs uniques</span>
            <strong>{{ uniqueVisitorsToday }}</strong>
          </article>
        </section>

        <section class="content-grid checkin-grid">
          <article class="panel checkin-panel">
            <div class="panel-header">
              <div>
                <h2>Poste de presence</h2>
                <p>Choisissez entree ou sortie puis enregistrez la presence par telephone</p>
              </div>
              <div class="panel-actions">
                <button class="panel-chip" type="button" @click="loadAttendanceHistory">Actualiser l historique</button>
                <button class="primary-button" type="button" @click="openClientPresenceWindow">Presence client</button>
              </div>
            </div>

            <div class="attendance-action-picker">
              <button
                :class="['action-toggle', selectedAttendanceAction === 'check-in' && 'is-active']"
                type="button"
                @click="selectedAttendanceAction = 'check-in'"
              >
                Entree
              </button>
              <button
                :class="['action-toggle', 'is-check-out', selectedAttendanceAction === 'check-out' && 'is-active']"
                type="button"
                @click="selectedAttendanceAction = 'check-out'"
              >
                Sortie
              </button>
            </div>

            <form class="checkin-form" @submit.prevent="submitPhoneCheckIn()">
              <label>
                <span>Telephone du membre</span>
                <input v-model="checkInPhone" required type="tel" placeholder="06 00 00 00 00" />
              </label>
              <button class="primary-button" :disabled="isCheckInSaving" type="submit">
                {{
                  isCheckInSaving
                    ? (selectedAttendanceAction === 'check-in' ? 'Enregistrement de l entree...' : 'Enregistrement de la sortie...')
                    : (selectedAttendanceAction === 'check-in' ? 'Enregistrer l entree' : 'Enregistrer la sortie')
                }}
              </button>
            </form>

            <div class="checkin-hint">
              Ce poste enregistre les presences manuellement tandis que l historique ci-dessous reste groupe par jour.
            </div>

            <div class="panel-header history-header">
              <div>
                <h2>Historique des presences</h2>
                <p>Telephone, ID membre et operations client regroupes par jour</p>
              </div>
            </div>

            <div v-if="isAttendanceLoading" class="empty-state">Chargement de l historique des presences...</div>
            <div v-else-if="groupedAttendanceHistory.length === 0" class="empty-state">Aucune presence n a encore ete enregistree.</div>
            <div v-else class="attendance-history-list">
              <section v-for="group in groupedAttendanceHistory" :key="group.dayKey" class="attendance-day-group">
                <div class="attendance-day-header">
                  <h3>{{ group.dayLabel }}</h3>
                  <span>{{ group.records.length }} evenement{{ group.records.length > 1 ? 's' : '' }}</span>
                </div>

                <div class="attendance-day-rows">
                  <div v-for="entry in group.records" :key="entry.id" class="attendance-row">
                    <div class="attendance-copy">
                      <strong>{{ entry.memberName }}</strong>
                      <span>{{ entry.memberPhone }}</span>
                    </div>
                    <div class="attendance-meta">
                      <span :class="['attendance-action', entry.action === 'check-out' && 'is-check-out']">
                        {{ formatAttendanceAction(entry.action) }}
                      </span>
                      <span class="attendance-source">{{ formatAttendanceSource(entry.source) }}</span>
                      <span>{{ formatAttendanceDate(entry.checkedInAt) }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentView === 'stock'">
        <section class="membership-overview">
          <article class="overview-card">
            <span>Produits</span>
            <strong>{{ filteredStockItems.length }}</strong>
          </article>
          <article class="overview-card">
            <span>Valeur totale</span>
            <strong>{{ formatCurrency(totalStockValue) }}</strong>
          </article>
          <article class="overview-card">
            <span>Quantite totale</span>
            <strong>{{ totalStockUnits }}</strong>
          </article>
        </section>

        <section class="content-grid stock-full-width">
          <article class="panel stock-list-panel">
            <div class="panel-header">
              <div>
                <h2>Liste du stock</h2>
                <p>Tous les produits enregistres avec modification et suppression rapide</p>
              </div>
              <div class="panel-actions stock-toolbar-actions">
                <label class="search-box stock-search-box">
                  <span>Recherche produit</span>
                  <input v-model="stockSearchQuery" type="text" placeholder="Rechercher par nom" />
                </label>
                <button class="panel-chip" type="button" @click="loadStockItems">Actualiser</button>
                <button class="primary-button" type="button" @click="openCreateStockModal">+ Ajouter</button>
              </div>
            </div>

            <div v-if="isStockLoading" class="empty-state">Chargement du stock...</div>
            <div v-else-if="filteredStockItems.length === 0" class="empty-state">Aucun produit ne correspond a la recherche actuelle.</div>
            <div v-else class="inventory-list">
              <div v-for="item in paginatedStockItems" :key="item.id" class="inventory-row">
                <div class="inventory-copy">
                  <strong>{{ item.name }}</strong>
                  <span>{{ formatAttendanceDate(item.createdAt) }}</span>
                  <span class="stock-quantity-line">Quantite en stock: {{ item.quantity }}</span>
                </div>
                <div class="inventory-meta">
                  <strong>{{ formatCurrency(item.price) }}</strong>
                  <span class="inventory-subvalue">Total: {{ formatCurrency(item.price * item.quantity) }}</span>
                  <div class="inventory-actions">
                    <button class="success-button" type="button" :disabled="item.quantity === 0" @click="openStockSaleModal(item)">Acheter</button>
                    <button class="panel-chip" type="button" @click="openStockRestockModal(item)">Restock</button>
                    <button class="panel-chip" type="button" @click="openStockDetailsModal(item)">Details</button>
                    <button class="panel-chip" type="button" @click="startEditingStock(item)">Modifier</button>
                    <button class="danger-button" type="button" @click="removeStockItem(item.id)">Supprimer</button>
                  </div>
                </div>
              </div>

              <div class="pagination-bar">
                <p>{{ stockPaginationLabel }}</p>
                <div class="pagination-actions">
                  <button
                    class="panel-chip"
                    type="button"
                    :disabled="stockCurrentPage === 1"
                    @click="goToStockPage(stockCurrentPage - 1)"
                  >
                    Precedent
                  </button>
                  <div class="pagination-pages">
                    <button
                      v-for="page in stockTotalPages"
                      :key="page"
                      :class="['pagination-page', page === stockCurrentPage && 'is-active']"
                      type="button"
                      @click="goToStockPage(page)"
                    >
                      {{ page }}
                    </button>
                  </div>
                  <button
                    class="panel-chip"
                    type="button"
                    :disabled="stockCurrentPage === stockTotalPages"
                    @click="goToStockPage(stockCurrentPage + 1)"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentView === 'payments'">
        <section class="membership-overview">
          <article class="overview-card">
            <span>Total paiements</span>
            <strong>{{ payments.length }}</strong>
          </article>
          <article class="overview-card">
            <span>Paiements d adhesion</span>
            <strong>{{ membershipPayments.length }}</strong>
          </article>
          <article class="overview-card">
            <span>Total registre</span>
            <strong>{{ formatCurrency(totalPayments) }}</strong>
          </article>
        </section>

        <section class="content-grid payments-grid">
          <article class="panel payment-form-panel">
            <div class="panel-header">
              <div>
                <h2>Creer un paiement</h2>
                <p>Enregistrez les paiements d adhesion et de stock au meme endroit</p>
              </div>
            </div>

            <form class="editor-form" @submit.prevent="savePayment">
              <label>
                <span>Libelle du paiement</span>
                <input v-model="paymentForm.label" :required="paymentForm.category === 'stock'" :disabled="paymentForm.category === 'membership'" type="text" placeholder="Vente accessoires - comptoir" />
              </label>

              <label>
                <span>Montant</span>
                <input
                  v-if="paymentForm.category === 'stock'"
                  v-model.number="paymentForm.amount"
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="39"
                />
                <input
                  v-else
                  :value="selectedPaymentMembershipType ? formatCurrency(selectedPaymentMembershipType.price) : formatCurrency(0)"
                  disabled
                  type="text"
                />
              </label>

              <label>
                <span>Type de paiement</span>
                <select v-model="paymentForm.category">
                  <option v-for="option in paymentCategoryOptions" :key="option" :value="option">
                    {{ formatPaymentCategory(option) }}
                  </option>
                </select>
              </label>

              <label>
                <span>Mode de paiement</span>
                <select v-model="paymentForm.paymentMethod">
                  <option value="cash">Espece</option>
                  <option value="mobile-money">Mobile money</option>
                </select>
              </label>

              <template v-if="paymentForm.category === 'membership'">
                <label>
                  <span>Membre</span>
                  <select v-model.number="paymentForm.memberId" required>
                    <option :value="null" disabled>Selectionner un membre</option>
                    <option v-for="member in members" :key="member.id" :value="member.id">
                      {{ member.fullName }}
                    </option>
                  </select>
                </label>

                <label>
                  <span>Type d adhesion</span>
                  <select v-model.number="paymentForm.membershipTypeId" required>
                    <option :value="null" disabled>Selectionner une formule</option>
                    <option v-for="membershipType in membershipTypes" :key="membershipType.id" :value="membershipType.id">
                      {{ membershipType.name }}
                    </option>
                  </select>
                </label>

                <label>
                  <span>Date de debut</span>
                  <input v-model="paymentForm.startedAt" required type="date" />
                </label>

                <div class="form-hint-card">
                  <strong>{{ selectedPaymentMembershipType?.name ?? 'Type d adhesion requis' }}</strong>
                  <span>
                    {{
                      selectedPaymentMembershipType && selectedPaymentMember
                        ? `${selectedPaymentMember.fullName} sera facture ${formatCurrency(selectedPaymentMembershipType.price)} pour ${formatMembershipDuration(selectedPaymentMembershipType.durationCount, selectedPaymentMembershipType.durationUnit)} en ${formatPaymentMethod(paymentForm.paymentMethod)}.`
                        : 'Selectionnez un membre et une formule pour generer automatiquement le paiement et la date de fin.'
                    }}
                  </span>
                </div>
              </template>

              <button class="primary-button" :disabled="isPaymentSaving" type="submit">
                {{ isPaymentSaving ? 'Enregistrement...' : 'Enregistrer le paiement' }}
              </button>
            </form>
          </article>

          <article class="panel payment-list-panel">
            <div class="panel-header">
              <div>
                <h2>Registre des paiements</h2>
                <p>Paiements d adhesion et de stock enregistres localement</p>
              </div>
              <button class="panel-chip" type="button" @click="loadPayments">Actualiser</button>
            </div>

            <div v-if="isPaymentLoading" class="empty-state">Chargement des paiements...</div>
            <div v-else-if="payments.length === 0" class="empty-state">Aucun paiement enregistre.</div>
            <div v-else class="inventory-list">
              <div v-for="payment in payments" :key="payment.id" class="inventory-row">
                <div class="inventory-copy">
                  <strong>{{ payment.label }}</strong>
                  <span>{{ formatPaymentCategory(payment.category) }} · {{ formatPaymentMethod(payment.paymentMethod) }} · {{ formatAttendanceDate(payment.createdAt) }}</span>
                </div>
                <div class="inventory-meta">
                  <strong>{{ formatCurrency(payment.amount) }}</strong>
                  <div class="inventory-actions">
                    <button class="danger-button" type="button" @click="removePayment(payment.id)">Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentView === 'settings'">
        <section class="membership-overview">
          <article class="overview-card">
            <span>Types d adhesion</span>
            <strong>{{ membershipTypes.length }}</strong>
          </article>
          <article class="overview-card">
            <span>Prix le plus bas</span>
            <strong>{{ membershipTypes.length === 0 ? formatCurrency(0) : formatCurrency(membershipTypes[0]?.price ?? 0) }}</strong>
          </article>
          <article class="overview-card">
            <span>Edition</span>
            <strong>{{ editingMembershipTypeId === null ? 'Nouveau type' : `#${editingMembershipTypeId}` }}</strong>
          </article>
        </section>

        <section class="content-grid stock-grid">
          <article class="panel stock-form-panel">
+            <div class="panel-header">
              <div>
                <h2>{{ membershipTypeFormTitle }}</h2>
                <p>Enregistrez les noms et prix des formules utilises dans le tableau de bord et le formulaire membre</p>
              </div>
              <button v-if="editingMembershipTypeId !== null" class="panel-chip" type="button" @click="resetMembershipTypeForm">
                Reinitialiser
              </button>
            </div>

            <form class="editor-form" @submit.prevent="saveMembershipType">
              <label>
                <span>Type d adhesion</span>
                <input v-model="membershipTypeForm.name" required type="text" placeholder="Mensuel" />
              </label>

              <label>
                <span>Prix</span>
                <input
                  v-model.number="membershipTypeForm.price"
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="39"
                />
              </label>

              <div class="field-row">
                <label>
                  <span>Duree</span>
                  <input
                    v-model.number="membershipTypeForm.durationCount"
                    required
                    min="1"
                    step="1"
                    type="number"
                    placeholder="1"
                  />
                </label>

                <label>
                  <span>Unite</span>
                  <select v-model="membershipTypeForm.durationUnit">
                    <option value="days">Jour(s)</option>
                    <option value="months">Mois</option>
                    <option value="years">Annee(s)</option>
                  </select>
                </label>
              </div>

              <button class="primary-button" :disabled="isMembershipTypeSaving" type="submit">
                {{ membershipTypeSubmitLabel }}
              </button>
            </form>
          </article>

          <article class="panel stock-list-panel">
            <div class="panel-header">
              <div>
                <h2>Types d adhesion enregistres</h2>
                <p>Ces formules sont chargees lors de la creation d un membre et du calcul des revenus</p>
              </div>
              <button class="panel-chip" type="button" @click="loadMembershipTypes">Actualiser</button>
            </div>

            <div v-if="isMembershipTypeLoading" class="empty-state">Chargement des types d adhesion...</div>
            <div v-else-if="membershipTypes.length === 0" class="empty-state">Aucun type d adhesion enregistre.</div>
            <div v-else class="inventory-list">
              <div v-for="membershipType in membershipTypes" :key="membershipType.id" class="inventory-row">
                <div class="inventory-copy">
                  <strong>{{ membershipType.name }}</strong>
                  <span>{{ formatAttendanceDate(membershipType.createdAt) }}</span>
                  <span>{{ formatMembershipDuration(membershipType.durationCount, membershipType.durationUnit) }}</span>
                </div>
                <div class="inventory-meta">
                  <strong>{{ formatCurrency(membershipType.price) }}</strong>
                  <div class="inventory-actions">
                    <button class="panel-chip" type="button" @click="startEditingMembershipType(membershipType)">Modifier</button>
                    <button class="danger-button" type="button" @click="removeMembershipType(membershipType.id)">Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-else-if="currentView === 'presence-client'">
        <section class="content-grid presence-client-grid">
          <article class="panel presence-client-panel">
            <div class="panel-header">
              <div>
                <h2>Poste de presence client</h2>
                <p>Choisissez entree ou sortie, puis utilisez un seul champ pour le telephone ou l ID membre</p>
              </div>
            </div>

            <div class="attendance-action-picker">
              <button
                :class="['action-toggle', selectedAttendanceAction === 'check-in' && 'is-active']"
                type="button"
                @click="selectedAttendanceAction = 'check-in'"
              >
                Entree
              </button>
              <button
                :class="['action-toggle', 'is-check-out', selectedAttendanceAction === 'check-out' && 'is-active']"
                type="button"
                @click="selectedAttendanceAction = 'check-out'"
              >
                Sortie
              </button>
            </div>

            <div class="presence-client-actions">
              <form class="checkin-form presence-lookup-form" @submit.prevent="submitPresenceLookup()">
                <label>
                  <span>Telephone ou ID membre</span>
                  <input v-model="presenceLookup" required type="text" placeholder="06 00 00 00 00 ou 1024" />
                </label>
                <button class="primary-button" :disabled="isCheckInSaving" type="submit">
                  {{
                    isCheckInSaving
                      ? (selectedAttendanceAction === 'check-in' ? 'Enregistrement de l entree...' : 'Enregistrement de la sortie...')
                      : (selectedAttendanceAction === 'check-in' ? 'Enregistrer l entree' : 'Enregistrer la sortie')
                  }}
                </button>
              </form>
            </div>

            <div class="panel-header history-header">
              <div>
                <h2>Historique recent des presences</h2>
                <p>Dernieres entrees et sorties enregistrees dans la salle</p>
              </div>
              <button class="panel-chip" type="button" @click="loadAttendanceHistory">Actualiser</button>
            </div>

            <div v-if="isAttendanceLoading" class="empty-state">Chargement de l historique des presences...</div>
            <div v-else-if="groupedAttendanceHistory.length === 0" class="empty-state">Aucune presence n a encore ete enregistree.</div>
            <div v-else class="attendance-history-list compact-history-list">
              <section v-for="group in groupedAttendanceHistory" :key="group.dayKey" class="attendance-day-group">
                <div class="attendance-day-header">
                  <h3>{{ group.dayLabel }}</h3>
                  <span>{{ group.records.length }} evenement{{ group.records.length > 1 ? 's' : '' }}</span>
                </div>

                <div class="attendance-day-rows">
                  <div v-for="entry in group.records" :key="entry.id" class="attendance-row">
                    <div class="attendance-copy">
                      <strong>{{ entry.memberName }}</strong>
                      <span>#{{ entry.memberId }} · {{ entry.memberPhone }}</span>
                    </div>
                    <div class="attendance-meta">
                      <span :class="['attendance-action', entry.action === 'check-out' && 'is-check-out']">
                        {{ formatAttendanceAction(entry.action) }}
                      </span>
                      <span class="attendance-source">{{ formatAttendanceSource(entry.source) }}</span>
                      <span>{{ formatAttendanceDate(entry.checkedInAt) }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </article>
        </section>
      </template>

      <template v-else>
        <section class="panel placeholder-panel">
          <h2>{{ pageTitle }}</h2>
          <p>
            Cette section est encore un espace reserve. Les principales fonctionnalites demandees sont deja en place :
            le tableau de bord est l ecran principal et les adhesions sont deja operationnelles.
          </p>
          <button class="primary-inline" type="button" @click="currentView = 'dashboard'">
            Retour au tableau de bord
          </button>
        </section>
      </template>
    </main>

    <div v-if="isMemberModalOpen" class="modal-backdrop" @click.self="closeMemberModal">
      <article class="modal-card">
        <div class="panel-header modal-header">
          <div>
            <h2>{{ formTitle }}</h2>
            <p>Ce formulaire utilise le meme service SQLite local que le reste de l application</p>
          </div>
          <div class="panel-actions">
            <button v-if="editingMemberId !== null" class="panel-chip" type="button" @click="resetForm">
              Reinitialiser
            </button>
            <button class="circle-button modal-close" type="button" @click="closeMemberModal">X</button>
          </div>
        </div>

        <form class="editor-form" @submit.prevent="saveMember">
          <label>
            <span>Nom complet</span>
            <input v-model="form.fullName" required type="text" placeholder="Alex Martin" />
          </label>

          <label>
            <span>Email</span>
            <input v-model="form.email" type="email" placeholder="alex@gym.local" />
          </label>

          <div class="field-row">
            <label>
              <span>Telephone</span>
              <input v-model="form.phone" required type="tel" placeholder="06 00 00 00 00" />
            </label>

            <label>
              <span>Adhesion</span>
              <select v-model="form.membershipType" :disabled="membershipSelectOptions.length === 0">
                <option v-if="membershipSelectOptions.length === 0" value="">Aucun type enregistre</option>
                <option v-for="option in membershipSelectOptions" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
            </label>
          </div>

          <p v-if="membershipOptions.length === 0" class="form-hint">
            Ajoutez un type d adhesion dans Parametres avant de creer des membres avec tarification.
          </p>

          <label>
            <span>Date d inscription</span>
            <input v-model="form.joinedAt" required type="date" />
          </label>

          <label>
            <span>Notes</span>
            <textarea
              v-model="form.notes"
              rows="5"
              placeholder="Objectifs, restrictions, notes de coaching..."
            ></textarea>
          </label>

          <label class="checkbox-row">
            <input v-model="form.active" type="checkbox" />
            <span>Adhesion active</span>
          </label>

          <label v-if="editingMemberId === null" class="checkbox-row">
            <input v-model="createWithMembershipPayment" type="checkbox" />
            <span>Creer avec paiement d adhesion</span>
          </label>

          <div v-if="editingMemberId === null && createWithMembershipPayment" class="form-hint-card">
            <strong>{{ selectedMembershipType?.name ?? 'Type d adhesion requis' }}</strong>
            <span>
              {{
                selectedMembershipType
                  ? `Un paiement d adhesion de ${formatCurrency(selectedMembershipType.price)} sera enregistre automatiquement pour ${formatMembershipDuration(selectedMembershipType.durationCount, selectedMembershipType.durationUnit)}.`
                  : 'Choisissez un type d adhesion enregistre avant de valider ce membre.'
              }}
            </span>
          </div>

          <div class="modal-footer">
            <button class="panel-chip" type="button" @click="closeMemberModal">Annuler</button>
            <button class="primary-button" :disabled="isSaving" type="submit">
              {{ submitLabel }}
            </button>
          </div>
        </form>
      </article>
    </div>

    <div v-if="isStockModalOpen" class="modal-backdrop" @click.self="closeStockModal">
      <article class="modal-card stock-modal-card">
        <div class="panel-header modal-header">
          <div>
            <h2>{{ stockFormTitle }}</h2>
            <p>Gestion simple du stock avec nom et prix</p>
          </div>
          <div class="panel-actions">
            <button v-if="editingStockId !== null" class="panel-chip" type="button" @click="resetStockForm">
              Reinitialiser
            </button>
            <button class="circle-button modal-close" type="button" @click="closeStockModal">X</button>
          </div>
        </div>

        <form class="editor-form" @submit.prevent="saveStockItem">
          <label>
            <span>Nom du produit</span>
            <input v-model="stockForm.name" required type="text" placeholder="Boisson proteinee" />
          </label>

          <div class="field-row">
            <label>
              <span>Prix</span>
              <input v-model.number="stockForm.price" required min="0" step="0.01" type="number" placeholder="25" />
            </label>

            <label>
              <span>Quantite</span>
              <input v-model.number="stockForm.quantity" required min="0" step="1" type="number" placeholder="10" />
            </label>
          </div>

          <div class="modal-footer">
            <button class="panel-chip" type="button" @click="closeStockModal">Annuler</button>
            <button class="primary-button" :disabled="isStockSaving" type="submit">
              {{ stockSubmitLabel }}
            </button>
          </div>
        </form>
      </article>
    </div>

    <div v-if="isStockSaleModalOpen && selectedStockItem" class="modal-backdrop" @click.self="closeStockSaleModal">
      <article class="modal-card stock-modal-card">
        <div class="panel-header modal-header">
          <div>
            <h2>Acheter {{ selectedStockItem.name }}</h2>
            <p>Enregistrer une vente client et deduire le stock automatiquement</p>
          </div>
          <button class="circle-button modal-close" type="button" @click="closeStockSaleModal">X</button>
        </div>

        <form class="editor-form" @submit.prevent="submitStockSale">
          <label>
            <span>Recherche client</span>
            <input
              v-model="stockSaleCustomerQuery"
              required
              type="text"
              placeholder="Rechercher par nom client"
              @input="handleStockSaleCustomerInput"
            />
          </label>

          <div v-if="selectedStockSaleMember" class="form-hint-card">
            <strong>Client selectionne</strong>
            <span>{{ selectedStockSaleMember.fullName }} · {{ selectedStockSaleMember.phone }}</span>
          </div>

          <div v-else-if="stockSaleCustomerQuery.trim()" class="form-hint">
            Selectionnez un client depuis la liste ci-dessous ou gardez le nom saisi.
          </div>

          <div v-if="stockSaleMemberResults.length > 0" class="search-results-list compact-customer-results">
            <div v-for="member in stockSaleMemberResults" :key="member.id" class="search-result-row">
              <div class="search-result-copy">
                <strong>{{ member.fullName }}</strong>
                <span>{{ member.phone }}</span>
              </div>
              <div class="search-result-actions">
                <button class="panel-chip" type="button" @click="selectStockSaleCustomer(member)">Selectionner</button>
              </div>
            </div>
          </div>

          <div class="field-row">
            <label>
              <span>Quantite</span>
              <input v-model.number="stockSaleForm.quantity" required min="1" :max="selectedStockItem.quantity" step="1" type="number" />
            </label>

            <label>
              <span>Total</span>
              <input :value="formatCurrency(selectedStockItem.price * Number(stockSaleForm.quantity || 0))" disabled type="text" />
            </label>
          </div>

          <label>
            <span>Note</span>
            <textarea v-model="stockSaleForm.notes" rows="3" placeholder="Observation sur la vente"></textarea>
          </label>

          <div class="modal-footer">
            <button class="panel-chip" type="button" @click="closeStockSaleModal">Annuler</button>
            <button class="success-button" :disabled="isStockSaving || selectedStockItem.quantity === 0" type="submit">Valider la vente</button>
          </div>
        </form>
      </article>
    </div>

    <div v-if="isStockRestockModalOpen && selectedStockItem" class="modal-backdrop" @click.self="closeStockRestockModal">
      <article class="modal-card stock-modal-card">
        <div class="panel-header modal-header">
          <div>
            <h2>Restock {{ selectedStockItem.name }}</h2>
            <p>Ajouter une quantite et enregistrer le mouvement dans l historique</p>
          </div>
          <button class="circle-button modal-close" type="button" @click="closeStockRestockModal">X</button>
        </div>

        <form class="editor-form" @submit.prevent="submitStockRestock">
          <label>
            <span>Quantite a ajouter</span>
            <input v-model.number="stockRestockForm.quantity" required min="1" step="1" type="number" />
          </label>

          <label>
            <span>Note</span>
            <textarea v-model="stockRestockForm.notes" rows="3" placeholder="Motif du restock"></textarea>
          </label>

          <div class="modal-footer">
            <button class="panel-chip" type="button" @click="closeStockRestockModal">Annuler</button>
            <button class="primary-button" :disabled="isStockSaving" type="submit">Valider le restock</button>
          </div>
        </form>
      </article>
    </div>

    <div v-if="isStockDetailsModalOpen && selectedStockItem" class="modal-backdrop" @click.self="closeStockDetailsModal">
      <article class="modal-card member-details-modal">
        <div class="panel-header modal-header">
          <div>
            <h2>{{ stockDetailsTitle }}</h2>
            <p>Details du produit, quantite restante et historique des mouvements</p>
          </div>
          <button class="circle-button modal-close" type="button" @click="closeStockDetailsModal">X</button>
        </div>

        <section class="member-details-grid">
          <article class="member-details-card">
            <span>Prix unitaire</span>
            <strong>{{ formatCurrency(selectedStockItem.price) }}</strong>
            <p>Produit #{{ selectedStockItem.id }}</p>
          </article>

          <article class="member-details-card">
            <span>Quantite</span>
            <strong>{{ selectedStockItem.quantity }}</strong>
            <p>Disponible actuellement</p>
          </article>

          <article class="member-details-card">
            <span>Valeur stockee</span>
            <strong>{{ formatCurrency(selectedStockItem.quantity * selectedStockItem.price) }}</strong>
            <p>{{ formatAttendanceDate(selectedStockItem.createdAt) }}</p>
          </article>
        </section>

        <section class="member-history-section">
          <div class="panel-header history-header">
            <div>
              <h2>Historique du stock</h2>
              <p>Creation, restock et ventes client enregistres localement</p>
            </div>
          </div>

          <div v-if="isStockHistoryLoading" class="empty-state">Chargement de l historique du stock...</div>
          <div v-else-if="stockHistory.length === 0" class="empty-state">Aucun mouvement enregistre pour ce produit.</div>

          <div v-else class="inventory-list">
            <div v-for="entry in stockHistory" :key="entry.id" class="inventory-row inventory-row-history">
              <div class="inventory-copy">
                <strong>{{ formatStockHistoryAction(entry.action) }}</strong>
                <span>{{ formatAttendanceDate(entry.createdAt) }}</span>
                <span v-if="entry.customerName">Client: {{ entry.customerName }}</span>
                <span v-if="entry.notes">{{ entry.notes }}</span>
              </div>
              <div class="inventory-meta">
                <span :class="['stock-history-badge', `is-${entry.action}`]">
                  {{ entry.action === 'sale' ? '-' : '+' }}{{ entry.quantity }}
                </span>
                <strong>{{ formatCurrency(entry.totalAmount) }}</strong>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>

    <div v-if="isMemberDetailsModalOpen && selectedSearchMember" class="modal-backdrop" @click.self="closeMemberDetails">
      <article class="modal-card member-details-modal">
        <div class="panel-header modal-header">
          <div>
            <h2>{{ selectedSearchMember.fullName }}</h2>
            <p>Adhesion, historique des paiements et historique des presences</p>
          </div>
          <div class="panel-actions">
            <button class="primary-button" type="button" @click="openRenewalModal(selectedSearchMember)">Reabonner</button>
            <button class="circle-button modal-close" type="button" @click="closeMemberDetails">X</button>
          </div>
        </div>

        <section class="member-details-grid">
          <article class="member-details-card">
            <span>Type d adhesion</span>
            <strong>{{ selectedSearchMember.membershipType }}</strong>
            <p>{{ selectedSearchMember.active ? 'Adhesion active' : 'Adhesion inactive' }}</p>
          </article>

          <article class="member-details-card">
            <span>Telephone</span>
            <strong>{{ selectedSearchMember.phone }}</strong>
            <p>{{ formatMemberEmail(selectedSearchMember.email) }}</p>
          </article>

          <article class="member-details-card">
            <span>Inscrit le</span>
            <strong>{{ selectedSearchMember.joinedAt }}</strong>
            <p>#{{ selectedSearchMember.id }}</p>
          </article>
        </section>

        <section class="member-history-section">
          <div class="panel-header history-header">
            <div>
              <h2>Historique des paiements</h2>
              <p>Paiements d adhesion retrouves dans le registre enregistre</p>
            </div>
          </div>

          <div v-if="selectedMemberPaymentHistory.length === 0" class="empty-state">
            Aucun paiement d adhesion trouve pour ce membre.
          </div>

          <div v-else class="inventory-list">
            <div v-for="payment in selectedMemberPaymentHistory" :key="payment.id" class="inventory-row">
              <div class="inventory-copy">
                <strong>{{ payment.label }}</strong>
                <span>{{ formatPaymentMethod(payment.paymentMethod) }} · {{ formatAttendanceDate(payment.createdAt) }}</span>
              </div>
              <div class="inventory-meta">
                <strong>{{ formatCurrency(payment.amount) }}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="member-history-section">
          <div class="panel-header history-header">
            <div>
              <h2>Historique des presences</h2>
              <p>Entrees et sorties enregistrees pour ce membre</p>
            </div>
          </div>

          <div v-if="selectedMemberAttendanceHistory.length === 0" class="empty-state">
            Aucun historique de presence trouve pour ce membre.
          </div>

          <div v-else class="attendance-history-list compact-history-list">
            <div v-for="entry in selectedMemberAttendanceHistory" :key="entry.id" class="attendance-row">
              <div class="attendance-copy">
                <strong>{{ formatAttendanceAction(entry.action) }}</strong>
                <span>{{ formatAttendanceSource(entry.source) }}</span>
              </div>
              <div class="attendance-meta">
                <span>{{ formatAttendanceDate(entry.checkedInAt) }}</span>
              </div>
            </div>
          </div>
        </section>
      </article>
    </div>

    <div v-if="isRenewalModalOpen && selectedRenewalMember" class="modal-backdrop" @click.self="closeRenewalModal">
      <article class="modal-card">
        <div class="panel-header modal-header">
          <div>
            <h2>Reabonnement</h2>
            <p>{{ selectedRenewalMember.fullName }} · choisissez la formule et le mode de paiement</p>
          </div>
          <button class="circle-button modal-close" type="button" @click="closeRenewalModal">X</button>
        </div>

        <form class="editor-form" @submit.prevent="saveRenewal">
          <label>
            <span>Type d adhesion</span>
            <select v-model.number="renewalForm.membershipTypeId" required>
              <option :value="null" disabled>Selectionner une formule</option>
              <option v-for="membershipType in membershipTypes" :key="membershipType.id" :value="membershipType.id">
                {{ membershipType.name }}
              </option>
            </select>
          </label>

          <label>
            <span>Date de debut</span>
            <input v-model="renewalForm.startedAt" required type="date" />
          </label>

          <label>
            <span>Mode de paiement</span>
            <select v-model="renewalForm.paymentMethod">
              <option value="cash">Espece</option>
              <option value="mobile-money">Mobile money</option>
            </select>
          </label>

          <div class="form-hint-card">
            <strong>{{ selectedRenewalMembershipType?.name ?? 'Type d adhesion requis' }}</strong>
            <span>
              {{
                selectedRenewalMembershipType
                  ? `${selectedRenewalMember.fullName} sera reabonne pour ${formatCurrency(selectedRenewalMembershipType.price)} sur ${formatMembershipDuration(selectedRenewalMembershipType.durationCount, selectedRenewalMembershipType.durationUnit)} en ${formatPaymentMethod(renewalForm.paymentMethod)}.`
                  : 'Choisissez une formule avant de valider le reabonnement.'
              }}
            </span>
          </div>

          <div class="modal-footer">
            <button class="panel-chip" type="button" @click="closeRenewalModal">Annuler</button>
            <button class="primary-button" :disabled="isPaymentSaving" type="submit">
              {{ isPaymentSaving ? 'Enregistrement...' : 'Valider le reabonnement' }}
            </button>
          </div>
        </form>
      </article>
    </div>
  </div>
</template>

