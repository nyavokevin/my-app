import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import type { AttendanceAction, AttendanceSource, GymMemberInput } from './shared/gym-members';
import { GymMemberService } from './main/gym-member-service';

let memberService: GymMemberService | null = null;
let mainWindow: BrowserWindow | null = null;
let presenceWindow: BrowserWindow | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const loadRendererWindow = (window: BrowserWindow, search = '') => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const url = new URL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    url.search = search;
    window.loadURL(url.toString());
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      search ? { search } : undefined,
    );
  }
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loadRendererWindow(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

const createPresenceWindow = () => {
  if (presenceWindow && !presenceWindow.isDestroyed()) {
    presenceWindow.focus();
    return;
  }

  presenceWindow = new BrowserWindow({
    width: 560,
    height: 860,
    title: 'Presence client',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  loadRendererWindow(presenceWindow, 'view=presence-client');

  presenceWindow.on('closed', () => {
    presenceWindow = null;
  });
};

const registerGymMemberHandlers = () => {
  const getMemberService = () => {
    if (memberService === null) {
      memberService = new GymMemberService();
    }

    return memberService;
  };

  ipcMain.removeHandler('gym-members:list');
  ipcMain.removeHandler('gym-members:create');
  ipcMain.removeHandler('gym-members:update');
  ipcMain.removeHandler('gym-members:remove');
  ipcMain.removeHandler('gym-members:attendance-history');
  ipcMain.removeHandler('gym-members:attendance-checkin');
  ipcMain.removeHandler('gym-members:attendance-checkin-by-id');
  ipcMain.removeHandler('gym-members:open-client-presence-window');
  ipcMain.removeHandler('gym-members:stock:list');
  ipcMain.removeHandler('gym-members:stock:create');
  ipcMain.removeHandler('gym-members:stock:update');
  ipcMain.removeHandler('gym-members:stock:remove');
  ipcMain.removeHandler('gym-members:stock:history');
  ipcMain.removeHandler('gym-members:stock:restock');
  ipcMain.removeHandler('gym-members:stock:sell');
  ipcMain.removeHandler('gym-members:payments:list');
  ipcMain.removeHandler('gym-members:payments:create');
  ipcMain.removeHandler('gym-members:payments:remove');
  ipcMain.removeHandler('gym-members:membership-types:list');
  ipcMain.removeHandler('gym-members:membership-types:create');
  ipcMain.removeHandler('gym-members:membership-types:update');
  ipcMain.removeHandler('gym-members:membership-types:remove');
  ipcMain.removeHandler('gym-members:membership-subscriptions:create');
  ipcMain.removeHandler('gym-members:settings:get');
  ipcMain.removeHandler('gym-members:settings:update');
  ipcMain.removeHandler('gym-members:data:seed-demo');
  ipcMain.removeHandler('gym-members:data:reset');

  ipcMain.handle('gym-members:list', async () => getMemberService().listMembers());
  ipcMain.handle('gym-members:create', async (_event, member: GymMemberInput) => getMemberService().createMember(member));
  ipcMain.handle('gym-members:update', async (_event, id: number, member: GymMemberInput) => getMemberService().updateMember(id, member));
  ipcMain.handle('gym-members:remove', async (_event, id: number) => {
    getMemberService().deleteMember(id);
  });
  ipcMain.handle('gym-members:attendance-history', async () => getMemberService().listAttendanceHistory());
  ipcMain.handle('gym-members:attendance-checkin', async (_event, phone: string, source: AttendanceSource | undefined, action: AttendanceAction | undefined) => {
    return getMemberService().checkInByPhone(phone, source, action);
  });
  ipcMain.handle('gym-members:attendance-checkin-by-id', async (_event, memberId: number, action: AttendanceAction | undefined) => {
    return getMemberService().checkInByMemberId(memberId, action);
  });
  ipcMain.handle('gym-members:open-client-presence-window', async () => {
    createPresenceWindow();
  });
  ipcMain.handle('gym-members:stock:list', async () => getMemberService().listStockItems());
  ipcMain.handle('gym-members:stock:create', async (_event, item) => getMemberService().createStockItem(item));
  ipcMain.handle('gym-members:stock:update', async (_event, id: number, item) => getMemberService().updateStockItem(id, item));
  ipcMain.handle('gym-members:stock:remove', async (_event, id: number) => {
    getMemberService().deleteStockItem(id);
  });
  ipcMain.handle('gym-members:stock:history', async (_event, stockItemId: number) => getMemberService().listStockHistory(stockItemId));
  ipcMain.handle('gym-members:stock:restock', async (_event, id: number, input) => getMemberService().restockStockItem(id, input));
  ipcMain.handle('gym-members:stock:sell', async (_event, id: number, input) => getMemberService().sellStockItem(id, input));
  ipcMain.handle('gym-members:payments:list', async () => getMemberService().listPayments());
  ipcMain.handle('gym-members:payments:create', async (_event, payment) => getMemberService().createPayment(payment));
  ipcMain.handle('gym-members:payments:remove', async (_event, id: number) => {
    getMemberService().deletePayment(id);
  });
  ipcMain.handle('gym-members:membership-types:list', async () => getMemberService().listMembershipTypes());
  ipcMain.handle('gym-members:membership-types:create', async (_event, membershipType) => getMemberService().createMembershipType(membershipType));
  ipcMain.handle('gym-members:membership-types:update', async (_event, id: number, membershipType) => {
    return getMemberService().updateMembershipType(id, membershipType);
  });
  ipcMain.handle('gym-members:membership-types:remove', async (_event, id: number) => {
    getMemberService().deleteMembershipType(id);
  });
  ipcMain.handle('gym-members:membership-subscriptions:create', async (_event, input) => getMemberService().createMembershipSubscription(input));
  ipcMain.handle('gym-members:settings:get', async () => getMemberService().getAppSettings());
  ipcMain.handle('gym-members:settings:update', async (_event, settings) => getMemberService().updateAppSettings(settings));
  ipcMain.handle('gym-members:data:seed-demo', async () => {
    getMemberService().seedDemoData();
  });
  ipcMain.handle('gym-members:data:reset', async () => {
    getMemberService().resetAppData();
  });
};

const initializeMainProcess = () => {
  registerGymMemberHandlers();

  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
};

if (app.isReady()) {
  initializeMainProcess();
} else {
  app.on('ready', initializeMainProcess);
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
