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
    8:  { name: 'RAR / IPC and Client Billing', done: true },
    9:  { name: 'Expenses and Subcontractors', done: true },
    10: { name: 'Reports and Management Dashboard', done: true },
    11: { name: 'Bulk Import / Export, Templates and Documents', done: true },
    12: { name: 'Audit, Notifications, Security, Performance hardening', done: true },
    13: { name: 'Working cash advances and site imprest', done: true }
  };

  /**
   * Screens inside a moved phase that have not moved themselves:
   *  - database: it inspected and created the Google Sheet's tabs
   *    (getDatabaseStatus, setupDatabase), which mean nothing here.
   * Should bulk import and export ever be shut again, add 'data' here and
   * set IMPORT_EXPORT_MOVED to false: the list screens' Import / Template /
   * Export buttons are then greyed too (see below).
   */
  const NOT_MOVED = ['database'];
  const IMPORT_EXPORT_MOVED = true;

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
    'rar-bill': 'rar',
    // A project's billing position. Its menu parent is Projects, but it is
    // the billing module's screen, so it opens when RAR / IPC has moved.
    billing: 'rar',
    expense: 'expenses',
    subcontractor: 'subcontractors',
    agreements: 'subcontractors',
    agreement: 'subcontractors',
    subbill: 'subcontractors',
    payables: 'subcontractors',
    'cash-account': 'cash',
    'cash-reports': 'cash',
    'cash-report': 'cash',
    report: 'reports',
    profile: null
  };

  window.PMS_PORT = {
    phases: PHASES,
    notMoved: NOT_MOVED,
    // Answered in the page; see call() in site/bridge.js. Files are the
    // server's to accept or refuse: it knows whether Drive is connected.
    local: {
      getAppMeta: () => ({ success: true, message: 'Meta', data: { phases: PHASES } }),
      // The original checked that every Apps Script file arrived whole. The
      // server here is one bundle with no such files, so there is nothing to
      // list; asking it cost a refused request on every page load. No data:
      // the startup band treats that as "nothing missing" and the diagnostics
      // screen leaves out its "Server files" card, as for an older build.
      getDeploymentCheck: () => ({ success: true, message: 'Deployment check', data: null })
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

  // The old system was switched off after cutover (22 Oct 2026), so a screen
  // that has not moved can no longer send anyone back to it. The Database
  // page managed the Google Sheet's tabs and has no meaning here: it leaves
  // the menu rather than sitting there greyed out.
  NAV.forEach(g => { g.items = g.items.filter(i => i.id !== 'database'); });

  const originalNavigate = navigate;
  navigate = function (route, arg) {
    if (moved(route)) return originalNavigate(route, arg);
    // Sign-in and boot land on the dashboard. Should it ever be shut, open
    // the first screen that has moved instead of an error.
    if (route === 'dashboard') return originalNavigate(landingRoute());
    const item = navItem(route) || navItem(ROUTE_PARENTS[route]);
    UI.warn('Not available',
      (item ? item.label : 'That screen') + ' is not part of the new system.');
  };

  // Import, Template and Export on the list screens belong to the import /
  // export module. Until it moves, the buttons are shown greyed with the
  // reason, rather than failing after a click.
  const originalImportExportBar = importExportBar;
  importExportBar = function () {
    const bar = originalImportExportBar.apply(this, arguments);
    if (!IMPORT_EXPORT_MOVED) {
      bar.querySelectorAll('button').forEach(b => {
        b.disabled = true;
        b.title = 'Import and export have not moved to the new system yet';
      });
    }
    return bar;
  };
})();
