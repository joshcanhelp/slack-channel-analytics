import "dotenv/config";

import slack from "@slack/bolt";
import { stringify } from "csv/sync";

import { readFileSync, writeFileSync } from "fs";
import { parseArgs } from "util";
import path from "path";

////
/// Constants
//

const {
  SLACK_CHANNEL_ID,
  SLACK_BOT_TOKEN,
  SLACK_SIGNING_SECRET,
  FILE_OUTPUT_DIR,
  DEBUG,
  OLDEST_MESSAGE_TIMESTAMP,
  DAYS_TO_STABLE_STATE = 5,
} = process.env;

if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID || !SLACK_SIGNING_SECRET) {
  console.log("❌ Missing required config");
  process.exit(1);
}

const app = new slack.App({
  token: SLACK_BOT_TOKEN,
  signingSecret: SLACK_SIGNING_SECRET,
});

const fileNameBase =
  new Date().toISOString().split(".")[0].replaceAll(":", "-") + "GMT-channel-analytics";

const excludedUsers = [
  "USLACKBOT", // Slackbot
  "U040ZRHT2KH", // y0da
];

const dataPoints = [
  {
    key: "date",
    header: "Date",
    type: "string",
  },
  {
    key: "total",
    header: "Total posts",
  },
  {
    key: "responses",
    header: "Total responses",
  },
  {
    key: "answered",
    header: "Posts answered",
  },
  {
    key: "abandoned",
    header: "Posts abandoned",
  },
  {
    key: "redirected",
    header: "Posts redirected",
  },
  {
    key: "unanswered",
    header: "Posts unanswered",
  },
  {
    key: "unmoderated",
    header: "Posts unmoderated",
  },
  {
    key: "joins",
    header: "Channel joins",
  },
  {
    key: "leaves",
    header: "Channel leaves",
  },
  {
    key: "reposts",
    header: "Reposts",
  },
  {
    key: "activeUsers",
    header: "Active users",
  },
  {
    key: "usersPosted",
    header: "Users who posted",
    type: "array",
  },
  {
    key: "usersResponded",
    header: "Users who responded",
    type: "array",
  },
];

const reactionMap = {
  answered: "white_check_mark",
  abandoned: "black_square_for_stop",
  redirected: "redirect",
  unanswered: "question",
};

////
/// Functions
//

const getFormattedDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  return `${yyyy}-${padLeftZero(mm)}-${padLeftZero(dd)}`;
};

const getNextDate = (formattedDate) => {
  const dateParts = formattedDate.split("-").map((number) => parseInt(number, 10));
  const nextDate = new Date();
  nextDate.setFullYear(dateParts[0]);
  nextDate.setMonth(dateParts[1] - 1);
  nextDate.setDate(dateParts[2] + 1);
  return getFormattedDate(nextDate);
};

const padLeftZero = (string) => {
  return `${string}`.length === 1 ? `0${string}` : `${string}`;
};

const reactionsInclude = (reactions, reaction) =>
  reactions && reactions.some((r) => r.name === reaction);

const sortByDateAsc = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

const makeEmptyDay = () => {
  const emptyDay = {};
  dataPoints.forEach((dp) => {
    emptyDay[dp.key] = dp.type === "string" ? "" : dp.type === "array" ? [] : 0;
  });
  return emptyDay;
};

////
/// Runtime
//

(async () => {
  try {
    const {
      outputDir = FILE_OUTPUT_DIR,
      inputJson,
      limit = 1000,
      debug = DEBUG,
    } = parseArgs({
      strict: true,
      options: {
        inputJson: {
          type: "string",
        },
        outputDir: {
          type: "string",
        },
        limit: {
          type: "string",
        },
        debug: {
          type: "boolean",
        },
      },
    }).values;

    const print = (text, type) => {
      if (!debug) {
        return;
      }
      switch (type) {
        case "skip":
          return console.log(`⏩ ${text}`);
        case "error":
          return console.log(`❌ ${text}`);
      }
      console.log(`🤖 ${text}`);
    };

    print(`Processing messages for channel ID ${SLACK_CHANNEL_ID}`);

    let slackData;
    if (inputJson) {
      print(`Reading from ${inputJson}`);
      slackData = readFileSync(inputJson, { encoding: "utf8" });
      slackData = JSON.parse(slackData);
    } else {
      print(`Getting fresh data from the Slack API`);
      slackData = await app.client.conversations.history({
        channel: SLACK_CHANNEL_ID,
        limit: parseInt(limit, 10),

        // 2022-10-31, first day is cut before CSV is built
        oldest: parseInt(OLDEST_MESSAGE_TIMESTAMP, 10),
      });
    }

    if (!inputJson && outputDir) {
      print(`Writing JSON to ${outputDir}`);
      writeFileSync(
        path.join(outputDir, `${fileNameBase}.json`),
        JSON.stringify(slackData, null, 2)
      );
    }

    if (!slackData.ok) {
      throw new Error(`Slack API returned ${slackData.error}`);
    }

    const { messages } = slackData;
    const totalMessages = messages.length;

    if (!totalMessages) {
      throw new Error(`No messages to process`);
    }

    const dailyStats = {};
    for (const msg of messages) {
      const { type, user, user_profile, ts, reply_users, reply_count, reactions, subtype } = msg;

      if (reactionsInclude(reactions, "no_entry")) {
        print(`Skipping skipped message ${ts} ...`, "skip");
        continue;
      }

      const tsFloat = parseFloat(ts);
      const tsDate = getFormattedDate(new Date(tsFloat * 1000));

      if (!dailyStats[tsDate]) {
        dailyStats[tsDate] = { ...makeEmptyDay(), date: tsDate };
      }

      if (subtype === "channel_join") {
        dailyStats[tsDate].joins++;
        continue;
      }

      if (subtype === "channel_leave") {
        dailyStats[tsDate].leaves++;
        continue;
      }

      if (subtype === "thread_broadcast") {
        dailyStats[tsDate].reposts++;
        continue;
      }

      if (subtype === "channel_topic") {
        continue;
      }

      if (excludedUsers.includes(user)) {
        print(`Skipping uncounted user ${user} for message ${ts}...`, "skip");
        continue;
      }

      if (type !== "message" || !user_profile) {
        print(`Skipping invalid message ${ts}...`, "skip");
        continue;
      }

      if (!dailyStats[tsDate].usersPosted.includes(user)) {
        dailyStats[tsDate].activeUsers++;
      }

      dailyStats[tsDate].usersPosted.push(user);

      if (reply_users && reply_users.length) {
        const filteredReplyUsers = reply_users.filter((user) => !excludedUsers.includes(user));
        dailyStats[tsDate].activeUsers += filteredReplyUsers.length;
        dailyStats[tsDate].usersResponded =
          dailyStats[tsDate].usersResponded.concat(filteredReplyUsers);

        // Adjust reply count by 1 per excluded user (not exact but ...)
        dailyStats[tsDate].responses +=
          reply_count - (reply_users.length - filteredReplyUsers.length);
      }

      // Should have filtered out everything we don't care about at this point
      dailyStats[tsDate].total += 1;

      let isModerated = false;
      Object.keys(reactionMap).forEach((statKey) => {
        if (reactionsInclude(reactions, reactionMap[statKey])) {
          dailyStats[tsDate][statKey]++;
          isModerated = true;
        }
      });
      if (!isModerated) {
        dailyStats[tsDate].unmoderated++;
      }
    }

    const collectedDays = Object.keys(dailyStats).sort(sortByDateAsc);

    print(`Returned ${totalMessages} messages`);
    print(`Returned ${collectedDays.length} days`);

    // Trim first day to ensure a complete starting day
    delete dailyStats[collectedDays[0]];

    // Trim the last day and days until stable
    let trimDays = parseInt(DAYS_TO_STABLE_STATE, 10) + 1;
    while (trimDays) {
      delete dailyStats[collectedDays[collectedDays.length - trimDays]];
      trimDays--;
    }

    const adjustedDays = Object.keys(dailyStats);

    // Add rows for dates where there were no posts
    let datePointer = adjustedDays[0];
    while (datePointer !== adjustedDays[adjustedDays.length - 1]) {
      if (!adjustedDays.includes(datePointer)) {
        dailyStats[datePointer] = { ...makeEmptyDay(), date: datePointer };
      }
      datePointer = getNextDate(datePointer);
    }

    const csvData = Object.values(dailyStats)
      .map((day) => ({
        ...day,
        usersPosted: day.usersPosted.join(" "),
        usersResponded: day.usersResponded.join(" "),
      }))
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    const csvString = stringify(csvData, { columns: dataPoints, header: true });
    if (outputDir) {
      const csvFilePath = path.join(outputDir, `${fileNameBase}.csv`);
      print(`Writing data to ${csvFilePath}`);
      writeFileSync(csvFilePath, csvString);
    } else {
      console.log(csvString);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
})();
