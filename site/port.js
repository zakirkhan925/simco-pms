/**
 * What the new system has taken over, and what it has not yet.
 *
 * Inlined by site/build.ts after every screen file and before boot runs
 * (boot waits for DOMContentLoaded). It uses the app's own gating: App.phases
 * says which phases are built, isBuilt() reads it, and every screen and
 * project tab already greys out what is not built. The only additions are the
 * three phase-1 screens whose server side has not moved, and a guard on
 * navigate(), which in the original trusted every link to point somewhere
 * built.
 *
 * Update PHASES and NOT_MOVED as modules are ported. Nothing else should need
 * to change.
 */
(function () {
  'use strict';

  /** Same table as PHASE_STATUS in src/Code.gs; `done` means "moved". */
  const PHASES = {
    1:  { name: 'Database, Authentication, Roles, Layout', done: true },
    2:  { name: 'Projects and Project Dashboard', done: true },
    3:  { name: 'BOQ, Budget, Schedule', done: true },
    4:  { name: 'Vendors and Procurement', done: true },
    5:  { name: 'Purchase Request Approval Workflow', done: true },
    6:  { name: 'RFQ, Quotations, Purchase Orders', done: true },
    7:  { name: 'Inventory, GRN, Material Issue', done: true },
    8:  { name: 'RAR / IPC and Client Billing', done: false },
    9:  { name: 'Expenses and Subcontractors', done: false },
    10: { name: 'Reports and Management Dashboard', done: false },
    11: { name: 'Bulk Import / Export, Templates and Documents', done: false },
    12: { name: 'Audit, Notifications, Security, Performance hardening', done: false },
    13: { name: 'Working cash advances and site imprest', done: false }
  };

  /**
   * Phase-1 screens whose server functions are not on the new server:
   * the dashboard (getDashboard, getDecisionQueue — they total billing,
   * stock and costs, none of which has moved), the audit log (listAuditLog)
   * and the database page (getDatabaseStatus, setupDatabase).
   */
  const NOT_MOVED = ['dashboard', 'audit', 'database'];

  /**
   * Screens that are not in the menu, and the menu entry they belong to.
   * Anything not listed here and not in the menu is treated as not moved:
   * a new detail screen has to be added on purpose, never by default.
   */
  const DETAIL_ROUTES = {
    project: 'projects',
    vendor: 'vendors',
    'purchase-request': 'purchase-requests',
    rfq: 'rfqs',
    'purchase-order': 'purchase-orders',
    profile: null
  };

  const FILES_NOT_STORED = {
    success: false, code: 'NOT_IMPLEMENTED',
    message: 'Files are not stored on the new system yet, so nothing was uploaded. ' +
      'Record the rates without the file, and keep the vendor\'s document on the existing system for now.'
  };

  window.PMS_PORT = {
    phases: PHASES,
    notMoved: NOT_MOVED,
    // Answered in the page; see call() in site/bridge.js.
    local: {
      getAppMeta: () => ({ success: true, message: 'Meta', data: { phases: PHASES } }),
      // Refused before the file leaves the browser; the server refuses too.
      attachQuotationDocument: () => FILES_NOT_STORED,
      recordQuotation: (token, rfqId, vendorId, d) =>
        d && d.attachment && d.attachment.Base64 ? FILES_NOT_STORED : undefined
    }
  };

  // Set now, not when getAppMeta answers: boot navigates in the same tick as
  // it asks, and the guard below needs the table already in place.
  App.phases = PHASES;

  isBuilt = function (item) {
    return !!(App.phases[item.phase] && App.phases[item.phase].done) &&
      NOT_MOVED.indexOf(item.id) === -1;
  };

  function navItem(route) {
    for (const g of NAV) {
      const found = g.items.find(i => i.id === route);
      if (found) return found;
    }
    return null;
  }

  function moved(route) {
    const item = navItem(route);
    if (item) return isBuilt(item);
    if (Object.prototype.hasOwnProperty.call(DETAIL_ROUTES, route)) {
      const parent = DETAIL_ROUTES[route];
      return parent ? moved(parent) : true;
    }
    return false;
  }

  /** The first moved screen this person may open, in menu order. */
  function landingRoute() {
    for (const g of NAV) {
      for (const i of g.items) {
        if (can(i.perm) && isBuilt(i) && typeof PAGES[i.id] === 'function') return i.id;
      }
    }
    return 'profile';
  }

  const originalNavigate = navigate;
  navigate = function (route, arg) {
    if (moved(route)) return originalNavigate(route, arg);
    // Sign-in and boot land on the dashboard, which has not moved: open the
    // first screen that has instead of an error.
    if (route === 'dashboard') return originalNavigate(landingRoute());
    const item = navItem(route) || navItem(ROUTE_PARENTS[route]);
    UI.warn('Not moved yet',
      (item ? item.label : 'That screen') + ' has not moved to the new system yet. ' +
      'It is still worked on in the live system.');
  };

  // Badges come from getNavCounts, which totals stock, billing and costs as
  // well as procurement; it is not on the new server, so there are none.
  refreshNavCounts = function () { App.navCounts = {}; };

  // Search and notifications read across every module; neither has moved.
  initGlobalSearch = function () {
    const input = document.getElementById('globalSearch');
    if (!input) return;
    input.disabled = true;
    input.placeholder = 'Search has not moved to the new system yet';
    input.title = input.placeholder;
  };
  initNotifications = function () {
    const btn = document.getElementById('notifBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.style.opacity = '.4';
    btn.style.cursor = 'not-allowed';
    btn.title = 'Notifications have not moved to the new system yet';
  };
})();
