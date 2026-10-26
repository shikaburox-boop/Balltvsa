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

// ✅ Helper Functions
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

  // ---- Main Form: Add Event ----
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
    
    // ✅ อ่านค่าสีจาก Radio Button
    let colorVal = $("input[name='eventColor']:checked").val();

    if (!titleVal) return;

    let startMinutes = timeToMinutes(startTimeVal);
    let endMinutes = timeToMinutes(endTimeVal);
    let durationVal = (endMinutes - startMinutes) / 60;

    if (durationVal <= 0) {
      alert("End time must be later than start time.");
      return;
    }

    // ✅ ถ้าไม่ได้เลือกสี ให้ Random สี
    if (!colorVal) {
      colorVal = getRandomColor();
    }

    let newEventData = {
      userId: currentUserId,
      date: dateVal,
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

    // ✅ อ่านค่าสีจาก Radio Button
    let color = $("input[name='stickerColor']:checked").val();

    if (!title) return;
    if (duration <= 0) {
      alert("Duration must be greater than 0.");
      return;
    }

    // ✅ ถ้าไม่ได้เลือกสี ให้ Random สี
    if (!color) {
      color = getRandomColor();
    }

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

  // ---- Delete Event (from Timeline or Banner) ----
  $(document).on("click", ".btn-del-banner, .btn-del-timeline", function (e) {
    e.stopPropagation();
    let idToDelete = $(this).data("id").toString();

    if (!confirm("Remove this event?")) return;

    db.collection("events").doc(idToDelete).delete()
      .then(() => {
        appointments = appointments.filter(app => app.id !== idToDelete);
        renderCalendar();
        renderEventList();
        showDayDetail(selectedDateStr);
      })
      .catch((error) => {
        console.error("Error removing event: ", error);
      });
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
        appointments.push(eventData);
      });
      renderCalendar();
      renderEventList();
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

    let dayEvents = appointments.filter(app => app.date === dateFormatted);
    let dashesHtml = "";
    
    if (dayEvents.length > 0) {
      dashesHtml = '<div class="event-dots">';
      dayEvents.slice(0, 3).forEach(evt => {
        let c = evt.color || "purple";
        dashesHtml += `<span class="event-dash dash-${c}"></span>`;
      });
      if (dayEvents.length > 3) {
        dashesHtml += `<span class="event-dash-more">+${dayEvents.length - 3}</span>`;
      }
      dashesHtml += '</div>';
    }

    let $cell = $(
      `<div class="${cellClass}" data-date="${dateFormatted}">
         <span class="cell-num">${day}</span>
         ${dashesHtml}
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

        let $sticker = $(`
          <div class="event-sticker-block sticker-${color}" 
               style="top: ${topPx}px; height: ${heightPx - 2}px; width: calc(${widthPercent}% - 80px); left: calc(${leftPercent}% + 74px);">
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
    
    let color = app.color || "purple";

    let $item = $(`
      <li class="agenda-item">
        <div>
          <span class="agenda-title">
            <span class="agenda-color-dot dot-${color}"></span>
            ${app.title}
          </span>
          <span class="agenda-meta">${app.date} · ${timeDisplay}</span>
        </div>
        <button class="btn-del" data-id="${app.id}" type="button">Remove</button>
      </li>
    `);
    $list.append($item);
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
  renderEventList();
  renderQuickStickers();
  $("#dragPresetsSection").hide();
});
