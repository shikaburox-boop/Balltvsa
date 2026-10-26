// ============================================================
//  Schedule & Event Manager - script.js
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBKGhZyNWA6wEIbjowrhdToXdSpQpL3O5Y",
  authDomain: "awesome-calendar-4a106.firebaseapp.com",
  projectId: "awesome-calendar-4a106",
  storageBucket: "awesome-calendar-4a106.firebasestorage.app",
  messagingSenderId: "939767735796",
  appId: "1:939767735796:web:f6de740a3305f60f2e05a1"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let appointments = [];
let quickStickers = [];
let currentDate = new Date();
let selectedDateStr = "";
let currentUserId = null;
let firstEventMinutes = null;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const dayNamesTh = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const SLOT_HEIGHT_PX = 70;
const PX_PER_MINUTE = SLOT_HEIGHT_PX / 60;

// Helper Functions
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  let [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

// กัน XSS / ข้อความที่มี " หรือ < ทำ HTML พัง
function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function formatDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysStr(dateStr, n) {
  let d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return formatDateStr(d);
}

const availableColors = ["purple", "blue", "green", "orange", "red"];
function getRandomColor() {
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

// ============================================================
//  INIT
// ============================================================
$(document).ready(function () {
  renderCalendar();
  renderAgendaList();
  renderTimelineSlots();
  renderQuickStickers();
  initDraggablesAndDroppables();

  // ---- Month navigation ----
  // ต้อง setDate(1) ก่อน ไม่งั้นวันที่ 29-31 จะข้ามเดือน (เช่น 31 ต.ค. → "31 พ.ย." = 1 ธ.ค.)
  $("#prevBtn").click(function () {
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  $("#nextBtn").click(function () {
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // อัปเดต Ongoing/Upcoming ทุกนาที
  setInterval(renderAgendaList, 60000);

  // ---- Back to Month View ----
  $("#backToMonthBtn").click(function () {
    $("#dayDetailView").hide();
    $("#monthView").fadeIn(150);
    selectedDateStr = "";
    $("#eventDate").val("");
    $("#eventEndDate").val("");
    $("#dragPresetsSection").hide();
    $("#stickerForm").hide();
  });

  // ---- Main Form: Add Event ----
  $("#appointmentForm").submit(function (e) {
    e.preventDefault();

    if (!currentUserId) {
      alert("Please sign in with Google first to save events.");
      return;
    }

    let dateVal = $("#eventDate").val();
    let endDateVal = $("#eventEndDate").val() || dateVal;

    if (!dateVal) {
      alert("Please select a specific day from the calendar first.");
      return;
    }

    if (endDateVal < dateVal) {
      alert("End Date cannot be before Start Date.");
      return;
    }

    let startTimeVal = $("#eventStartTime").val() || "09:00";
    let endTimeVal = $("#eventEndTime").val() || "10:00";
    let titleVal = $("#eventTitle").val().trim();
    let detailsVal = $("#eventDetails").val().trim();
    
    let colorVal = $("input[name='eventColor']:checked").val();

    if (!titleVal) return;

    // เทียบเป็นวัน+เวลาเต็ม (ข้ามวันได้ เช่น จ. 22:00 → อ. 06:00)
    let startDT = new Date(`${dateVal}T${startTimeVal}`);
    let endDT = new Date(`${endDateVal}T${endTimeVal}`);
    let durationVal = (endDT - startDT) / 3600000;

    if (durationVal <= 0) {
      alert("End must be later than start.");
      return;
    }

    if (!colorVal) colorVal = getRandomColor();

    let newEventData = {
      userId: currentUserId,
      date: dateVal,
      endDate: endDateVal,
      time: startTimeVal,
      endTime: endTimeVal,
      duration: durationVal,
      title: titleVal,
      details: detailsVal,
      color: colorVal,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("events").add(newEventData)
      .then((docRef) => {
        newEventData.id = docRef.id;
        appointments.push(newEventData);

        $("#eventTitle").val("");
        $("#eventDetails").val("");

        renderCalendar();
        renderAgendaList();

        if ($("#dayDetailView").is(":visible") && selectedDateStr === dateVal) {
          showDayDetail(selectedDateStr);
        }
      })
      .catch((error) => {
        console.error("Error adding event: ", error);
      });
  });

  // ---- Toggle Mini Sticker Form ----
  $("#toggleStickerFormBtn").click(function () {
    $("#stickerForm").slideToggle(150);
    $("#stickerTitle").focus();
  });

  // ---- Mini Form: Create Quick Sticker ----
  $("#stickerForm").submit(function (e) {
    e.preventDefault();

    if (!currentUserId) {
      alert("Please sign in with Google first.");
      return;
    }

    let title = $("#stickerTitle").val().trim();
    let details = $("#stickerDetails").val().trim();
    
    let hours = parseInt($("#stickerHours").val()) || 0;
    let minutes = parseInt($("#stickerMinutes").val()) || 0;
    let duration = hours + (minutes / 60);

    let color = $("input[name='stickerColor']:checked").val();

    if (!title) return;
    if (duration <= 0) {
      alert("Duration must be greater than 0.");
      return;
    }

    if (!color) color = getRandomColor();

    let newStickerData = {
      userId: currentUserId,
      title: title,
      duration: duration,
      details: details,
      color: color,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("stickers").add(newStickerData)
      .then((docRef) => {
        newStickerData.id = docRef.id;
        quickStickers.push(newStickerData);
        renderQuickStickers();

        $("#stickerTitle").val("");
        $("#stickerDetails").val("");
        $("#stickerHours").val("0");
        $("#stickerMinutes").val("0");
        $("#stickerForm").slideUp(150);
      })
      .catch((error) => {
        console.error("Error adding sticker: ", error);
      });
  });

  // ---- Delete Event (from Agenda) ----
  $(".agenda-list").on("click", ".btn-del", function () {
    let idToDelete = $(this).data("id").toString();

    db.collection("events").doc(idToDelete).delete()
      .then(() => {
        appointments = appointments.filter(app => app.id !== idToDelete);

        $(this).closest(".agenda-item").fadeOut(150, function () {
          renderCalendar();
          renderAgendaList();
          if ($("#dayDetailView").is(":visible")) {
            showDayDetail(selectedDateStr);
          }
        });
      })
      .catch((error) => {
        console.error("Error removing event: ", error);
      });
  });

  // ---- Click a date cell → open Day View ----
  $("#daysContainer").on("click", ".cell:not(.empty)", function () {
    let dateStr = $(this).data("date");
    selectedDateStr = dateStr;
    $("#eventDate").val(dateStr);
    $("#eventEndDate").val(dateStr);

    showDayDetail(dateStr);

    $("#monthView").hide();
    $("#dayDetailView").fadeIn(150);
    $("#dragPresetsSection").show();
    scrollTimelineToFocus();
  });

  // ---- Delete Quick Sticker ----
  $(document).on("click", ".btn-del-sticker", function (e) {
    e.stopPropagation();
    let idToDelete = $(this).data("id").toString();

    db.collection("stickers").doc(idToDelete).delete()
      .then(() => {
        quickStickers = quickStickers.filter(s => s.id !== idToDelete);
        renderQuickStickers();
      })
      .catch((error) => {
        console.error("Error removing sticker: ", error);
      });
  });

  // ✅ ---- Delete Event (from Timeline or Banner) - ลบเลยไม่ต้องถาม ----
  $(document).on("click", ".btn-del-banner, .btn-del-timeline", function (e) {
    e.stopPropagation();
    let idToDelete = $(this).data("id").toString();

    db.collection("events").doc(idToDelete).delete()
      .then(() => {
        appointments = appointments.filter(app => app.id !== idToDelete);
        renderCalendar();
        renderAgendaList();
        showDayDetail(selectedDateStr);
      })
      .catch((error) => {
        console.error("Error removing event: ", error);
      });
  });

  // ==========================================================
  // ✅ CUSTOM DATE PICKER LOGIC
  // ==========================================================
  let dpCurrentDate = new Date();
  let dpTargetInputId = null;

  function renderDpCalendar() {
    let year = dpCurrentDate.getFullYear();
    let month = dpCurrentDate.getMonth();
    
    $("#dpMonthYear").text(`${monthNames[month]} ${year}`);

    let firstDay = new Date(year, month, 1).getDay();
    let daysInMonth = new Date(year, month + 1, 0).getDate();
    let $daysContainer = $("#dpDays").empty();

    for (let i = 0; i < firstDay; i++) {
      $daysContainer.append('<div class="dp-day dp-empty"></div>');
    }

    let today = new Date();
    let selectedVal = dpTargetInputId ? $(dpTargetInputId).val() : "";

    for (let day = 1; day <= daysInMonth; day++) {
      let mStr = String(month + 1).padStart(2, '0');
      let dStr = String(day).padStart(2, '0');
      let dateStr = `${year}-${mStr}-${dStr}`;
      
      let isSelected = (dateStr === selectedVal) ? "dp-selected" : "";
      let isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) ? "dp-today" : "";
      let isSunday = (new Date(year, month, day).getDay() === 0) ? "dp-sunday" : "";

      let $dayDiv = $(`<div class="dp-day ${isSelected} ${isToday} ${isSunday}" data-date="${dateStr}">${day}</div>`);
      $daysContainer.append($dayDiv);
    }
  }

  $(document).on("click", "#eventDate, #eventEndDate", function(e) {
    e.preventDefault();
    dpTargetInputId = "#" + $(this).attr("id");
    
    let currentVal = $(this).val();
    if (currentVal) {
      dpCurrentDate = new Date(currentVal + "T00:00:00");
    } else {
      dpCurrentDate = new Date();
    }

    renderDpCalendar();
    $("#datePickerModal").css("display", "flex");
  });

  $(".dp-overlay").click(function() {
    $("#datePickerModal").hide();
  });

  $(document).on("click", ".dp-day:not(.dp-empty)", function() {
    let selectedDate = $(this).data("date");
    if (dpTargetInputId) {
      $(dpTargetInputId).val(selectedDate);

      // เลือกวันเริ่มหลังวันจบ → ดันวันจบตาม / ไม่มีวันจบ → ใช้วันเดียวกัน
      if (dpTargetInputId === "#eventDate") {
        let endVal = $("#eventEndDate").val();
        if (!endVal || endVal < selectedDate) $("#eventEndDate").val(selectedDate);
      }
    }
    $("#datePickerModal").hide();
  });

  $(".dp-prev").click(function(e) {
    e.stopPropagation();
    dpCurrentDate.setDate(1);
    dpCurrentDate.setMonth(dpCurrentDate.getMonth() - 1);
    renderDpCalendar();
  });

  $(".dp-next").click(function(e) {
    e.stopPropagation();
    dpCurrentDate.setDate(1);
    dpCurrentDate.setMonth(dpCurrentDate.getMonth() + 1);
    renderDpCalendar();
  });

  // ==========================================================
  // ✅ CUSTOM TIME PICKER LOGIC
  // ==========================================================
  let tpTargetInputId = null;

  function populateHours() {
    let $wheel = $("#wheelHour");
    $wheel.find(".tp-wheel-item").remove();
    for (let i = 1; i <= 12; i++) {
      let val = String(i).padStart(2, '0');
      $wheel.find(".tp-wheel-spacer").eq(1).before(`<div class="tp-wheel-item" data-val="${val}">${val}</div>`);
    }
  }

  function populateMinutes() {
    let $wheel = $("#wheelMinute");
    $wheel.find(".tp-wheel-item").remove();
    for (let i = 0; i < 60; i++) {
      let val = String(i).padStart(2, '0');
      $wheel.find(".tp-wheel-spacer").eq(1).before(`<div class="tp-wheel-item" data-val="${val}">${val}</div>`);
    }
  }

  populateHours();
  populateMinutes();

  function scrollToValue($wheel, value) {
    let $items = $wheel.find(".tp-wheel-item");
    let $item = $items.filter(`[data-val="${value}"]`);
    if ($item.length) {
      // ใช้ลำดับในกลุ่ม item เท่านั้น (ไม่นับ spacer) ไม่งั้นเลื่อนเลยไป 1 ช่อง
      let scrollPos = $items.index($item) * 40;
      $wheel.scrollTop(scrollPos);
      $item.addClass("tp-active").siblings(".tp-wheel-item").removeClass("tp-active");
    }
  }

  function updateWheelHighlight($wheel, displayId, isAmPm) {
    let scrollTop = $wheel.scrollTop();
    let index = Math.round(scrollTop / 40); 
    let $items = $wheel.find(".tp-wheel-item");
    
    $items.removeClass("tp-active");
    let $active = $items.eq(index);
    $active.addClass("tp-active");

    let val = $active.data("val");
    if (val) {
      $(displayId).text(val);
    }
  }

  $(document).on("click", "#eventStartTime, #eventEndTime", function(e) {
    e.preventDefault();
    tpTargetInputId = "#" + $(this).attr("id");
    
    let currentVal = $(this).val(); 
    let h = "09", m = "00", ampm = "AM";
    
    if (currentVal) {
      let parts = currentVal.split(":");
      let hour24 = parseInt(parts[0], 10);
      m = parts[1];
      
      if (hour24 >= 12) {
        ampm = "PM";
        if (hour24 > 12) hour24 -= 12;
      } else {
        ampm = "AM";
        if (hour24 === 0) hour24 = 12;
      }
      h = String(hour24).padStart(2, '0');
    } else {
      h = "09"; m = "00"; ampm = "AM";
    }

    $("#tpHourDisplay").text(h);
    $("#tpMinDisplay").text(m);
    $("#tpAmPmDisplay").text(ampm);

    setTimeout(() => {
      scrollToValue($("#wheelHour"), h);
      scrollToValue($("#wheelMinute"), m);
      scrollToValue($("#wheelAmPm"), ampm);
    }, 50); 

    $("#timePickerModal").css("display", "flex");
  });

  $(".tp-wheel").scroll(function() {
    let scrollTop = $(this).scrollTop();
    let index = Math.round(scrollTop / 40);
    let $items = $(this).find(".tp-wheel-item");
    
    $items.removeClass("tp-active");
    let $active = $items.eq(index);
    $active.addClass("tp-active");

    let val = $active.data("val");
    if ($(this).attr("id") === "wheelHour") {
      $("#tpHourDisplay").text(val);
    } else if ($(this).attr("id") === "wheelMinute") {
      $("#tpMinDisplay").text(val);
    } else if ($(this).attr("id") === "wheelAmPm") {
      $("#tpAmPmDisplay").text(val);
    }
  });

  // กด Done หรือแตะพื้นหลัง = บันทึกเวลา
  $(".tp-overlay, #tpDoneBtn").click(function() {
    let h = $("#tpHourDisplay").text();
    let m = $("#tpMinDisplay").text();
    let ampm = $("#tpAmPmDisplay").text();

    let hour24 = parseInt(h, 10);
    if (ampm === "PM" && hour24 !== 12) hour24 += 12;
    if (ampm === "AM" && hour24 === 12) hour24 = 0;

    let finalTime = `${String(hour24).padStart(2, '0')}:${m}`;
    
    if (tpTargetInputId) {
      $(tpTargetInputId).val(finalTime);
    }

    $("#timePickerModal").hide();
  });
});

// ============================================================
//  LOAD DATA
// ============================================================
function loadUserDataFromDatabase(userId) {
  db.collection("events")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      appointments = [];
      querySnapshot.forEach((doc) => {
        let eventData = doc.data();
        eventData.id = doc.id;
        if (!eventData.color) eventData.color = "purple";
        if (!eventData.endDate) eventData.endDate = eventData.date;
        appointments.push(eventData);
      });
      renderCalendar();
      renderAgendaList();
      if ($("#dayDetailView").is(":visible") && selectedDateStr) {
        showDayDetail(selectedDateStr);
      }
    });

  db.collection("stickers")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      quickStickers = [];
      querySnapshot.forEach((doc) => {
        let stickerData = doc.data();
        stickerData.id = doc.id;
        if (!stickerData.color) stickerData.color = "purple";
        quickStickers.push(stickerData);
      });
      renderQuickStickers();
    });
}

// ============================================================
//  RENDER AGENDA LIST (Ongoing & Upcoming)
// ============================================================
function renderAgendaList() {
  let $ongoingList = $("#ongoingList").empty();
  let $upcomingList = $("#upcomingList").empty();

  let now = new Date();
  
  appointments.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

  let ongoingEvents = [];
  let upcomingEvents = [];

  appointments.forEach(app => {
    let startDateTime = new Date(`${app.date}T${app.time}`);
    let endDateTime = new Date(`${app.endDate}T${app.endTime}`);

    if (now >= startDateTime && now <= endDateTime) {
      ongoingEvents.push(app);
    } else if (now < startDateTime) {
      upcomingEvents.push(app);
    }
  });

  $("#ongoingCount").text(ongoingEvents.length);
  $("#upcomingCount").text(upcomingEvents.length);

  if (ongoingEvents.length === 0) {
    $ongoingList.append('<li class="agenda-item" style="color: var(--text-muted); font-size: 0.8rem;">No ongoing events</li>');
  } else {
    ongoingEvents.forEach(app => {
      $ongoingList.append(createAgendaItemHtml(app, true));
    });
  }

  if (upcomingEvents.length === 0) {
    $upcomingList.append('<li class="agenda-item" style="color: var(--text-muted); font-size: 0.8rem;">No upcoming events</li>');
  } else {
    upcomingEvents.forEach(app => {
      $upcomingList.append(createAgendaItemHtml(app, false));
    });
  }
}

function createAgendaItemHtml(app, isOngoing) {
  let color = app.color || "purple";
  let dateDisplay = app.date;
  if (app.endDate && app.endDate !== app.date) {
    dateDisplay = `${app.date} to ${app.endDate}`;
  }
  
  let timeDisplay = isOngoing 
    ? `<span style="color: var(--color-green); font-weight:600;">Now</span> · ends ${app.endTime}`
    : `${app.time} - ${app.endTime}`;

  return `
    <li class="agenda-item">
      <div>
        <span class="agenda-title">
          <span class="agenda-color-dot dot-${color}"></span>
          ${escapeHtml(app.title)}
        </span>
        <span class="agenda-meta">${dateDisplay} · ${timeDisplay}</span>
      </div>
      <button class="btn-del" data-id="${escapeHtml(app.id)}" type="button">Remove</button>
    </li>
  `;
}

// ============================================================
//  RENDER QUICK STICKERS
// ============================================================
function renderQuickStickers() {
  let $container = $("#presetChipsContainer").empty();

  if (quickStickers.length === 0) {
    $container.append('<div style="font-size: 0.75rem; color: #a1a1aa; font-style: italic;">No stickers yet. Click + to create.</div>');
    return;
  }

  quickStickers.forEach(sticker => {
    let colorClass = "sticker-" + (sticker.color || "purple");
    let $chip = $(`
      <div class="draggable-chip ${colorClass}">
        ${escapeHtml(sticker.title)} (${sticker.duration}h)
        <button class="btn-del-sticker" type="button" title="Remove sticker">×</button>
      </div>
    `);
    // ใส่ผ่าน .attr/.data เพื่อไม่ให้ " ในข้อความทำ attribute พัง
    $chip.attr("data-title", sticker.title)
         .attr("data-duration", sticker.duration)
         .attr("data-details", sticker.details || "")
         .attr("data-color", sticker.color || "purple");
    $chip.find(".btn-del-sticker").attr("data-id", sticker.id);
    $container.append($chip);
  });
}

// ============================================================
//  ✅ RENDER MONTH CALENDAR (Absolute Position Multi-day Bar)
// ============================================================
function renderCalendar() {
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth();

  $("#monthYearDisplay").text(`${monthNames[month]} ${year}`);

  let firstDay = new Date(year, month, 1).getDay();
  let daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalRows = Math.ceil((firstDay + daysInMonth) / 7);
  let monthStartStr = `${year}-${pad2(month + 1)}-01`;
  let monthEndStr = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`;
  let monthStartMs = new Date(monthStartStr + "T00:00:00").getTime();

  // วันที่ → index ใน grid (0 = ช่องแรกของสัปดาห์แรก) อาจติดลบหรือเกินเดือนได้
  function gridIndex(dateStr) {
    return Math.round((new Date(dateStr + "T00:00:00").getTime() - monthStartMs) / 86400000) + firstDay;
  }

  // 1. รวม event ที่ "ติดกัน" (ชื่อ+สีเดียวกัน และอยู่วันต่อเนื่องกัน) ให้เป็นเส้นเดียว
  let items = [];
  appointments.forEach(evt => {
    let s = evt.date;
    let e = evt.endDate || evt.date;
    if (e < monthStartStr || s > monthEndStr) return;
    items.push({
      s, e,
      color: evt.color || "purple",
      title: evt.title || "",
      key: (evt.color || "purple") + "|" + (evt.title || "").trim().toLowerCase()
    });
  });
  items.sort((a, b) => a.key.localeCompare(b.key) || a.s.localeCompare(b.s));

  let ranges = [];
  items.forEach(it => {
    let last = ranges[ranges.length - 1];
    if (last && last.key === it.key && it.s <= addDaysStr(last.e, 1)) {
      if (it.e > last.e) last.e = it.e;
    } else {
      ranges.push({ s: it.s, e: it.e, color: it.color, title: it.title, key: it.key });
    }
  });

  // 2. ตัดเส้นเป็นท่อนตามสัปดาห์ (แถว)
  let segsByRow = [];
  for (let r = 0; r < totalRows; r++) segsByRow.push([]);
  let gridFirst = firstDay;
  let gridLast = firstDay + daysInMonth - 1;

  ranges.forEach(rg => {
    let realS = gridIndex(rg.s);
    let realE = gridIndex(rg.e);
    let s = Math.max(realS, gridFirst);
    let e = Math.min(realE, gridLast);
    if (s > e) return;

    for (let r = Math.floor(s / 7); r <= Math.floor(e / 7); r++) {
      let segS = Math.max(s, r * 7);
      let segE = Math.min(e, r * 7 + 6);
      segsByRow[r].push({
        colStart: segS % 7,
        colEnd: segE % 7,
        // ต่อเนื่องมาจาก/ไปยังสัปดาห์อื่น → ชนขอบช่องเพื่อให้เส้นเชื่อมกัน
        contLeft: realS < r * 7,
        contRight: realE > r * 7 + 6,
        color: rg.color,
        title: rg.title
      });
    }
  });

  // 3. วาดแถวสัปดาห์
  let $container = $("#daysContainer").empty();
  let today = new Date();
  const LANE_H = 12;
  const TOP_BASE = 32;
  const INSET = 3;

  for (let r = 0; r < totalRows; r++) {
    let $row = $('<div class="week-row"></div>');

    for (let c = 0; c < 7; c++) {
      let day = r * 7 + c - firstDay + 1;
      if (day < 1 || day > daysInMonth) {
        $row.append('<div class="cell empty"></div>');
        continue;
      }
      let dateFormatted = `${year}-${pad2(month + 1)}-${pad2(day)}`;
      let isToday = (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day);
      $row.append(
        `<div class="${isToday ? "cell is-today" : "cell"}" data-date="${dateFormatted}">
           <span class="cell-num">${day}</span>
         </div>`
      );
    }

    // จัดเลน: event ที่ไม่ซ้อนกันใช้เลนเดียวกัน → เส้นของวันที่ติดกันจะอยู่ระดับเดียวกัน
    let segs = segsByRow[r].sort((a, b) => a.colStart - b.colStart || (b.colEnd - b.colStart) - (a.colEnd - a.colStart));
    let laneEnds = [];
    segs.forEach(seg => {
      let lane = laneEnds.findIndex(endCol => endCol < seg.colStart);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(-1); }
      laneEnds[lane] = seg.colEnd;
      seg.lane = lane;
    });

    $row.css("min-height", Math.max(120, TOP_BASE + laneEnds.length * LANE_H + 10) + "px");

    segs.forEach(seg => {
      let span = seg.colEnd - seg.colStart + 1;
      let insetL = seg.contLeft ? 0 : INSET;
      let insetR = seg.contRight ? 0 : INSET;

      let $bar = $('<div class="month-event-bar"></div>')
        .addClass("bar-" + seg.color)
        .toggleClass("cont-left", seg.contLeft)
        .toggleClass("cont-right", seg.contRight)
        .attr("title", seg.title)
        .css({
          left: `calc(${seg.colStart} * 100% / 7 + ${insetL}px)`,
          width: `calc(${span} * 100% / 7 - ${insetL + insetR}px)`,
          top: (TOP_BASE + seg.lane * LANE_H) + "px"
        });
      $row.append($bar);
    });

    $container.append($row);
  }
}

// ============================================================
//  ✅ DAY DETAIL VIEW (แก้บัคซ้อนทับ)
// ============================================================
function showDayDetail(dateStr) {
  let dateObj = new Date(dateStr + "T00:00:00");
  let dayNum = dateObj.getDate();
  let dayOfWeek = dayNamesTh[dateObj.getDay()];

  $("#detailDayName").text(dayOfWeek);
  $("#detailDayCircle").text(dayNum);

  let dayEvents = appointments.filter(app => {
    let start = app.date;
    let end = app.endDate || app.date;
    return dateStr >= start && dateStr <= end;
  });

  // ช่วงเวลาของ event ในวันนี้: วันแรกเริ่มตามเวลาเริ่ม, วันสุดท้ายจบตามเวลาจบ, วันกลางเต็มวัน
  let items = dayEvents.map(evt => {
    let end = evt.endDate || evt.date;
    let s = (dateStr === evt.date) ? timeToMinutes(evt.time) : 0;
    let e = (dateStr === end) ? timeToMinutes(evt.endTime) : 1440;
    if (e <= s) e = Math.min(1440, s + 30);
    return { evt, start: s, end: e };
  });
  items.sort((a, b) => a.start - b.start || b.end - a.end);

  $("#timelineGrid .event-sticker-block").remove();
  let $banner = $("#allDayBanner").empty();

  firstEventMinutes = null;

  if (items.length > 0) {
    firstEventMinutes = items[0].start;

    // จัดกลุ่มที่ซ้อนทับกัน (เทียบกับเวลาจบ "สูงสุด" ของกลุ่ม) แล้วแบ่งคอลัมน์
    let groups = [];
    let current = null;
    items.forEach(item => {
      if (!current || item.start >= current.maxEnd) {
        current = { items: [], maxEnd: 0, colEnds: [] };
        groups.push(current);
      }
      let col = current.colEnds.findIndex(endMin => endMin <= item.start);
      if (col === -1) { col = current.colEnds.length; current.colEnds.push(0); }
      current.colEnds[col] = item.end;
      item.col = col;
      current.items.push(item);
      current.maxEnd = Math.max(current.maxEnd, item.end);
    });

    groups.forEach(group => {
      let cols = group.colEnds.length;

      group.items.forEach(item => {
        let evt = item.evt;
        let color = evt.color || "purple";
        let safeTitle = escapeHtml(evt.title);
        let timeText = `${evt.time} - ${evt.endTime}`;
        if ((evt.endDate || evt.date) !== evt.date) {
          timeText = `${evt.date} ${evt.time} → ${evt.endDate} ${evt.endTime}`;
        }

        $banner.append(
          `<div class="event-banner-item banner-${color}">
             ${safeTitle} (${escapeHtml(timeText)})
             <button class="btn-del-banner" data-id="${escapeHtml(evt.id)}" type="button" title="Remove event">×</button>
           </div>`
        );

        let topPx = item.start * PX_PER_MINUTE;
        let heightPx = Math.max((item.end - item.start) * PX_PER_MINUTE, 18);

        let widthPercent = 100 / cols;
        let leftPercent = widthPercent * item.col;

        let $sticker = $(`
          <div class="event-sticker-block sticker-${color}"
               style="top: ${topPx}px; height: ${heightPx - 2}px; width: calc(${widthPercent}% - 78px); left: calc(${leftPercent}% + 74px);">
            <div class="sticker-title">${safeTitle}</div>
            <div class="sticker-time">${escapeHtml(timeText)}</div>
            ${evt.details ? `<div class="sticker-details">${escapeHtml(evt.details)}</div>` : ""}
            <button class="btn-del-timeline" data-id="${escapeHtml(evt.id)}" type="button" title="Remove event">×</button>
          </div>
        `);

        $("#timelineGrid").append($sticker);
      });
    });
  } else {
    $banner.html(
      '<div style="color: var(--text-muted); font-size: 0.85rem;">No events for this day.</div>'
    );
  }

  scrollTimelineToFocus();
}

// เลื่อน timeline ไปที่ event แรกของวัน (ถ้าไม่มีให้ไปที่ 07:00)
function scrollTimelineToFocus() {
  if (!$("#dayDetailView").is(":visible")) return;
  let mins = (firstEventMinutes != null) ? firstEventMinutes : 7 * 60;
  $(".timeline-scroll").scrollTop(Math.max(0, mins * PX_PER_MINUTE - 20));
}

// ============================================================
//  RENDER 24-HOUR TIMELINE
// ============================================================
function renderTimelineSlots() {
  let $grid = $("#timelineGrid").empty();
  let globalSlotCounter = 0;

  for (let hour = 0; hour < 24; hour++) {
    let label = "";
    if (hour === 0) label = "12 AM";
    else if (hour < 12) label = `${hour} AM`;
    else if (hour === 12) label = "12 PM";
    else label = `${hour - 12} PM`;

    let slot00 = globalSlotCounter++;
    let slot30 = globalSlotCounter++;

    let $hourGroup = $(`
      <div class="time-slot">
        <div>
          <div class="time-label">${label}</div>
          <div id="slot-half-${slot00}" class="time-content"
               data-time-slot="${hour}:00" data-slot-index="${slot00}"></div>
        </div>
        <div>
          <div class="time-label" style="color: transparent;">-</div>
          <div id="slot-half-${slot30}" class="time-content"
               data-time-slot="${hour}:30" data-slot-index="${slot30}"></div>
        </div>
      </div>
    `);

    $grid.append($hourGroup);
  }
}

// ============================================================
//  DRAG & DROP
// ============================================================
function initDraggablesAndDroppables() {
  $(document).on("mouseenter", ".draggable-chip", function () {
    if (!$(this).hasClass("ui-draggable")) {
      $(this).draggable({
        helper: "clone",
        revert: "invalid",
        cursor: "move",
        zIndex: 9999,
        cancel: ".btn-del-sticker"
      });
    }
  });

  $(document).on("mouseenter", ".time-content", function () {
    if (!$(this).hasClass("ui-droppable")) {
      $(this).droppable({
        accept: ".draggable-chip",
        hoverClass: "ui-droppable-hover",
        drop: function (event, ui) {
          if (!currentUserId) {
            alert("Please sign in with Google first to drop events.");
            return;
          }
          if (!selectedDateStr) return;

          let targetTimeStr = String($(this).data("time-slot"));
          let title = String(ui.draggable.attr("data-title"));
          let duration = parseFloat(ui.draggable.attr("data-duration")) || 1;
          let details = ui.draggable.attr("data-details") || "";
          let color = ui.draggable.attr("data-color") || "purple";

          let [h, m] = targetTimeStr.split(":");
          let formattedTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

          let startMinutes = parseInt(h) * 60 + parseInt(m);
          let endMinutes = Math.round(startMinutes + duration * 60);

          // ถ้าเกินเที่ยงคืน ให้ไปจบวันถัดไป (เดิมใช้ % 24 ทำให้เวลาจบน้อยกว่าเวลาเริ่ม)
          let endDateStr = selectedDateStr;
          if (endMinutes >= 1440) {
            endDateStr = addDaysStr(selectedDateStr, Math.floor(endMinutes / 1440));
            endMinutes = endMinutes % 1440;
          }
          let formattedEndTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

          let newEventData = {
            userId: currentUserId,
            date: selectedDateStr,
            endDate: endDateStr,
            time: formattedTime,
            endTime: formattedEndTime,
            duration: duration,
            title: title,
            details: details,
            color: color,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          db.collection("events").add(newEventData)
            .then((docRef) => {
              newEventData.id = docRef.id;
              appointments.push(newEventData);

              renderCalendar();
              renderAgendaList();
              showDayDetail(selectedDateStr);
            })
            .catch((error) => {
              console.error("Error adding dropped event: ", error);
            });
        }
      });
    }
  });
}

// ============================================================
//  GOOGLE SIGN-IN
// ============================================================
function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  currentUserId = payload.sub;

  $("#loginContainer").hide();
  $("#userAvatar").attr("src", payload.picture);
  $("#userName").text(payload.name);
  $("#userInfo").css("display", "flex");

  db.collection("users").doc(currentUserId).set({
    uid: currentUserId,
    email: payload.email,
    displayName: payload.name,
    photoURL: payload.picture,
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  loadUserDataFromDatabase(currentUserId);
}

function parseJwt(token) {
  let base64Url = token.split(".")[1];
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  let jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
}

$(document).on("click", "#logoutBtn", function () {
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  $("#userInfo").hide();
  $("#loginContainer").show();

  currentUserId = null;
  appointments = [];
  quickStickers = [];
  renderCalendar();
  renderAgendaList();
  renderQuickStickers();
  $("#dragPresetsSection").hide();
});
