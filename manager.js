let collections = [];
let emails = [];
let result = {};
let removeName = ["zadif"];

function removeNames(collection) {
  for (let i = 0; i < collection.length; i++) {
    if (
      removeName.some((name) =>
        collection[i].name.toLowerCase().includes(name.toLowerCase())
      )
    ) {
      continue;
    }
    if (emails.includes(collection[i].email)) continue;
    emails.push(collection[i].email);
    collections.push(collection[i]);
  }
}
function calculateRevenue() {
  let revenue = 0;
  for (let col of collections) {
    if (col.subscription) {
      if (col.subscription.isPremium) {
        revenue += col.subscription.paymentHistory.length;
      }
    }
  }

  return revenue * 1000;
}
function calcualteAverageScore() {
  let average = [];
  for (let col of collections) {
    if (col.quizStats) {
      if (col.quizStats.averageScore === undefined) {
        continue;
      }
      for (let avg of col.quizStats.quizzes) {
        if (avg.score) average.push(avg.score);
      }
    }
  }

  //calcualting avg
  let ag = 0;
  for (let i of average) {
    ag += i;
  }
  ag /= average.length;

  return ag;
}

function accessedQuizes() {
  let accesed = 0;
  for (let col of collections) {
    if (col.quizStats) {
      accesed += col.quizStats.totalQuizzes;
    }
  }
  return accesed;
}

function overviewGenerator() {
  let overview = {};
  overview.totalUsers = collections.length;

  let revenue = calculateRevenue();
  overview.revenue = `PKR ${revenue}`;
  overview.ranking = 5;
  overview.averageTime = "30 min";
  overview.averageScore = calcualteAverageScore();
  overview.quizzesCompleted = accessedQuizes();

  return overview;
}

function settingGenrator() {
  let setting = {};
  setting.fontSize = "medium";
  setting.emailNotifications = true;
  setting.darkMode = true;
  return setting;
}

function categoriesGenerator() {
  let cat = {
    labels: [],
    data: [],
    quizCounts: [],
  };

  for (let col of collections) {
    if (col.quizHistory) {
      if (col.quizHistory) {
        for (let quiz of col.quizHistory) {
          cat.labels.push(quiz.title);
          cat.data.push(quiz.questions.length);
        }
      }
    }
  }

  let map = {};
  let order = [];

  cat.labels.forEach((key, i) => {
    if (!map[key]) {
      map[key] = { sum: 0, count: 0 };
      order.push(key); // preserve order
    }
    map[key].sum += cat.data[i];
    map[key].count++;
  });

  // Results in order
  let keys = order;
  let sums = order.map((k) => map[k].sum);
  let counts = order.map((k) => map[k].count);

  //   console.log(keys); // [1, 2, 3]
  //   console.log(sums); // [21, 6, 8]
  //   console.log(counts); // [3, 1, 1]

  cat.labels = keys;
  cat.data = sums;
  cat.quizCounts = counts;

  return cat;
}
function distributionGenerator(performance) {
  let col = {
    labels: [],
    data: [],
  };
  col.labels = performance.labels;
  col.data = performance.quizCounts;
  return col;
}

function monthlyRevenue() {
  let sym = {
    labels: [],
    data: [],
  };

  for (let col of collections) {
    if (col.subscription) {
      if (col.subscription.isPremium) {
        for (let payment of col.subscription.paymentHistory) {
          let monthName = new Date(payment.date).toLocaleString("en-US", {
            month: "long",
          });
          sym.labels.push(monthName);
          sym.data.push(payment.amount / 1000);
        }
      }
    }
  }
  let map = {};

  sym.labels.forEach((key, i) => {
    if (!map[key]) {
      map[key] = 0;
    }
    map[key] += sym.data[i];
  });

  sym.labels = Object.keys(map).map(String); // [1, 2, 3]
  sym.data = Object.values(map); // [21, 6, 8]

  return sym;
}

async function manager(collection) {
  removeNames(collection);
  result.overview = overviewGenerator();
  result.settings = settingGenrator();
  let categoryPerformance = categoriesGenerator();
  result.categories = categoryPerformance;
  result.subjectDistribution = distributionGenerator(categoryPerformance);
  result.monthlyRevenue = monthlyRevenue();

  return result;
}

export { manager };
