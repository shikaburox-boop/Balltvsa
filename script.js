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
  $("#prevBtn").click(function () {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  $("#nextBtn").click(function () {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // ---- Back to Month View ----
  $("#backToMonthBtn").click(function () {
    $("#dayDetailView").hide();
    $("#monthView").fadeIn(150);
    selectedDateStr = "";
    $("#eventDate").val("");
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

    let startMinutes = timeToMinutes(startTimeVal);
    let endMinutes = timeToMinutes(endTimeVal);
    let durationVal = (endMinutes - startMinutes) / 60;

    if (durationVal <= 0) {
      alert("End time must be later than start time.");
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
    }
    $("#datePickerModal").hide();
  });

  $(".dp-prev").click(function(e) {
    e.stopPropagation();
    dpCurrentDate.setMonth(dpCurrentDate.getMonth() - 1);
    renderDpCalendar();
  });

  $(".dp-next").click(function(e) {
    e.stopPropagation();
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
    let $item = $wheel.find(`.tp-wheel-item[data-val="${value}"]`);
    if ($item.length) {
      let scrollPos = $item.index() * 40; 
      $wheel.scrollTop(scrollPos);
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

  $(".tp-overlay").click(function() {
    $("#timePickerModal").hide();
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

  $(".tp-overlay").click(function() {
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
          ${app.title}
        </span>
        <span class="agenda-meta">${dateDisplay} · ${timeDisplay}</span>
      </div>
      <button class="btn-del" data-id="${app.id}" type="button">Remove</button>
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
      <div class="draggable-chip ${colorClass}" data-title="${sticker.title}" data-duration="${sticker.duration}" data-details="${sticker.details || ''}" data-color="${sticker.color || 'purple'}">
        ${sticker.title} (${sticker.duration}h)
        <button class="btn-del-sticker" data-id="${sticker.id}" type="button" title="Remove sticker">×</button>
      </div>
    `);
    $container.append($chip);
  });
}

// ============================================================
//  ✅ RENDER MONTH CALENDAR (Stacked & Connected Bars)
// ============================================================
function renderCalendar() {
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth();

  $("#monthYearDisplay").text(`${monthNames[month]} ${year}`);

  let firstDay = new Date(year, month, 1).getDay();
  let daysInMonth = new Date(year, month + 1, 0).getDate();

  let $container = $("#daysContainer");
  $container.empty();

  for (let i = 0; i < firstDay; i++) {
    $container.append('<div class="cell empty"></div>');
  }

  let today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    let monthStr = String(month + 1).padStart(2, "0");
    let dayStr = String(day).padStart(2, "0");
    let dateFormatted = `${year}-${monthStr}-${dayStr}`;

    let isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day;

    let cellClass = isToday ? "cell is-today" : "cell";

    let dayEvents = appointments.filter(app => {
      let start = app.date;
      let end = app.endDate || app.date;
      return dateFormatted >= start && dateFormatted <= end;
    });

    let barsHtml = "";
    if (dayEvents.length > 0) {
      barsHtml = '<div class="event-stack">';
      dayEvents.forEach(evt => {
        let c = evt.color || "purple";
        let start = evt.date;
        let end = evt.endDate || evt.date;
        
        let classCap = "";
        if (start === end) {
           classCap = "single-cap";
        } else if (dateFormatted === start) {
           classCap = "start-cap";
        } else if (dateFormatted === end) {
           classCap = "end-cap";
        }

        barsHtml += `<div class="event-bar bar-${c} ${classCap}"></div>`;
      });
      barsHtml += '</div>';
    }

    let $cell = $(
      `<div class="${cellClass}" data-date="${dateFormatted}">
         <span class="cell-num">${day}</span>
         ${barsHtml}
       </div>`
    );
    $container.append($cell);
  }
}

// ============================================================
//  ✅ DAY DETAIL VIEW (แก้บัคซ้อนทับ & ระยะห่าง)
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
  
  dayEvents.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

  $("#timelineGrid .event-sticker-block").remove();
  let $banner = $("#allDayBanner").empty();

  if (dayEvents.length > 0) {
    let groups = [];
    let currentGroup = [];

    dayEvents.forEach(evt => {
      let evtStart = timeToMinutes(evt.time);
      let evtEnd = timeToMinutes(evt.endTime);

      if (currentGroup.length === 0) {
        currentGroup.push({ evt, start: evtStart, end: evtEnd });
      } else {
        let lastInGroup = currentGroup[currentGroup.length - 1];
        if (evtStart < lastInGroup.end) {
          currentGroup.push({ evt, start: evtStart, end: evtEnd });
        } else {
          groups.push([...currentGroup]);
          currentGroup = [{ evt, start: evtStart, end: evtEnd }];
        }
      }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    groups.forEach(group => {
      let groupSize = group.length;
      
      group.forEach((item, index) => {
        let evt = item.evt;
        let color = evt.color || "purple";
        
        $banner.append(
          `<div class="event-banner-item banner-${color}">
             ${evt.title} (${evt.time} - ${evt.endTime})
             <button class="btn-del-banner" data-id="${evt.id}" type="button" title="Remove event">×</button>
           </div>`
        );

        let minutesFromTop = item.start;
        let durationMinutes = item.end - item.start;

        let topPx = minutesFromTop * PX_PER_MINUTE;
        let heightPx = durationMinutes * PX_PER_MINUTE;

        let widthPercent = 100 / groupSize;
        let leftPercent = widthPercent * index;

        // ดันไปทางขวา 74px (70px Label + 4px padding) และลบความกว้าง 80px 
        let $sticker = $(`
          <div class="event-sticker-block sticker-${color}" 
               style="top: ${topPx}px; height: ${heightPx - 2}px; width: calc(${widthPercent}% - 78px); left: calc(${leftPercent}% + 74px);">
            <div class="sticker-title">${evt.title}</div>
            <div class="sticker-time">${evt.time} - ${evt.endTime}</div>
            ${evt.details ? `<div class="sticker-details">${evt.details}</div>` : ""}
            <button class="btn-del-timeline" data-id="${evt.id}" type="button" title="Remove event">×</button>
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

          let targetTimeStr = $(this).data("time-slot");
          let title = ui.draggable.data("title");
          let duration = parseFloat(ui.draggable.data("duration")) || 1;
          let details = ui.draggable.data("details") || "";
          let color = ui.draggable.data("color") || "purple";

          let [h, m] = targetTimeStr.split(":");
          let formattedTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

          let startMinutes = parseInt(h) * 60 + parseInt(m);
          let endMinutes = startMinutes + (duration * 60);
          
          let endH = Math.floor(endMinutes / 60) % 24;
          let endM = endMinutes % 60;
          let formattedEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

          let newEventData = {
            userId: currentUserId,
            date: selectedDateStr,
            endDate: selectedDateStr,
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
