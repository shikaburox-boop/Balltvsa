// ============================================================
//  Schedule & Event Manager - script.js (Database Connected)
// ============================================================

// TODO: แทนที่ค่า Config นี้ด้วยโปรเจกต์ Firebase ของคุณจริง ๆ
const firebaseConfig = {
  apiKey: "AIzaSyBKGhZyNWA6wEIbjowrhdToXdSpQpL3O5Y",
  authDomain: "awesome-calendar-4a106.firebaseapp.com",
  projectId: "awesome-calendar-4a106",
  storageBucket: "awesome-calendar-4a106.firebasestorage.app",
  messagingSenderId: "939767735796",
  appId: "1:939767735796:web:f6de740a3305f60f2e05a1"
};

// เริ่มต้นใช้งาน Firebase (ต้องมั่นใจว่าใส่ Script Firebase ใน HTML แล้ว)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let appointments = [];
let quickStickers = [];
let currentDate = new Date();
let selectedDateStr = "";
let currentUserId = null; // เก็บ UID ของผู้ใช้ที่ล็อกอิน

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const dayNamesTh = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

// ============================================================
//  INIT
// ============================================================
$(document).ready(function () {
  renderCalendar();
  renderEventList();
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

  // ---- Main Form: Add Event (บันทึกลง Database Collection: events) ----
  $("#appointmentForm").submit(function (e) {
    e.preventDefault();

    if (!currentUserId) {
      alert("Please sign in with Google first to save events.");
      return;
    }

    let dateVal = $("#eventDate").val();
    if (!dateVal) {
      alert("Please select a specific day from the calendar first.");
      return;
    }

    let startTimeVal = $("#eventStartTime").val() || "09:00";
    let endTimeVal = $("#eventEndTime").val() || "10:00";
    let titleVal = $("#eventTitle").val().trim();
    let detailsVal = $("#eventDetails").val().trim();

    if (!titleVal) return;

    let [startH, startM] = startTimeVal.split(":").map(Number);
    let [endH, endM] = endTimeVal.split(":").map(Number);
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    let durationVal = (endMinutes - startMinutes) / 60;

    if (durationVal <= 0) {
      alert("End time must be later than start time.");
      return;
    }

    let newEventData = {
      userId: currentUserId,
      date: dateVal,
      time: startTimeVal,
      endTime: endTimeVal,
      duration: durationVal,
      title: titleVal,
      details: detailsVal,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // บันทึกลงตาราง/Collection 'events' ใน Database
    db.collection("events").add(newEventData)
      .then((docRef) => {
        newEventData.id = docRef.id;
        appointments.push(newEventData);

        $("#eventTitle").val("");
        $("#eventDetails").val("");

        renderCalendar();
        renderEventList();

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

  // ---- Mini Form: Create Quick Sticker (บันทึกลง Database Collection: stickers) ----
  $("#stickerForm").submit(function (e) {
    e.preventDefault();

    if (!currentUserId) {
      alert("Please sign in with Google first.");
      return;
    }

    let title = $("#stickerTitle").val().trim();
    let details = $("#stickerDetails").val().trim();
    let duration = parseFloat($("#stickerDuration").val()) || 1;

    if (!title) return;

    let newStickerData = {
      userId: currentUserId,
      title: title,
      duration: duration,
      details: details,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // บันทึกลงตาราง/Collection 'stickers' ใน Database แยกต่างหาก
    db.collection("stickers").add(newStickerData)
      .then((docRef) => {
        newStickerData.id = docRef.id;
        quickStickers.push(newStickerData);
        renderQuickStickers();

        $("#stickerTitle").val("");
        $("#stickerDetails").val("");
        $("#stickerDuration").val(1);
        $("#stickerForm").slideUp(150);
      })
      .catch((error) => {
        console.error("Error adding sticker: ", error);
      });
  });

  // ---- Delete Event (ลบจาก Database Collection: events) ----
  $("#eventList").on("click", ".btn-del", function () {
    let idToDelete = $(this).data("id").toString();

    db.collection("events").doc(idToDelete).delete()
      .then(() => {
        appointments = appointments.filter(app => app.id !== idToDelete);

        $(this).closest(".agenda-item").fadeOut(150, function () {
          renderCalendar();
          renderEventList();
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

    showDayDetail(dateStr);

    $("#monthView").hide();
    $("#dayDetailView").fadeIn(150);
    $("#dragPresetsSection").show();
  });

  // ---- Delete Quick Sticker (ลบจาก Database Collection: stickers) ----
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
});

// ============================================================
//  LOAD DATA FROM SEPARATED DATABASE COLLECTIONS
// ============================================================
function loadUserDataFromDatabase(userId) {
  // 1. โหลดข้อมูลกิจกรรมเฉพาะของผู้ใช้คนนี้ จาก Collection 'events'
  db.collection("events")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      appointments = [];
      querySnapshot.forEach((doc) => {
        let eventData = doc.data();
        eventData.id = doc.id;
        appointments.push(eventData);
      });
      renderCalendar();
      renderEventList();
      if ($("#dayDetailView").is(":visible") && selectedDateStr) {
        showDayDetail(selectedDateStr);
      }
    });

  // 2. โหลดข้อมูลสติกเกอร์เฉพาะของผู้ใช้คนนี้ จาก Collection 'stickers'
  db.collection("stickers")
    .where("userId", "==", userId)
    .get()
    .then((querySnapshot) => {
      quickStickers = [];
      querySnapshot.forEach((doc) => {
        let stickerData = doc.data();
        stickerData.id = doc.id;
        quickStickers.push(stickerData);
      });
      renderQuickStickers();
    });
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
    let $chip = $(`
      <div class="draggable-chip" data-title="${sticker.title}" data-duration="${sticker.duration}" data-details="${sticker.details || ''}">
        ${sticker.title} (${sticker.duration}h)
        <button class="btn-del-sticker" data-id="${sticker.id}" type="button" title="Remove sticker">×</button>
      </div>
    `);
    $container.append($chip);
  });
}

// ============================================================
//  RENDER MONTH CALENDAR
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

    let $cell = $(
      `<div class="${cellClass}" data-date="${dateFormatted}">
         <span class="cell-num">${day}</span>
       </div>`
    );
    $container.append($cell);
  }
}

// ============================================================
//  DAY DETAIL VIEW
// ============================================================
function showDayDetail(dateStr) {
  let dateObj = new Date(dateStr + "T00:00:00");
  let dayNum = dateObj.getDate();
  let dayOfWeek = dayNamesTh[dateObj.getDay()];

  $("#detailDayName").text(dayOfWeek);
  $("#detailDayCircle").text(dayNum);

  let dayEvents = appointments.filter(app => app.date === dateStr);

  $(".time-content").empty();
  let $banner = $("#allDayBanner").empty();

  if (dayEvents.length > 0) {
    dayEvents.forEach(evt => {
      $banner.append(
        `<div class="event-banner-item">${evt.title} (${evt.time} - ${evt.endTime})</div>`
      );

      let [hStr, mStr] = evt.time.split(":");
      let hour = parseInt(hStr, 10);
      let minute = parseInt(mStr, 10);

      let slotIndex = hour * 2 + (minute >= 30 ? 1 : 0);
      let $targetSlot = $(`#slot-half-${slotIndex}`);

      if ($targetSlot.length) {
        let blockHeight = evt.duration * 70 - 4;

        let $sticker = $(`
          <div class="event-sticker-block" style="height: ${blockHeight}px;">
            <div class="sticker-title">${evt.title}</div>
            <div class="sticker-time">${evt.time} - ${evt.endTime}</div>
            ${evt.details ? `<div class="sticker-details">${evt.details}</div>` : ""}
          </div>
        `);

        $targetSlot.append($sticker);
      }
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
//  DRAG & DROP (Event Delegation)
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
            time: formattedTime,
            endTime: formattedEndTime,
            duration: duration,
            title: title,
            details: details,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          };

          // บันทึกการลากวางสติกเกอร์ลง Database Collection 'events' ทันที
          db.collection("events").add(newEventData)
            .then((docRef) => {
              newEventData.id = docRef.id;
              appointments.push(newEventData);

              renderCalendar();
              renderEventList();
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
//  AGENDA LIST
// ============================================================
function renderEventList() {
  let $list = $("#eventList");
  $list.empty();

  $("#eventCount").text(appointments.length);

  if (appointments.length === 0) {
    $list.append(
      '<li class="agenda-item" style="color: var(--text-muted); font-size: 0.8rem;">No upcoming events</li>'
    );
    return;
  }

  appointments.sort(
    (a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)
  );

  appointments.forEach(app => {
    let timeDisplay = app.endTime 
      ? `${app.time} - ${app.endTime}` 
      : `${app.time} (${app.duration}h)`;

    let $item = $(`
      <li class="agenda-item">
        <div>
          <span class="agenda-title">${app.title}</span>
          <span class="agenda-meta">${app.date} · ${timeDisplay}</span>
        </div>
        <button class="btn-del" data-id="${app.id}" type="button">Remove</button>
      </li>
    `);
    $list.append($item);
  });
}

// ============================================================
//  GOOGLE SIGN-IN & USERS COLLECTION MANAGEMENT
// ============================================================
function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  currentUserId = payload.sub; // ใช้ Google ID เป็น UID แยกข้อมูล

  $("#loginContainer").hide();
  $("#userAvatar").attr("src", payload.picture);
  $("#userName").text(payload.name);
  $("#userInfo").css("display", "flex");

  // บันทึก/อัปเดตข้อมูลผู้ใช้ลง Collection 'users' ใน Database
  db.collection("users").doc(currentUserId).set({
    uid: currentUserId,
    email: payload.email,
    displayName: payload.name,
    photoURL: payload.picture,
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // โหลดข้อมูลแยกตามผู้ใช้นี้ (Events และ Stickers)
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
  renderEventList();
  renderQuickStickers();
  $("#dragPresetsSection").hide();
});