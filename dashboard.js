let CURRENT_DATE = new Date();
    let SELECTED_DATE = new Date();
    let ALL_BOOKINGS = [];
    let ESPECIALISTA_DATA = {};
    let KPI_MONTH = new Date().getMonth();
    let KPI_YEAR = new Date().getFullYear();

    document.addEventListener('DOMContentLoaded', () => { 
      lucide.createIcons(); 
      loadProfile(); 
      loadBookings(); 
      initKPIFilters();
    });

    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      sidebar.classList.toggle('-translate-x-full');
      overlay.classList.toggle('hidden');
    }

    function showTab(tab) {
      ['bookings', 'settings', 'admin', 'kpis'].forEach(t => {
        const section = document.getElementById('tab-' + t);
        const nav = document.getElementById('nav-' + t);
        if(section) section.classList.toggle('hidden', tab !== t);
        if(nav) {
          nav.classList.remove('active', 'sidebar-link-admin');
          if (tab === t) {
             nav.classList.add(t === 'admin' ? 'sidebar-link-admin' : 'active');
             if (t === 'admin') nav.classList.add('active');
          }
        }
      });
      if(window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if(!sidebar.classList.contains('-translate-x-full')) toggleSidebar();
      }
      if(tab === 'admin') cargarAdminList();
      if(tab === 'kpis') renderKPIs();
    }

    function changeMonth(delta) { CURRENT_DATE.setMonth(CURRENT_DATE.getMonth() + delta); renderCalendar(); }

    function refreshData() {
      const icon = document.getElementById('icon-refresh');
      icon.classList.add('spinning');
      loadBookings();
      setTimeout(() => icon.classList.remove('spinning'), 1000);
    }

    function exportarCitasCSV() {
      if (!ALL_BOOKINGS.length) {
        Swal.fire('Sin datos', 'No hay citas cargadas para exportar todavía.', 'info');
        return;
      }
      const ESTADO_LABEL = {
        pendiente: 'Pendiente', pagado: 'Pagado', confirmado: 'Confirmado',
        cancelado: 'Cancelado', reagendado: 'Reagendado'
      };
      const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const headers = ['Fecha', 'Hora', 'Paciente', 'Correo', 'Estado', 'Modalidad', 'Precio (CLP)'];
      const filas = ALL_BOOKINGS
        .slice()
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .map(b => {
          const fecha = b.start ? new Date(b.start).toLocaleDateString('es-CL') : '';
          const hora = b.start ? new Date(b.start).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
          return [
            fecha, hora, b.patientName || '', b.patientEmail || '',
            ESTADO_LABEL[b.status] || b.status || '', b.modality || '', b.price || 0
          ].map(csvEscape).join(',');
        });
      const csvContent = '\uFEFF' + [headers.map(csvEscape).join(','), ...filas].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fechaHoy = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `citas_${fechaHoy}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function loadBookings() {
      google.script.run.withSuccessHandler(res => { 
        ALL_BOOKINGS = res || []; 
        renderCalendar(); 
        renderDailyList(); 
        renderKPIs();
      }).obtenerReservasEspecialista(TOKEN);
    }

    function initKPIFilters() {
      const mSelect = document.getElementById('kpi-month-select');
      const ySelect = document.getElementById('kpi-year-select');
      if (!mSelect || !ySelect) return;
      const currentY = new Date().getFullYear();
      ySelect.innerHTML = '';
      for(let y = currentY - 1; y <= currentY + 2; y++) {
        ySelect.innerHTML += `<option value="${y}">${y}</option>`;
      }
      ySelect.value = KPI_YEAR;
      mSelect.value = KPI_MONTH;
    }

    function updateKPIFilter() {
      KPI_MONTH = parseInt(document.getElementById('kpi-month-select').value);
      KPI_YEAR = parseInt(document.getElementById('kpi-year-select').value);
      renderKPIs();
    }

    function renderKPIs() {
      const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      document.getElementById('kpi-month-name').innerText = `${monthNames[KPI_MONTH]} ${KPI_YEAR}`;
      const bookingsMes = ALL_BOOKINGS.filter(b => {
        if (!b.start) return false;
        const d = new Date(b.start);
        return d.getMonth() === KPI_MONTH && d.getFullYear() === KPI_YEAR;
      });
      const canceladas = bookingsMes.filter(b => b.status === 'cancelado');
      const activas = bookingsMes.filter(b => b.status !== 'cancelado');
      const pagadas = activas.filter(b => b.status === 'pagado' || b.status === 'confirmado');
      const pendientes = activas.filter(b => b.status === 'pendiente');
      const totalIngresos = pagadas.reduce((sum, b) => sum + Number(b.price || 0), 0);
      const totalPendiente = pendientes.reduce((sum, b) => sum + Number(b.price || 0), 0);
      const comisionPlataformaPct = ESPECIALISTA_DATA.commission || 0;
      const cobroPlataforma = totalIngresos * (comisionPlataformaPct / 100);
      const cobroKhipu = totalIngresos * 0.008211; 
      const netoEspecialista = totalIngresos - cobroPlataforma - cobroKhipu;
      document.getElementById('kpi-citas').innerText = activas.length;
      document.getElementById('kpi-canceladas').innerText = canceladas.length;
      document.getElementById('kpi-ingresos').innerText = '$' + totalIngresos.toLocaleString('es-CL');
      document.getElementById('kpi-pendiente').innerText = '$' + totalPendiente.toLocaleString('es-CL');
      document.getElementById('kpi-tarifa-pct').innerText = comisionPlataformaPct;
      document.getElementById('kpi-plataforma').innerText = '-$' + Math.round(cobroPlataforma).toLocaleString('es-CL');
      document.getElementById('kpi-khipu-cost').innerText = '-$' + Math.round(cobroKhipu).toLocaleString('es-CL');
      document.getElementById('kpi-neto').innerText = '$' + Math.round(netoEspecialista).toLocaleString('es-CL');
    }

    function renderCalendar() {
      const grid = document.getElementById('calendar-grid');
      const label = document.getElementById('calendar-month-label');
      grid.innerHTML = '';
      const year = CURRENT_DATE.getFullYear();
      const month = CURRENT_DATE.getMonth();
      label.innerText = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(CURRENT_DATE);
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      let dayOfWeek = firstDay.getDay();
      let offset = (dayOfWeek === 0) ? 0 : dayOfWeek - 1; 
      if (dayOfWeek === 6) offset = 0; 
      for (let e = 0; e < Math.min(offset, 4); e++) {
        const empty = document.createElement('div');
        empty.className = 'cal-cell disabled';
        grid.appendChild(empty);
      }
      for (let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(year, month, i);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const dateStr = d.toISOString().split('T')[0];
        const dayBookings = ALL_BOOKINGS.filter(b => b.start && b.start.split('T')[0] === dateStr && b.status !== 'cancelado');
        const cell = document.createElement('div');
        cell.className = `cal-cell ${d.toDateString() === SELECTED_DATE.toDateString() ? 'selected' : ''} ${d.toDateString() === new Date().toDateString() ? 'today' : ''}`;
        const dots = dayBookings.map(b => `<div class="dot ${((b.status||'').toLowerCase()==='pagado'||(b.status||'').toLowerCase()==='confirmado')?'dot-confirmada':'dot-pendiente'}"></div>`).slice(0,4).join('');
        cell.innerHTML = `<div class="text-xs sm:text-sm font-black text-slate-800">${i}</div><div class="flex flex-wrap gap-1">${dots}</div><div class="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase">${dayBookings.length ? dayBookings.length + ' cita' : ''}</div>`;
        cell.onclick = () => { SELECTED_DATE = new Date(d); renderCalendar(); renderDailyList(); };
        grid.appendChild(cell);
      }
    }

    function renderDailyList() {
      const list = document.getElementById('daily-list');
      const empty = document.getElementById('empty-state');
      const dateStr = SELECTED_DATE.toISOString().split('T')[0];
      document.getElementById('display-date').innerText = new Intl.DateTimeFormat('es-CL', { weekday:'long', day:'numeric', month:'long' }).format(SELECTED_DATE);
      const dayBookings = ALL_BOOKINGS.filter(b => b.start && b.start.split('T')[0] === dateStr && b.status !== 'cancelado');
      document.getElementById('display-count').innerText = dayBookings.length + (dayBookings.length === 1 ? ' cita' : ' citas');
      list.innerHTML = '';
      if (!dayBookings.length) { empty.classList.remove('hidden'); lucide.createIcons(); return; }
      empty.classList.add('hidden');
      dayBookings.sort((a,b) => new Date(a.start) - new Date(b.start)).forEach(r => {
        const status = (r.status || 'pendiente').toLowerCase();
        let acciones = `<div class="flex justify-end items-center gap-2 sm:gap-3">`;
        if (status === 'pendiente') {
           acciones += `<button onclick="confirmar('${r.id}')" class="text-emerald-600 font-black text-[9px] sm:text-[10px] uppercase hover:underline sm:mr-1">Confirmar</button>`;
        }
        acciones += `<button onclick="reagendar('${r.id}')" class="text-[var(--primary)] font-black text-[9px] sm:text-[10px] uppercase hover:underline border-l border-slate-200 pl-2 ml-2 sm:border-none sm:pl-0 sm:ml-0">Reagendar</button><button onclick="cancelar('${r.id}')" class="text-red-400 font-black text-[9px] sm:text-[10px] uppercase hover:underline border-l border-slate-200 pl-2 ml-2 sm:border-none sm:pl-0 sm:ml-0">Cancelar</button></div>`;
        const row = document.createElement('tr'); row.className = "hover:bg-slate-50/50 transition-colors";
        row.innerHTML = `<td class="py-4 sm:py-5 text-[11px] sm:text-xs font-black text-slate-900">${new Date(r.start).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })}</td><td class="py-4 sm:py-5"><div class="text-[11px] sm:text-xs font-black text-slate-900 uppercase">${r.patientName || 'Paciente'}</div></td><td class="py-4 sm:py-5"><span class="status-badge status-${status}">${status}</span></td><td class="py-4 sm:py-5 text-right">${acciones}</td>`;
        list.appendChild(row);
      });
      lucide.createIcons();
    }

    function cargarHorasModal(fechaId, horaId) {
      const fecha = document.getElementById(fechaId).value;
      const select = document.getElementById(horaId);
      if(!fecha) return;
      select.innerHTML = '<option>Buscando...</option>';
      google.script.run.withSuccessHandler(slots => {
        select.innerHTML = '<option value="">Selecciona hora</option>';
        slots.filter(s => !s.ocupado && !s.pasado).forEach(s => {
          const opt = document.createElement('option'); opt.value = s.hora; opt.textContent = s.hora; select.appendChild(opt);
        });
      }).obtenerHorariosDisponibles(ESPECIALISTA_DATA.id, ESPECIALISTA_DATA.duration || 45, fecha);
    }

    function generarCamposFechasSW() {
      const cant = parseInt(document.getElementById('sw-cant').value);
      const container = document.getElementById('sw-fechas-container');
      container.innerHTML = '';
      for(let i = 0; i < cant; i++) {
        container.innerHTML += `
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p class="text-[10px] font-black text-slate-400 uppercase mb-2">Sesión ${i+1}</p>
            <div class="grid grid-cols-2 gap-3">
              <input type="date" id="sw-f-${i}" onchange="cargarHorasModal('sw-f-${i}','sw-h-${i}')" class="form-input">
              <select id="sw-h-${i}" class="form-input">
                <option value="">Elige fecha primero</option>
              </select>
            </div>
          </div>
        `;
      }
    }

    function abrirModalAgendar() {
      Swal.fire({
        title: 'Agendar Plan de Citas',
        html: `
          <div class="text-left space-y-4">
            <input id="sw-nom" placeholder="Nombre Paciente" class="form-input">
            <input id="sw-mail" type="email" placeholder="Correo del Paciente" class="form-input">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Modalidad</label>
                <select id="sw-m" class="form-input">
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase mb-1">Nº Citas</label>
                <select id="sw-cant" class="form-input" onchange="generarCamposFechasSW()">
                  <option value="1">1 Cita</option>
                  <option value="2">2 Citas</option>
                  <option value="3">3 Citas</option>
                  <option value="4">4 Citas</option>
                  <option value="5">5 Citas</option>
                </select>
              </div>
            </div>
            <div id="sw-fechas-container" class="space-y-3 max-h-[40vh] overflow-y-auto p-1">
            </div>
          </div>
        `,
        showCancelButton: true, 
        confirmButtonText: 'Agendar y Cobrar',
        didOpen: () => {
          generarCamposFechasSW();
        },
        preConfirm: () => {
          const nombre = document.getElementById('sw-nom').value;
          const correo = document.getElementById('sw-mail').value;
          const modalidad = document.getElementById('sw-m').value;
          const cantidad = parseInt(document.getElementById('sw-cant').value);
          if(!nombre || !correo) return Swal.showValidationMessage('Ingresa nombre y correo del paciente');
          const fechas = [];
          for(let i=0; i<cantidad; i++) {
            const f = document.getElementById(`sw-f-${i}`).value;
            const h = document.getElementById(`sw-h-${i}`).value;
            if(!f || !h) return Swal.showValidationMessage(`Completa la fecha y hora de la Sesión ${i+1}`);
            fechas.push(`${f}T${h}:00`);
          }
          return { patientName: nombre, patientEmail: correo, modality: modalidad, fechas: fechas };
        }
      }).then(res => { 
        if(res.isConfirmed) { 
          Swal.fire({title:'Guardando y enviando cobro...', didOpen:()=>Swal.showLoading()}); 
          google.script.run.withSuccessHandler((r) => { 
            if(r.ok) {
              Swal.fire('¡Éxito!','Las citas fueron agendadas y se envió el cobro.','success'); 
              loadBookings(); 
            } else {
              Swal.fire('Error', r.message, 'error');
            }
          }).agendarCitaManual(TOKEN, res.value); 
        }
      });
    }

    function reagendar(id) {
      const b = ALL_BOOKINGS.find(x => x.id === id);
      Swal.fire({
        title: 'Mover Cita',
        html: `<div class="text-left space-y-4"><p class="text-[10px] font-black text-slate-400 uppercase">Paciente: <b>${b.patientName}</b></p><div class="grid grid-cols-2 gap-3"><input type="date" id="re-f" onchange="cargarHorasModal('re-f','re-h')" class="form-input"><select id="re-h" class="form-input"><option value="">Elige fecha</option></select></div></div>`,
        showCancelButton: true, confirmButtonText: 'Mover',
        preConfirm: () => {
          if(!document.getElementById('re-h').value) return Swal.showValidationMessage('Selecciona nuevo horario');
          return { fecha: document.getElementById('re-f').value, hora: document.getElementById('re-h').value }
        }
      }).then(res => { if(res.isConfirmed) { Swal.fire({title:'Moviendo...', didOpen:()=>Swal.showLoading()}); google.script.run.withSuccessHandler(() => { Swal.fire('Éxito','Cita movida','success'); loadBookings(); }).reagendarCitaSaaS(TOKEN, id, res.value.fecha, res.value.hora); }});
    }

    function cancelar(id) {
      Swal.fire({ title:'¿Cancelar?', icon:'warning', showCancelButton:true, confirmButtonColor:'#ef4444' }).then(r => {
        if(r.isConfirmed) {
          Swal.fire({title:'Cancelando...', didOpen:()=>Swal.showLoading()});
          google.script.run.withSuccessHandler(() => { Swal.fire('Cancelada','','success'); loadBookings(); }).cancelarCitaSaaS(TOKEN, id);
        }
      });
    }

    function loadProfile() {
      google.script.run.withSuccessHandler(p => { 
        ESPECIALISTA_DATA = p; 
        if (p.role === 'admin') {
          document.getElementById('nav-admin').classList.remove('hidden');
        }
        document.getElementById('pf-name').value = p.name || '';
        document.getElementById('pf-rut').value = p.rut || '';
        document.getElementById('pf-address').value = p.address || '';
        document.getElementById('pf-price').value = p.price || 0;
        document.getElementById('pf-business-name').value = p.businessName || '';
        document.getElementById('pf-photo-url').value = p.photoUrl || '';
        previsualizarFoto();
        const esAdmin = p.role === 'admin';
        document.getElementById('business-name-wrap').classList.toggle('hidden', !esAdmin);
        document.getElementById('business-name-readonly-wrap').classList.toggle('hidden', esAdmin);
        if (!esAdmin) {
          document.getElementById('business-name-readonly-text').innerText = (p.businessName && p.businessName.trim()) ? p.businessName : 'prenobooking (por defecto)';
        }
        const colorGuardado = p.accentColor || '#0D9488';
        document.getElementById('pf-color').value = colorGuardado;
        document.getElementById('pf-color-hex').value = colorGuardado.toUpperCase();
        document.getElementById('pf-duration').value = p.duration || 45;
        document.getElementById('pf-start').value = p.schedule?.start || '09:00';
        document.getElementById('pf-end').value = p.schedule?.end || '18:00';
        document.getElementById('pf-break-start').value = p.schedule?.breakStart || '';
        document.getElementById('pf-break-end').value = p.schedule?.breakEnd || '';
        const workDays = p.schedule?.workDays ? String(p.schedule.workDays).split(',') : ['1','2','3','4','5'];
        document.querySelectorAll('.pf-day').forEach(cb => {
          cb.checked = workDays.includes(cb.value);
        });
        document.getElementById('pf-k-api').value = p.khipu?.apiKey || '';
        document.getElementById('pf-k-sec').value = p.khipu?.secret || '';
        const baseUrl = "https://prenobooking.github.io/";
        document.getElementById('public-link').innerText = baseUrl + "?sp=" + (p.email || p.id);
        aplicarMarcaPersonalizada(p);
        renderKPIs();
      }).obtenerPerfilEspecialista(TOKEN);
    }

    function aplicarMarcaPersonalizada(p) {
      const wordmarkHtml = `<span class="text-xl font-bold text-slate-900 tracking-tight font-display">preno<span class="font-medium" style="color:var(--primary)">booking</span></span>`;
      const wordmarkHtmlSm = `<span class="font-bold text-slate-900 tracking-tight font-display leading-tight">preno<span class="font-medium" style="color:var(--primary)">booking</span></span>`;
      if (p.businessName && p.businessName.trim()) {
        const nombre = p.businessName.trim();
        document.getElementById('brand-wordmark-sidebar').innerHTML =
          `<p class="text-sm font-bold text-slate-900 tracking-tight font-display leading-tight">${nombre}</p>
           <p class="text-[10px] text-slate-400 font-medium">by prenobooking</p>`;
        document.getElementById('brand-wordmark-mobile').outerHTML =
          `<span id="brand-wordmark-mobile" class="text-sm font-bold text-slate-900 tracking-tight font-display leading-tight block">${nombre}</span>`;
      } else {
        document.getElementById('brand-wordmark-sidebar').innerHTML = wordmarkHtml;
        const mobileEl = document.getElementById('brand-wordmark-mobile');
        if (mobileEl) mobileEl.outerHTML = `<span id="brand-wordmark-mobile" class="font-bold text-slate-900 tracking-tight font-display leading-tight">preno<span class="font-medium" style="color:var(--primary)">booking</span></span>`;
      }
      if (p.accentColor) {
        document.documentElement.style.setProperty('--primary', p.accentColor);
        document.documentElement.style.setProperty('--primary-dark', oscurecerColor_(p.accentColor, 15));
        document.documentElement.style.setProperty('--primary-tint', aclararColor_(p.accentColor, 88));
        document.documentElement.style.setProperty('--primary-tint-strong', aclararColor_(p.accentColor, 55));
      }
    }

    function oscurecerColor_(hex, porcentaje) {
      try {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
        const num = parseInt(c, 16);
        let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
        r = Math.max(0, Math.round(r * (1 - porcentaje / 100)));
        g = Math.max(0, Math.round(g * (1 - porcentaje / 100)));
        b = Math.max(0, Math.round(b * (1 - porcentaje / 100)));
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      } catch (e) { return hex; }
    }

    function aclararColor_(hex, porcentaje) {
      try {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
        const num = parseInt(c, 16);
        let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
        r = Math.min(255, Math.round(r + (255 - r) * (porcentaje / 100)));
        g = Math.min(255, Math.round(g + (255 - g) * (porcentaje / 100)));
        b = Math.min(255, Math.round(b + (255 - b) * (porcentaje / 100)));
        return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      } catch (e) { return hex; }
    }

    function sincronizarColorHex() {
      const hex = document.getElementById('pf-color-hex').value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        document.getElementById('pf-color').value = hex;
      }
    }

    function restaurarColorDefecto() {
      document.getElementById('pf-color').value = '#0D9488';
      document.getElementById('pf-color-hex').value = '#0D9488';
    }

    function previsualizarFoto() {
      const url = document.getElementById('pf-photo-url').value.trim();
      const img = document.getElementById('pf-photo-preview');
      const placeholder = document.getElementById('pf-photo-placeholder');
      if (/^https?:\/\/.+/i.test(url)) {
        img.src = url;
        img.classList.remove('hidden');
        img.onerror = () => { img.classList.add('hidden'); placeholder.classList.remove('hidden'); };
        img.onload = () => { placeholder.classList.add('hidden'); };
      } else {
        img.classList.add('hidden');
        placeholder.classList.remove('hidden');
      }
    }

    function contrasteInsuficiente_(hex) {
      try {
        const c = String(hex).replace('#', '');
        if (!/^[0-9A-Fa-f]{6}$/.test(c)) return true;
        const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
        const brillo = (r * 299 + g * 587 + b * 114) / 1000;
        return brillo > 175;
      } catch (e) { return true; }
    }

    function saveProfile() {
      const colorElegido = document.getElementById('pf-color-hex').value.trim();
      if (colorElegido && contrasteInsuficiente_(colorElegido)) {
        Swal.fire('Color muy claro', 'Ese color es muy claro y el texto blanco de los botones quedaría difícil de leer. Elige un tono más oscuro/saturado.', 'warning');
        return;
      }
      const checkedDays = Array.from(document.querySelectorAll('.pf-day:checked')).map(cb => cb.value).join(',');
      const d = {
        name: document.getElementById('pf-name').value,
        rut: document.getElementById('pf-rut').value,
        address: document.getElementById('pf-address').value,
        price: parseInt(document.getElementById('pf-price').value),
        duration: parseInt(document.getElementById('pf-duration').value),
        businessName: document.getElementById('pf-business-name').value.trim(),
        photoUrl: document.getElementById('pf-photo-url').value.trim(),
        accentColor: document.getElementById('pf-color').value,
        schedule: { 
          start: document.getElementById('pf-start').value, 
          end: document.getElementById('pf-end').value,
          breakStart: document.getElementById('pf-break-start').value,
          breakEnd: document.getElementById('pf-break-end').value,
          workDays: checkedDays
        },
        khipu: { apiKey: document.getElementById('pf-k-api').value, secret: document.getElementById('pf-k-sec').value }
      };
      Swal.fire({title:'Guardando...', didOpen:()=>Swal.showLoading()});
      google.script.run.withSuccessHandler(() => { Swal.fire('Perfil Actualizado','','success'); loadProfile(); }).actualizarPerfilEspecialista(TOKEN, d);
    }

    function cambiarPassword() {
      const actual = document.getElementById('pw-actual').value;
      const nueva = document.getElementById('pw-nueva').value;
      const nueva2 = document.getElementById('pw-nueva-2').value;
      if (!actual || !nueva || !nueva2) {
        Swal.fire('Faltan datos', 'Completa los 3 campos para cambiar tu contraseña.', 'warning');
        return;
      }
      if (nueva.length < 8) {
        Swal.fire('Contraseña muy corta', 'La nueva contraseña debe tener al menos 8 caracteres.', 'warning');
        return;
      }
      if (nueva !== nueva2) {
        Swal.fire('No coinciden', 'La nueva contraseña y su repetición no son iguales.', 'warning');
        return;
      }
      Swal.fire({title:'Actualizando...', didOpen:()=>Swal.showLoading()});
      google.script.run.withSuccessHandler(res => {
        if (res.ok) {
          Swal.fire('Contraseña actualizada', '', 'success');
          document.getElementById('pw-actual').value = '';
          document.getElementById('pw-nueva').value = '';
          document.getElementById('pw-nueva-2').value = '';
        } else {
          Swal.fire('Error', res.message || 'No se pudo cambiar la contraseña.', 'error');
        }
      }).cambiarPasswordEspecialista(TOKEN, actual, nueva);
    }

    function copyLink() {
      const text = document.getElementById('public-link').innerText;
      const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
      Swal.fire({ title:'Copiado', icon:'success', timer:1500, showConfirmButton:false });
    }

    function cargarAdminList() {
      google.script.run
        .withSuccessHandler(lista => {
          const tbody = document.getElementById('tabla-admin');
          tbody.innerHTML = '';
          lista.forEach(e => {
            const isActivo = (e.active === true || String(e.active) === "true");
            const toggleId = `toggle-${e.id}`;
            const roleBadge = e.role === 'admin' ? '<span class="text-[9px] sm:text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2 uppercase font-black">Admin</span>' : '';
            let actionsHtml = `<span class="text-[10px] text-slate-400 italic">Tu cuenta</span>`;
            if (e.id !== ESPECIALISTA_DATA.id) {
               actionsHtml = `
                 <div class="flex justify-end items-center gap-2">
                   <button onclick="resetPasswordEsp('${e.id}', '${e.name}')" class="text-slate-500 font-black text-[9px] sm:text-[10px] uppercase hover:underline whitespace-nowrap">Reset Clave</button>
                   <button onclick="hacerAdmin('${e.id}', ${!(e.role === 'admin')})" class="${e.role === 'admin' ? 'text-amber-600' : 'text-[var(--primary)]'} font-black text-[9px] sm:text-[10px] uppercase hover:underline whitespace-nowrap border-l border-slate-200 pl-2 ml-1">${e.role === 'admin' ? 'Quitar Admin' : '+ Hacer Admin'}</button>
                   <button onclick="eliminarEspecialista('${e.id}', '${e.name}')" class="text-red-500 font-black text-[9px] sm:text-[10px] uppercase hover:underline border-l border-slate-200 pl-2 ml-2">Eliminar</button>
                 </div>
               `;
            }
            tbody.innerHTML += `
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 sm:px-6 py-4">
                  <p class="font-black text-slate-800 flex items-center whitespace-nowrap">${e.name} ${roleBadge}</p>
                  <p class="text-xs font-semibold text-slate-400">${e.email}</p>
                </td>
                <td class="px-4 sm:px-6 py-4">
                  <span class="bg-amber-50 text-amber-600 font-black text-xs px-2 py-1 rounded-md border border-amber-100">${e.commission || 0}%</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-xs sm:text-sm font-black text-slate-800">$${Number(e.price||0).toLocaleString('es-CL')}</td>
                <td class="px-4 sm:px-6 py-4">
                  <div class="flex items-center justify-center">
                    <div class="relative inline-block w-10 mr-2 sm:mr-3 align-middle select-none transition duration-200 ease-in">
                      <input type="checkbox" id="${toggleId}" onchange="toggleEstadoEsp('${e.id}', this.checked)" ${isActivo ? 'checked' : ''} class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 border-slate-300 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"/>
                      <label for="${toggleId}" class="toggle-label block overflow-hidden h-5 rounded-full bg-slate-300 cursor-pointer transition-colors duration-200 ease-in-out"></label>
                    </div>
                  </div>
                </td>
                <td class="px-4 sm:px-6 py-4 text-right">
                  ${actionsHtml}
                </td>
              </tr>
            `;
          });
        })
        .obtenerEspecialistasAdmin(TOKEN);
    }

    function toggleEstadoEsp(id, isChecked) {
      google.script.run.withSuccessHandler(res => {
          if(!res.ok) { Swal.fire('Error', res.message, 'error'); cargarAdminList(); }
        }).cambiarEstadoEspecialista(TOKEN, id, isChecked);
    }

    function resetPasswordEsp(id, name) {
       Swal.fire({title: '¿Regenerar contraseña?', text: `Se generará una nueva contraseña aleatoria para ${name} y se le enviará por correo. La actual dejará de funcionar.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, regenerar'})
       .then(r => {
         if(r.isConfirmed){
           Swal.fire({title:'Generando...', didOpen:()=>Swal.showLoading()});
           google.script.run.withSuccessHandler(res => {
             if(res.ok){ Swal.fire('Listo', `Se envió la nueva contraseña a ${name} por correo.`, 'success'); }
             else Swal.fire('Error', res.message, 'error');
           }).resetPasswordEspecialista(TOKEN, id);
         }
       });
    }

    function hacerAdmin(id, makeAdmin) {
       const actionText = makeAdmin ? 'otorgar' : 'quitar';
       Swal.fire({title: `¿${makeAdmin ? 'Hacer Admin' : 'Quitar Admin'}?`, text: `Vas a ${actionText} permisos de administrador a este usuario.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, continuar'})
       .then(r => {
         if(r.isConfirmed){
           Swal.fire({title:'Actualizando...', didOpen:()=>Swal.showLoading()});
           google.script.run.withSuccessHandler(res => {
             if(res.ok){ Swal.fire('Actualizado','','success'); cargarAdminList(); }
             else Swal.fire('Error', res.message, 'error');
           }).toggleAdminRole(TOKEN, id, makeAdmin);
         }
       });
    }

    function eliminarEspecialista(id, name) {
       Swal.fire({title: '¿Eliminar Especialista?', text: `Eliminarás a ${name} permanentemente. ¡Esta acción no se puede deshacer!`, icon: 'error', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sí, eliminar'})
       .then(r => {
         if(r.isConfirmed){
           Swal.fire({title:'Eliminando...', didOpen:()=>Swal.showLoading()});
           google.script.run.withSuccessHandler(res => {
             if(res.ok){ Swal.fire('Eliminado','','success'); cargarAdminList(); }
             else Swal.fire('Error', res.message, 'error');
           }).eliminarEspecialistaAdmin(TOKEN, id);
         }
       });
    }

    function abrirModalEnrolar() {
      const m = document.getElementById('modal-enrolar'); const c = document.getElementById('modal-content');
      m.classList.remove('hidden'); setTimeout(() => { c.classList.remove('scale-95'); c.classList.add('scale-100'); }, 10);
    }

    function cerrarModalEnrolar() {
      const m = document.getElementById('modal-enrolar'); const c = document.getElementById('modal-content');
      c.classList.remove('scale-100'); c.classList.add('scale-95');
      setTimeout(() => { m.classList.add('hidden'); document.getElementById('form-enrolar').reset(); }, 200);
    }

    function procesarEnrolamiento(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-enrolar');
      btn.innerText = 'Creando...'; btn.disabled = true;
      const data = { 
        name: document.getElementById('n-name').value, 
        rut: document.getElementById('n-rut').value, 
        specialty: document.getElementById('n-specialty').value, 
        email: document.getElementById('n-email').value, 
        price: document.getElementById('n-price').value, 
        duration: document.getElementById('n-duration').value,
        commission: document.getElementById('n-commission').value
      };
      google.script.run.withSuccessHandler(res => {
          btn.innerText = 'Crear Cuenta'; btn.disabled = false;
          if(res.ok) { Swal.fire('Especialista Creado', 'La contraseña temporal son los últimos 4 dígitos de su RUT.', 'success'); cerrarModalEnrolar(); cargarAdminList(); } 
          else { Swal.fire('Error', res.message, 'error'); }
        }).enrolarEspecialista(TOKEN, data);
    }

    function logout() { 
      sessionStorage.clear(); 
      localStorage.clear();
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = LOGIN_URL;
      form.target = '_top';
      document.body.appendChild(form);
      form.submit();
    }
