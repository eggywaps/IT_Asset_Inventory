(function(){
  const STORAGE_KEY = 'inventory';
  const STORAGE_KEY_SVC = 'serviceUnits';
  let devices = [];
  let serviceUnits = [];
  let editingId = null;
  let editingSvcId = null;
  let deleteTargetId = null;
  let deleteTargetType = 'device';
  let sortKey = 'itemNo';
  let sortDir = 1;
  let sortKeySvc = 'dateReceived';
  let sortDirSvc = -1;

  const tbody = document.getElementById('tbody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const filterDept = document.getElementById('filterDept');
  const filterCharger = document.getElementById('filterCharger');
  const panel = document.getElementById('panel');
  const scrim = document.getElementById('scrim');
  const confirmBox = document.getElementById('confirmBox');
  const scrimConfirm = document.getElementById('scrimConfirm');
  const toast = document.getElementById('toast');

  const svcTbody = document.getElementById('svcTbody');
  const svcEmptyState = document.getElementById('svcEmptyState');
  const searchInputSvc = document.getElementById('searchInputSvc');
  const filterSvcStatus = document.getElementById('filterSvcStatus');
  const panelSvc = document.getElementById('panelSvc');
  const scrimSvc = document.getElementById('scrimSvc');

  const STATUS_LABELS = { pending:'Pending', in_progress:'In Progress', completed:'Completed', returned:'Returned to User' };
  const STATUS_BADGE = { pending:'badge-warn', in_progress:'badge-accent', completed:'badge-ok', returned:'badge-neutral' };

  function uid(){ return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.classList.remove('show'), 2200);
  }

  async function loadDevices(){
    try{
      const res = await window.storage.get(STORAGE_KEY, true);
      devices = res && res.value ? JSON.parse(res.value) : [];
    }catch(e){
      devices = [];
    }
    render();
  }

  async function persist(){
    try{
      const res = await window.storage.set(STORAGE_KEY, JSON.stringify(devices), true);
      if(!res){ showToast('Could not save — try again.'); }
    }catch(e){
      showToast('Storage error — changes may not be saved.');
    }
  }

  async function loadServiceUnits(){
    try{
      const res = await window.storage.get(STORAGE_KEY_SVC, true);
      serviceUnits = res && res.value ? JSON.parse(res.value) : [];
    }catch(e){
      serviceUnits = [];
    }
    renderService();
  }

  async function persistService(){
    try{
      const res = await window.storage.set(STORAGE_KEY_SVC, JSON.stringify(serviceUnits), true);
      if(!res){ showToast('Could not save — try again.'); }
    }catch(e){
      showToast('Storage error — changes may not be saved.');
    }
  }

  function formatDate(iso){
    if(!iso) return '—';
    const [y,m,d] = iso.split('-');
    if(!y || !m || !d) return escapeHtml(iso);
    const dt = new Date(Number(y), Number(m)-1, Number(d));
    return dt.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
  }

  function escapeHtml(str){
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  function updateDeptFilterOptions(){
    const current = filterDept.value;
    const depts = Array.from(new Set(devices.map(d => d.department).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    filterDept.innerHTML = '<option value="">All departments</option>' + depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    if(depts.includes(current)) filterDept.value = current;
  }

  function getFiltered(){
    const q = searchInput.value.trim().toLowerCase();
    const dept = filterDept.value;
    const chg = filterCharger.value;
    let list = devices.filter(d => {
      if(dept && d.department !== dept) return false;
      if(chg && d.charger !== chg) return false;
      if(q){
        const hay = [d.itemNo, d.employeeName, d.department, d.brand, d.model, d.serialNumber, d.remarks].join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a,b) => {
      const av = (a[sortKey] || '').toString().toLowerCase();
      const bv = (b[sortKey] || '').toString().toLowerCase();
      if(av < bv) return -1 * sortDir;
      if(av > bv) return 1 * sortDir;
      return 0;
    });
    return list;
  }

  function updateStats(){
    document.getElementById('statTotal').textContent = devices.length;
    document.getElementById('statCharger').textContent = devices.filter(d => d.charger === 'yes').length;
    document.getElementById('statAdobe').textContent = devices.filter(d => d.adobe === 'yes').length;
    document.getElementById('statM365').textContent = devices.filter(d => d.m365 === 'yes').length;
    document.getElementById('statAV').textContent = devices.filter(d => d.antivirus === 'yes').length;
  }

  function render(){
    updateDeptFilterOptions();
    updateStats();
    const list = getFiltered();

    document.querySelectorAll('#invTable thead th .arrow').forEach(a => a.textContent = '');
    const activeTh = document.querySelector(`#invTable thead th[data-key="${sortKey}"] .arrow`);
    if(activeTh) activeTh.textContent = sortDir === 1 ? '▲' : '▼';

    if(list.length === 0){
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      document.getElementById('emptyTitle').textContent = devices.length === 0 ? 'No devices yet' : 'No matching devices';
      document.getElementById('emptySub').textContent = devices.length === 0
        ? 'Add the first laptop to start tracking assignments.'
        : 'Try adjusting your search or filters.';
      document.getElementById('btnAddEmpty').style.display = devices.length === 0 ? 'inline-flex' : 'none';
      return;
    }
    emptyState.style.display = 'none';

    tbody.innerHTML = list.map(d => `
      <tr data-id="${d.id}">
        <td class="mono">${escapeHtml(d.itemNo)}</td>
        <td class="name">${escapeHtml(d.employeeName)}</td>
        <td class="dept">${escapeHtml(d.department)}</td>
        <td>${escapeHtml(d.brand)}</td>
        <td>${escapeHtml(d.model)}</td>
        <td class="mono">${escapeHtml(d.serialNumber)}</td>
        <td>${formatDate(d.dateIssued)}</td>
        <td>${d.charger === 'yes'
          ? '<span class="badge badge-ok">With charger</span>'
          : '<span class="badge badge-warn">Without</span>'}</td>
        <td>
          <div class="pill-group">
            <span class="badge ${d.adobe === 'yes' ? 'badge-ok' : 'badge-warn'}">Adobe ${d.adobe === 'yes' ? '✓' : '✕'}</span>
            <span class="badge ${d.m365 === 'yes' ? 'badge-ok' : 'badge-warn'}">M365 ${d.m365 === 'yes' ? '✓' : '✕'}</span>
            <span class="badge ${d.antivirus === 'yes' ? 'badge-ok' : 'badge-warn'}">AV ${d.antivirus === 'yes' ? '✓' : '✕'}</span>
          </div>
        </td>
        <td class="remarks-cell" title="${escapeHtml(d.remarks)}">${escapeHtml(d.remarks) || '—'}</td>
        <td>
          <div class="row-actions">
            <button class="btn-ghost btn-edit" data-id="${d.id}" title="Edit" aria-label="Edit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4v16h16v-7"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-ghost btn-del btn-danger-text" data-id="${d.id}" title="Delete" aria-label="Delete">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // ---------- sorting ----------
  document.querySelectorAll('#invTable thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if(sortKey === key){ sortDir *= -1; } else { sortKey = key; sortDir = 1; }
      render();
    });
  });

  searchInput.addEventListener('input', render);
  filterDept.addEventListener('change', render);
  filterCharger.addEventListener('change', render);

  // ================== SERVICE UNITS ==================
  function getFilteredSvc(){
    const q = searchInputSvc.value.trim().toLowerCase();
    const status = filterSvcStatus.value;
    let list = serviceUnits.filter(u => {
      if(status && u.status !== status) return false;
      if(q){
        const hay = [u.itemNo, u.brand, u.model, u.serialNumber, u.turnedOverBy, u.issue, u.remarks].join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a,b) => {
      const av = (a[sortKeySvc] || '').toString().toLowerCase();
      const bv = (b[sortKeySvc] || '').toString().toLowerCase();
      if(av < bv) return -1 * sortDirSvc;
      if(av > bv) return 1 * sortDirSvc;
      return 0;
    });
    return list;
  }

  function updateStatsSvc(){
    document.getElementById('statSvcTotal').textContent = serviceUnits.length;
    document.getElementById('statSvcPending').textContent = serviceUnits.filter(u => u.status === 'pending').length;
    document.getElementById('statSvcProgress').textContent = serviceUnits.filter(u => u.status === 'in_progress').length;
    document.getElementById('statSvcDone').textContent = serviceUnits.filter(u => u.status === 'completed').length;
  }

  function renderService(){
    updateStatsSvc();
    const list = getFilteredSvc();

    document.querySelectorAll('#svcTable thead th .arrow').forEach(a => a.textContent = '');
    const activeTh = document.querySelector(`#svcTable thead th[data-key="${sortKeySvc}"] .arrow`);
    if(activeTh) activeTh.textContent = sortDirSvc === 1 ? '▲' : '▼';

    if(list.length === 0){
      svcTbody.innerHTML = '';
      svcEmptyState.style.display = 'block';
      document.getElementById('svcEmptyTitle').textContent = serviceUnits.length === 0 ? 'No units in for service' : 'No matching units';
      document.getElementById('svcEmptySub').textContent = serviceUnits.length === 0
        ? "Log a laptop here when it's turned in for repair or maintenance."
        : 'Try adjusting your search or filters.';
      document.getElementById('btnAddSvcEmpty').style.display = serviceUnits.length === 0 ? 'inline-flex' : 'none';
      return;
    }
    svcEmptyState.style.display = 'none';

    svcTbody.innerHTML = list.map(u => `
      <tr data-id="${u.id}">
        <td class="mono">${escapeHtml(u.itemNo)}</td>
        <td>${escapeHtml(u.brand)}</td>
        <td>${escapeHtml(u.model)}</td>
        <td class="mono">${escapeHtml(u.serialNumber)}</td>
        <td class="name">${escapeHtml(u.turnedOverBy)}</td>
        <td>${formatDate(u.dateReceived)}</td>
        <td class="remarks-cell" title="${escapeHtml(u.issue)}">${escapeHtml(u.issue) || '—'}</td>
        <td><span class="badge ${STATUS_BADGE[u.status] || 'badge-neutral'}">${STATUS_LABELS[u.status] || u.status}</span></td>
        <td class="remarks-cell" title="${escapeHtml(u.remarks)}">${escapeHtml(u.remarks) || '—'}</td>
        <td>
          <div class="row-actions">
            <button class="btn-ghost btn-edit-svc" data-id="${u.id}" title="Edit" aria-label="Edit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4v16h16v-7"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="btn-ghost btn-del-svc btn-danger-text" data-id="${u.id}" title="Delete" aria-label="Delete">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  document.querySelectorAll('#svcTable thead th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-key');
      if(sortKeySvc === key){ sortDirSvc *= -1; } else { sortKeySvc = key; sortDirSvc = 1; }
      renderService();
    });
  });

  searchInputSvc.addEventListener('input', renderService);
  filterSvcStatus.addEventListener('change', renderService);

  function openSvcPanel(unit){
    clearErrors();
    editingSvcId = unit ? unit.id : null;
    document.getElementById('panelSvcTitle').textContent = unit ? 'Edit service unit' : 'Add service unit';
    document.getElementById('panelSvcSub').textContent = unit ? 'Update the service record' : "Log a laptop that's been turned in for service";

    document.getElementById('svc_itemNo').value = unit ? unit.itemNo : '';
    document.getElementById('svc_serialNumber').value = unit ? unit.serialNumber : '';
    document.getElementById('svc_brand').value = unit ? unit.brand : '';
    document.getElementById('svc_model').value = unit ? unit.model : '';
    document.getElementById('svc_turnedOverBy').value = unit ? unit.turnedOverBy : '';
    document.getElementById('svc_dateReceived').value = unit ? (unit.dateReceived || '') : '';
    document.getElementById('svc_issue').value = unit ? unit.issue : '';
    document.getElementById('svc_status').value = unit ? unit.status : 'pending';
    document.getElementById('svc_remarks').value = unit ? unit.remarks : '';

    panelSvc.classList.add('open');
    scrimSvc.classList.add('open');
    setTimeout(() => document.getElementById('svc_itemNo').focus(), 50);
  }

  function closeSvcPanel(){
    panelSvc.classList.remove('open');
    scrimSvc.classList.remove('open');
    editingSvcId = null;
  }

  document.getElementById('btnAddSvc').addEventListener('click', () => openSvcPanel(null));
  document.getElementById('btnAddSvcEmpty').addEventListener('click', () => openSvcPanel(null));
  document.getElementById('btnCloseSvcPanel').addEventListener('click', closeSvcPanel);
  document.getElementById('btnCancelSvc').addEventListener('click', closeSvcPanel);
  scrimSvc.addEventListener('click', closeSvcPanel);

  document.getElementById('btnSaveSvc').addEventListener('click', async () => {
    const itemNo = document.getElementById('svc_itemNo').value;
    const serialNumber = document.getElementById('svc_serialNumber').value;
    const brand = document.getElementById('svc_brand').value;
    const model = document.getElementById('svc_model').value;
    const turnedOverBy = document.getElementById('svc_turnedOverBy').value;
    const dateReceived = document.getElementById('svc_dateReceived').value;
    const issue = document.getElementById('svc_issue').value;
    const status = document.getElementById('svc_status').value;
    const remarks = document.getElementById('svc_remarks').value;

    const valid = validate([
      ['itemNo', itemNo], ['serialNumber', serialNumber],
      ['brand', brand], ['model', model],
      ['turnedOverBy', turnedOverBy], ['issue', issue]
    ], 'fs_');
    if(!valid) return;

    const record = {
      id: editingSvcId || uid(),
      itemNo: itemNo.trim(),
      serialNumber: serialNumber.trim(),
      brand: brand.trim(),
      model: model.trim(),
      turnedOverBy: turnedOverBy.trim(),
      dateReceived: dateReceived || '',
      issue: issue.trim(),
      status: status,
      remarks: remarks.trim()
    };

    if(editingSvcId){
      const idx = serviceUnits.findIndex(u => u.id === editingSvcId);
      if(idx > -1) serviceUnits[idx] = record;
    } else {
      serviceUnits.push(record);
    }

    await persistService();
    renderService();
    closeSvcPanel();
    showToast(editingSvcId ? 'Service unit updated.' : 'Service unit added.');
  });

  svcTbody.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-svc');
    const delBtn = e.target.closest('.btn-del-svc');
    if(editBtn){
      const u = serviceUnits.find(x => x.id === editBtn.getAttribute('data-id'));
      if(u) openSvcPanel(u);
    } else if(delBtn){
      deleteTargetId = delBtn.getAttribute('data-id');
      deleteTargetType = 'service';
      const u = serviceUnits.find(x => x.id === deleteTargetId);
      document.getElementById('confirmText').textContent = u
        ? `“${u.itemNo} — ${u.brand} ${u.model}” will be permanently removed from the service log.`
        : 'This record will be permanently deleted.';
      confirmBox.classList.add('open');
      scrimConfirm.classList.add('open');
    }
  });

  // ================== TABS ==================
  const tabDevices = document.getElementById('tabDevices');
  const tabService = document.getElementById('tabService');
  const viewDevices = document.getElementById('view-devices');
  const viewService = document.getElementById('view-service');
  const statRowDevices = document.getElementById('statRowDevices');
  const statRowService = document.getElementById('statRowService');

  function activateTab(name){
    const isDevices = name === 'devices';
    tabDevices.classList.toggle('active', isDevices);
    tabService.classList.toggle('active', !isDevices);
    viewDevices.classList.toggle('hidden', !isDevices);
    viewService.classList.toggle('hidden', isDevices);
    statRowDevices.style.display = isDevices ? 'flex' : 'none';
    statRowService.style.display = isDevices ? 'none' : 'flex';
  }
  tabDevices.addEventListener('click', () => activateTab('devices'));
  tabService.addEventListener('click', () => activateTab('service'));

  // ================== EXPORT TO EXCEL ==================
  function pad(n){ return String(n).padStart(2,'0'); }
  function timestampForFilename(){
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  const HEADER_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1B2230' } };
  const BAND_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF5F6F8' } };
  const THIN_BORDER = { style:'thin', color:{ argb:'FFDCE1E7' } };
  const OK_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFE4F5EE' } };
  const WARN_FILL = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFBEEDD' } };

  function styleSheet(ws, columns, rowObjects, greenNoneCols){
    ws.columns = columns;               // ExcelJS auto-writes the header row from `columns`

    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 };
      cell.fill = HEADER_FILL;
      cell.alignment = { vertical:'middle', horizontal:'left' };
      cell.border = { top:THIN_BORDER, left:THIN_BORDER, right:THIN_BORDER, bottom:THIN_BORDER };
    });
    headerRow.height = 20;

    rowObjects.forEach((r, i) => {
      const row = ws.addRow(r);
      const banded = i % 2 === 1;
      row.eachCell({ includeEmpty:true }, (cell, colNumber) => {
        cell.border = { top:THIN_BORDER, left:THIN_BORDER, right:THIN_BORDER, bottom:THIN_BORDER };
        cell.alignment = { vertical:'middle', horizontal:'left', wrapText:false };
        if(banded) cell.fill = BAND_FILL;
        const colKey = columns[colNumber-1] ? columns[colNumber-1].key : null;
        if(greenNoneCols && greenNoneCols.includes(colKey)){
          const v = (cell.value || '').toString().toLowerCase();
          if(v === 'yes' || v === 'with charger'){ cell.fill = OK_FILL; }
          else if(v === 'no' || v === 'none' || v === 'without charger'){ cell.fill = WARN_FILL; }
        }
      });
    });

    ws.views = [{ state:'frozen', ySplit:1 }];
    ws.autoFilter = { from:{ row:1, column:1 }, to:{ row:1, column:columns.length } };
  }

  async function exportToExcel(){
    if(typeof ExcelJS === 'undefined'){
      showToast('Export library failed to load — check your connection and retry.');
      return;
    }
    if(devices.length === 0 && serviceUnits.length === 0){
      showToast('Nothing to export yet — add a record first.');
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'IT Inventory';
    wb.created = new Date();

    // ---- Assigned Devices sheet ----
    const wsDevices = wb.addWorksheet('Assigned Devices');
    const deviceCols = [
      { header:'Item No.', key:'itemNo', width:12 },
      { header:'Employee Name', key:'employeeName', width:20 },
      { header:'Department', key:'department', width:16 },
      { header:'Brand', key:'brand', width:14 },
      { header:'Model', key:'model', width:18 },
      { header:'Serial Number', key:'serialNumber', width:18 },
      { header:'Date Issued', key:'dateIssued', width:13 },
      { header:'Charger', key:'charger', width:16 },
      { header:'Adobe Account', key:'adobe', width:14 },
      { header:'Microsoft 365', key:'m365', width:14 },
      { header:'Antivirus Installed', key:'antivirus', width:16 },
      { header:'Remarks', key:'remarks', width:32 }
    ];
    const deviceRows = devices.map(d => ({
      itemNo: d.itemNo,
      employeeName: d.employeeName,
      department: d.department,
      brand: d.brand,
      model: d.model,
      serialNumber: d.serialNumber,
      dateIssued: d.dateIssued || '',
      charger: d.charger === 'yes' ? 'With charger' : 'Without charger',
      adobe: d.adobe === 'yes' ? 'Yes' : 'No',
      m365: d.m365 === 'yes' ? 'Yes' : 'No',
      antivirus: d.antivirus === 'yes' ? 'Yes' : 'None',
      remarks: d.remarks || ''
    }));
    styleSheet(wsDevices, deviceCols, deviceRows, ['charger','adobe','m365','antivirus']);

    // ---- Service Units sheet ----
    const wsService = wb.addWorksheet('Service Units');
    const serviceCols = [
      { header:'Item No.', key:'itemNo', width:12 },
      { header:'Brand', key:'brand', width:14 },
      { header:'Model', key:'model', width:18 },
      { header:'Serial Number', key:'serialNumber', width:18 },
      { header:'Turned Over By', key:'turnedOverBy', width:18 },
      { header:'Date Received', key:'dateReceived', width:14 },
      { header:'Issue', key:'issue', width:30 },
      { header:'Status', key:'status', width:16 },
      { header:'Remarks', key:'remarks', width:32 }
    ];
    const serviceRows = serviceUnits.map(u => ({
      itemNo: u.itemNo,
      brand: u.brand,
      model: u.model,
      serialNumber: u.serialNumber,
      turnedOverBy: u.turnedOverBy,
      dateReceived: u.dateReceived || '',
      issue: u.issue,
      status: STATUS_LABELS[u.status] || u.status,
      remarks: u.remarks || ''
    }));
    styleSheet(wsService, serviceCols, serviceRows, []);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laptop-inventory-${timestampForFilename()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Excel file downloaded.');
  }

  document.getElementById('btnExport').addEventListener('click', () => {
    exportToExcel().catch(() => showToast('Export failed — please try again.'));
  });

  // ---------- panel open/close ----------
  function setToggle(groupId, val){
    document.querySelectorAll('#' + groupId + ' .toggle-opt').forEach(opt => {
      opt.classList.remove('active-yes','active-no');
      if(opt.getAttribute('data-val') === val){
        opt.classList.add(val === 'yes' ? 'active-yes' : 'active-no');
      }
    });
  }
  function getToggle(groupId){
    const el = document.querySelector('#' + groupId + ' .toggle-opt.active-yes, #' + groupId + ' .toggle-opt.active-no');
    return el ? el.getAttribute('data-val') : 'no';
  }
  ['toggleCharger','toggleAdobe','toggleM365','toggleAV'].forEach(gid => {
    document.querySelectorAll('#' + gid + ' .toggle-opt').forEach(opt => {
      opt.addEventListener('click', () => setToggle(gid, opt.getAttribute('data-val')));
    });
  });

  function clearErrors(){
    document.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
  }

  function openPanel(device){
    clearErrors();
    editingId = device ? device.id : null;
    document.getElementById('panelTitle').textContent = device ? 'Edit device' : 'Add device';
    document.getElementById('panelSub').textContent = device ? 'Update the laptop and assignment details' : 'Enter the laptop and assignment details';

    document.getElementById('in_itemNo').value = device ? device.itemNo : '';
    document.getElementById('in_serialNumber').value = device ? device.serialNumber : '';
    document.getElementById('in_dateIssued').value = device ? (device.dateIssued || '') : '';
    document.getElementById('in_brand').value = device ? device.brand : '';
    document.getElementById('in_model').value = device ? device.model : '';
    document.getElementById('in_employeeName').value = device ? device.employeeName : '';
    document.getElementById('in_department').value = device ? device.department : '';
    document.getElementById('in_remarks').value = device ? device.remarks : '';

    setToggle('toggleCharger', device ? device.charger : 'yes');
    setToggle('toggleAdobe', device ? device.adobe : 'no');
    setToggle('toggleM365', device ? device.m365 : 'no');
    setToggle('toggleAV', device ? device.antivirus : 'no');

    panel.classList.add('open');
    scrim.classList.add('open');
    setTimeout(() => document.getElementById('in_itemNo').focus(), 50);
  }

  function closePanel(){
    panel.classList.remove('open');
    scrim.classList.remove('open');
    editingId = null;
  }

  document.getElementById('btnAdd').addEventListener('click', () => openPanel(null));
  document.getElementById('btnAddEmpty').addEventListener('click', () => openPanel(null));
  document.getElementById('btnClosePanel').addEventListener('click', closePanel);
  document.getElementById('btnCancel').addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);

  function validate(fields, prefix){
    prefix = prefix || 'f_';
    clearErrors();
    let ok = true;
    fields.forEach(([id, val]) => {
      if(!val.trim()){
        document.getElementById(prefix + id).classList.add('has-error');
        ok = false;
      }
    });
    return ok;
  }

  document.getElementById('btnSave').addEventListener('click', async () => {
    const itemNo = document.getElementById('in_itemNo').value;
    const serialNumber = document.getElementById('in_serialNumber').value;
    const dateIssued = document.getElementById('in_dateIssued').value;
    const brand = document.getElementById('in_brand').value;
    const model = document.getElementById('in_model').value;
    const employeeName = document.getElementById('in_employeeName').value;
    const department = document.getElementById('in_department').value;
    const remarks = document.getElementById('in_remarks').value;

    const valid = validate([
      ['itemNo', itemNo], ['serialNumber', serialNumber],
      ['brand', brand], ['model', model],
      ['employeeName', employeeName], ['department', department]
    ]);
    if(!valid) return;

    const record = {
      id: editingId || uid(),
      itemNo: itemNo.trim(),
      serialNumber: serialNumber.trim(),
      dateIssued: dateIssued || '',
      brand: brand.trim(),
      model: model.trim(),
      employeeName: employeeName.trim(),
      department: department.trim(),
      remarks: remarks.trim(),
      charger: getToggle('toggleCharger'),
      adobe: getToggle('toggleAdobe'),
      m365: getToggle('toggleM365'),
      antivirus: getToggle('toggleAV')
    };

    if(editingId){
      const idx = devices.findIndex(d => d.id === editingId);
      if(idx > -1) devices[idx] = record;
    } else {
      devices.push(record);
    }

    await persist();
    render();
    closePanel();
    showToast(editingId ? 'Device updated.' : 'Device added.');
  });

  // ---------- edit / delete ----------
  tbody.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    const delBtn = e.target.closest('.btn-del');
    if(editBtn){
      const d = devices.find(x => x.id === editBtn.getAttribute('data-id'));
      if(d) openPanel(d);
    } else if(delBtn){
      deleteTargetId = delBtn.getAttribute('data-id');
      deleteTargetType = 'device';
      const d = devices.find(x => x.id === deleteTargetId);
      document.getElementById('confirmText').textContent = d
        ? `“${d.itemNo} — ${d.employeeName}” will be permanently removed from the inventory.`
        : 'This record will be permanently deleted from the inventory.';
      confirmBox.classList.add('open');
      scrimConfirm.classList.add('open');
    }
  });

  document.getElementById('btnConfirmCancel').addEventListener('click', () => {
    confirmBox.classList.remove('open');
    scrimConfirm.classList.remove('open');
    deleteTargetId = null;
    deleteTargetType = 'device';
  });
  scrimConfirm.addEventListener('click', () => {
    confirmBox.classList.remove('open');
    scrimConfirm.classList.remove('open');
    deleteTargetId = null;
    deleteTargetType = 'device';
  });
  document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
    if(deleteTargetType === 'service'){
      serviceUnits = serviceUnits.filter(u => u.id !== deleteTargetId);
      await persistService();
      renderService();
      showToast('Service unit removed.');
    } else {
      devices = devices.filter(d => d.id !== deleteTargetId);
      await persist();
      render();
      showToast('Device removed.');
    }
    confirmBox.classList.remove('open');
    scrimConfirm.classList.remove('open');
    deleteTargetId = null;
    deleteTargetType = 'device';
  });

  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      if(confirmBox.classList.contains('open')){ document.getElementById('btnConfirmCancel').click(); }
      else if(panel.classList.contains('open')){ closePanel(); }
      else if(panelSvc.classList.contains('open')){ closeSvcPanel(); }
    }
  });

  loadDevices();
  loadServiceUnits();
})();