/**
 * Reading Progress Tracker - Pure Business & Analytical Logic
 * Supports UMD / CommonJS exports for Node.js unit testing.
 */

function calculateBookProgress(book) {
  if (!book) return { percentage: 0, remainingPages: 0, isCompleted: false };

  const totalPages = Math.max(0, parseInt(book.totalPages, 10) || 0);
  const currentPage = Math.min(
    totalPages,
    Math.max(0, parseInt(book.currentPage, 10) || 0)
  );

  let percentage = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;
  percentage = parseFloat(percentage.toFixed(1));

  const remainingPages = Math.max(0, totalPages - currentPage);
  const isCompleted = totalPages > 0 && currentPage >= totalPages;

  return {
    currentPage,
    totalPages,
    percentage,
    remainingPages,
    isCompleted,
  };
}

function estimateCompletionDate(
  book,
  sessions = [],
  defaultVelocityPagesPerDay = 25
) {
  const progress = calculateBookProgress(book);

  if (progress.isCompleted || progress.remainingPages <= 0) {
    return {
      estimatedDate: null,
      daysRemaining: 0,
      dailyVelocity: 0,
      status: "completed",
    };
  }

  // Filter sessions for this specific book
  const bookSessions = Array.isArray(sessions)
    ? sessions.filter(s => String(s.bookId) === String(book.id))
    : [];

  let dailyVelocity = 0;

  if (bookSessions.length > 0) {
    // Sort sessions by date
    const sorted = [...bookSessions].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    const totalPagesInSessions = sorted.reduce(
      (sum, s) => sum + (parseInt(s.pagesRead, 10) || 0),
      0
    );

    // Calculate date span in days
    const firstDate = new Date(sorted[0].date);
    const lastDate = new Date(sorted[sorted.length - 1].date);
    const dayDiff = Math.max(
      1,
      Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1
    );

    dailyVelocity = totalPagesInSessions / dayDiff;
  }

  // Fallback to overall session velocity if book has no specific velocity, or default parameter
  if (dailyVelocity <= 0 && Array.isArray(sessions) && sessions.length > 0) {
    const totalPagesAll = sessions.reduce(
      (sum, s) => sum + (parseInt(s.pagesRead, 10) || 0),
      0
    );
    const dates = sessions.map(s => new Date(s.date)).filter(d => !isNaN(d));
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));
      const daySpan = Math.max(
        1,
        Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1
      );
      dailyVelocity = totalPagesAll / daySpan;
    }
  }

  if (dailyVelocity <= 0) {
    dailyVelocity = defaultVelocityPagesPerDay;
  }

  dailyVelocity = parseFloat(dailyVelocity.toFixed(1));

  const daysRemaining = Math.ceil(progress.remainingPages / dailyVelocity);

  // Calculate target estimated date from current date (or reference date)
  const today = new Date();
  const estDateObj = new Date(today);
  estDateObj.setDate(estDateObj.getDate() + daysRemaining);

  const year = estDateObj.getFullYear();
  const month = String(estDateObj.getMonth() + 1).padStart(2, "0");
  const day = String(estDateObj.getDate()).padStart(2, "0");

  return {
    estimatedDate: `${year}-${month}-${day}`,
    daysRemaining,
    dailyVelocity,
    status: "in-progress",
  };
}

function calculateReadingStreak(sessions = []) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Extract unique sorted dates (YYYY-MM-DD)
  const uniqueDates = Array.from(
    new Set(
      sessions.map(s => (s.date ? s.date.split("T")[0] : null)).filter(Boolean)
    )
  ).sort();

  if (uniqueDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let previousDate = null;

  for (let i = 0; i < uniqueDates.length; i++) {
    const currentDate = new Date(uniqueDates[i]);
    currentDate.setHours(0, 0, 0, 0);

    if (!previousDate) {
      tempStreak = 1;
    } else {
      const diffTime = currentDate - previousDate;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }

    previousDate = currentDate;
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }

  // Check if current streak extends to today or yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastSessionDate = new Date(uniqueDates[uniqueDates.length - 1]);
  lastSessionDate.setHours(0, 0, 0, 0);

  const diffToToday = Math.round(
    (today - lastSessionDate) / (1000 * 60 * 60 * 24)
  );

  if (diffToToday <= 1) {
    currentStreak = tempStreak;
  } else {
    currentStreak = 0;
  }

  return { currentStreak, longestStreak };
}

function calculateReadingStats(books = [], sessions = []) {
  const safeBooks = Array.isArray(books) ? books : [];
  const safeSessions = Array.isArray(sessions) ? sessions : [];

  const totalBooks = safeBooks.length;
  let completedBooks = 0;
  let currentlyReading = 0;
  let wantToRead = 0;

  const genreBreakdown = {};

  safeBooks.forEach(b => {
    const status =
      b.status || (b.currentPage >= b.totalPages ? "completed" : "reading");
    if (status === "completed") completedBooks++;
    else if (status === "reading") currentlyReading++;
    else if (status === "want-to-read") wantToRead++;

    const genre = b.genre || "Uncategorized";
    genreBreakdown[genre] = (genreBreakdown[genre] || 0) + 1;
  });

  let totalPagesRead = 0;
  let totalReadingMinutes = 0;
  const monthlyPages = {};

  safeSessions.forEach(s => {
    const pages = parseInt(s.pagesRead, 10) || 0;
    const minutes = parseInt(s.durationMinutes, 10) || 0;
    totalPagesRead += pages;
    totalReadingMinutes += minutes;

    if (s.date) {
      const yearMonth = s.date.substring(0, 7); // 'YYYY-MM'
      monthlyPages[yearMonth] = (monthlyPages[yearMonth] || 0) + pages;
    }
  });

  const totalHours = totalReadingMinutes / 60;
  const averageSpeedPagesPerHour =
    totalHours > 0 ? parseFloat((totalPagesRead / totalHours).toFixed(1)) : 0;

  const streakInfo = calculateReadingStreak(safeSessions);

  return {
    totalBooks,
    completedBooks,
    currentlyReading,
    wantToRead,
    totalPagesRead,
    totalReadingMinutes,
    totalHours: parseFloat(totalHours.toFixed(1)),
    averageSpeedPagesPerHour,
    genreBreakdown,
    monthlyPages,
    currentStreak: streakInfo.currentStreak,
    longestStreak: streakInfo.longestStreak,
  };
}

function exportTrackerData(books, sessions) {
  const data = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    books: Array.isArray(books) ? books : [],
    sessions: Array.isArray(sessions) ? sessions : [],
  };
  return JSON.stringify(data, null, 2);
}

function importTrackerData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON data format.");
    }
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch (err) {
    throw new Error(`Import failed: ${err.message}`);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    calculateBookProgress,
    estimateCompletionDate,
    calculateReadingStreak,
    calculateReadingStats,
    exportTrackerData,
    importTrackerData,
  };
}
