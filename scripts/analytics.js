import "dotenv/config";

import { stringify } from "csv/sync";

import { readFileSync, writeFileSync } from "fs";
import path from "path";

import cliArgs from "../src/cli-args.js";
import { getConversations } from "../src/slack.js";
import { fileNameBase, getFormattedDate, getNextDate, makeEmptyDay, reactionsInclude, sortByDateAsc } from "../src/utilities.js";
import { analyticsDataPoints, excludedUsers, reactionMap } from "../src/constants.js";

const {
  SLACK_CHANNEL_ID,
  DAYS_TO_STABLE_STATE = 5,
} = process.env;

(async () => {
  try {
    const { outputDir, inputJson, limit, debug } = cliArgs;

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
      slackData = await getConversations(parseInt(limit, 10));
    }

    if (!inputJson && outputDir) {
      print(`Writing JSON to ${outputDir}`);
      writeFileSync(
        path.join(outputDir, `${fileNameBase("analytics")}.json`),
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
    print(`Starting trim ...`);
    while (trimDays) {
      delete dailyStats[collectedDays[collectedDays.length - trimDays]];
      trimDays--;
    }

    const adjustedDays = Object.keys(dailyStats).sort(sortByDateAsc);

    // Add rows for dates where there were no posts
    let datePointer = adjustedDays[0];
    print(`Starting date fill-out ...`);
    while (datePointer !== adjustedDays[adjustedDays.length - 1]) {
      if (!adjustedDays.includes(datePointer)) {
        dailyStats[datePointer] = { ...makeEmptyDay(), date: datePointer };
      }
      datePointer = getNextDate(datePointer);
    }

    const csvData = Object.values(dailyStats)
      .map((day) => {
        const dayTransformed = { ...day };
        dayTransformed.answerPercent = !day.total ? 1 : Math.round(day.answered / day.total * 100) / 100;
        dayTransformed.usersPosted = day.usersPosted.join(" ")
        dayTransformed.usersResponded = day.usersResponded.join(" ")
        return dayTransformed;
      })
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    const csvString = stringify(csvData, { columns: analyticsDataPoints, header: true });
    if (outputDir) {
      const csvFilePath = path.join(outputDir, `${fileNameBase("analytics")}.csv`);
      print(`Writing data to ${csvFilePath}`);
      writeFileSync(csvFilePath, csvString);
    } else {
      console.log(csvString);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
})();
