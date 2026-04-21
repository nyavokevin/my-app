import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

import type {
  AttendanceAction,
  AttendanceRecord,
  AttendanceSource,
  GymMember,
  GymMemberInput,
  MembershipDurationUnit,
  MembershipSubscriptionInput,
  MembershipSubscriptionRecord,
  MembershipType,
  MembershipTypeInput,
  PaymentMethod,
  PaymentInput,
  PaymentRecord,
  PaymentCategory,
  StockItem,
  StockHistoryAction,
  StockHistoryRecord,
  StockItemInput,
  StockRestockInput,
  StockSaleInput,
} from '../shared/gym-members';

type GymMemberRow = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string;
  membership_type: string;
  joined_at: string;
  first_membership_at: string | null;
  membership_started_at: string | null;
  membership_ends_at: string | null;
  notes: string;
  active: number;
};

type AttendanceHistoryRow = {
  id: number;
  member_id: number;
  member_name: string;
  member_phone: string;
  checked_in_at: string;
  source: AttendanceSource;
  action: AttendanceAction;
};

type StockItemRow = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  created_at: string;
};

type StockHistoryRow = {
  id: number;
  stock_item_id: number;
  stock_item_name: string;
  action: StockHistoryAction;
  quantity: number;
  unit_price: number;
  total_amount: number;
  customer_name: string;
  customer_member_id: number | null;
  notes: string;
  created_at: string;
};

type PaymentRow = {
  id: number;
  label: string;
  amount: number;
  category: PaymentCategory;
  payment_method: PaymentMethod;
  created_at: string;
};

type MembershipTypeRow = {
  id: number;
  name: string;
  price: number;
  duration_count: number;
  duration_unit: MembershipDurationUnit;
  created_at: string;
};

type MembershipSubscriptionRow = {
  id: number;
  member_id: number;
  member_name: string;
  membership_type_id: number;
  membership_type_name: string;
  started_at: string;
  ends_at: string;
  payment_id: number | null;
  created_at: string;
};

export class GymMemberService {
  private database: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const databaseDirectory = path.join(userDataPath, 'data');

    fs.mkdirSync(databaseDirectory, { recursive: true });

    this.database = new Database(path.join(databaseDirectory, 'gym.sqlite'));
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('foreign_keys = ON');

    this.createSchema();
  }

  listMembers(): GymMember[] {
    const query = this.database.prepare(`
      SELECT
        id,
        full_name,
        email,
        phone,
        membership_type,
        joined_at,
        (
          SELECT MIN(ms.started_at)
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
        ) as first_membership_at,
        (
          SELECT ms.started_at
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
          ORDER BY ms.ends_at DESC, ms.started_at DESC, ms.id DESC
          LIMIT 1
        ) as membership_started_at,
        (
          SELECT ms.ends_at
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
          ORDER BY ms.ends_at DESC, ms.started_at DESC, ms.id DESC
          LIMIT 1
        ) as membership_ends_at,
        notes,
        active
      FROM gym_members
      ORDER BY joined_at DESC, full_name ASC
    `);

    return query.all().map((row) => this.mapRow(row as GymMemberRow));
  }

  createMember(member: GymMemberInput): GymMember {
    const normalized = this.normalizeMember(member);
    const statement = this.database.prepare(`
      INSERT INTO gym_members (
        full_name,
        email,
        phone,
        membership_type,
        joined_at,
        notes,
        active
      ) VALUES (
        @fullName,
        @email,
        @phone,
        @membershipType,
        @joinedAt,
        @notes,
        @active
      )
    `);

    const result = statement.run({
      ...normalized,
      active: normalized.active ? 1 : 0,
    });

    return this.getMemberById(Number(result.lastInsertRowid));
  }

  updateMember(id: number, member: GymMemberInput): GymMember {
    const normalized = this.normalizeMember(member);
    const statement = this.database.prepare(`
      UPDATE gym_members
      SET
        full_name = @fullName,
        email = @email,
        phone = @phone,
        membership_type = @membershipType,
        joined_at = @joinedAt,
        notes = @notes,
        active = @active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    const result = statement.run({
      id,
      ...normalized,
      active: normalized.active ? 1 : 0,
    });

    if (result.changes === 0) {
      throw new Error('Member not found');
    }

    return this.getMemberById(id);
  }

  deleteMember(id: number): void {
    const statement = this.database.prepare('DELETE FROM gym_members WHERE id = ?');
    const result = statement.run(id);

    if (result.changes === 0) {
      throw new Error('Member not found');
    }
  }

  listAttendanceHistory(): AttendanceRecord[] {
    const query = this.database.prepare(`
      SELECT
        id,
        member_id,
        member_name,
        member_phone,
        checked_in_at,
        source,
        action
      FROM attendance_history
      ORDER BY checked_in_at DESC, id DESC
      LIMIT 200
    `);

    return query.all().map((row) => this.mapAttendanceRow(row as AttendanceHistoryRow));
  }

  checkInByPhone(phone: string, source: AttendanceSource = 'phone-number', action: AttendanceAction = 'check-in'): AttendanceRecord {
    const normalizedPhone = this.normalizePhone(phone);

    if (!normalizedPhone) {
      throw new Error('Phone number is required');
    }

    const member = this.findMemberByPhone(normalizedPhone);

    if (!member.active) {
      throw new Error('Inactive members cannot be checked in');
    }

    return this.createAttendanceRecord(member, source, action);
  }

  checkInByMemberId(memberId: number, action: AttendanceAction = 'check-in'): AttendanceRecord {
    const member = this.getMemberRowById(memberId);

    if (!member.active) {
      throw new Error('Inactive members cannot be checked in');
    }

    return this.createAttendanceRecord(member, 'member-id', action);
  }

  listStockItems(): StockItem[] {
    const query = this.database.prepare(`
      SELECT id, name, price, quantity, created_at
      FROM stock_items
      ORDER BY created_at DESC, name ASC
    `);

    return query.all().map((row) => this.mapStockRow(row as StockItemRow));
  }

  listStockHistory(stockItemId: number): StockHistoryRecord[] {
    this.getStockItemById(stockItemId);

    const query = this.database.prepare(`
      SELECT
        id,
        stock_item_id,
        stock_item_name,
        action,
        quantity,
        unit_price,
        total_amount,
        customer_name,
        customer_member_id,
        notes,
        created_at
      FROM stock_history
      WHERE stock_item_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `);

    return query.all(stockItemId).map((row) => this.mapStockHistoryRow(row as StockHistoryRow));
  }

  createStockItem(item: StockItemInput): StockItem {
    const normalized = this.normalizeStockItem(item);
    const transaction = this.database.transaction(() => {
      const statement = this.database.prepare(`
        INSERT INTO stock_items (name, price, quantity)
        VALUES (@name, @price, @quantity)
      `);

      const result = statement.run(normalized);
      const stockItemId = Number(result.lastInsertRowid);
      this.createStockHistoryEntry(stockItemId, normalized.name, 'create', normalized.quantity, normalized.price, '', null, 'Creation du produit');
      return this.getStockItemById(stockItemId);
    });

    return transaction();
  }

  updateStockItem(id: number, item: StockItemInput): StockItem {
    const normalized = this.normalizeStockItem(item);
    const currentItem = this.getStockItemById(id);
    const statement = this.database.prepare(`
      UPDATE stock_items
      SET name = @name, price = @price, quantity = @quantity
      WHERE id = @id
    `);

    const result = statement.run({ id, ...normalized });

    if (result.changes === 0) {
      throw new Error('Stock item not found');
    }

    if (normalized.quantity > currentItem.quantity) {
      this.createStockHistoryEntry(
        id,
        normalized.name,
        'restock',
        normalized.quantity - currentItem.quantity,
        normalized.price,
        '',
        null,
        'Ajustement depuis la fiche produit',
      );
    }

    return this.getStockItemById(id);
  }

  restockStockItem(id: number, input: StockRestockInput): StockItem {
    const normalized = this.normalizeStockRestock(input);

    const transaction = this.database.transaction(() => {
      const stockItem = this.getStockItemById(id);
      const statement = this.database.prepare(`
        UPDATE stock_items
        SET quantity = quantity + @quantity
        WHERE id = @id
      `);

      statement.run({ id, quantity: normalized.quantity });
      this.createStockHistoryEntry(id, stockItem.name, 'restock', normalized.quantity, stockItem.price, '', null, normalized.notes);
      return this.getStockItemById(id);
    });

    return transaction();
  }

  sellStockItem(id: number, input: StockSaleInput): StockItem {
    const normalized = this.normalizeStockSale(input);

    const transaction = this.database.transaction(() => {
      const stockItem = this.getStockItemById(id);

      if (stockItem.quantity < normalized.quantity) {
        throw new Error('Stock insuffisant pour cette vente');
      }

      let customerName = normalized.customerName;

      if (normalized.customerMemberId !== null) {
        const member = this.getMemberRowById(normalized.customerMemberId);
        customerName = member.full_name;
      }

      const updateStatement = this.database.prepare(`
        UPDATE stock_items
        SET quantity = quantity - @quantity
        WHERE id = @id
      `);

      updateStatement.run({ id, quantity: normalized.quantity });

      this.createStockHistoryEntry(
        id,
        stockItem.name,
        'sale',
        normalized.quantity,
        stockItem.price,
        customerName,
        normalized.customerMemberId,
        normalized.notes,
      );

      const paymentStatement = this.database.prepare(`
        INSERT INTO payments (label, amount, category, payment_method)
        VALUES (@label, @amount, 'stock', 'cash')
      `);

      paymentStatement.run({
        label: `Vente stock: ${stockItem.name} x${normalized.quantity} - ${customerName}`,
        amount: stockItem.price * normalized.quantity,
      });

      return this.getStockItemById(id);
    });

    return transaction();
  }

  deleteStockItem(id: number): void {
    const statement = this.database.prepare('DELETE FROM stock_items WHERE id = ?');
    const result = statement.run(id);

    if (result.changes === 0) {
      throw new Error('Stock item not found');
    }
  }

  listPayments(): PaymentRecord[] {
    const query = this.database.prepare(`
      SELECT id, label, amount, category, payment_method, created_at
      FROM payments
      ORDER BY created_at DESC, id DESC
    `);

    return query.all().map((row) => this.mapPaymentRow(row as PaymentRow));
  }

  createPayment(payment: PaymentInput): PaymentRecord {
    const normalized = this.normalizePayment(payment);
    const statement = this.database.prepare(`
      INSERT INTO payments (label, amount, category, payment_method)
      VALUES (@label, @amount, @category, @paymentMethod)
    `);

    const result = statement.run(normalized);
    return this.getPaymentById(Number(result.lastInsertRowid));
  }

  deletePayment(id: number): void {
    const statement = this.database.prepare('DELETE FROM payments WHERE id = ?');
    const result = statement.run(id);

    if (result.changes === 0) {
      throw new Error('Payment not found');
    }
  }

  listMembershipTypes(): MembershipType[] {
    const query = this.database.prepare(`
      SELECT id, name, price, duration_count, duration_unit, created_at
      FROM membership_types
      ORDER BY price ASC, name ASC
    `);

    return query.all().map((row) => this.mapMembershipTypeRow(row as MembershipTypeRow));
  }

  createMembershipType(membershipType: MembershipTypeInput): MembershipType {
    const normalized = this.normalizeMembershipType(membershipType);
    const statement = this.database.prepare(`
      INSERT INTO membership_types (name, price, duration_count, duration_unit)
      VALUES (@name, @price, @durationCount, @durationUnit)
    `);

    const result = statement.run(normalized);
    return this.getMembershipTypeById(Number(result.lastInsertRowid));
  }

  updateMembershipType(id: number, membershipType: MembershipTypeInput): MembershipType {
    const normalized = this.normalizeMembershipType(membershipType);
    const statement = this.database.prepare(`
      UPDATE membership_types
      SET name = @name, price = @price, duration_count = @durationCount, duration_unit = @durationUnit
      WHERE id = @id
    `);

    const result = statement.run({ id, ...normalized });

    if (result.changes === 0) {
      throw new Error('Membership type not found');
    }

    return this.getMembershipTypeById(id);
  }

  createMembershipSubscription(input: MembershipSubscriptionInput): MembershipSubscriptionRecord {
    const normalized = this.normalizeMembershipSubscription(input);

    const transaction = this.database.transaction(() => {
      const member = this.getMemberRowById(normalized.memberId);
      const membershipType = this.getMembershipTypeRowById(normalized.membershipTypeId);
      const endsAt = this.calculateMembershipEndDate(
        normalized.startedAt,
        membershipType.duration_count,
        membershipType.duration_unit,
      );

      const paymentResult = this.database.prepare(`
        INSERT INTO payments (label, amount, category, payment_method)
        VALUES (@label, @amount, 'membership', @paymentMethod)
      `).run({
        label: `Adhesion ${membershipType.name} - ${member.full_name}`,
        amount: membershipType.price,
        paymentMethod: normalized.paymentMethod,
      });

      const subscriptionResult = this.database.prepare(`
        INSERT INTO membership_subscriptions (
          member_id,
          member_name,
          membership_type_id,
          membership_type_name,
          started_at,
          ends_at,
          payment_id
        ) VALUES (
          @memberId,
          @memberName,
          @membershipTypeId,
          @membershipTypeName,
          @startedAt,
          @endsAt,
          @paymentId
        )
      `).run({
        memberId: member.id,
        memberName: member.full_name,
        membershipTypeId: membershipType.id,
        membershipTypeName: membershipType.name,
        startedAt: normalized.startedAt,
        endsAt,
        paymentId: Number(paymentResult.lastInsertRowid),
      });

      this.database.prepare(`
        UPDATE gym_members
        SET membership_type = @membershipType
        WHERE id = @memberId
      `).run({
        memberId: member.id,
        membershipType: membershipType.name,
      });

      return this.getMembershipSubscriptionById(Number(subscriptionResult.lastInsertRowid));
    });

    return transaction();
  }

  deleteMembershipType(id: number): void {
    const statement = this.database.prepare('DELETE FROM membership_types WHERE id = ?');
    const result = statement.run(id);

    if (result.changes === 0) {
      throw new Error('Membership type not found');
    }
  }

  private createSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS gym_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT NOT NULL,
        membership_type TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        member_phone TEXT NOT NULL,
        checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL DEFAULT 'phone-number',
        action TEXT NOT NULL DEFAULT 'check-in',
        FOREIGN KEY (member_id) REFERENCES gym_members(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_attendance_history_checked_in_at
      ON attendance_history (checked_in_at DESC);

      CREATE TABLE IF NOT EXISTS stock_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_item_id INTEGER NOT NULL,
        stock_item_name TEXT NOT NULL,
        action TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_member_id INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_member_id) REFERENCES gym_members(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_stock_history_item_created_at
      ON stock_history (stock_item_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL DEFAULT 'membership',
        payment_method TEXT NOT NULL DEFAULT 'cash',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS membership_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        price REAL NOT NULL,
        duration_count INTEGER NOT NULL DEFAULT 1,
        duration_unit TEXT NOT NULL DEFAULT 'months',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS membership_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        membership_type_id INTEGER NOT NULL,
        membership_type_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        payment_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        ,FOREIGN KEY (member_id) REFERENCES gym_members(id) ON DELETE CASCADE
        ,FOREIGN KEY (membership_type_id) REFERENCES membership_types(id) ON DELETE RESTRICT
        ,FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
      );
    `);

    const attendanceColumns = this.database.prepare('PRAGMA table_info(attendance_history)').all() as Array<{ name: string }>;
    const hasActionColumn = attendanceColumns.some((column) => column.name === 'action');

    if (!hasActionColumn) {
      this.database.exec(`
        ALTER TABLE attendance_history
        ADD COLUMN action TEXT NOT NULL DEFAULT 'check-in';
      `);
    }

    const stockColumns = this.database.prepare('PRAGMA table_info(stock_items)').all() as Array<{ name: string }>;
    const hasQuantityColumn = stockColumns.some((column) => column.name === 'quantity');

    if (!hasQuantityColumn) {
      this.database.exec(`
        ALTER TABLE stock_items
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0;
      `);
    }

    const paymentColumns = this.database.prepare('PRAGMA table_info(payments)').all() as Array<{ name: string }>;

    if (!paymentColumns.some((column) => column.name === 'payment_method')) {
      this.database.exec(`
        ALTER TABLE payments
        ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';
      `);
    }

    const memberColumns = this.database.prepare('PRAGMA table_info(gym_members)').all() as Array<{ name: string; notnull: number }>;
    const emailColumn = memberColumns.find((column) => column.name === 'email');

    if (emailColumn?.notnull === 1) {
      this.database.exec(`
        PRAGMA foreign_keys = OFF;

        ALTER TABLE gym_members RENAME TO gym_members_legacy;

        CREATE TABLE gym_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT NOT NULL,
          membership_type TEXT NOT NULL,
          joined_at TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO gym_members (
          id,
          full_name,
          email,
          phone,
          membership_type,
          joined_at,
          notes,
          active,
          created_at,
          updated_at
        )
        SELECT
          id,
          full_name,
          NULLIF(TRIM(email), ''),
          phone,
          membership_type,
          joined_at,
          notes,
          active,
          created_at,
          updated_at
        FROM gym_members_legacy;
      `);

      this.repairLegacyGymMemberReferences();

      this.database.exec(`
        DROP TABLE gym_members_legacy;

        PRAGMA foreign_keys = ON;
      `);
    }

    if (this.hasLegacyGymMemberReferences()) {
      this.repairLegacyGymMemberReferences();
    }

    const membershipTypeColumns = this.database.prepare('PRAGMA table_info(membership_types)').all() as Array<{ name: string }>;

    if (!membershipTypeColumns.some((column) => column.name === 'duration_count')) {
      this.database.exec(`
        ALTER TABLE membership_types
        ADD COLUMN duration_count INTEGER NOT NULL DEFAULT 1;
      `);
    }

    if (!membershipTypeColumns.some((column) => column.name === 'duration_unit')) {
      this.database.exec(`
        ALTER TABLE membership_types
        ADD COLUMN duration_unit TEXT NOT NULL DEFAULT 'months';
      `);
    }

    const membershipTypeCount = this.database.prepare('SELECT COUNT(*) as total FROM membership_types').get() as { total: number };

    if (membershipTypeCount.total === 0) {
      const seedStatement = this.database.prepare(`
        INSERT INTO membership_types (name, price, duration_count, duration_unit)
        VALUES (?, ?, ?, ?)
      `);

      const seedTransaction = this.database.transaction(() => {
        seedStatement.run('Monthly', 39, 1, 'months');
        seedStatement.run('Quarterly', 59, 3, 'months');
        seedStatement.run('Annual', 75, 1, 'years');
        seedStatement.run('Premium', 89, 1, 'months');
      });

      seedTransaction();
    }
  }

  private hasLegacyGymMemberReferences(): boolean {
    return ['attendance_history', 'stock_history', 'membership_subscriptions'].some((tableName) => {
      const foreignKeys = this.database.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as Array<{ table: string }>;
      return foreignKeys.some((foreignKey) => foreignKey.table === 'gym_members_legacy');
    });
  }

  private repairLegacyGymMemberReferences(): void {
    this.database.exec(`
      PRAGMA foreign_keys = OFF;

      DROP INDEX IF EXISTS idx_attendance_history_checked_in_at;
      ALTER TABLE attendance_history RENAME TO attendance_history_legacy;

      CREATE TABLE attendance_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        member_phone TEXT NOT NULL,
        checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        source TEXT NOT NULL DEFAULT 'phone-number',
        action TEXT NOT NULL DEFAULT 'check-in',
        FOREIGN KEY (member_id) REFERENCES gym_members(id) ON DELETE CASCADE
      );

      INSERT INTO attendance_history (
        id,
        member_id,
        member_name,
        member_phone,
        checked_in_at,
        source,
        action
      )
      SELECT
        id,
        member_id,
        member_name,
        member_phone,
        checked_in_at,
        source,
        action
      FROM attendance_history_legacy;

      DROP TABLE attendance_history_legacy;
      CREATE INDEX idx_attendance_history_checked_in_at ON attendance_history (checked_in_at DESC);

      DROP INDEX IF EXISTS idx_stock_history_item_created_at;
      ALTER TABLE stock_history RENAME TO stock_history_legacy;

      CREATE TABLE stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_item_id INTEGER NOT NULL,
        stock_item_name TEXT NOT NULL,
        action TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_member_id INTEGER,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
        FOREIGN KEY (customer_member_id) REFERENCES gym_members(id) ON DELETE SET NULL
      );

      INSERT INTO stock_history (
        id,
        stock_item_id,
        stock_item_name,
        action,
        quantity,
        unit_price,
        total_amount,
        customer_name,
        customer_member_id,
        notes,
        created_at
      )
      SELECT
        id,
        stock_item_id,
        stock_item_name,
        action,
        quantity,
        unit_price,
        total_amount,
        customer_name,
        customer_member_id,
        notes,
        created_at
      FROM stock_history_legacy;

      DROP TABLE stock_history_legacy;
      CREATE INDEX idx_stock_history_item_created_at ON stock_history (stock_item_id, created_at DESC);

      ALTER TABLE membership_subscriptions RENAME TO membership_subscriptions_legacy;

      CREATE TABLE membership_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        membership_type_id INTEGER NOT NULL,
        membership_type_name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        payment_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES gym_members(id) ON DELETE CASCADE,
        FOREIGN KEY (membership_type_id) REFERENCES membership_types(id) ON DELETE RESTRICT,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
      );

      INSERT INTO membership_subscriptions (
        id,
        member_id,
        member_name,
        membership_type_id,
        membership_type_name,
        started_at,
        ends_at,
        payment_id,
        created_at
      )
      SELECT
        id,
        member_id,
        member_name,
        membership_type_id,
        membership_type_name,
        started_at,
        ends_at,
        payment_id,
        created_at
      FROM membership_subscriptions_legacy;

      DROP TABLE membership_subscriptions_legacy;

      PRAGMA foreign_keys = ON;
    `);
  }

  private getMemberById(id: number): GymMember {
    const statement = this.database.prepare(`
      SELECT
        id,
        full_name,
        email,
        phone,
        membership_type,
        joined_at,
        (
          SELECT MIN(ms.started_at)
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
        ) as first_membership_at,
        (
          SELECT ms.started_at
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
          ORDER BY ms.ends_at DESC, ms.started_at DESC, ms.id DESC
          LIMIT 1
        ) as membership_started_at,
        (
          SELECT ms.ends_at
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
          ORDER BY ms.ends_at DESC, ms.started_at DESC, ms.id DESC
          LIMIT 1
        ) as membership_ends_at,
        notes,
        active
      FROM gym_members
      WHERE id = ?
    `);

    const row = statement.get(id) as GymMemberRow | undefined;

    if (!row) {
      throw new Error('Member not found');
    }

    return this.mapRow(row);
  }

  private getAttendanceById(id: number): AttendanceRecord {
    const statement = this.database.prepare(`
      SELECT
        id,
        member_id,
        member_name,
        member_phone,
        checked_in_at,
        source,
        action
      FROM attendance_history
      WHERE id = ?
    `);

    const row = statement.get(id) as AttendanceHistoryRow | undefined;

    if (!row) {
      throw new Error('Attendance record not found');
    }

    return this.mapAttendanceRow(row);
  }

  private getMemberRowById(id: number): GymMemberRow {
    const statement = this.database.prepare(`
      SELECT
        id,
        full_name,
        email,
        phone,
        membership_type,
        joined_at,
        (
          SELECT MIN(ms.started_at)
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
        ) as first_membership_at,
        (
          SELECT ms.started_at
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
          ORDER BY ms.ends_at DESC, ms.started_at DESC, ms.id DESC
          LIMIT 1
        ) as membership_started_at,
        (
          SELECT ms.ends_at
          FROM membership_subscriptions ms
          WHERE ms.member_id = gym_members.id
          ORDER BY ms.ends_at DESC, ms.started_at DESC, ms.id DESC
          LIMIT 1
        ) as membership_ends_at,
        notes,
        active
      FROM gym_members
      WHERE id = ?
    `);

    const row = statement.get(id) as GymMemberRow | undefined;

    if (!row) {
      throw new Error('Member not found');
    }

    return row;
  }

  private getStockItemById(id: number): StockItem {
    const statement = this.database.prepare(`
      SELECT id, name, price, quantity, created_at
      FROM stock_items
      WHERE id = ?
    `);

    const row = statement.get(id) as StockItemRow | undefined;

    if (!row) {
      throw new Error('Stock item not found');
    }

    return this.mapStockRow(row);
  }

  private getPaymentById(id: number): PaymentRecord {
    const statement = this.database.prepare(`
      SELECT id, label, amount, category, payment_method, created_at
      FROM payments
      WHERE id = ?
    `);

    const row = statement.get(id) as PaymentRow | undefined;

    if (!row) {
      throw new Error('Payment not found');
    }

    return this.mapPaymentRow(row);
  }

  private getMembershipTypeById(id: number): MembershipType {
    const statement = this.database.prepare(`
      SELECT id, name, price, duration_count, duration_unit, created_at
      FROM membership_types
      WHERE id = ?
    `);

    const row = statement.get(id) as MembershipTypeRow | undefined;

    if (!row) {
      throw new Error('Membership type not found');
    }

    return this.mapMembershipTypeRow(row);
  }

  private getMembershipTypeRowById(id: number): MembershipTypeRow {
    const statement = this.database.prepare(`
      SELECT id, name, price, duration_count, duration_unit, created_at
      FROM membership_types
      WHERE id = ?
    `);

    const row = statement.get(id) as MembershipTypeRow | undefined;

    if (!row) {
      throw new Error('Membership type not found');
    }

    return row;
  }

  private getMembershipSubscriptionById(id: number): MembershipSubscriptionRecord {
    const statement = this.database.prepare(`
      SELECT
        id,
        member_id,
        member_name,
        membership_type_id,
        membership_type_name,
        started_at,
        ends_at,
        payment_id,
        created_at
      FROM membership_subscriptions
      WHERE id = ?
    `);

    const row = statement.get(id) as MembershipSubscriptionRow | undefined;

    if (!row) {
      throw new Error('Membership subscription not found');
    }

    return this.mapMembershipSubscriptionRow(row);
  }

  private findMemberByPhone(phone: string): GymMemberRow {
    const statement = this.database.prepare(`
      SELECT
        id,
        full_name,
        email,
        phone,
        membership_type,
        joined_at,
        notes,
        active
      FROM gym_members
      ORDER BY full_name ASC
    `);

    const rows = statement.all() as GymMemberRow[];
    const row = rows.find((candidate) => this.normalizePhone(candidate.phone) === phone);

    if (!row) {
      throw new Error('No member found for this phone number');
    }

    return row;
  }

  private createAttendanceRecord(member: GymMemberRow, source: AttendanceSource, action: AttendanceAction): AttendanceRecord {
    const statement = this.database.prepare(`
      INSERT INTO attendance_history (
        member_id,
        member_name,
        member_phone,
        source,
        action
      ) VALUES (
        @memberId,
        @memberName,
        @memberPhone,
        @source,
        @action
      )
    `);

    const result = statement.run({
      memberId: member.id,
      memberName: member.full_name,
      memberPhone: member.phone,
      source,
      action,
    });

    return this.getAttendanceById(Number(result.lastInsertRowid));
  }

  private mapRow(row: GymMemberRow): GymMember {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      membershipType: row.membership_type,
      joinedAt: row.joined_at,
      firstMembershipAt: row.first_membership_at,
      membershipStartedAt: row.membership_started_at,
      membershipEndsAt: row.membership_ends_at,
      notes: row.notes,
      active: Boolean(row.active),
    };
  }

  private mapAttendanceRow(row: AttendanceHistoryRow): AttendanceRecord {
    return {
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      memberPhone: row.member_phone,
      checkedInAt: row.checked_in_at,
      source: row.source,
      action: row.action,
    };
  }

  private mapStockRow(row: StockItemRow): StockItem {
    return {
      id: row.id,
      name: row.name,
      price: row.price,
      quantity: row.quantity,
      createdAt: row.created_at,
    };
  }

  private mapStockHistoryRow(row: StockHistoryRow): StockHistoryRecord {
    return {
      id: row.id,
      stockItemId: row.stock_item_id,
      stockItemName: row.stock_item_name,
      action: row.action,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      totalAmount: row.total_amount,
      customerName: row.customer_name,
      customerMemberId: row.customer_member_id,
      notes: row.notes,
      createdAt: row.created_at,
    };
  }

  private mapPaymentRow(row: PaymentRow): PaymentRecord {
    return {
      id: row.id,
      label: row.label,
      amount: row.amount,
      category: row.category,
      paymentMethod: row.payment_method,
      createdAt: row.created_at,
    };
  }

  private mapMembershipTypeRow(row: MembershipTypeRow): MembershipType {
    return {
      id: row.id,
      name: row.name,
      price: row.price,
      durationCount: row.duration_count,
      durationUnit: row.duration_unit,
      createdAt: row.created_at,
    };
  }

  private mapMembershipSubscriptionRow(row: MembershipSubscriptionRow): MembershipSubscriptionRecord {
    return {
      id: row.id,
      memberId: row.member_id,
      memberName: row.member_name,
      membershipTypeId: row.membership_type_id,
      membershipTypeName: row.membership_type_name,
      startedAt: row.started_at,
      endsAt: row.ends_at,
      paymentId: row.payment_id,
      createdAt: row.created_at,
    };
  }

  private normalizeMember(member: GymMemberInput): GymMemberInput {
    const normalized = {
      fullName: member.fullName.trim(),
      email: member.email?.trim().toLowerCase() || null,
      phone: member.phone.trim(),
      membershipType: member.membershipType.trim(),
      joinedAt: member.joinedAt.trim(),
      notes: member.notes.trim(),
      active: Boolean(member.active),
    };

    if (!normalized.fullName || !normalized.phone || !normalized.membershipType || !normalized.joinedAt) {
      throw new Error('Missing required member fields');
    }

    if (!this.normalizePhone(normalized.phone)) {
      throw new Error('Invalid phone number');
    }

    return normalized;
  }

  private normalizeStockItem(item: StockItemInput): StockItemInput {
    const normalized = {
      name: item.name.trim(),
      price: Number(item.price),
      quantity: Number(item.quantity),
    };

    if (
      !normalized.name
      || Number.isNaN(normalized.price)
      || normalized.price < 0
      || Number.isNaN(normalized.quantity)
      || normalized.quantity < 0
    ) {
      throw new Error('Invalid stock item');
    }

    return normalized;
  }

  private normalizeStockRestock(input: StockRestockInput): StockRestockInput {
    const normalized = {
      quantity: Number(input.quantity),
      notes: input.notes.trim(),
    };

    if (Number.isNaN(normalized.quantity) || normalized.quantity <= 0) {
      throw new Error('Quantite de restock invalide');
    }

    return normalized;
  }

  private normalizeStockSale(input: StockSaleInput): StockSaleInput {
    const normalized = {
      quantity: Number(input.quantity),
      customerName: input.customerName.trim(),
      customerMemberId: input.customerMemberId === null ? null : Number(input.customerMemberId),
      notes: input.notes.trim(),
    };

    if (Number.isNaN(normalized.quantity) || normalized.quantity <= 0) {
      throw new Error('Quantite de vente invalide');
    }

    if (!normalized.customerName && normalized.customerMemberId === null) {
      throw new Error('Client requis pour enregistrer une vente');
    }

    if (normalized.customerMemberId !== null && Number.isNaN(normalized.customerMemberId)) {
      throw new Error('Client invalide');
    }

    return normalized;
  }

  private createStockHistoryEntry(
    stockItemId: number,
    stockItemName: string,
    action: StockHistoryAction,
    quantity: number,
    unitPrice: number,
    customerName: string,
    customerMemberId: number | null,
    notes: string,
  ): void {
    const statement = this.database.prepare(`
      INSERT INTO stock_history (
        stock_item_id,
        stock_item_name,
        action,
        quantity,
        unit_price,
        total_amount,
        customer_name,
        customer_member_id,
        notes
      ) VALUES (
        @stockItemId,
        @stockItemName,
        @action,
        @quantity,
        @unitPrice,
        @totalAmount,
        @customerName,
        @customerMemberId,
        @notes
      )
    `);

    statement.run({
      stockItemId,
      stockItemName,
      action,
      quantity,
      unitPrice,
      totalAmount: unitPrice * quantity,
      customerName,
      customerMemberId,
      notes,
    });
  }

  private normalizePayment(payment: PaymentInput): PaymentInput {
    const normalized = {
      label: payment.label.trim(),
      amount: Number(payment.amount),
      category: payment.category,
      paymentMethod: payment.paymentMethod,
    };

    if (!normalized.label || Number.isNaN(normalized.amount) || normalized.amount < 0) {
      throw new Error('Invalid payment');
    }

    if (normalized.category !== 'membership' && normalized.category !== 'stock') {
      throw new Error('Invalid payment category');
    }

    if (normalized.paymentMethod !== 'cash' && normalized.paymentMethod !== 'mobile-money') {
      throw new Error('Invalid payment method');
    }

    return normalized;
  }

  private normalizeMembershipType(membershipType: MembershipTypeInput): MembershipTypeInput {
    const normalized = {
      name: membershipType.name.trim(),
      price: Number(membershipType.price),
      durationCount: Number(membershipType.durationCount),
      durationUnit: membershipType.durationUnit,
    };

    if (!normalized.name || Number.isNaN(normalized.price) || normalized.price < 0) {
      throw new Error('Invalid membership type');
    }

    if (Number.isNaN(normalized.durationCount) || normalized.durationCount <= 0) {
      throw new Error('Invalid membership duration');
    }

    if (!['days', 'months', 'years'].includes(normalized.durationUnit)) {
      throw new Error('Invalid membership duration unit');
    }

    return normalized;
  }

  private normalizeMembershipSubscription(input: MembershipSubscriptionInput): MembershipSubscriptionInput {
    const normalized = {
      memberId: Number(input.memberId),
      membershipTypeId: Number(input.membershipTypeId),
      startedAt: input.startedAt.trim(),
      paymentMethod: input.paymentMethod,
    };

    if (Number.isNaN(normalized.memberId) || normalized.memberId <= 0) {
      throw new Error('Invalid member');
    }

    if (Number.isNaN(normalized.membershipTypeId) || normalized.membershipTypeId <= 0) {
      throw new Error('Invalid membership type');
    }

    if (!normalized.startedAt) {
      throw new Error('Start date is required');
    }

    if (normalized.paymentMethod !== 'cash' && normalized.paymentMethod !== 'mobile-money') {
      throw new Error('Invalid payment method');
    }

    return normalized;
  }

  private calculateMembershipEndDate(startedAt: string, durationCount: number, durationUnit: MembershipDurationUnit): string {
    const date = new Date(startedAt.includes('T') ? startedAt : `${startedAt}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid membership start date');
    }

    if (durationUnit === 'days') {
      date.setDate(date.getDate() + durationCount);
    } else if (durationUnit === 'months') {
      date.setMonth(date.getMonth() + durationCount);
    } else {
      date.setFullYear(date.getFullYear() + durationCount);
    }

    return date.toISOString().slice(0, 10);
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }
}