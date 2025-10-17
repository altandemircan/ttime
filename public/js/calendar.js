// Eğer global meta veri için ayrı obje kullanıyorsan:
window.tripDates = window.tripDates || { startDate: null, endDates: [] };

function reInitMaps() {
    let dayCounter = 1;
    const dayContainers = document.querySelectorAll('.day-container');

    dayContainers.forEach(dayContainer => {
        dayContainer.dataset.day = dayCounter; // Update the data-day attribute
        const dayHeader = dayContainer.querySelector('.day-header');
        dayHeader.textContent = `Day ${dayCounter}`;

        // Update the map element ID
        const mapElement = document.getElementById(`map-day-${dayCounter}`);
        if (mapElement) {
            mapElement.id = `map-day-${dayCounter}`;
        }
        dayCounter++;
    });
}

// Create Save Dates button outside openCalendar
const saveButton = document.createElement("button");
saveButton.textContent = "Save Dates";
saveButton.classList.add("save-dates-button");
saveButton.onclick = function() {
    // Takvim panelini kapat
    const calendarContainer = document.getElementById("calendar-container");
    calendarContainer.remove();
    document.body.classList.remove('calendar-open');

    // Trip tarihlerini window.cart'a yaz
    if (window.cart) {
        window.cart.startDate = window.tripDates.startDate;
        window.cart.endDates = window.tripDates.endDates;
    }

    updateCart();

};

function openCalendar(tripDuration) {
    const cartDiv = document.getElementById("cart-items");

    // Remove existing calendar if it exists
    const existingCalendar = document.getElementById("calendar-container");
    if (existingCalendar) {
        existingCalendar.remove();
    }

    const calendarContainer = document.createElement("div");
    calendarContainer.id = "calendar-container";

    const now = new Date();
    let currentMonth = now.getMonth();
    let currentYear = now.getFullYear();

    function generateCalendar(month, year) {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startingDay = firstDayOfMonth.getDay(); // Sunday: 0, Monday: 1, ... Saturday: 6

        let calendarHTML = `
            <div class="calendar-header">
                <button class="month-control" onclick="changeMonth(-1, ${tripDuration})">‹</button>
                <span>${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</span>
                <button class="month-control" onclick="changeMonth(1, ${tripDuration})">›</button>
            </div>
            <div class="calendar-grid">
        `;

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            calendarHTML += `<div class="calendar-day empty"></div>`;
        }

        // Add day cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            let isSelected = false;

            if (window.tripDates.startDate) {
                const startDate = new Date(window.tripDates.startDate);

                for (let i = 0; i < tripDuration; i++) {
                    const nextDate = new Date(startDate);
                    nextDate.setDate(startDate.getDate() + i);
                    if (currentDate.toDateString() === nextDate.toDateString()) {
                        isSelected = true;
                        break;
                    }
                }
            }

            calendarHTML += `
                <div class="calendar-day ${isSelected ? 'selected' : ''}" onclick="selectDate(${day}, ${month}, ${year}, ${tripDuration})">${day}</div>
            `;
        }

        calendarHTML += `</div>`;
        return calendarHTML;
    }

    const addToCalendarButton = document.querySelector(".add-to-calendar-btn");
    addToCalendarButton.disabled = true;
    document.body.classList.add('calendar-open');

    calendarContainer.innerHTML = generateCalendar(currentMonth, currentYear);
    calendarContainer.appendChild(saveButton);

    cartDiv.appendChild(calendarContainer);
}

function changeMonth(change, tripDuration) {
    const calendarContainer = document.getElementById("calendar-container");
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    currentMonth += change;

    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }

    function generateCalendar(month, year) {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startingDay = firstDayOfMonth.getDay(); // Sunday: 0, Monday: 1, ... Saturday: 6

        let calendarHTML = `
            <div class="calendar-header">
                <button class="month-control" onclick="changeMonth(-1, ${tripDuration})">‹</button>
                <span>${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</span>
                <button class="month-control" onclick="changeMonth(1, ${tripDuration})">›</button>
            </div>
            <div class="calendar-grid">
        `;

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            calendarHTML += `<div class="calendar-day empty"></div>`;
        }

        // Add day cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            let isSelected = false;

            if (window.tripDates.startDate) {
                const startDate = new Date(window.tripDates.startDate);

                for (let i = 0; i < tripDuration; i++) {
                    const nextDate = new Date(startDate);
                    nextDate.setDate(startDate.getDate() + i);
                    if (currentDate.toDateString() === nextDate.toDateString()) {
                        isSelected = true;
                        break;
                    }
                }
            }
            calendarHTML += `
                <div class="calendar-day ${isSelected ? 'selected' : ''}" onclick="selectDate(${day}, ${month}, ${year}, ${tripDuration})">${day}</div>
            `;
        }

        calendarHTML += `</div>`;
        return calendarHTML;
    }

    calendarContainer.innerHTML = generateCalendar(currentMonth, currentYear);
    const calendarDays = calendarContainer.querySelectorAll('.calendar-day');
    if (window.tripDates.startDate) {
        const startDate = new Date(window.tripDates.startDate);
        calendarDays.forEach(calendarDay => {
            const currentDate = new Date(currentYear, currentMonth, calendarDay.textContent);
            for (let i = 0; i < tripDuration; i++) {
                const nextDate = new Date(startDate);
                nextDate.setDate(startDate.getDate() + i);
                if (currentDate.toDateString() === nextDate.toDateString()) {
                    calendarDay.classList.add('selected');
                    break;
                } else {
                    calendarDay.classList.remove('selected');
                }
            }
        });
    }
    calendarContainer.appendChild(saveButton);
}

function selectDate(day, month, year, tripDuration) {
    console.log(`Trip plan assigned to start on: ${year}-${month + 1}-${day}`);
    const calendarContainer = document.getElementById("calendar-container");

    // Clear existing dates
    window.tripDates.startDate = null;
    window.tripDates.endDates = null;

    // Store the start date and calculate the end dates
    const startDate = new Date(year, month, day);
    const endDates = [];

    for (let i = 0; i < tripDuration; i++) {
        const nextDate = new Date(startDate);
        nextDate.setDate(startDate.getDate() + i);
        endDates.push(nextDate.toLocaleDateString());
    }

    // Store the start date and end dates in the tripDates object
    window.tripDates.startDate = startDate.toLocaleDateString();
    window.tripDates.endDates = endDates;

    // Update the button text to "Change Dates"
    const addToCalendarButton = document.querySelector(".add-to-calendar-btn");

    // Re-generate the calendar to show the selected dates
    const calendarDays = calendarContainer.querySelectorAll('.calendar-day');

    calendarDays.forEach(calendarDay => {
        const currentDate = new Date(year, month, calendarDay.textContent);
        for (let i = 0; i < tripDuration; i++) {
            const nextDate = new Date(startDate);
            nextDate.setDate(startDate.getDate() + i);
            if (currentDate.toDateString() === nextDate.toDateString()) {
                calendarDay.classList.add('selected');
                break;
            } else {
                calendarDay.classList.remove('selected');
            }
        }
    });

    const buttonText = window.tripDates.startDate
        ? `Change Dates (${window.tripDates.startDate} - ${window.tripDates.endDates[window.tripDates.endDates.length - 1]})`
        : "Select Dates (No date selected)";
    addToCalendarButton.textContent = buttonText;
}