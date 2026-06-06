const sampleReport = {
  dateIso: "2026-06-06",
  report: {
    date: "06 June 2026",
    readTime: "Approx reading time: 2 minutes",
    fetchWindow: "Bundled sample report",
    fetchedAt: "Open the Next server to fetch live or archived reports",
    sections: [
      {
        source: "Dawn",
        status: "sample",
        scores: {
          State: 5,
          Opposition: 2.5,
          Reform: 3.5,
          Security: 3.5,
          "Civil liberties": 2.5
        },
        items: [
          {
            title: "Slow and steady healing",
            author: "Murad Moosa Khan",
            theme: "State",
            tone: "positive",
            summary: "casts state capacity as the central question; For countries like Pakistan, slow medicine is particularly relevant.",
            url: "https://www.dawn.com/news/2005595/slow-and-steady-healing",
            dateIso: "2026-06-06"
          },
          {
            title: "Is Islamic banking Islamic?",
            author: "Miftah Ismail",
            theme: "State",
            tone: "positive",
            summary: "casts state capacity as the central question; We should examine how close to Quranic edicts is Islamic banking.",
            url: "https://www.dawn.com/news/2005594/is-islamic-banking-islamic",
            dateIso: "2026-06-06"
          },
          {
            title: "Cooling cities",
            author: "Mohamed Yahya",
            theme: "Security",
            tone: "critical",
            summary: "treats the issue as a security and stability risk; Climate action must begin with redesigning our cities.",
            url: "https://www.dawn.com/news/2005593/cooling-cities",
            dateIso: "2026-06-06"
          }
        ]
      },
      {
        source: "The News International",
        status: "blocked",
        error: "No matching articles found for 06 June 2026",
        scores: {
          State: 0,
          Opposition: 0,
          Reform: 0,
          Security: 0,
          "Civil liberties": 0
        },
        items: []
      },
      {
        source: "The Express Tribune",
        status: "sample",
        scores: {
          State: 5,
          Opposition: 2.5,
          Reform: 2.5,
          Security: 2.5,
          "Civil liberties": 2.5
        },
        items: [
          {
            title: "Looming food crisis",
            author: "editorial",
            theme: "State",
            tone: "positive",
            summary: "casts state capacity as the central question; tracks the argument around looming food crisis and places it inside Pakistan's daily policy debate.",
            url: "https://tribune.com.pk/story/2611659/looming-food-crisis-2",
            dateIso: "2026-06-06"
          },
          {
            title: "Expanding settlements",
            author: "editorial",
            theme: "State",
            tone: "positive",
            summary: "casts state capacity as the central question; tracks the argument around expanding settlements and places it inside Pakistan's daily policy debate.",
            url: "https://tribune.com.pk/story/2611660/expanding-settlements",
            dateIso: "2026-06-06"
          },
          {
            title: "Minimum wage",
            author: "editorial",
            theme: "State",
            tone: "positive",
            summary: "casts state capacity as the central question; tracks the argument around minimum wage and places it inside Pakistan's daily policy debate.",
            url: "https://tribune.com.pk/story/2611661/minimum-wage-2",
            dateIso: "2026-06-06"
          }
        ]
      }
    ]
  }
};

export default sampleReport;
