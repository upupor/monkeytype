import * as Misc from "../utils/misc";
import Page from "./page";
import Ape from "../ape";
import * as Notifications from "../elements/notifications";
import * as ChartController from "../controllers/chart-controller";
import * as ConnectionState from "../states/connection";
import intervalToDuration from "date-fns/intervalToDuration";

function reset(): void {
  $(".pageAbout .contributors").empty();
  $(".pageAbout .supporters").empty();
  ChartController.globalSpeedHistogram.data.datasets[0].data = [];
  ChartController.globalSpeedHistogram.updateColors();
}

let speedStatsResponseData: any | undefined;
let typingStatsResponseData: any | undefined;

function updateStatsAndHistogram(): void {
  if (!speedStatsResponseData && !typingStatsResponseData) {
    return;
  }
  ChartController.globalSpeedHistogram.updateColors();
  const bucketedSpeedStats = getHistogramDataBucketed(speedStatsResponseData);
  ChartController.globalSpeedHistogram.data.labels = bucketedSpeedStats.labels;
  ChartController.globalSpeedHistogram.data.datasets[0].data =
    bucketedSpeedStats.data;

  const secondsRounded = Math.round(typingStatsResponseData.timeTyping);

  const timeTypingDuration = intervalToDuration({
    start: 0,
    end: secondsRounded * 1000,
  });

  $(".pageAbout #totalTimeTypingStat .val").text(
    timeTypingDuration.years?.toString() ?? ""
  );
  $(".pageAbout #totalTimeTypingStat .valSmall").text("years");
  $(".pageAbout #totalTimeTypingStat").attr(
    "aria-label",
    Math.round(secondsRounded / 3600) + " hours"
  );

  $(".pageAbout #totalStartedTestsStat .val").text(
    Math.round(typingStatsResponseData.testsStarted / 1000000)
  );
  $(".pageAbout #totalStartedTestsStat .valSmall").text("million");
  $(".pageAbout #totalStartedTestsStat").attr(
    "aria-label",
    typingStatsResponseData.testsStarted + " tests"
  );

  $(".pageAbout #totalCompletedTestsStat .val").text(
    Math.round(typingStatsResponseData.testsCompleted / 1000000)
  );
  $(".pageAbout #totalCompletedTestsStat .valSmall").text("million");
  $(".pageAbout #totalCompletedTestsStat").attr(
    "aria-label",
    typingStatsResponseData.testsCompleted + " tests"
  );
}

async function getStatsAndHistogramData(): Promise<void> {
  if (speedStatsResponseData && typingStatsResponseData) {
    return;
  }

  if (!ConnectionState.get()) {
    Notifications.add("Cannot update all time stats - offline", 0);
    return;
  }

  const speedStats = await Ape.publicStats.getSpeedHistogram({
    language: "english",
    mode: "time",
    mode2: "60",
  });
  if (speedStats.status >= 200 && speedStats.status < 300) {
    speedStatsResponseData = speedStats.data;
  } else {
    Notifications.add(
      `Failed to get global speed stats for histogram: ${speedStats.message}`,
      -1
    );
  }
  const typingStats = await Ape.publicStats.getTypingStats();
  if (typingStats.status >= 200 && typingStats.status < 300) {
    typingStatsResponseData = typingStats.data;
  } else {
    Notifications.add(
      `Failed to get global typing stats: ${speedStats.message}`,
      -1
    );
  }
}

async function fill(): Promise<void> {
  const supporters = await Misc.getSupportersList();
  const contributors = await Misc.getContributorsList();

  await getStatsAndHistogramData();
  updateStatsAndHistogram();

  supporters.forEach((supporter) => {
    $(".pageAbout .supporters").append(`
      <div>${supporter}</div>
    `);
  });
  contributors.forEach((contributor) => {
    $(".pageAbout .contributors").append(`
      <div>${contributor}</div>
    `);
  });
}

export const page = new Page(
  "about",
  $(".page.pageAbout"),
  "/about",
  async () => {
    //
  },
  async () => {
    reset();
  },
  async () => {
    fill();
  },
  async () => {
    //
  }
);

/** Convert histogram data to the format required to draw a bar chart. */
function getHistogramDataBucketed(data: Record<string, number>): {
  data: { x: number; y: number }[];
  labels: string[];
} {
  const histogramChartDataBucketed: { x: number; y: number }[] = [];
  const labels: string[] = [];

  const keys = Object.keys(data).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10)
  );
  for (let i = 0; i < keys.length; i++) {
    const bucket = parseInt(keys[i], 10);
    histogramChartDataBucketed.push({
      x: bucket,
      y: data[bucket],
    });
    labels.push(`${bucket} - ${bucket + 9}`);
    if (bucket + 10 != parseInt(keys[i + 1], 10)) {
      for (let j = bucket + 10; j < parseInt(keys[i + 1], 10); j += 10) {
        histogramChartDataBucketed.push({ x: j, y: 0 });
        labels.push(`${j} - ${j + 9}`);
      }
    }
  }
  return { data: histogramChartDataBucketed, labels };
}
